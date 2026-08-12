/**
 * Módulo de Tacógrafo
 * Formulário e consulta de cadastramentos de motoristas no tacógrafo
 */

class TacografoModule {
  constructor() {
    this.modal = new ModalController('modal-tacografo');
    this.initEventListeners();
  }
  
  close() {
    this.modal.close();
  }

  initEventListeners() {
    getEl('btn-tacografo')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.open();
    });

    getEl('btn-enviar-tacografo')?.addEventListener('click', () => this.enviarCadastro());
    getEl('btn-conferir-tacografos')?.addEventListener('click', () => this.conferirCadastramentos());
  }

  async open() {
    if (canCreateInspection) {
      preencherSelectTerminais();
      this.openForm();
    } else {
      await this.conferirCadastramentos();
    }
  }

  openForm() {
    this.modal.open();
    this.preencherAutomatico();
    this.resetarFormulario();
    const btn = getEl('btn-conferir-tacografos');
    if (btn)
      btn.style.display =
        currentUserRole === 'FISCAL' || currentUserRole === 'INSPETOR' || currentUserRole === 'ADMIN' ? 'block' : 'none';
  }

  preencherAutomatico() {
    const apelido =
      localStorage.getItem('inspectorApelido') ||
      localStorage.getItem('inspectorName') ||
      'Inspetor';
    if (getEl('tacografo-fiscal')) getEl('tacografo-fiscal').value = apelido;
    const agora = new Date();
    if (getEl('tacografo-data'))
      getEl('tacografo-data').value = agora.toLocaleDateString('pt-BR');
    if (getEl('tacografo-hora'))
      getEl('tacografo-hora').value = agora.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
  }

  atualizarDataHora() {
    const agora = new Date();
    if (getEl('tacografo-data'))
      getEl('tacografo-data').value = agora.toLocaleDateString('pt-BR');
    if (getEl('tacografo-hora'))
      getEl('tacografo-hora').value = agora.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
  }

  resetarFormulario() {
    if (getEl('tacografo-terminal')) getEl('tacografo-terminal').value = '';
    if (getEl('tacografo-linha')) getEl('tacografo-linha').value = '';
    if (getEl('tacografo-carro')) getEl('tacografo-carro').value = '';
    if (getEl('tacografo-motorista')) getEl('tacografo-motorista').value = '';
  }

  coletarDados() {
    const terminal = getEl('tacografo-terminal')?.value.trim();
    const linha = getEl('tacografo-linha')?.value.trim();
    const carro = getEl('tacografo-carro')?.value.trim();
    const motorista = getEl('tacografo-motorista')?.value.trim();
    const fiscal = getEl('tacografo-fiscal')?.value.trim();
    const data = getEl('tacografo-data')?.value;
    const hora = getEl('tacografo-hora')?.value;
    
    if (!terminal || !linha || !carro || !motorista) {
      alert('Preencha todos os campos: TERMINAL, LINHA, CARRO e MOTORISTA.');
      return null;
    }
    
    return { terminal, linha, carro, motorista, fiscal, data, hora };
  }

  async enviarCadastro() {
    if (!canCreateInspection) {
      alert('Seu perfil não permite criar cadastramentos de tacógrafo.');
      return;
    }
    this.atualizarDataHora();
    const dados = this.coletarDados();
    if (!dados) return;

    const dadosEnvio = {
      terminal: dados.terminal,
      linha: dados.linha,
      carro: dados.carro,
      motorista: dados.motorista,
      fiscal: dados.fiscal,
      data: dados.data,
      hora: dados.hora
    };

    let resumo = `CONFIRMAR ENVIO?\n\nTerminal: ${dadosEnvio.terminal}\nLinha: ${dadosEnvio.linha}\nCarro: ${dadosEnvio.carro}\nMotorista: ${dadosEnvio.motorista}\nFiscal: ${dadosEnvio.fiscal}\nData/Hora: ${dados.data} ${dados.hora}\n\nDeseja enviar os dados?`;
    if (!confirm(resumo)) return;

    try {
      await fetch(URL_PLANILHA, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          acao: 'tacografo_cadastro',
          dados: JSON.stringify(dadosEnvio),
        }),
      });
      alert('✅ Cadastramento de tacógrafo enviado com sucesso!');
      this.resetarFormulario();
    } catch (err) {
      console.error(err);
      alert('❌ Erro ao enviar. Tente novamente.');
    }
  }

  // ======================== CONSULTAS COM VALIDAÇÕES ========================
  conferirCadastramentos() {
    const hoje = new Date().toISOString().split('T')[0];
    this.conferirCadastramentosComFiltro(hoje, hoje, null, null);
  }

  conferirCadastramentosComFiltro(dataInicio, dataFim, carro, fiscalFiltro) {
    // --- Validações de data ---
    const hojeStr = new Date().toISOString().split('T')[0];

    if (dataInicio && dataInicio > hojeStr) {
      alert('A data de início não pode ser maior que a data atual.');
      return;
    }
    if (dataFim && dataFim > hojeStr) {
      alert('A data de fim não pode ser maior que a data atual.');
      return;
    }
    if (dataInicio && dataFim && dataInicio > dataFim) {
      alert('A data de início não pode ser maior que a data de fim.');
      return;
    }

    const params = new URLSearchParams();
    params.append('acao', 'consultar_tacografos');
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);
    if (carro) params.append('carro', carro);
    if (fiscalFiltro) params.append('fiscalFiltro', fiscalFiltro);
    // Fiscais veem apenas seus próprios registros
    if (currentUserRole === 'FISCAL') {
      params.append(
        'fiscal',
        localStorage.getItem('inspectorApelido') ||
          localStorage.getItem('inspectorName')
      );
    }
    return this._executarConsulta(params);
  }

  _executarConsulta(params) {
    return new Promise((resolve, reject) => {
      const callbackName = 'consultarTacografosCallback_' + Date.now();
      window[callbackName] = dados => {
        if (dados && dados.erro) {
          alert('Erro ao consultar: ' + dados.erro);
        } else {
          mostrarModalConferirTacografos(dados || [], currentUserRole, params);
        }
        delete window[callbackName];
        resolve();
      };
      params.append('callback', callbackName);
      const url = `${URL_PLANILHA}?${params.toString()}`;
      const script = document.createElement('script');
      script.src = url;
      script.onerror = () => {
        delete window[callbackName];
        alert('Erro ao consultar. Verifique sua conexão.');
        reject();
      };
      document.body.appendChild(script);
    });
  }
}

// ====================================================================
// FUNÇÕES GLOBAIS DO MODAL DE CONSULTA DE TACÓGRAFO
// ====================================================================

function mostrarModalConferirTacografos(cadastramentos, role, params) {
  const modal = getEl('modal-conferir-tacografos');
  const container = getEl('lista-tacografos');
  if (!modal || !container) return;

  const hoje = new Date().toISOString().split('T')[0];
  // Fiscais só podem ver seus próprios registros; outros perfis veem todos
  const isFiscal = role === 'FISCAL';
  const rolesQueVeemTodos = ['INSPETOR', 'ENCARREGADO', 'SAF', 'ADMIN', 'GERENTE', 'PLANTONISTA'];
  const podeVerTodos = rolesQueVeemTodos.includes(role);

  // --- Cria o painel de filtros (se não existir) ---
  if (!document.getElementById('filtros-tacografo')) {
    const filtrosDiv = document.createElement('div');
    filtrosDiv.id = 'filtros-tacografo';
    filtrosDiv.style.marginBottom = '15px';
    filtrosDiv.style.padding = '10px';
    filtrosDiv.style.background = 'var(--card-bg)';
    filtrosDiv.style.borderRadius = '8px';

    let htmlFiltros = `
      <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end;">
        <div><label>Data Início</label><input type="date" id="filtro-tacografo-data-inicio" value="${hoje}" max="${hoje}"></div>
        <div><label>Data Fim</label><input type="date" id="filtro-tacografo-data-fim" value="${hoje}" max="${hoje}"></div>
        <div><label>Carro</label><input type="text" id="filtro-tacografo-carro" placeholder="Prefixo"></div>
    `;

    if (!isFiscal && podeVerTodos) {
      htmlFiltros += `<div><label>Fiscal</label><input type="text" id="filtro-tacografo-fiscal" placeholder="Apelido"></div>`;
    }

    htmlFiltros += `
        <div><button id="btn-aplicar-filtros-tacografo" class="btn-secundario">🔍 Aplicar</button></div>
        <div><button id="btn-limpar-filtros-tacografo" class="btn-secundario">🗑️ Limpar</button></div>
      </div>
    `;

    filtrosDiv.innerHTML = htmlFiltros;
    container.parentNode.insertBefore(filtrosDiv, container);

    // Evento Aplicar
    document
      .getElementById('btn-aplicar-filtros-tacografo')
      .addEventListener('click', () => {
        const dataInicio = document.getElementById('filtro-tacografo-data-inicio').value;
        const dataFim = document.getElementById('filtro-tacografo-data-fim').value;
        const carro = document.getElementById('filtro-tacografo-carro').value;
        const fiscalFiltro =
          !isFiscal && podeVerTodos ? document.getElementById('filtro-tacografo-fiscal').value : null;
        window.modals.tacografo.conferirCadastramentosComFiltro(
          dataInicio,
          dataFim,
          carro,
          fiscalFiltro
        );
      });

    // Evento Limpar
    document
      .getElementById('btn-limpar-filtros-tacografo')
      .addEventListener('click', () => {
        document.getElementById('filtro-tacografo-data-inicio').value = hoje;
        document.getElementById('filtro-tacografo-data-fim').value = hoje;
        document.getElementById('filtro-tacografo-carro').value = '';
        if (!isFiscal && podeVerTodos)
          document.getElementById('filtro-tacografo-fiscal').value = '';
        window.modals.tacografo.conferirCadastramentos();
      });
  }

  // --- Agrupa os cadastramentos por data (formato dd/MM/yyyy) ---
  const grouped = {};
  cadastramentos.forEach(cad => {
    let dataStr = 'Data desconhecida';
    if (cad.dataHora) {
      const partes = cad.dataHora.split(' ')[0]; // "dd/MM/yyyy"
      if (partes && partes.match(/\d{2}\/\d{2}\/\d{4}/)) {
        dataStr = partes;
      }
    }
    if (!grouped[dataStr]) grouped[dataStr] = [];
    grouped[dataStr].push(cad);
  });

  // Ordena as datas (da mais recente para a mais antiga)
  const datasOrdenadas = Object.keys(grouped).sort((a, b) => {
    const [da, ma, aa] = a.split('/');
    const [db, mb, ab] = b.split('/');
    return new Date(ab, mb - 1, db) - new Date(aa, ma - 1, da);
  });

  // --- Gera o HTML agrupado ---
  let html = `<div style="margin-bottom: 12px; text-align: right;">
                <button id="exportar-lista-tacografo" class="btn-secundario">📋 Exportar para texto</button>
                <button id="exportar-csv-tacografo" class="btn-secundario" style="margin-left: 8px;">📊 Exportar CSV</button>
              </div>`;

  if (datasOrdenadas.length === 0) {
    html += `<div style="text-align: center; padding: 30px 10px; font-weight: 500;">Nenhum cadastramento encontrado para os filtros selecionados.</div>`;
  } else {
    for (const data of datasOrdenadas) {
      const cadastramentosDaData = grouped[data];
      // Cabeçalho da data
      html += `<div style="margin-top: 20px; margin-bottom: 10px; padding: 8px; background: var(--accent); color: white; border-radius: 8px; font-weight: bold;">📅 ${data}</div>`;

      for (const cad of cadastramentosDaData) {
        html += `<div style="background: var(--card-bg); margin: 10px 0; padding: 12px; border-radius: 8px; border-left: 4px solid var(--accent);">`;
        html += `<strong>Carro: ${cad.carro} | Linha: ${cad.linha}</strong><br>`;
        html += `<small>Terminal: ${cad.terminal} | Motorista: ${cad.motorista}</small><br>`;
        if (!isFiscal && podeVerTodos) {
          html += `<small>Fiscal: ${cad.fiscal}</small><br>`;
        }
        html += `</div>`;
      }
    }
  }

  container.innerHTML = html;

  // --- Evento do botão de exportação para texto ---
  const exportBtn = document.getElementById('exportar-lista-tacografo');
  if (exportBtn) {
    const novoBtn = exportBtn.cloneNode(true);
    exportBtn.parentNode.replaceChild(novoBtn, exportBtn);
    novoBtn.addEventListener('click', () => {
      const texto = gerarTextoExportacaoTacografo(cadastramentos, role, isFiscal);
      navigator.clipboard
        .writeText(texto)
        .then(() => alert('Lista copiada!'))
        .catch(() => alert('Erro ao copiar.'));
    });
  }

  // --- Evento do botão de exportação para CSV ---
  const csvBtn = document.getElementById('exportar-csv-tacografo');
  if (csvBtn) {
    const novoCsvBtn = csvBtn.cloneNode(true);
    csvBtn.parentNode.replaceChild(novoCsvBtn, csvBtn);
    novoCsvBtn.addEventListener('click', () => {
      const csv = gerarCSVExportacaoTacografo(cadastramentos);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const hojeFormatado = new Date().toISOString().split('T')[0];
      link.setAttribute('href', url);
      link.setAttribute('download', `tacografo_${hojeFormatado}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  modal.classList.add('is-open');
}

// ====================================================================
// EXPORTAÇÃO PARA TEXTO
// ====================================================================
function gerarTextoExportacaoTacografo(cadastramentos, role, isFiscal) {
  let texto = `=== CADASTRAMENTOS DE TACÓGRAFO ===\n\n`;

  // Agrupa por data
  const grouped = {};
  cadastramentos.forEach(cad => {
    let dataStr = 'Data desconhecida';
    if (cad.dataHora) {
      const partes = cad.dataHora.split(' ')[0];
      if (partes && partes.match(/\d{2}\/\d{2}\/\d{4}/)) dataStr = partes;
    }
    if (!grouped[dataStr]) grouped[dataStr] = [];
    grouped[dataStr].push(cad);
  });

  const datasOrdenadas = Object.keys(grouped).sort((a, b) => {
    const [da, ma, aa] = a.split('/');
    const [db, mb, ab] = b.split('/');
    return new Date(ab, mb - 1, db) - new Date(aa, ma - 1, da);
  });

  for (const data of datasOrdenadas) {
    texto += `📅 ${data}\n`;
    texto += `----------------------------------------\n`;
    for (const cad of grouped[data]) {
      texto += `Carro: ${cad.carro} | Linha: ${cad.linha}\n`;
      texto += `Terminal: ${cad.terminal}\n`;
      texto += `Motorista: ${cad.motorista}\n`;
      if (!isFiscal && podeVerTodos) {
        texto += `Fiscal: ${cad.fiscal}\n`;
      }
      texto += `\n`;
    }
    texto += `\n`;
  }
  return texto;
}

// ====================================================================
// EXPORTAÇÃO PARA CSV (ordenado por prefixo/carro, linha, motorista, fiscal, data)
// ====================================================================
function gerarCSVExportacaoTacografo(cadastramentos) {
  // Ordenar: carro (prefixo), linha, motorista, fiscal, data
  const ordenados = [...cadastramentos].sort((a, b) => {
    // Ordenar por carro (prefixo) - numérico se possível
    const carroA = parseInt(a.carro) || a.carro;
    const carroB = parseInt(b.carro) || b.carro;
    if (carroA < carroB) return -1;
    if (carroA > carroB) return 1;
    
    // Depois por linha
    if (a.linha < b.linha) return -1;
    if (a.linha > b.linha) return 1;
    
    // Depois por motorista
    if (a.motorista < b.motorista) return -1;
    if (a.motorista > b.motorista) return 1;
    
    // Depois por fiscal
    if (a.fiscal < b.fiscal) return -1;
    if (a.fiscal > b.fiscal) return 1;
    
    // Depois por data
    const dataA = a.dataHora ? a.dataHora.split(' ')[0].split('/').reverse().join('-') : '';
    const dataB = b.dataHora ? b.dataHora.split(' ')[0].split('/').reverse().join('-') : '';
    if (dataA < dataB) return -1;
    if (dataA > dataB) return 1;
    
    return 0;
  });

  // Cabeçalho CSV
  let csv = "Data;Hora;Terminal;Linha;Carro;Motorista;Fiscal\n";
  
  for (const cad of ordenados) {
    const dataHoraParts = cad.dataHora ? cad.dataHora.split(' ') : ['', ''];
    const data = dataHoraParts[0] || '';
    const hora = dataHoraParts[1] || '';
    const linha = [
      data,
      hora,
      cad.terminal || '',
      cad.linha || '',
      cad.carro || '',
      cad.motorista || '',
      cad.fiscal || ''
    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(';');
    csv += linha + '\n';
  }
  
  return csv;
}

// Função para fechar o modal de consulta
function fecharModalConferirTacografos() {
  const m = getEl('modal-conferir-tacografos');
  if (m) m.classList.remove('is-open');
}

// Exportar para escopo global
window.TacografoModule = TacografoModule;
window.mostrarModalConferirTacografos = mostrarModalConferirTacografos;
window.fecharModalConferirTacografos = fecharModalConferirTacografos;
window.gerarTextoExportacaoTacografo = gerarTextoExportacaoTacografo;
window.gerarCSVExportacaoTacografo = gerarCSVExportacaoTacografo;
