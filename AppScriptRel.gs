/**
 * ============================================================================
 * BACKEND PWA - MIGRAÇÃO PARA POSTGRESQL
 * ============================================================================
 */

// ============================================================================
// CREDENCIAIS DO BANCO DE DADOS (INSIRA AQUI SEUS DADOS)
// ============================================================================
const DB_URL = 'jdbc:postgresql://aws-1-sa-east-1.pooler.supabase.com:6543/postgres?user=postgres.usnyxftbhgglpbdkppsj&password=[YOUR-PASSWORD]';
const DB_USER = 'postgres.usnyxftbhgglpbdkppsj';
const DB_PASS = '70hhrIcCGVViu6to';

// Configurações gerais do sistema
const CONFIG = {
  TIMEOUT_INATIVIDADE: 20 * 60 * 1000, 
  MAX_LINHAS_HISTORICO: 16,
  MAX_CARACTERES_HISTORICO: 1400,
  ID_PASTA_ANEXOS: "1BrN9zxFViGbQu0ZDp0MzVDIZ0lKAYqxP"
};

/**
 * Função utilitária para abrir a conexão com o PostgreSQL
 */
function getDbConnection() {
  return Jdbc.getConnection(DB_URL, DB_USER, DB_PASS);
}

// ============================================================================
// MÓDULO: LOGS - Registro de acessos
// ============================================================================
const LogModule = {
  registrarAcesso: function(email, acao, detalhes, endpoint, imei, localizacaoGps) {
    let conn, stmt;
    try {
      conn = getDbConnection();
      const sql = 'INSERT INTO log_acessos (timestamp, email, acao, detalhes, endpoint, imei, localizacao_gps) VALUES (?, ?, ?, ?, ?, ?, ?)';
      stmt = conn.prepareStatement(sql);
      const dataFormatada = Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd HH:mm:ss");
      
      stmt.setString(1, dataFormatada);
      stmt.setString(2, email || 'Anonimo');
      stmt.setString(3, acao);
      stmt.setString(4, detalhes || '');
      stmt.setString(5, endpoint || 'N/A');
      stmt.setString(6, imei || '');
      stmt.setString(7, localizacaoGps || '');
      stmt.execute();
    } catch (e) {
      Logger.log('Erro ao registrar log: ' + e.message);
    } finally {
      if (stmt) stmt.close();
      if (conn) conn.close();
    }
  },
  
  consultarLogs: function(filtroEmail, dataInicio, dataFim) {
    let conn, stmt, rs;
    const resultados = [];
    try {
      conn = getDbConnection();
      let sql = 'SELECT * FROM log_acessos WHERE 1=1';
      let paramIndex = 1;
      
      if (filtroEmail) sql += ` AND email = ?`;
      if (dataInicio) sql += ` AND timestamp >= ?`;
      if (dataFim) sql += ` AND timestamp <= ?`;
      
      sql += ' ORDER BY timestamp DESC';
      stmt = conn.prepareStatement(sql);
      
      if (filtroEmail) stmt.setString(paramIndex++, filtroEmail);
      if (dataInicio) stmt.setString(paramIndex++, dataInicio + ' 00:00:00');
      if (dataFim) stmt.setString(paramIndex++, dataFim + ' 23:59:59');
      
      rs = stmt.executeQuery();
      while (rs.next()) {
        resultados.push({
          timestamp: Utilities.formatDate(new Date(rs.getString('timestamp')), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss"),
          email: rs.getString('email'),
          acao: rs.getString('acao'),
          detalhes: rs.getString('detalhes'),
          endpoint: rs.getString('endpoint'),
          imei: rs.getString('imei'),
          localizacaoGps: rs.getString('localizacao_gps')
        });
      }
    } catch(e) {
      Logger.log('Erro consultar logs: ' + e.message);
    } finally {
      if (rs) rs.close(); if (stmt) stmt.close(); if (conn) conn.close();
    }
    return resultados;
  }
};

// ============================================================================
// INSPEÇÕES VEICULARES
// ============================================================================
function salvarInspecao(dadosJson) {
  let conn, stmt;
  try {
    conn = getDbConnection();
    const dataHora = Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd HH:mm:ss");
    const { carro, terminal, fiscal, thoreb, elevador, limpeza, ventilador } = dadosJson;
    
    const sql = `INSERT INTO inspecoes_veiculares 
      (data_hora, carro, terminal, fiscal, thoreb_status, thoreb_obs, elevador_status, elevador_obs, limpeza_status, limpeza_obs, ventilador_status, ventilador_obs, ventilador_posicao) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
       
    stmt = conn.prepareStatement(sql);
    stmt.setString(1, dataHora);
    stmt.setString(2, carro || '');
    stmt.setString(3, terminal || '');
    stmt.setString(4, fiscal || '');
    stmt.setString(5, thoreb?.status || "");
    stmt.setString(6, thoreb?.obs || "");
    stmt.setString(7, elevador?.status || "");
    stmt.setString(8, elevador?.obs || "");
    stmt.setString(9, limpeza?.status || "");
    stmt.setString(10, limpeza?.obs || "");
    stmt.setString(11, ventilador?.status || "");
    stmt.setString(12, ventilador?.obs || "");
    stmt.setString(13, ventilador?.posicao || "");
    
    stmt.execute();
    return true;
  } catch (e) {
    Logger.log("Erro salvarInspecao: " + e.message);
    return false;
  } finally {
    if (stmt) stmt.close(); if (conn) conn.close();
  }
}

function consultarInspecoes(fiscalNome, dataInicio, dataFim, carro, fiscalFiltro) {
  let conn, stmt, rs;
  const resultados = [];
  try {
    conn = getDbConnection();
    let sql = 'SELECT * FROM inspecoes_veiculares WHERE 1=1';
    let params = [];
    
    if (dataInicio) { sql += ' AND data_hora >= ?'; params.push(dataInicio + ' 00:00:00'); }
    if (dataFim) { sql += ' AND data_hora <= ?'; params.push(dataFim + ' 23:59:59'); }
    if (carro) { sql += ' AND carro ILIKE ?'; params.push('%' + carro + '%'); }
    if (fiscalFiltro) { sql += ' AND fiscal = ?'; params.push(fiscalFiltro); }
    if (fiscalNome) { sql += ' AND fiscal = ?'; params.push(fiscalNome); }
    
    sql += ' ORDER BY data_hora DESC';
    stmt = conn.prepareStatement(sql);
    for (let i = 0; i < params.length; i++) stmt.setString(i + 1, params[i]);
    
    rs = stmt.executeQuery();
    while (rs.next()) {
      let dataHoraBanco = rs.getString('data_hora');
      let dataHoraFormatada = Utilities.formatDate(new Date(dataHoraBanco), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");
      
      resultados.push({
        dataHora: dataHoraFormatada,
        dataPreenchimento: dataHoraFormatada.split(" ")[0],
        carro: rs.getString('carro'),
        terminal: rs.getString('terminal'),
        fiscal: rs.getString('fiscal'),
        thoreb: { status: rs.getString('thoreb_status'), obs: rs.getString('thoreb_obs') },
        elevador: { status: rs.getString('elevador_status'), obs: rs.getString('elevador_obs') },
        limpeza: { status: rs.getString('limpeza_status'), obs: rs.getString('limpeza_obs') },
        ventilador: { status: rs.getString('ventilador_status'), obs: rs.getString('ventilador_obs'), posicao: rs.getString('ventilador_posicao') }
      });
    }
  } catch (err) {
    Logger.log("Erro consultarInspecoes: " + err.message);
  } finally {
    if (rs) rs.close(); if (stmt) stmt.close(); if (conn) conn.close();
  }
  return resultados;
}

// ============================================================================
// TACÓGRAFOS
// ============================================================================
function salvarTacografoCadastro(dadosJson) {
  let conn, stmt;
  try {
    conn = getDbConnection();
    const dataHora = Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd HH:mm:ss");
    const { fiscal, terminal, linha, carro, motorista } = dadosJson;
    
    const sql = `INSERT INTO tacografo_cadastros (data_hora, fiscal, terminal, linha, carro, motorista) VALUES (?, ?, ?, ?, ?, ?)`;
    stmt = conn.prepareStatement(sql);
    stmt.setString(1, dataHora);
    stmt.setString(2, fiscal || '');
    stmt.setString(3, terminal || '');
    stmt.setString(4, linha || '');
    stmt.setString(5, carro || '');
    stmt.setString(6, motorista || '');
    
    stmt.execute();
    return true;
  } catch (e) {
    Logger.log("Erro salvarTacografoCadastro: " + e.message);
    return false;
  } finally {
    if (stmt) stmt.close(); if (conn) conn.close();
  }
}

function consultarTacografos(fiscalNome, dataInicio, dataFim, carro, fiscalFiltro) {
  let conn, stmt, rs;
  const resultados = [];
  try {
    conn = getDbConnection();
    let sql = 'SELECT * FROM tacografo_cadastros WHERE 1=1';
    let params = [];
    
    if (dataInicio) { sql += ' AND data_hora >= ?'; params.push(dataInicio + ' 00:00:00'); }
    if (dataFim) { sql += ' AND data_hora <= ?'; params.push(dataFim + ' 23:59:59'); }
    if (carro) { sql += ' AND carro ILIKE ?'; params.push('%' + carro + '%'); }
    if (fiscalFiltro) { sql += ' AND fiscal = ?'; params.push(fiscalFiltro); }
    if (fiscalNome) { sql += ' AND fiscal = ?'; params.push(fiscalNome); }
    
    sql += ' ORDER BY data_hora DESC';
    stmt = conn.prepareStatement(sql);
    for (let i = 0; i < params.length; i++) stmt.setString(i + 1, params[i]);
    
    rs = stmt.executeQuery();
    while (rs.next()) {
      let dataHoraFormatada = Utilities.formatDate(new Date(rs.getString('data_hora')), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");
      resultados.push({
        dataHora: dataHoraFormatada,
        dataPreenchimento: dataHoraFormatada.split(" ")[0],
        fiscal: rs.getString('fiscal'),
        terminal: rs.getString('terminal'),
        linha: rs.getString('linha'),
        carro: rs.getString('carro'),
        motorista: rs.getString('motorista')
      });
    }
  } catch (err) {
    Logger.log("Erro consultarTacografos: " + err.message);
  } finally {
    if (rs) rs.close(); if (stmt) stmt.close(); if (conn) conn.close();
  }
  return resultados;
}

// ============================================================================
// ENVIOS DE INFORMAÇÕES (COM DRIVE)
// ============================================================================
function salvarEnvioInformacoes(dadosJson) {
  const dataHoraBanco = Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd HH:mm:ss");
  const { areaDestino, motivo, carro, linha, motorista, cobrador, hora, sentido, historico, local, data, fiscal, anexos, dataPreenchimento } = dadosJson;
  const historicoTruncado = truncarTexto(historico || '');
  let linksAnexos = [];

  // 1. Processamento e salvamento de anexos no Google Drive (MANTIDO INTACTO)
  if (anexos && Array.isArray(anexos) && anexos.length) {
    const pasta = DriveApp.getFolderById(CONFIG.ID_PASTA_ANEXOS);
    for (let i = 0; i < anexos.length; i++) {
      try {
        const dadosDecodificados = Utilities.base64Decode(anexos[i].base64);
        const sufixo = Utilities.formatDate(new Date(), "America/Sao_Paulo", "ddMMyyyy_HHmmss") + `_${i+1}`;
        const extensao = anexos[i].mimeType.includes("pdf") ? ".pdf" : ".jpg";
        const nomeArquivo = (carro ? `Carro${carro}_` : "Anexo_") + sufixo + extensao;
        const blob = Utilities.newBlob(dadosDecodificados, anexos[i].mimeType, nomeArquivo);
        const arquivoDrive = pasta.createFile(blob);
        arquivoDrive.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        linksAnexos.push(arquivoDrive.getUrl());
      } catch (err) {
        linksAnexos.push(`ERRO: ${err.message}`);
      }
    }
  }
  const linkFinal = linksAnexos.join(" ; ");

  // 2. Gravação no PostgreSQL
  let conn, stmt;
  try {
    conn = getDbConnection();
    const sql = `INSERT INTO envios_informacoes 
      (data_hora, fiscal, area_destino, motivo, carro, linha, motorista, cobrador, hora, sentido, historico, local, data, anexos, data_preenchimento) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      
    stmt = conn.prepareStatement(sql);
    stmt.setString(1, dataHoraBanco);
    stmt.setString(2, fiscal || '');
    stmt.setString(3, areaDestino || '');
    stmt.setString(4, motivo || '');
    stmt.setString(5, carro || '');
    stmt.setString(6, linha || '');
    stmt.setString(7, motorista || '');
    stmt.setString(8, cobrador || '');
    stmt.setString(9, hora || '');
    stmt.setString(10, sentido || '');
    stmt.setString(11, historicoTruncado);
    stmt.setString(12, local || '');
    stmt.setString(13, data || '');
    stmt.setString(14, linkFinal);
    stmt.setString(15, dataPreenchimento || '');
    stmt.execute();
    return true;
  } catch (e) {
    Logger.log("Erro salvarEnvioInformacoes: " + e.message);
    return false;
  } finally {
    if (stmt) stmt.close(); if (conn) conn.close();
  }
}

function consultarEnvios(fiscalNome, dataInicio, dataFim, motivo, carro, prefixo, fiscalFiltro, papel, apelido) {
  let conn, stmt, rs;
  const resultados = [];
  try {
    conn = getDbConnection();
    
    // 1. Carrega papéis para a lógica de permissões complexa
    const stmtRoles = conn.createStatement();
    const rsRoles = stmtRoles.executeQuery("SELECT apelido, funcao FROM login WHERE funcao IN ('FISCAL', 'INSPETOR')");
    const fiscaisSet = new Set();
    const inspetoresSet = new Set();
    while (rsRoles.next()) {
      let func = rsRoles.getString('funcao').toUpperCase();
      let apel = rsRoles.getString('apelido');
      if (func === 'FISCAL') fiscaisSet.add(apel);
      if (func === 'INSPETOR') inspetoresSet.add(apel);
    }
    rsRoles.close(); stmtRoles.close();

    // 2. Monta consulta principal
    let sql = 'SELECT * FROM envios_informacoes WHERE 1=1';
    let params = [];
    
    if (fiscalNome) { sql += ' AND fiscal = ?'; params.push(fiscalNome); }
    if (fiscalFiltro) { sql += ' AND fiscal = ?'; params.push(fiscalFiltro); }
    if (motivo) { sql += ' AND motivo = ?'; params.push(motivo); }
    if (carro) { sql += ' AND carro = ?'; params.push(carro); }
    if (prefixo) { sql += ' AND carro ILIKE ?'; params.push('%' + prefixo + '%'); }
    
    // Tratamento de Datas na Consulta SQL
    if (dataInicio && dataFim) {
      sql += ' AND data_hora >= ? AND data_hora <= ?';
      params.push(dataInicio + ' 00:00:00', dataFim + ' 23:59:59');
    } else if (!dataInicio && !dataFim) {
      const quatroDias = new Date();
      quatroDias.setDate(quatroDias.getDate() - 4);
      sql += ' AND data_hora >= ?';
      params.push(Utilities.formatDate(quatroDias, "America/Sao_Paulo", "yyyy-MM-dd") + ' 00:00:00');
    }
    
    sql += ' ORDER BY data_hora DESC';
    stmt = conn.prepareStatement(sql);
    for (let i = 0; i < params.length; i++) stmt.setString(i + 1, params[i]);
    
    rs = stmt.executeQuery();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    while (rs.next()) {
      let dataHoraStr = rs.getString('data_hora');
      let dataHoraDate = new Date(dataHoraStr);
      let diffDias = Math.floor((hoje - dataHoraDate) / (1000 * 60 * 60 * 24));
      
      let fiscalLinha = rs.getString('fiscal');
      let area = rs.getString('area_destino');
      let motivoEnvio = rs.getString('motivo');
      let permitido = false;
      
      // REGRAS DE PERMISSÃO
      switch (papel) {
        case 'FISCAL': 
          permitido = (fiscalLinha === apelido); 
          if (diffDias > 30) permitido = false;
          break;
        case 'INSPETOR':
          if (fiscalLinha === apelido || (fiscaisSet.has(fiscalLinha) && motivoEnvio !== 'PEDIDO DE FOLGAS')) permitido = true;
          if (diffDias > 60) permitido = false;
          break;
        case 'ENCARREGADO':
        case 'GERENTE':
        case 'ADMIN':
          permitido = true;
          if (papel !== 'ADMIN' && diffDias > 90) permitido = false;
          break;
        case 'SAF':
          if (area === 'SAF' || motivoEnvio === 'AVARIAS') permitido = true;
          break;
      }
      
      if (permitido) {
        // Tratamento de anexos mantido
        let anexosProcessados = [];
        const anexoRaw = rs.getString('anexos');
        if (anexoRaw && anexoRaw !== "Nenhum" && anexoRaw.trim() !== "") {
          const links = anexoRaw.split(" ; ");
          for (let j = 0; j < links.length; j++) {
            const linkOriginal = links[j].trim();
            if (linkOriginal) {
              let fileId = null;
              var regexes = [/\/d\/([a-zA-Z0-9_-]+)/, /id=([a-zA-Z0-9_-]+)/, /file\/d\/([a-zA-Z0-9_-]+)/];
              for(let r of regexes) {
                let match = linkOriginal.match(r);
                if (match && match[1]) { fileId = match[1]; break; }
              }
              if (fileId) {
                anexosProcessados.push({
                  urlOriginal: linkOriginal,
                  urlDownload: "https://drive.google.com/uc?export=download&id=" + fileId,
                  urlVisualizacao: "https://drive.google.com/file/d/" + fileId + "/view",
                  fileId: fileId
                });
              } else {
                anexosProcessados.push({ urlOriginal: linkOriginal, urlDownload: linkOriginal, urlVisualizacao: linkOriginal, fileId: null });
              }
            }
          }
        }
        
        let dataCampo = rs.getString('data');
        let dataPreenchFinal = rs.getString('data_preenchimento');
        if (!dataPreenchFinal) dataPreenchFinal = dataCampo ? formatarDataRaw(dataCampo) : Utilities.formatDate(dataHoraDate, "America/Sao_Paulo", "dd/MM/yyyy");

        resultados.push({
          areaDestino: area,
          motivo: motivoEnvio,
          carro: rs.getString('carro'),
          local: rs.getString('local'),
          historico: rs.getString('historico'),
          anexo: anexoRaw,
          anexosDetalhados: anexosProcessados,
          data: dataCampo ? formatarDataRaw(dataCampo) : "",
          hora: rs.getString('hora') || "",
          sentido: rs.getString('sentido') || "",
          motorista: rs.getString('motorista') || "",
          cobrador: rs.getString('cobrador') || "",
          linha: rs.getString('linha') || "",
          fiscal: fiscalLinha,
          dataPreenchimento: dataPreenchFinal
        });
      }
    }
  } catch (err) {
    Logger.log("Erro consultarEnvios: " + err.message);
  } finally {
    if (rs) rs.close(); if (stmt) stmt.close(); if (conn) conn.close();
  }
  return resultados;
}

// ============================================================================
// ADMINISTRAÇÃO E USUÁRIOS
// ============================================================================
const AdminModule = {
  getConfig: function(chave, valorPadrao) {
    let conn, stmt, rs;
    try {
      conn = getDbConnection();
      stmt = conn.prepareStatement('SELECT valor FROM configuracoes WHERE chave = ?');
      stmt.setString(1, chave);
      rs = stmt.executeQuery();
      if (rs.next()) return rs.getString('valor');
    } catch (e) { } finally {
      if(rs) rs.close(); if(stmt) stmt.close(); if(conn) conn.close();
    }
    return valorPadrao;
  },
  
  setConfig: function(chave, valor, descricao) {
    let conn, stmtCheck, rs, stmtUpd, stmtIns;
    try {
      conn = getDbConnection();
      stmtCheck = conn.prepareStatement('SELECT chave FROM configuracoes WHERE chave = ?');
      stmtCheck.setString(1, chave);
      rs = stmtCheck.executeQuery();
      
      if (rs.next()) {
        stmtUpd = conn.prepareStatement('UPDATE configuracoes SET valor = ?, descricao = ? WHERE chave = ?');
        stmtUpd.setString(1, valor); stmtUpd.setString(2, descricao); stmtUpd.setString(3, chave);
        stmtUpd.execute();
      } else {
        stmtIns = conn.prepareStatement('INSERT INTO configuracoes (chave, valor, descricao) VALUES (?, ?, ?)');
        stmtIns.setString(1, chave); stmtIns.setString(2, valor); stmtIns.setString(3, descricao);
        stmtIns.execute();
      }
      return true;
    } catch (e) {
      return false;
    } finally {
      if(rs) rs.close(); if(stmtCheck) stmtCheck.close(); if(stmtUpd) stmtUpd.close(); if(stmtIns) stmtIns.close(); if(conn) conn.close();
    }
  },
  
  getBotoesConfig: function() {
    return {
      clandestinos: JSON.parse(this.getConfig('BOTOES_CLANDESTINOS', '[]')),
      levantamentos: JSON.parse(this.getConfig('BOTOES_LEVANTAMENTOS', '[]')),
      inspecoes5s: JSON.parse(this.getConfig('BOTOES_INSPICOES_5S', '[]'))
    };
  },
  saveBotoesConfig: function(botoes) {
    return this.setConfig('BOTOES_CLANDESTINOS', JSON.stringify(botoes.clandestinos || []), 'Botões Clandestinos') &&
           this.setConfig('BOTOES_LEVANTAMENTOS', JSON.stringify(botoes.levantamentos || []), 'Botões Levantamentos') &&
           this.setConfig('BOTOES_INSPICOES_5S', JSON.stringify(botoes.inspecoes5s || []), 'Botões 5S');
  },
  getTimeoutInatividade: function() {
    return parseInt(this.getConfig('TIMEOUT_INATIVIDADE', '1200000'), 10) || CONFIG.TIMEOUT_INATIVIDADE;
  }
};

function adminGetConfig() {
  return { sucesso: true, dados: { botoes: AdminModule.getBotoesConfig(), timeout: AdminModule.getTimeoutInatividade(), modoDebug: AdminModule.getConfig('MODO_DEBUG', 'FALSE') === 'TRUE' } };
}

function adminSaveConfig(dadosJson) {
  const { botoes, timeout, modoDebug } = dadosJson;
  if (botoes) AdminModule.saveBotoesConfig(botoes);
  if (timeout) AdminModule.setConfig('TIMEOUT_INATIVIDADE', String(timeout), 'Timeout ms');
  if (modoDebug !== undefined) AdminModule.setConfig('MODO_DEBUG', modoDebug ? 'TRUE' : 'FALSE', 'Modo Debug');
  return { sucesso: true, mensagem: 'Salvo com sucesso' };
}

function adminGetUsuarios(filtro) {
  let conn, stmt, rs;
  const usuarios = [];
  try {
    conn = getDbConnection();
    let sql = 'SELECT matricula, nome, apelido, funcao, ativo FROM login';
    if (filtro) sql += " WHERE apelido ILIKE ? OR nome ILIKE ? OR matricula ILIKE ?";
    
    stmt = conn.prepareStatement(sql);
    if (filtro) {
      const term = `%${filtro}%`;
      stmt.setString(1, term); stmt.setString(2, term); stmt.setString(3, term);
    }
    
    rs = stmt.executeQuery();
    while(rs.next()) {
      usuarios.push({
        matricula: rs.getString('matricula'), nome: rs.getString('nome'),
        apelido: rs.getString('apelido'), funcao: rs.getString('funcao'), ativo: rs.getString('ativo')
      });
    }
    return { sucesso: true, usuarios: usuarios };
  } catch (e) {
    return { sucesso: false, erro: e.message, usuarios: [] };
  } finally {
    if(rs) rs.close(); if(stmt) stmt.close(); if(conn) conn.close();
  }
}

function adminSaveUsuario(dados) {
  let conn, stmt;
  try {
    conn = getDbConnection();
    const { apelido, funcao, senha } = dados;
    let sql = "UPDATE login SET ";
    let params = [];
    
    if (funcao) { sql += "funcao = ? "; params.push(funcao); }
    if (senha) { 
      sql += (funcao ? ", " : "") + "senha_hash = ? "; 
      params.push(gerarHashComSalt(senha, apelido)); 
    }
    sql += "WHERE apelido = ?"; params.push(apelido);
    
    stmt = conn.prepareStatement(sql);
    for(let i=0; i<params.length; i++) stmt.setString(i+1, params[i]);
    stmt.execute();
    return { sucesso: true, mensagem: 'Usuário atualizado!' };
  } catch (e) {
    return { sucesso: false, erro: e.message };
  } finally {
    if(stmt) stmt.close(); if(conn) conn.close();
  }
}

function adminCreateUsuario(dados) {
  let conn, stmt;
  try {
    conn = getDbConnection();
    const { matricula, nome, apelido, funcao, senha } = dados;
    stmt = conn.prepareStatement("INSERT INTO login (matricula, nome, apelido, funcao, ativo, senha_hash) VALUES (?, ?, ?, ?, 'SIM', ?)");
    stmt.setString(1, matricula); stmt.setString(2, nome); stmt.setString(3, apelido); 
    stmt.setString(4, funcao); stmt.setString(5, gerarHashComSalt(senha, apelido));
    stmt.execute();
    return { sucesso: true, mensagem: 'Usuário criado!' };
  } catch (e) {
    return { sucesso: false, erro: 'Erro ao criar, possivelmente apelido duplicado.' };
  } finally {
    if(stmt) stmt.close(); if(conn) conn.close();
  }
}

function adminDeleteUsuario(apelido) {
  let conn, stmt;
  try {
    conn = getDbConnection();
    stmt = conn.prepareStatement("DELETE FROM login WHERE apelido = ?");
    stmt.setString(1, apelido);
    stmt.execute();
    return { sucesso: true, mensagem: 'Usuário excluído!' };
  } catch (e) {
    return { sucesso: false, erro: e.message };
  } finally {
    if(stmt) stmt.close(); if(conn) conn.close();
  }
}

function adminToggleUsuario(apelido, ativo) {
  let conn, stmt;
  try {
    conn = getDbConnection();
    stmt = conn.prepareStatement("UPDATE login SET ativo = ? WHERE apelido = ?");
    stmt.setString(1, ativo ? 'SIM' : 'NAO'); stmt.setString(2, apelido);
    stmt.execute();
    return { sucesso: true, mensagem: 'Status alterado!' };
  } catch (e) {
    return { sucesso: false, erro: e.message };
  } finally {
    if(stmt) stmt.close(); if(conn) conn.close();
  }
}

// ============================================================================
// UTILITÁRIOS E ROTAS (DO GET / DO POST)
// ============================================================================

function gerarHashComSalt(senha, salt) {
  const stringCombinada = senha + salt;
  const hashBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, stringCombinada, Utilities.Charset.UTF_8);
  return hashBytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function truncarTexto(texto, maxCaracteres = CONFIG.MAX_CARACTERES_HISTORICO, maxLinhas = CONFIG.MAX_LINHAS_HISTORICO) {
  if (!texto) return '';
  let textoFinal = texto;
  let linhas = textoFinal.split(/\r?\n/);
  if (linhas.length > maxLinhas) { linhas = linhas.slice(0, maxLinhas); textoFinal = linhas.join('\n'); }
  if (textoFinal.length > maxCaracteres) {
    textoFinal = textoFinal.substring(0, maxCaracteres);
    const ultimoEspaco = textoFinal.lastIndexOf(' ');
    if (ultimoEspaco > 0 && ultimoEspaco > maxCaracteres - 50) textoFinal = textoFinal.substring(0, ultimoEspaco);
  }
  return textoFinal;
}

function formatarDataRaw(valor) {
  if (!valor) return "";
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
    const partes = valor.split('-'); return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  try { return Utilities.formatDate(new Date(valor), "America/Sao_Paulo", "dd/MM/yyyy"); } catch (e) { return String(valor); }
}

function listarTerminais() {
  let conn, stmt, rs;
  const terminais = [];
  try {
    conn = getDbConnection();
    stmt = conn.createStatement();
    rs = stmt.executeQuery("SELECT terminal FROM terminais WHERE status = 'SIM'");
    while (rs.next()) terminais.push(rs.getString('terminal'));
  } catch (e) {} finally {
    if(rs) rs.close(); if(stmt) stmt.close(); if(conn) conn.close();
  }
  return terminais.length ? terminais : ["Terminal A", "Terminal B"];
}

function listarTodosTerminais() {
  let conn, stmt, rs;
  const terminais = [];
  try {
    conn = getDbConnection();
    stmt = conn.createStatement();
    rs = stmt.executeQuery("SELECT terminal FROM terminais");
    while (rs.next()) terminais.push(rs.getString('terminal'));
  } catch (e) {} finally {
    if(rs) rs.close(); if(stmt) stmt.close(); if(conn) conn.close();
  }
  return terminais;
}

function doPost(e) {
  try {
    const { nome, acao, dados } = e.parameter;
    const endpoint = `post_${acao || 'desconhecido'}`;
    const imei = e.parameter.imei || '';
    const localizacaoGps = e.parameter.localizacaoGps || '';
    
    if (acao === "inspecao_veicular" && dados) {
      salvarInspecao(JSON.parse(dados));
      return ContentService.createTextOutput("Inspeção registrada com sucesso").setMimeType(ContentService.MimeType.TEXT);
    }
    if (acao === "tacografo_cadastro" && dados) {
      salvarTacografoCadastro(JSON.parse(dados));
      return ContentService.createTextOutput("Cadastramento registrado com sucesso").setMimeType(ContentService.MimeType.TEXT);
    }
    if (acao === "envio_informacoes" && dados) {
      salvarEnvioInformacoes(JSON.parse(dados));
      return ContentService.createTextOutput("Envio registrado com sucesso").setMimeType(ContentService.MimeType.TEXT);
    }
    if (acao === "admin_save_config" && dados) return ContentService.createTextOutput(JSON.stringify(adminSaveConfig(JSON.parse(dados)))).setMimeType(ContentService.MimeType.JSON);
    if (acao === "admin_save_usuario" && dados) return ContentService.createTextOutput(JSON.stringify(adminSaveUsuario(JSON.parse(dados)))).setMimeType(ContentService.MimeType.JSON);
    if (acao === "admin_create_usuario" && dados) return ContentService.createTextOutput(JSON.stringify(adminCreateUsuario(JSON.parse(dados)))).setMimeType(ContentService.MimeType.JSON);
    if (acao === "admin_delete_usuario" && dados) return ContentService.createTextOutput(JSON.stringify(adminDeleteUsuario(e.parameter.apelido))).setMimeType(ContentService.MimeType.JSON);
    if (acao === "admin_toggle_usuario" && dados) return ContentService.createTextOutput(JSON.stringify(adminToggleUsuario(e.parameter.apelido, e.parameter.ativo === 'SIM'))).setMimeType(ContentService.MimeType.JSON);
    
    return ContentService.createTextOutput("Ação concluida/desconhecida").setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return ContentService.createTextOutput("Erro: " + err.message).setMimeType(ContentService.MimeType.TEXT);
  }
}

function doGet(e) {
  const acao = e.parameter.acao;
  const callback = e.parameter.callback;
  
  function enviarResposta(dados) {
    if (callback) return ContentService.createTextOutput(callback + '(' + JSON.stringify(dados) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
    return ContentService.createTextOutput(JSON.stringify(dados)).setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    if (acao === "terminais") return enviarResposta(listarTerminais());
    if (acao === "terminais_todos") return enviarResposta(listarTodosTerminais());
    if (acao === "consultar_inspecoes") return enviarResposta(consultarInspecoes(e.parameter.fiscal, e.parameter.dataInicio, e.parameter.dataFim, e.parameter.carro, e.parameter.fiscalFiltro));
    if (acao === "consultar_tacografos") return enviarResposta(consultarTacografos(e.parameter.fiscal, e.parameter.dataInicio, e.parameter.dataFim, e.parameter.carro, e.parameter.fiscalFiltro));
    if (acao === "consultar_envios") return enviarResposta(consultarEnvios(e.parameter.fiscal, e.parameter.dataInicio, e.parameter.dataFim, e.parameter.motivo, e.parameter.carro, e.parameter.prefixo, e.parameter.fiscalFiltro, e.parameter.papel, e.parameter.apelido));
    if (acao === "consultar_logs") return enviarResposta(LogModule.consultarLogs(e.parameter.email, e.parameter.dataInicio, e.parameter.dataFim));
    if (acao === "admin_get_config") return enviarResposta(adminGetConfig());
    if (acao === "admin_get_usuarios") return enviarResposta(adminGetUsuarios(e.parameter.filtro));
    
    if (acao === "login") {
      let conn, stmt, rs;
      let usuarioEncontrado = { sucesso: false, erro: 'Usuário ou senha incorretos' };
      try {
        conn = getDbConnection();
        stmt = conn.prepareStatement("SELECT nome, apelido, funcao, senha_hash FROM login WHERE apelido = ? AND ativo = 'SIM'");
        stmt.setString(1, e.parameter.apelido || '');
        rs = stmt.executeQuery();
        if (rs.next()) {
          const hashCalculado = gerarHashComSalt(e.parameter.senha, rs.getString('apelido'));
          if (hashCalculado === rs.getString('senha_hash')) {
            usuarioEncontrado = { sucesso: true, nome: rs.getString('nome'), apelido: rs.getString('apelido'), funcao: rs.getString('funcao') };
            LogModule.registrarAcesso(rs.getString('apelido'), 'LOGIN_SUCESSO', '', 'get_login', '', '');
          }
        }
      } catch (err) {} finally {
        if(rs) rs.close(); if(stmt) stmt.close(); if(conn) conn.close();
      }
      return enviarResposta(usuarioEncontrado);
    }
    return enviarResposta({ erro: "Ação inválida" });
  } catch (err) {
    return enviarResposta({ erro: "Erro interno: " + err.message });
  }
}
// ============================================================================
// SCRIPTS DE MIGRAÇÃO (SHEETS -> POSTGRESQL)
// ============================================================================

/**
 * Utilitário para converter as datas do Sheets para o formato do PostgreSQL
 */
function converterDataParaPg(valorData) {
  if (!valorData) return null;
  try {
    if (valorData instanceof Date) {
      return Utilities.formatDate(valorData, "America/Sao_Paulo", "yyyy-MM-dd HH:mm:ss");
    }
    // Tenta lidar com strings (ex: dd/MM/yyyy HH:mm:ss)
    const dataStr = String(valorData);
    if (dataStr.includes('/')) {
      const partes = dataStr.split(' ');
      const dataParts = partes[0].split('/');
      if (dataParts.length === 3) {
        const horaPart = partes[1] || '00:00:00';
        return `${dataParts[2]}-${dataParts[1]}-${dataParts[0]} ${horaPart}`;
      }
    }
    return Utilities.formatDate(new Date(valorData), "America/Sao_Paulo", "yyyy-MM-dd HH:mm:ss");
  } catch (e) {
    return null; // Retorna null se não conseguir converter, evitando quebrar o lote
  }
}

/**
 * 1. MIGRAÇÃO DE USUÁRIOS (LOGIN)
 */
function migrarUsuarios() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("login");
  if (!sheet) return Logger.log("Aba 'login' não encontrada.");

  const data = sheet.getDataRange().getValues();
  let conn, stmt;
  let count = 0;

  try {
    conn = getDbConnection();
    // Usa ON CONFLICT para não duplicar se você rodar o script duas vezes
    stmt = conn.prepareStatement(`INSERT INTO login (matricula, nome, apelido, funcao, ativo, senha_hash) 
                                  VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (apelido) DO NOTHING`);

    for (let i = 1; i < data.length; i++) { // Começa do 1 para pular o cabeçalho
      const row = data[i];
      const apelido = String(row[2] || '').trim();
      if (!apelido) continue; // Pula se não tiver apelido

      stmt.setString(1, String(row[0] || '')); // matricula
      stmt.setString(2, String(row[1] || '')); // nome
      stmt.setString(3, apelido);              // apelido
      stmt.setString(4, String(row[4] || '')); // funcao
      stmt.setString(5, String(row[5] || 'SIM')); // ativo
      stmt.setString(6, String(row[6] || '')); // senha_hash (G)
      
      stmt.addBatch();
      count++;
    }
    
    stmt.executeBatch();
    Logger.log(`✅ Sucesso! ${count} usuários migrados para o Supabase.`);
  } catch (e) {
    Logger.log("❌ Erro ao migrar usuários: " + e.message);
  } finally {
    if (stmt) stmt.close(); if (conn) conn.close();
  }
}

/**
 * 2. MIGRAÇÃO DE TERMINAIS
 */
function migrarTerminais() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Terminais");
  if (!sheet) return Logger.log("Aba 'Terminais' não encontrada.");

  const data = sheet.getDataRange().getValues();
  let conn, stmt;
  let count = 0;

  try {
    conn = getDbConnection();
    stmt = conn.prepareStatement(`INSERT INTO terminais (terminal, status) VALUES (?, ?)`);

    for (let i = 1; i < data.length; i++) {
      const terminal = String(data[i][0] || '').trim();
      if (!terminal) continue;

      stmt.setString(1, terminal);
      stmt.setString(2, String(data[i][1] || 'SIM').trim().toUpperCase());
      stmt.addBatch();
      count++;
    }
    
    stmt.executeBatch();
    Logger.log(`✅ Sucesso! ${count} terminais migrados.`);
  } catch (e) {
    Logger.log("❌ Erro ao migrar terminais: " + e.message);
  } finally {
    if (stmt) stmt.close(); if (conn) conn.close();
  }
}

/**
 * 3. MIGRAÇÃO DE INSPEÇÕES VEICULARES
 */
function migrarInspecoes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Inspecoes_Veiculares");
  if (!sheet) return Logger.log("Aba 'Inspecoes_Veiculares' não encontrada.");

  const data = sheet.getDataRange().getValues();
  let conn, stmt;
  let count = 0;

  try {
    conn = getDbConnection();
    stmt = conn.prepareStatement(`INSERT INTO inspecoes_veiculares 
      (data_hora, carro, terminal, fiscal, thoreb_status, thoreb_obs, elevador_status, elevador_obs, 
       limpeza_status, limpeza_obs, ventilador_status, ventilador_obs, ventilador_posicao) 
      VALUES (?::timestamp, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const dataStr = converterDataParaPg(row[0]);
      if (!dataStr) continue;

      stmt.setString(1, dataStr);
      stmt.setString(2, String(row[1] || ''));
      stmt.setString(3, String(row[2] || ''));
      stmt.setString(4, String(row[3] || ''));
      stmt.setString(5, String(row[4] || ''));
      stmt.setString(6, String(row[5] || ''));
      stmt.setString(7, String(row[6] || ''));
      stmt.setString(8, String(row[7] || ''));
      stmt.setString(9, String(row[8] || ''));
      stmt.setString(10, String(row[9] || ''));
      stmt.setString(11, String(row[10] || ''));
      stmt.setString(12, String(row[11] || ''));
      stmt.setString(13, String(row[12] || ''));
      
      stmt.addBatch();
      count++;
    }
    
    stmt.executeBatch();
    Logger.log(`✅ Sucesso! ${count} inspeções migradas.`);
  } catch (e) {
    Logger.log("❌ Erro ao migrar inspeções: " + e.message);
  } finally {
    if (stmt) stmt.close(); if (conn) conn.close();
  }
}
