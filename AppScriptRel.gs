/**
 * ============================================================================
 * CONFIGURAÇÃO MASTER E GERENCIAMENTO DE PLANILHAS SEPARADAS
 * ============================================================================
 * ESTRUTURA SUGERIDA NO DRIVE:
 * 1. Crie uma planilha "Master_Config"
 * 2. Nela, crie uma aba "IDs" com as colunas: [Nome, ID]
 *    - Login, <ID_DA_PLANILHA_LOGIN>
 *    - Logs, <ID_DA_PLANILHA_LOGS>
 *    - Envios, <ID_DA_PLANILHA_ENVIOS>
 *    - Inspecoes, <ID_DA_PLANILHA_INSPICOES>
 *    - Admin, <ID_DA_PLANILHA_ADMIN> (nova aba para configurações do painel admin)
 * 3. Substitua a variável MASTER_SHEET_ID abaixo pelo ID da sua planilha Master.
 * 
 * Se MASTER_SHEET_ID não estiver configurado, o sistema usa SpreadsheetApp.getActiveSpreadsheet()
 * (modo legado/único) para manter compatibilidade.
 */

const MASTER_SHEET_ID = ''; // Deixe vazio para usar planilha atual, ou coloque o ID da Planilha Master

// Cache para evitar chamadas repetidas ao SpreadsheetApp
const _sheetCache = {};

// Configurações do sistema
const CONFIG = {
  TIMEOUT_INATIVIDADE: 20 * 60 * 1000, // 20 minutos em milissegundos
  MAX_LINHAS_HISTORICO: 16,
  MAX_CARACTERES_HISTORICO: 1400,
  ID_PASTA_ANEXOS: "1BrN9zxFViGbQu0ZDp0MzVDIZ0lKAYqxP"
};

/**
 * Obtém o ID de uma planilha específica baseado na configuração Master.
 * Se MASTER_SHEET_ID estiver vazio, retorna null para usar a planilha ativa.
 */
function getSheetIdByName(name) {
  // Modo legado: usa planilha ativa se MASTER_SHEET_ID não estiver configurado
  if (!MASTER_SHEET_ID) {
    return null;
  }

  if (_sheetCache[name]) {
    return _sheetCache[name];
  }

  try {
    const masterSpreadsheet = SpreadsheetApp.openById(MASTER_SHEET_ID);
    const sheet = masterSpreadsheet.getSheetByName('IDs');
    if (!sheet) throw new Error('Aba "IDs" não encontrada na Planilha Master.');
    
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === name) {
        const id = data[i][1];
        _sheetCache[name] = id;
        return id;
      }
    }
    throw new Error(`ID para "${name}" não encontrado na Master.`);
  } catch (e) {
    Logger.log(`Erro ao buscar ID para ${name}: ${e.message}`);
    return null;
  }
}

/**
 * Abre uma planilha pelo nome lógico definido na Master.
 * Se não houver Master configurada, retorna a planilha ativa.
 */
function openSheetByName(name) {
  const id = getSheetIdByName(name);
  if (id) {
    return SpreadsheetApp.openById(id);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

// ============================================================================
// MÓDULO: LOGS (Simula logs.gs) - Registro de acessos e endpoints
// ============================================================================
const LogModule = {
  getSheet: function() {
    const ss = openSheetByName('Logs');
    let sheet = ss.getSheetByName('Acessos');
    if (!sheet) {
      sheet = ss.insertSheet('Acessos');
      sheet.appendRow(['Timestamp', 'Email', 'Ação', 'Detalhes', 'Endpoint', 'IMEI/Dispositivo', 'Localizacao_GPS']);
    }
    return sheet;
  },

  registrarAcesso: function(email, acao, detalhes, endpoint, imei, localizacaoGps) {
    try {
      const sheet = this.getSheet();
      sheet.appendRow([new Date(), email || 'Anonimo', acao, detalhes, endpoint || 'N/A', imei || '', localizacaoGps || '']);
    } catch (e) {
      Logger.log('Erro ao registrar log: ' + e.message);
    }
  },
  
  consultarLogs: function(filtroEmail, dataInicio, dataFim) {
    const sheet = this.getSheet();
    const data = sheet.getDataRange().getValues();
    const resultados = [];
    
    let dataInicioObj = null;
    if (dataInicio) {
      const parts = dataInicio.split('-');
      dataInicioObj = new Date(parts[0], parts[1]-1, parts[2]);
    }
    let dataFimObj = null;
    if (dataFim) {
      const parts = dataFim.split('-');
      dataFimObj = new Date(parts[0], parts[1]-1, parts[2], 23, 59, 59);
    }
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const timestamp = row[0];
      
      if (filtroEmail && row[1] !== filtroEmail) continue;
      if (dataInicioObj && timestamp < dataInicioObj) continue;
      if (dataFimObj && timestamp > dataFimObj) continue;
      
      resultados.push({
        timestamp: timestamp,
        email: row[1],
        acao: row[2],
        detalhes: row[3],
        endpoint: row[4],
        imei: row[5] || '',
        localizacaoGps: row[6] || ''
      });
    }
    return resultados;
  }
};

// ======================= SALVAR INSPEÇÃO VEICULAR =======================
function salvarInspecao(dadosJson) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Inspecoes_Veiculares");
  if (!sheet) {
    sheet = ss.insertSheet("Inspecoes_Veiculares");
    sheet.appendRow([
      "DataHora", "Carro", "Terminal", "Fiscal",
      "THOREB_Status", "THOREB_Obs",
      "Elevador_Status", "Elevador_Obs",
      "Limpeza_Status", "Limpeza_Obs",
      "Ventilador_Status", "Ventilador_Obs", "Ventilador_Posicao"
    ]);
  }
  const agora = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");
  const { carro, terminal, fiscal, thoreb, elevador, limpeza, ventilador } = dadosJson;
  sheet.appendRow([
    agora, carro, terminal, fiscal,
    thoreb.status || "", thoreb.obs || "",
    elevador.status || "", elevador.obs || "",
    limpeza.status || "", limpeza.obs || "",
    ventilador.status || "", ventilador.obs || "", ventilador.posicao || ""
  ]);
  return true;
}

// ======================= CONSULTAR INSPEÇÕES (com filtros) =======================
function consultarInspecoes(fiscalNome, dataInicio, dataFim, carro, fiscalFiltro) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Inspecoes_Veiculares");
    if (!sheet) return [];
    const dados = sheet.getDataRange().getValues();
    if (dados.length < 2) return [];
    
    let dataInicioObj = null;
    if (dataInicio) {
      const parts = dataInicio.split('-');
      dataInicioObj = new Date(parts[0], parts[1]-1, parts[2], 0, 0, 0);
    }
    let dataFimObj = null;
    if (dataFim) {
      const parts = dataFim.split('-');
      dataFimObj = new Date(parts[0], parts[1]-1, parts[2], 23, 59, 59);
    }

    const cabecalhos = dados[0].map(h => String(h).trim());
    const indices = {
      dataHora: cabecalhos.indexOf("DataHora"),
      fiscal: cabecalhos.indexOf("Fiscal"),
      carro: cabecalhos.indexOf("Carro"),
      terminal: cabecalhos.indexOf("Terminal"),
      thoreb_status: cabecalhos.indexOf("THOREB_Status"),
      thoreb_obs: cabecalhos.indexOf("THOREB_Obs"),
      elevador_status: cabecalhos.indexOf("Elevador_Status"),
      elevador_obs: cabecalhos.indexOf("Elevador_Obs"),
      limpeza_status: cabecalhos.indexOf("Limpeza_Status"),
      limpeza_obs: cabecalhos.indexOf("Limpeza_Obs"),
      ventilador_status: cabecalhos.indexOf("Ventilador_Status"),
      ventilador_obs: cabecalhos.indexOf("Ventilador_Obs"),
      ventilador_pos: cabecalhos.indexOf("Ventilador_Posicao")
    };
    
    const resultados = [];
    
    for (let i = 1; i < dados.length; i++) {
      const linha = dados[i];
      let dataHora = linha[indices.dataHora];
      const fiscalLinha = linha[indices.fiscal];
      if (!dataHora || !fiscalLinha) continue;
      
      let dataHoraStr = "";
      let dataRegistro = null;
      if (dataHora instanceof Date) {
        dataHoraStr = Utilities.formatDate(dataHora, "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");
        dataRegistro = new Date(dataHora.getFullYear(), dataHora.getMonth(), dataHora.getDate());
      } else {
        dataHoraStr = String(dataHora).trim();
        const partes = dataHoraStr.split(" ")[0].split("/");
        if (partes.length === 3) {
          const dia = parseInt(partes[0], 10);
          const mes = parseInt(partes[1], 10) - 1;
          const ano = parseInt(partes[2], 10);
          dataRegistro = new Date(ano, mes, dia);
        } else {
          continue;
        }
      }
      
      if (dataInicioObj && dataRegistro < dataInicioObj) continue;
      if (dataFimObj && dataRegistro > dataFimObj) continue;
      
      if (carro && linha[indices.carro] && !String(linha[indices.carro]).toLowerCase().includes(carro.toLowerCase())) continue;
      if (fiscalFiltro && fiscalLinha !== fiscalFiltro) continue;
      if (fiscalNome && fiscalLinha !== fiscalNome) continue; 
      
      // Extrai apenas a data (dd/MM/yyyy) da dataHora para exibição como "data de preenchimento"
      const dataPreenchimento = dataHoraStr.split(" ")[0];
      
      resultados.push({
        dataHora: dataHoraStr,
        dataPreenchimento: dataPreenchimento,  // Nova propriedade: data de preenchimento pelo fiscal
        carro: linha[indices.carro] || "",
        terminal: linha[indices.terminal] || "",
        fiscal: fiscalLinha,
        thoreb: { status: linha[indices.thoreb_status] || "", obs: linha[indices.thoreb_obs] || "" },
        elevador: { status: linha[indices.elevador_status] || "", obs: linha[indices.elevador_obs] || "" },
        limpeza: { status: linha[indices.limpeza_status] || "", obs: linha[indices.limpeza_obs] || "" },
        ventilador: { status: linha[indices.ventilador_status] || "", obs: linha[indices.ventilador_obs] || "", posicao: linha[indices.ventilador_pos] || "" }
      });
    }
    return resultados;
  } catch (err) {
    Logger.log("ERRO em consultarInspecoes: " + err.message);
    return [];
  }
}

// ======================= LISTAR TERMINAIS (apenas SIM) =======================
function listarTerminais() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Terminais");
    if (!sheet) {
      sheet = ss.insertSheet("Terminais");
      sheet.appendRow(["Terminal", "Status"]);
      sheet.appendRow(["Terminal A", "SIM"]);
      sheet.appendRow(["Terminal B", "SIM"]);
      sheet.appendRow(["Terminal C", "SIM"]);
      sheet.appendRow(["Terminal D", "SIM"]);
    }
    const dados = sheet.getDataRange().getValues();
    const terminais = [];
    for (let i = 1; i < dados.length; i++) {
      const terminal = dados[i][0];
      const status = dados[i][1] ? String(dados[i][1]).trim().toUpperCase() : "";
      if (terminal && status === "SIM") {
        terminais.push(String(terminal).trim());
      }
    }
    return terminais;
  } catch (err) {
    Logger.log("ERRO em listarTerminais: " + err.message);
    return ["Terminal A", "Terminal B", "Terminal C", "Terminal D"];
  }
}

// ======================= LISTAR TODOS OS TERMINAIS =======================
function listarTodosTerminais() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Terminais");
    if (!sheet) {
      sheet = ss.insertSheet("Terminais");
      sheet.appendRow(["Terminal", "Status"]);
      sheet.appendRow(["Terminal A", "SIM"]);
      sheet.appendRow(["Terminal B", "SIM"]);
      sheet.appendRow(["Terminal C", "SIM"]);
      sheet.appendRow(["Terminal D", "SIM"]);
    }
    const dados = sheet.getDataRange().getValues();
    const terminais = [];
    for (let i = 1; i < dados.length; i++) {
      const terminal = dados[i][0];
      if (terminal) terminais.push(String(terminal).trim());
    }
    return terminais;
  } catch (err) {
    return ["Terminal A", "Terminal B", "Terminal C", "Terminal D"];
  }
}
// ======================= LIMPEZA DE INSPEÇÕES COM BACKUP =======================
/**
 * Realiza a limpeza das inspeções mais antigas que 7 dias, criando um backup em arquivo CSV
 * no Google Drive antes de remover os dados.
 */
function limparInspecoesAntigas() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Inspecoes_Veiculares");
    if (!sheet) {
      return { sucesso: false, erro: 'Planilha de Inspeções não encontrada' };
    }
    
    const dados = sheet.getDataRange().getValues();
    if (dados.length < 2) {
      return { sucesso: true, mensagem: 'Nenhuma inspeção para limpar', removidas: 0 };
    }
    
    // Calcula data de corte (7 dias atrás)
    const hoje = new Date();
    const dataCorte = new Date(hoje);
    dataCorte.setDate(dataCorte.getDate() - 7);
    dataCorte.setHours(0, 0, 0, 0);
    
    const cabecalhos = dados[0].map(h => String(h).trim());
    const idxDataHora = cabecalhos.indexOf("DataHora");
    
    if (idxDataHora === -1) {
      return { sucesso: false, erro: 'Coluna DataHora não encontrada' };
    }
    
    const linhasManter = [dados[0]]; // Mantém cabeçalho
    const linhasRemover = [];
    
    for (let i = 1; i < dados.length; i++) {
      const linha = dados[i];
      let dataHora = linha[idxDataHora];
      
      let dataRegistro = null;
      if (dataHora instanceof Date) {
        dataRegistro = new Date(dataHora.getFullYear(), dataHora.getMonth(), dataHora.getDate());
      } else {
        const dataHoraStr = String(dataHora).trim();
        const partes = dataHoraStr.split(" ")[0].split("/");
        if (partes.length === 3) {
          const dia = parseInt(partes[0], 10);
          const mes = parseInt(partes[1], 10) - 1;
          const ano = parseInt(partes[2], 10);
          dataRegistro = new Date(ano, mes, dia);
        }
      }
      
      if (dataRegistro && dataRegistro >= dataCorte) {
        linhasManter.push(linha);
      } else {
        linhasRemover.push(linha);
      }
    }
    
    // Cria backup se houver linhas para remover
    let arquivoBackupUrl = null;
    if (linhasRemover.length > 0) {
      arquivoBackupUrl = criarBackupCSV(linhasRemover, cabecalhos, "Inspecoes_RemoVIDAS");
    }
    
    // Limpa a planilha e reinsere apenas as linhas mantidas
    sheet.clearContents();
    for (let i = 0; i < linhasManter.length; i++) {
      sheet.appendRow(linhasManter[i]);
    }
    
    LogModule.registrarAcesso('SISTEMA', 'LIMPEZA_INSPICOES', 
      `Removidas: ${linhasRemover.length}, Mantidas: ${linhasManter.length - 1}`, 'limpeza_inspecoes');
    
    return {
      sucesso: true,
      mensagem: `Limpeza concluída! ${linhasRemover.length} inspeções removidas.`,
      removidas: linhasRemover.length,
      mantidas: linhasManter.length - 1,
      backupUrl: arquivoBackupUrl
    };
    
  } catch (e) {
    Logger.log('Erro em limparInspecoesAntigas: ' + e.message);
    return { sucesso: false, erro: e.message };
  }
}

/**
 * Cria um arquivo CSV de backup no Google Drive
 */
function criarBackupCSV(linhas, cabecalhos, nomeArquivo) {
  try {
    const pastaId = CONFIG.ID_PASTA_ANEXOS;
    const pasta = DriveApp.getFolderById(pastaId);
    
    const timestamp = Utilities.formatDate(new Date(), "America/Sao_Paulo", "ddMMyyyy_HHmmss");
    const nomeCompleto = `${nomeArquivo}_${timestamp}.csv`;
    
    // Constrói o conteúdo CSV
    let csvContent = cabecalhos.join(";") + "\n";
    for (let i = 0; i < linhas.length; i++) {
      const linhaFormatada = linhas[i].map(cell => {
        if (cell instanceof Date) {
          return Utilities.formatDate(cell, "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");
        }
        return String(cell || "").replace(/;/g, ","); // Evita conflito com separador
      });
      csvContent += linhaFormatada.join(";") + "\n";
    }
    
    // Cria o arquivo
    const blob = Utilities.newBlob(csvContent, MimeType.PLAIN_TEXT, nomeCompleto);
    const arquivo = pasta.createFile(blob);
    arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return arquivo.getUrl();
  } catch (e) {
    Logger.log('Erro ao criar backup CSV: ' + e.message);
    return null;
  }
}

// ======================= FUNÇÃO AUXILIAR PARA TRUNCAR HISTÓRICO =======================
function truncarTexto(texto, maxCaracteres = CONFIG.MAX_CARACTERES_HISTORICO, maxLinhas = CONFIG.MAX_LINHAS_HISTORICO) {
  if (!texto) return '';
  
  let textoFinal = texto;
  
  // Limite por linhas
  let linhas = textoFinal.split(/\r?\n/);
  if (linhas.length > maxLinhas) {
    linhas = linhas.slice(0, maxLinhas);
    textoFinal = linhas.join('\n');
  }
  
  // Limite por caracteres
  if (textoFinal.length > maxCaracteres) {
    textoFinal = textoFinal.substring(0, maxCaracteres);
    // Remove última palavra truncada se possível
    const ultimoEspaco = textoFinal.lastIndexOf(' ');
    if (ultimoEspaco > 0 && ultimoEspaco > maxCaracteres - 50) {
      textoFinal = textoFinal.substring(0, ultimoEspaco);
    }
  }
  return textoFinal;
}
// ======================= FUNÇÃO AUXILIAR PARA FORMATAR DATAS COM FUSO HORÁRIO CORRETO =======================
/**
 * Formata uma data da planilha para dd/MM/yyyy, corrigindo problemas de fuso horário.
 * A planilha pode armazenar datas como Date ou string ISO (YYYY-MM-DD).
 * Quando é string ISO, o dia pode ser alterado devido ao fuso horário.
 */
function formatDateSafe(dateValue) {
  if (!dateValue) return "";

  // Se já for string no formato dd/MM/yyyy, retorna como está
  if (typeof dateValue === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) {
    return dateValue;
  }

  // Se for string ISO (YYYY-MM-DD), extrai as partes diretamente para evitar fuso horário
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
    const parts = dateValue.split('-');
    const ano = parts[0];
    const mes = parts[1];
    const dia = parts[2].substring(0, 2); // Pode ter hora após espaço
    return `${dia}/${mes}/${ano}`;
  }

  // Se for objeto Date, formata com fuso horário
  if (dateValue instanceof Date) {
    return Utilities.formatDate(dateValue, "America/Sao_Paulo", "dd/MM/yyyy");
  }

  // Tenta converter para Date como fallback
  try {
    const dateObj = new Date(dateValue);
    if (!isNaN(dateObj.getTime())) {
      return Utilities.formatDate(dateObj, "America/Sao_Paulo", "dd/MM/yyyy");
    }
  } catch (e) {
    // Ignora erro e retorna vazio
  }

  return String(dateValue);
}

/**
 * Formata uma string no formato YYYY-MM-DD para DD/MM/YYYY
 * sem conversão para Date, evitando problemas de fuso horário.
 * Esta função é usada para o campo 'Data' (data do acontecimento) vindo da planilha.
 */
function formatarDataRaw(valor) {
  if (!valor) return "";
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
    const partes = valor.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  // Fallback para outros tipos
  try {
    return Utilities.formatDate(new Date(valor), "America/Sao_Paulo", "dd/MM/yyyy");
  } catch (e) {
    return String(valor);
  }
}

// ====================================================================
// SALVAR ENVIO DE INFORMAÇÕES
// ====================================================================
/**
 * Salva as informações de envio na planilha.
 * CORREÇÃO: Captura a 'dataPreenchimento' original do front-end e 
 * armazena em uma nova coluna para evitar divergência de fuso/sincronização.
 */
function salvarEnvioInformacoes(dadosJson) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("EnviosInformacoes");
  
  if (!sheet) {
    // Cria a aba já com a nova coluna 'DataPreenchimento' se não existir
    sheet = ss.insertSheet("EnviosInformacoes");
    sheet.appendRow([
      "DataHora", "Fiscal", "AreaDestino", "Motivo", "Carro", "Linha",
      "Motorista", "Cobrador", "Hora", "Sentido", "Historico", "Local", 
      "Data", "Anexos", "DataPreenchimento"
    ]);
  } else {
    // Verifica se a coluna 'DataPreenchimento' já existe no cabeçalho; se não, cria dinamicamente.
    const ultimaColuna = sheet.getLastColumn();
    if (ultimaColuna > 0) {
      const headers = sheet.getRange(1, 1, 1, ultimaColuna).getValues()[0];
      if (headers.indexOf("DataPreenchimento") === -1) {
        sheet.getRange(1, ultimaColuna + 1).setValue("DataPreenchimento");
      }
    }
  }

  const agora = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");
  
  // Extraímos o dataPreenchimento enviado pelo front-end
  const { areaDestino, motivo, carro, linha, motorista, cobrador, hora, sentido, historico, local, data, fiscal, anexos, dataPreenchimento } = dadosJson;
  
  // ========== TRUNCA O HISTÓRICO ANTES DE SALVAR ==========
  const historicoTruncado = truncarTexto(historico || '');

  let linksAnexos = [];

  // Processamento e salvamento de anexos no Google Drive
  if (anexos && Array.isArray(anexos) && anexos.length) {
    const pasta = DriveApp.getFolderById(CONFIG.ID_PASTA_ANEXOS);
    for (let i = 0; i < anexos.length; i++) {
      const anexo = anexos[i];
      try {
        const dadosDecodificados = Utilities.base64Decode(anexo.base64);
        const sufixo = Utilities.formatDate(new Date(), "America/Sao_Paulo", "ddMMyyyy_HHmmss") + `_${i+1}`;
        const extensao = anexo.mimeType.includes("pdf") ? ".pdf" : ".jpg";
        const nomeArquivo = (carro ? `Carro${carro}_` : "Anexo_") + sufixo + extensao;
        const blob = Utilities.newBlob(dadosDecodificados, anexo.mimeType, nomeArquivo);
        const arquivoDrive = pasta.createFile(blob);
        arquivoDrive.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        linksAnexos.push(arquivoDrive.getUrl());
      } catch (err) {
        linksAnexos.push(`ERRO: ${err.message}`);
      }
    }
  }

  const linkFinal = linksAnexos.join(" ; ");
  const dataPreenchimentoFront = dataPreenchimento || ""; // Garante string vazia se não vier

  // Adiciona a linha na planilha, incluindo a DataPreenchimento na última posição
  sheet.appendRow([
    agora, fiscal, areaDestino, motivo, carro, linha,
    motorista, cobrador, hora, sentido, historicoTruncado, local, data, linkFinal, dataPreenchimentoFront
  ]);

  return true;
}


// ====================================================================
// CONSULTAR ENVIOS COM PERMISSÕES AVANÇADAS
// ====================================================================
/**
 * Consulta os envios aplicando filtros.
 * CORREÇÃO: Lê a 'DataPreenchimento' original da planilha. Em casos de 
 * relatórios legados, aplica um fallback seguro usando a 'Data' do acontecimento.
 */
function consultarEnvios(fiscalNome, dataInicio, dataFim, motivo, carro, prefixo, fiscalFiltro, papel, apelido) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("EnviosInformacoes");
    if (!sheet) return [];
    const dados = sheet.getDataRange().getValues();
    if (dados.length < 2) return [];
    
    // Converte datas de filtro
    let dataInicioObj = null;
    if (dataInicio) {
      const parts = dataInicio.split('-');
      dataInicioObj = new Date(parts[0], parts[1] - 1, parts[2]);
    }
    let dataFimObj = null;
    if (dataFim) {
      const parts = dataFim.split('-');
      dataFimObj = new Date(parts[0], parts[1] - 1, parts[2]);
    }
    
    // Carrega a planilha de login para obter os papéis
    const loginSheet = ss.getSheetByName("login");
    const loginData = loginSheet.getDataRange().getValues();
    const fiscaisSet = new Set();     
    const inspetoresSet = new Set();  
    for (let i = 1; i < loginData.length; i++) {
      const funcao = String(loginData[i][4] || "").trim().toUpperCase();
      const apelidoLogin = loginData[i][2];
      if (!apelidoLogin) continue;
      if (funcao === 'FISCAL') {
        fiscaisSet.add(apelidoLogin);
      } else if (funcao === 'INSPETOR') {
        inspetoresSet.add(apelidoLogin);
      }
    }
    
    // Índices das colunas
    const cabecalhos = dados[0].map(h => String(h).trim());
    const idxDataHora = cabecalhos.indexOf("DataHora");
    const idxFiscal = cabecalhos.indexOf("Fiscal");
    const idxArea = cabecalhos.indexOf("AreaDestino");
    const idxMotivo = cabecalhos.indexOf("Motivo");
    const idxCarro = cabecalhos.indexOf("Carro");
    const idxLocal = cabecalhos.indexOf("Local");
    const idxHistorico = cabecalhos.indexOf("Historico");
    const idxAnexo = cabecalhos.indexOf("Anexos");
    const idxData = cabecalhos.indexOf("Data");
    const idxHora = cabecalhos.indexOf("Hora");
    const idxSentido = cabecalhos.indexOf("Sentido");
    const idxMotorista = cabecalhos.indexOf("Motorista");
    const idxCobrador = cabecalhos.indexOf("Cobrador");
    const idxLinha = cabecalhos.indexOf("Linha");
    
    // Mapeia o índice da nova coluna
    const idxDataPreenchimento = cabecalhos.indexOf("DataPreenchimento"); 
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const resultados = [];
    
    for (let i = 1; i < dados.length; i++) {
      const linha = dados[i];
      let dataHora = linha[idxDataHora];
      const fiscalLinha = linha[idxFiscal];
      if (!dataHora || !fiscalLinha) continue;
      
      // Converte data/hora do registro para base
      let dataHoraStr = "";
      if (dataHora instanceof Date) {
        dataHoraStr = Utilities.formatDate(dataHora, "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");
      } else {
        dataHoraStr = String(dataHora).trim();
      }
      
      const dataEnvioStr = dataHoraStr.split(" ")[0];
      const [dia, mes, ano] = dataEnvioStr.split("/").map(Number);
      const dataRegistro = new Date(ano, mes - 1, dia);
      
      // Filtro padrão de período
      if (!dataInicio && !dataFim) {
        const quatroDiasAtras = new Date(hoje);
        quatroDiasAtras.setDate(quatroDiasAtras.getDate() - 4);
        if (dataRegistro < quatroDiasAtras) continue;
      }
      
      // Filtros básicos
      if (fiscalNome && fiscalLinha !== fiscalNome) continue;
      if (fiscalFiltro && fiscalLinha !== fiscalFiltro) continue;
      if (dataInicioObj && dataRegistro < dataInicioObj) continue;
      if (dataFimObj && dataRegistro > dataFimObj) continue;
      if (motivo && linha[idxMotivo] !== motivo) continue;
      if (carro && String(linha[idxCarro] || "") !== carro) continue;
      if (prefixo && !String(linha[idxCarro] || "").toLowerCase().includes(prefixo.toLowerCase())) continue;
      
      const area = linha[idxArea] || "";
      const motivoEnvio = linha[idxMotivo] || "";
      let permitido = false;
      
      // ========== REGRAS DE PERMISSÃO POR PERFIL ==========
      switch (papel) {
        case 'FISCAL':
          permitido = (fiscalLinha === apelido);
          break;
        case 'INSPETOR':
          const isProprioInsp = (fiscalLinha === apelido);
          const isFiscalInsp = fiscaisSet.has(fiscalLinha);
          if (isProprioInsp || (isFiscalInsp && motivoEnvio !== 'PEDIDO DE FOLGAS')) {
            permitido = true;
          }
          break;
        case 'ENCARREGADO':
        case 'GERENTE':
        case 'ADMIN':
          permitido = true;
          break;
        case 'SAF':
          if (area === 'SAF' || motivoEnvio === 'AVARIAS') {
            permitido = true;
          }
          break;
        default:
          permitido = false;
      }
      
      // ========== LIMITE DE DIAS POR PERFIL ==========
      if (permitido) {
        const diffDias = Math.floor((hoje - dataRegistro) / (1000 * 60 * 60 * 24));
        switch (papel) {
          case 'FISCAL': if (diffDias > 30) permitido = false; break;
          case 'INSPETOR': if (diffDias > 60) permitido = false; break;
          case 'ENCARREGADO':
          case 'GERENTE': if (diffDias > 90) permitido = false; break;
        }
      }
      
      if (permitido) {
        // Tratamento de anexos processados (mantido intacto)
        let anexosProcessados = [];
        const anexoRaw = linha[idxAnexo] || "";
        if (anexoRaw && anexoRaw !== "Nenhum" && anexoRaw.trim() !== "") {
          const links = anexoRaw.split(" ; ");
          for (let j = 0; j < links.length; j++) {
            const linkOriginal = links[j].trim();
            if (linkOriginal) {
              let fileId = null;
              var regexes = [
                /\/d\/([a-zA-Z0-9_-]+)/, /id=([a-zA-Z0-9_-]+)/, /file\/d\/([a-zA-Z0-9_-]+)/,
                /uc\?id=([a-zA-Z0-9_-]+)/, /open\?id=([a-zA-Z0-9_-]+)/, /\/u\/\d\/d\/([a-zA-Z0-9_-]+)/
              ];
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
                anexosProcessados.push({
                  urlOriginal: linkOriginal, urlDownload: linkOriginal,
                  urlVisualizacao: linkOriginal, fileId: null
                });
              }
            }
          }
        }
        
        // =================================================================
        // CORREÇÃO: LÓGICA DE DEFINIÇÃO DA DATA DE PREENCHIMENTO FINAL
        // =================================================================
        let dataPreenchimentoFinal = "";
        if (idxDataPreenchimento !== -1 && linha[idxDataPreenchimento]) {
          // Se existir a coluna e ela estiver preenchida, usa a info real do front-end
          dataPreenchimentoFinal = formatarDataRaw(linha[idxDataPreenchimento]);
        } else {
          // Fallback Seguro (Planilhas Legadas): Em vez de usar a DataHora do servidor que causa delay,
          // espelha de maneira sensata a data do acontecimento preenchida pelo usuário.
          dataPreenchimentoFinal = linha[idxData] ? formatarDataRaw(linha[idxData]) : dataEnvioStr;
        }
        
        resultados.push({
          areaDestino: area,
          motivo: motivoEnvio,
          carro: linha[idxCarro],
          local: linha[idxLocal],
          historico: linha[idxHistorico],
          anexo: linha[idxAnexo],
          anexosDetalhados: anexosProcessados,
          data: linha[idxData] ? formatarDataRaw(linha[idxData]) : "",
          hora: linha[idxHora] || "",
          sentido: linha[idxSentido] || "",
          motorista: linha[idxMotorista] || "",
          cobrador: linha[idxCobrador] || "",
          linha: linha[idxLinha] || "",
          fiscal: fiscalLinha,
          dataPreenchimento: dataPreenchimentoFinal // Passando a data correta para a UI
        });
      }
    }
    
    // Ordenação decrescente por data
    resultados.sort((a, b) => {
      const converte = (dataStr) => {
        if (!dataStr) return 0;
        const partes = dataStr.split('/');
        if (partes.length !== 3) return 0;
        const [dia, mes, ano] = partes.map(Number);
        return new Date(ano, mes - 1, dia).getTime();
      };
      return converte(b.data) - converte(a.data);
    });
    
    return resultados;
  } catch (err) {
    Logger.log("ERRO em consultarEnvios: " + err.message);
    return [];
  }
}
// ======================= doPost =======================
function doPost(e) {
  try {
    const { nome, acao, dados } = e.parameter;
    const endpoint = `post_${acao || 'desconhecido'}`;
    const imei = e.parameter.imei || '';
    const localizacaoGps = e.parameter.localizacaoGps || '';
    
    if (acao === "Login bem-sucedido" || (!dados && nome)) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let logSheet = ss.getSheetByName("Log_Acessos");
      if (!logSheet) {
        logSheet = ss.insertSheet("Log_Acessos");
        logSheet.appendRow(["Data e Hora", "Apelido", "Nome Completo", "Cargo/Função", "Ação"]);
      }
      const sheetLogin = ss.getSheetByName("login");
      const data = sheetLogin.getDataRange().getValues();
      let nomeCompleto = "Não encontrado";
      let cargo = "Não informado";
      for (let i = 1; i < data.length; i++) {
        if (data[i][2] === nome) {
          nomeCompleto = data[i][1] || nome;
          cargo = data[i][4] || "";
          break;
        }
      }
      const dataHora = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");
      logSheet.appendRow([dataHora, nome, nomeCompleto, cargo, acao]);
      
      // Registrar no LogModule também (padronização)
      LogModule.registrarAcesso(nome, 'LOGIN_POST', acao, endpoint, imei, localizacaoGps);
      
      return ContentService.createTextOutput("Log registrado com sucesso").setMimeType(ContentService.MimeType.TEXT);
    }
    if (acao === "inspecao_veicular" && dados) {
      const dadosObj = JSON.parse(dados);
      salvarInspecao(dadosObj);
      const fiscal = dadosObj.fiscal || 'Desconhecido';
      LogModule.registrarAcesso(fiscal, 'INSPECAO_SALVA', `Carro: ${dadosObj.carro||''}`, endpoint, imei, localizacaoGps);
      return ContentService.createTextOutput("Inspeção registrada com sucesso").setMimeType(ContentService.MimeType.TEXT);
    }
    if (acao === "envio_informacoes" && dados) {
      const dadosObj = JSON.parse(dados);
      salvarEnvioInformacoes(dadosObj);
      const fiscal = dadosObj.fiscal || 'Desconhecido';
      LogModule.registrarAcesso(fiscal, 'ENVIO_SALVO', `Motivo: ${dadosObj.motivo||''}, Area: ${dadosObj.areaDestino||''}`, endpoint, imei, localizacaoGps);
      return ContentService.createTextOutput("Envio registrado com sucesso").setMimeType(ContentService.MimeType.TEXT);
    }
    // ADMINISTRAÇÃO - SALVAR CONFIGURAÇÕES
    if (acao === "admin_save_config" && dados) {
      const dadosObj = JSON.parse(dados);
      const resultado = adminSaveConfig(dadosObj);
      if (resultado.sucesso) {
        return ContentService.createTextOutput(JSON.stringify(resultado)).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify(resultado)).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // ADMINISTRAÇÃO - SALVAR USUÁRIO (edição)
    if (acao === "admin_save_usuario" && dados) {
      const dadosObj = JSON.parse(dados);
      const resultado = adminSaveUsuario(dadosObj);
      return ContentService.createTextOutput(JSON.stringify(resultado)).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ADMINISTRAÇÃO - CRIAR USUÁRIO
    if (acao === "admin_create_usuario" && dados) {
      const dadosObj = JSON.parse(dados);
      const resultado = adminCreateUsuario(dadosObj);
      return ContentService.createTextOutput(JSON.stringify(resultado)).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ADMINISTRAÇÃO - EXCLUIR USUÁRIO
    if (acao === "admin_delete_usuario" && dados) {
      const apelido = e.parameter.apelido;
      const resultado = adminDeleteUsuario(apelido);
      return ContentService.createTextOutput(JSON.stringify(resultado)).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ADMINISTRAÇÃO - HABILITAR/DESABILITAR USUÁRIO
    if (acao === "admin_toggle_usuario" && dados) {
      const apelido = e.parameter.apelido;
      const ativo = e.parameter.ativo === 'SIM';
      const resultado = adminToggleUsuario(apelido, ativo);
      return ContentService.createTextOutput(JSON.stringify(resultado)).setMimeType(ContentService.MimeType.JSON);
    }
    
    LogModule.registrarAcesso('Anonimo', 'POST_DESCONHECIDO', `acao: ${acao||''}`, endpoint, imei, localizacaoGps);
    return ContentService.createTextOutput("Ação desconhecida").setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    Logger.log("ERRO em doPost: " + err.message);
    LogModule.registrarAcesso('Sistema', 'ERRO_POST', err.message, `post_${e.parameter.acao || 'desconhecido'}`, e.parameter.imei || '', e.parameter.localizacaoGps || '');
    return ContentService.createTextOutput("Erro: " + err.message).setMimeType(ContentService.MimeType.TEXT);
  }
}

// ======================= doGet (rota para JSONP) - VERSÃO CORRIGIDA =======================
function doGet(e) {
  const acao = e.parameter.acao;
  const callback = e.parameter.callback;
  
  // Função auxiliar para enviar resposta JSONP
  function enviarResposta(dados) {
    if (callback) {
      const json = JSON.stringify(dados);
      const resposta = callback + '(' + json + ');';
      return ContentService
        .createTextOutput(resposta)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      return ContentService
        .createTextOutput(JSON.stringify(dados))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  // Função para enviar erro
  function enviarErro(mensagem) {
    const erroObj = { erro: mensagem };
    if (callback) {
      const json = JSON.stringify(erroObj);
      const resposta = callback + '(' + json + ');';
      return ContentService
        .createTextOutput(resposta)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      return ContentService
        .createTextOutput(JSON.stringify(erroObj))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  try {
    // Registrar endpoint acessado
    const usuario = e.parameter.apelido || e.parameter.fiscal || 'Anonimo';
    const endpoint = `get_${acao}`;
    const imei = e.parameter.imei || '';
    const localizacaoGps = e.parameter.localizacaoGps || '';
    
    // TERMINAIS
    if (acao === "terminais") {
      const terminais = listarTerminais();
      LogModule.registrarAcesso(usuario, 'CONSULTA_TERMINAIS', '', endpoint, imei, localizacaoGps);
      return enviarResposta(terminais);
    }
    
    if (acao === "terminais_todos") {
      const terminais = listarTodosTerminais();
      LogModule.registrarAcesso(usuario, 'CONSULTA_TERMINAIS_TODOS', '', endpoint, imei, localizacaoGps);
      return enviarResposta(terminais);
    }
    
    // CONSULTA INSPEÇÕES
    if (acao === "consultar_inspecoes") {
      const fiscal = e.parameter.fiscal || null;
      const dataInicio = e.parameter.dataInicio || null;
      const dataFim = e.parameter.dataFim || null;
      const carro = e.parameter.carro || null;
      const fiscalFiltro = e.parameter.fiscalFiltro || null;
      const resultado = consultarInspecoes(fiscal, dataInicio, dataFim, carro, fiscalFiltro);
      LogModule.registrarAcesso(usuario, 'CONSULTA_INSPICOES', `fiscal:${fiscal||''},dataInicio:${dataInicio||''},dataFim:${dataFim||''}`, endpoint, imei, localizacaoGps);
      return enviarResposta(resultado);
    }
    // CONSULTAR ENVIOS  
  if (acao === "consultar_envios") {
  const fiscal = e.parameter.fiscal || null;
  const dataInicio = e.parameter.dataInicio || null;
  const dataFim = e.parameter.dataFim || null;
  const motivo = e.parameter.motivo || null;
  const carro = e.parameter.carro || null;
  const prefixo = e.parameter.prefixo || null;
  const fiscalFiltro = e.parameter.fiscalFiltro || null;
  const papel = e.parameter.papel || '';
  const apelido = e.parameter.apelido || '';
  const resultado = consultarEnvios(fiscal, dataInicio, dataFim, motivo, carro, prefixo, fiscalFiltro, papel, apelido);
  LogModule.registrarAcesso(usuario, 'CONSULTA_ENVIOS', `papel:${papel},fiscal:${fiscal||''},dataInicio:${dataInicio||''},dataFim:${dataFim||''}`, endpoint, imei, localizacaoGps);
  return enviarResposta(resultado);
}
    
    // CONSULTAR LOGS DE AUDITORIA
    if (acao === "consultar_logs") {
      const filtroEmail = e.parameter.email || null;
      const dataInicioLogs = e.parameter.dataInicio || null;
      const dataFimLogs = e.parameter.dataFim || null;
      const resultado = LogModule.consultarLogs(filtroEmail, dataInicioLogs, dataFimLogs);
      return enviarResposta(resultado);
    }
    
    // ADMINISTRAÇÃO - OBTER CONFIGURAÇÕES
    if (acao === "admin_get_config") {
      const resultado = adminGetConfig();
      return enviarResposta(resultado);
    }
    
    // ADMINISTRAÇÃO - OBTER USUÁRIOS
    if (acao === "admin_get_usuarios") {
      const filtro = e.parameter.filtro || '';
      const resultado = adminGetUsuarios(filtro);
      return enviarResposta(resultado);
    }
    
    // ADMINISTRAÇÃO - LIMPAR INSPEÇÕES ANTIGAS (com backup)
    if (acao === "limpar_inspecoes_antigas") {
      const resultado = limparInspecoesAntigas();
      LogModule.registrarAcesso(usuario, 'LIMPEZA_INSPICOES', JSON.stringify(resultado), endpoint, imei, localizacaoGps);
      return enviarResposta(resultado);
    }
    
    // LOGIN
    if (acao === "login") {
      const senhaDigitada = e.parameter.senha;
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheetLogin = ss.getSheetByName("login");
      
      if (!sheetLogin) {
        return enviarResposta({ sucesso: false, erro: 'Planilha de login não encontrada' });
      }
      
      const data = sheetLogin.getDataRange().getValues();
      
      let usuarioEncontrado = { sucesso: false };
      
      for (let i = 1; i < data.length; i++) {
        // Estrutura da planilha login:
        // Coluna 0: ID/Matrícula (opcional)
        // Coluna 1: Nome completo
        // Coluna 2: Apelido (username)
        // Coluna 3: (reservado)
        // Coluna 4: Função
        // Coluna 5: Ativo (SIM/NAO)
        // Coluna 6: Hash da senha
        const nome = data[i][1];
        const apelido = data[i][2];
        const hashPlanilha = String(data[i][6] || "").trim();
        const funcao = data[i][4];
        const ativo = data[i][5];
        
        // Verifica se há um hash armazenado e se o usuário está ativo
        if (apelido && hashPlanilha && ativo === "SIM") {
          const hashCalculado = gerarHashComSalt(senhaDigitada, apelido);
          if (hashCalculado === hashPlanilha) {
            usuarioEncontrado = {
              sucesso: true,
              nome: nome,
              apelido: apelido,
              funcao: funcao
            };
            LogModule.registrarAcesso(apelido, 'LOGIN_SUCESSO', `Perfil: ${funcao}`, endpoint, imei, localizacaoGps);
            break;
          }
        }
      }
      
      if (!usuarioEncontrado.sucesso) {
        const apelidoLogin = e.parameter.apelido || e.parameter.fiscal || 'Usuario';
        LogModule.registrarAcesso(apelidoLogin, 'LOGIN_FALHA', '', endpoint, imei, localizacaoGps);
      }
      
      return enviarResposta(usuarioEncontrado);
    }
    
    // Fallback
    return enviarErro("Ação inválida: " + acao);
    
  } catch (err) {
    Logger.log("ERRO em doGet: " + err.message);
    LogModule.registrarAcesso('Sistema', 'ERRO_DOGET', err.message, `get_${e.parameter.acao || 'desconhecido'}`, e.parameter.imei || '', e.parameter.localizacaoGps || '');
    return enviarErro("Erro interno: " + err.message);
  }
}

// ======================= HASH E MIGRAÇÃO =======================
function gerarHashComSalt(senha, salt) {
  const stringCombinada = senha + salt;
  const hashBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, stringCombinada, Utilities.Charset.UTF_8);
  return hashBytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function migrarSenhasParaHashComSalt() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("login");
  const data = sheet.getDataRange().getValues();
  if (data[0].length < 7 || data[0][6] !== "senha_hash") {
    sheet.getRange(1, 7).setValue("senha_hash");
  }
  let alterados = 0;
  for (let i = 1; i < data.length; i++) {
    const senhaPlana = String(data[i][3] || "").trim();
    const apelido = data[i][2];
    const hashAtual = String(data[i][6] || "").trim();
    if (senhaPlana && apelido && !hashAtual) {
      const novoHash = gerarHashComSalt(senhaPlana, apelido);
      sheet.getRange(i + 1, 7).setValue(novoHash);
      alterados++;
    }
  }
  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert(`Migração concluída!\n\n${alterados} senhas convertidas.`);
}

// ======================= FUNÇÕES DE TESTE DO DRIVE =======================
function testDrive() {
  const pasta = DriveApp.getFolderById("1BrN9zxFViGbQu0ZDp0MzVDIZ0lKAYqxP");
  Logger.log(pasta.getName());
}

function forcarPermissaoDrive() {
  DriveApp.getRootFolder();
}

function testarDrive() {
  try {
    const pasta = DriveApp.getFolderById("1BrN9zxFViGbQu0ZDp0MzVDIZ0lKAYqxP");
    console.log("✅ Sucesso! Pasta encontrada: " + pasta.getName());
    console.log("🔗 URL da Pasta: " + pasta.getUrl());
    return "Pasta acessada com sucesso!";
  } catch (e) {
    console.error("❌ ERRO NO DRIVE: " + e.toString());
    return "Erro: " + e.toString();
  }
}

function testarArrayAnexos() {
  const testData = {
    areaDestino: "FISCALIZAÇÃO",
    motivo: "AVARIAS",
    carro: "1234",
    fiscal: "TESTE",
    anexos: [
      { base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", mimeType: "image/png", nome: "teste.png" }
    ]
  };
  const result = salvarEnvioInformacoes(testData);
  console.log("Resultado:", result);
}
// ============================================================================
// MÓDULO: ADMINISTRAÇÃO DO SISTEMA (PAINEL ADMIN)
// ============================================================================
const AdminModule = {
  /**
   * Obtém ou cria a planilha de configurações do Admin
   */
  getSheet: function() {
    const ss = openSheetByName('Admin');
    let sheet = ss.getSheetByName('Configuracoes');
    if (!sheet) {
      sheet = ss.insertSheet('Configuracoes');
      sheet.appendRow(['Chave', 'Valor', 'Descricao']);
      // Configurações padrão
      sheet.appendRow(['TIMEOUT_INATIVIDADE', '1200000', 'Tempo de inatividade em ms (20 min)']);
      sheet.appendRow(['MODO_DEBUG', 'FALSE', 'Ativa modo debug']);
      sheet.appendRow(['BOTOES_CLANDESTINOS', '[]', 'Botões personalizados Clandestinos/RTO']);
      sheet.appendRow(['BOTOES_LEVANTAMENTOS', '[]', 'Botões personalizados Levantamentos']);
      sheet.appendRow(['BOTOES_INSPICOES_5S', '[]', 'Botões personalizados Inspeções 5S']);
    }
    return sheet;
  },
  
  /**
   * Obtém uma configuração específica
   */
  getConfig: function(chave, valorPadrao) {
    try {
      const sheet = this.getSheet();
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === chave) {
          return data[i][1];
        }
      }
      return valorPadrao;
    } catch (e) {
      Logger.log('Erro ao buscar config ' + chave + ': ' + e.message);
      return valorPadrao;
    }
  },
  
  /**
   * Salva uma configuração
   */
  setConfig: function(chave, valor, descricao) {
    try {
      const sheet = this.getSheet();
      const data = sheet.getDataRange().getValues();
      let encontrou = false;
      
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === chave) {
          sheet.getRange(i + 1, 2).setValue(valor);
          if (descricao) {
            sheet.getRange(i + 1, 3).setValue(descricao);
          }
          encontrou = true;
          break;
        }
      }
      
      if (!encontrou) {
        sheet.appendRow([chave, valor, descricao || '']);
      }
      
      return true;
    } catch (e) {
      Logger.log('Erro ao salvar config ' + chave + ': ' + e.message);
      return false;
    }
  },
  
  /**
   * Obtém todas as configurações de botões
   */
  getBotoesConfig: function() {
    return {
      clandestinos: JSON.parse(this.getConfig('BOTOES_CLANDESTINOS', '[]')),
      levantamentos: JSON.parse(this.getConfig('BOTOES_LEVANTAMENTOS', '[]')),
      inspecoes5s: JSON.parse(this.getConfig('BOTOES_INSPICOES_5S', '[]'))
    };
  },
  
  /**
   * Salva configurações de botões
   */
  saveBotoesConfig: function(botoes) {
    const success = 
      this.setConfig('BOTOES_CLANDESTINOS', JSON.stringify(botoes.clandestinos || []), 'Botões Clandestinos/RTO') &&
      this.setConfig('BOTOES_LEVANTAMENTOS', JSON.stringify(botoes.levantamentos || []), 'Botões Levantamentos') &&
      this.setConfig('BOTOES_INSPICOES_5S', JSON.stringify(botoes.inspecoes5s || []), 'Botões Inspeções 5S');
    return success;
  },
  
  /**
   * Obtém timeout de inatividade configurado
   */
  getTimeoutInatividade: function() {
    const valor = this.getConfig('TIMEOUT_INATIVIDADE', '1200000');
    return parseInt(valor, 10) || CONFIG.TIMEOUT_INATIVIDADE;
  }
};

// ============================================================================
// ENDPOINTS DE ADMINISTRAÇÃO (API para o painel admin)
// ============================================================================

/**
 * Endpoint para obter configurações do admin
 * Uso: ?acao=admin_get_config
 */
function adminGetConfig() {
  try {
    const botoes = AdminModule.getBotoesConfig();
    const timeout = AdminModule.getTimeoutInatividade();
    const modoDebug = AdminModule.getConfig('MODO_DEBUG', 'FALSE');
    
    return {
      sucesso: true,
      dados: {
        botoes: botoes,
        timeout: timeout,
        modoDebug: modoDebug === 'TRUE'
      }
    };
  } catch (e) {
    Logger.log('Erro em adminGetConfig: ' + e.message);
    return { sucesso: false, erro: e.message };
  }
}

/**
 * Endpoint para salvar configurações do admin
 * Uso: POST com acao=admin_save_config e dados={botoes: {...}}
 */
function adminSaveConfig(dadosJson) {
  try {
    const { botoes, timeout, modoDebug } = dadosJson;
    
    if (botoes) {
      AdminModule.saveBotoesConfig(botoes);
    }
    
    if (timeout) {
      AdminModule.setConfig('TIMEOUT_INATIVIDADE', String(timeout), 'Tempo de inatividade em ms');
    }
    
    if (modoDebug !== undefined) {
      AdminModule.setConfig('MODO_DEBUG', modoDebug ? 'TRUE' : 'FALSE', 'Ativa modo debug');
    }
    
    LogModule.registrarAcesso('ADMIN', 'CONFIG_SALVA', JSON.stringify(dadosJson), 'admin_save_config');
    
    return { sucesso: true, mensagem: 'Configurações salvas com sucesso!' };
  } catch (e) {
    Logger.log('Erro em adminSaveConfig: ' + e.message);
    return { sucesso: false, erro: e.message };
  }
}

// ============================================================================
// FUNÇÕES DE GERENCIAMENTO DE USUÁRIOS (Admin)
// ============================================================================

/**
 * Obtém usuários da planilha de login com filtro opcional por apelido/chapa ou nome
 */
function adminGetUsuarios(filtro) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetLogin = ss.getSheetByName("login");
    if (!sheetLogin) {
      return { sucesso: false, erro: 'Planilha de login não encontrada' };
    }
    
    const data = sheetLogin.getDataRange().getValues();
    const usuarios = [];
    
    // Cabeçalho esperado: [matricula, nome, apelido, senha, funcao, ativo, hash]
    for (let i = 1; i < data.length; i++) {
      const matricula = String(data[i][0] || '');
      const nome = String(data[i][1] || '');
      const apelido = String(data[i][2] || '');
      const funcao = String(data[i][4] || '');
      const ativo = String(data[i][5] || 'NAO');
      
      // Aplica filtro se fornecido (busca por apelido, matrícula ou nome)
      if (filtro) {
        const filtroLower = filtro.toLowerCase();
        if (apelido.toLowerCase().indexOf(filtroLower) === -1 && 
            nome.toLowerCase().indexOf(filtroLower) === -1 &&
            matricula.toLowerCase().indexOf(filtroLower) === -1) {
          continue;
        }
      }
      
      usuarios.push({
        matricula: matricula,
        nome: nome,
        apelido: apelido,
        funcao: funcao,
        ativo: ativo
      });
    }
    
    return { sucesso: true, usuarios: usuarios };
  } catch (e) {
    Logger.log('Erro em adminGetUsuarios: ' + e.message);
    return { sucesso: false, erro: e.message, usuarios: [] };
  }
}

/**
 * Salva/Atualiza usuário (edição de função e senha)
 */
function adminSaveUsuario(dados) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetLogin = ss.getSheetByName("login");
    if (!sheetLogin) {
      return { sucesso: false, erro: 'Planilha de login não encontrada' };
    }
    
    const { apelido, funcao, senha } = dados;
    if (!apelido) {
      return { sucesso: false, erro: 'Apelido é obrigatório' };
    }
    
    const data = sheetLogin.getDataRange().getValues();
    let encontrou = false;
    
    for (let i = 1; i < data.length; i++) {
      const rowApelido = data[i][2];
      if (rowApelido === apelido) {
        // Atualiza função (coluna E - índice 4)
        if (funcao) {
          sheetLogin.getRange(i + 1, 5).setValue(funcao);
        }
        
        // Atualiza senha se fornecida (coluna G - índice 6)
        if (senha) {
          const novoHash = gerarHashComSalt(senha, apelido);
          sheetLogin.getRange(i + 1, 7).setValue(novoHash);
        }
        
        encontrou = true;
        break;
      }
    }
    
    if (!encontrou) {
      return { sucesso: false, erro: 'Usuário não encontrado' };
    }
    
    LogModule.registrarAcesso('ADMIN', 'USUARIO_ATUALIZADO', `apelido:${apelido}`, 'admin_save_usuario');
    return { sucesso: true, mensagem: 'Usuário atualizado com sucesso!' };
  } catch (e) {
    Logger.log('Erro em adminSaveUsuario: ' + e.message);
    return { sucesso: false, erro: e.message };
  }
}

/**
 * Cria novo usuário
 */
function adminCreateUsuario(dados) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetLogin = ss.getSheetByName("login");
    if (!sheetLogin) {
      return { sucesso: false, erro: 'Planilha de login não encontrada' };
    }
    
    const { matricula, nome, apelido, funcao, senha } = dados;
    if (!matricula || !apelido || !nome || !senha) {
      return { sucesso: false, erro: 'Matrícula, nome, apelido e senha são obrigatórios' };
    }
    
    // Verifica se apelido já existe
    const data = sheetLogin.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === apelido) {
        return { sucesso: false, erro: 'Apelido já cadastrado' };
      }
    }
    
    // Gera hash da senha
    const hash = gerarHashComSalt(senha, apelido);
    
    // Adiciona nova linha na estrutura: [matricula, nome, apelido, (reservado), funcao, ativo, hash]
    sheetLogin.appendRow([matricula, nome, apelido, '', funcao, 'SIM', hash]);
    
    LogModule.registrarAcesso('ADMIN', 'USUARIO_CRIADO', `apelido:${apelido}`, 'admin_create_usuario');
    return { sucesso: true, mensagem: 'Usuário criado com sucesso!' };
  } catch (e) {
    Logger.log('Erro em adminCreateUsuario: ' + e.message);
    return { sucesso: false, erro: e.message };
  }
}

/**
 * Exclui usuário
 */
function adminDeleteUsuario(apelido) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetLogin = ss.getSheetByName("login");
    if (!sheetLogin) {
      return { sucesso: false, erro: 'Planilha de login não encontrada' };
    }
    
    if (!apelido) {
      return { sucesso: false, erro: 'Apelido é obrigatório' };
    }
    
    const data = sheetLogin.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === apelido) {
        sheetLogin.deleteRow(i + 1);
        LogModule.registrarAcesso('ADMIN', 'USUARIO_EXCLUIDO', `apelido:${apelido}`, 'admin_delete_usuario');
        return { sucesso: true, mensagem: 'Usuário excluído com sucesso!' };
      }
    }
    
    return { sucesso: false, erro: 'Usuário não encontrado' };
  } catch (e) {
    Logger.log('Erro em adminDeleteUsuario: ' + e.message);
    return { sucesso: false, erro: e.message };
  }
}

/**
 * Habilita ou desabilita usuário
 */
function adminToggleUsuario(apelido, ativo) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetLogin = ss.getSheetByName("login");
    if (!sheetLogin) {
      return { sucesso: false, erro: 'Planilha de login não encontrada' };
    }
    
    if (!apelido) {
      return { sucesso: false, erro: 'Apelido é obrigatório' };
    }
    
    const data = sheetLogin.getDataRange().getValues();
    const valorAtivo = ativo ? 'SIM' : 'NAO';
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === apelido) {
        // Coluna 6 (índice 5) é o campo 'ativo'
        sheetLogin.getRange(i + 1, 6).setValue(valorAtivo);
        LogModule.registrarAcesso('ADMIN', 'USUARIO_TOGGLE', `apelido:${apelido},ativo:${valorAtivo}`, 'admin_toggle_usuario');
        return { sucesso: true, mensagem: `Usuário ${ativo ? 'habilitado' : 'desabilitado'} com sucesso!` };
      }
    }
    
    return { sucesso: false, erro: 'Usuário não encontrado' };
  } catch (e) {
    Logger.log('Erro em adminToggleUsuario: ' + e.message);
    return { sucesso: false, erro: e.message };
  }
}
