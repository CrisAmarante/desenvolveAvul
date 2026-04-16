// ====================================================================
// INSPEÇÃO VEICULAR - VERSÃO COMPLETA COM VALIDAÇÕES E AGRUPAMENTO
// ====================================================================
class InspecaoVeicular {
  constructor() {
    this.modal = new ModalController('modal-inspecao-veicular');
    this.initEventListeners();
  }

  close() {
    this.modal.close();
  }

  initEventListeners() {
    getEl('btn-inspecao-veicular')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.open();
    });

    // Configura os checkboxes e inputs de observação/posição
    document.querySelectorAll('#tabela-inspecao tbody tr').forEach(row => {
      const cbOk = row.querySelector('.ok');
      const cbDef = row.querySelector('.defeito');
      const obsInput = row.querySelector('.obs-input');
      const posBtns = row.querySelectorAll('.pos-btn');

      const atualizarEstadoLinha = () => {
        const isDefective = cbDef.checked;

        if (obsInput) {
          obsInput.disabled = !isDefective;
          if (!isDefective) obsInput.value = '';
        }

        if (posBtns) {
          posBtns.forEach(btn => {
            btn.disabled = !isDefective;
            if (!isDefective) btn.classList.remove('active');
          });
        }
      };

      if (cbOk && cbDef) {
        cbOk.addEventListener('change', () => {
          if (cbOk.checked) cbDef.checked = false;
          atualizarEstadoLinha();
        });
        cbDef.addEventListener('change', () => {
          if (cbDef.checked) cbOk.checked = false;
          atualizarEstadoLinha();
        });
      }
    });

    // Botões de posição (F, M, T)
    document.querySelectorAll('.pos-btn').forEach(btn =>
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!btn.disabled) {
          btn.classList.toggle('active');
        }
      })
    );

    getEl('btn-enviar-inspecao')?.addEventListener('click', () => this.enviarInspecao());
    getEl('btn-conferir-inspecoes')?.addEventListener('click', () => this.conferirInspecoes());
  }

  async open() {
    if (canCreateInspection) {
      preencherSelectTerminais();
      this.openForm();
    } else {
      await this.conferirInspecoes();
    }
  }

  openForm() {
    this.modal.open();
    this.preencherAutomatico();
    this.resetarFormulario();
    const btn = getEl('btn-conferir-inspecoes');
    if (btn)
      btn.style.display =
        currentUserRole === 'FISCAL' || currentUserRole === 'INSPETOR' ? 'block' : 'none';
  }

  preencherAutomatico() {
    const apelido =
      localStorage.getItem('inspectorApelido') ||
      localStorage.getItem('inspectorName') ||
      'Inspetor';
    if (getEl('fiscal')) getEl('fiscal').value = apelido;
    const agora = new Date();
    if (getEl('data'))
      getEl('data').value = agora.toLocaleDateString('pt-BR');
    if (getEl('hora'))
      getEl('hora').value = agora.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
  }

  atualizarDataHora() {
    const agora = new Date();
    if (getEl('data'))
      getEl('data').value = agora.toLocaleDateString('pt-BR');
    if (getEl('hora'))
      getEl('hora').value = agora.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
  }

  resetarFormulario() {
    if (getEl('carro')) getEl('carro').value = '';
    document
      .querySelectorAll(
        '#tabela-inspecao tbody tr .ok, #tabela-inspecao tbody tr .defeito'
      )
      .forEach(cb => (cb.checked = false));

    document.querySelectorAll('.obs-input').forEach(inp => {
      inp.value = '';
      inp.disabled = true;
    });

    document.querySelectorAll('.pos-btn').forEach(btn => {
      btn.classList.remove('active');
      btn.disabled = true;
    });
  }

  coletarDados() {
    const carro = getEl('carro').value.trim();
    const terminal = getEl('terminal').value;
    const fiscal = getEl('fiscal').value;
    const data = getEl('data').value;
    const hora = getEl('hora').value;
    if (!carro || !terminal) {
      alert('Preencha o campo CARRO e selecione o TERMINAL.');
      return null;
    }
    const itens = {};
    document.querySelectorAll('#tabela-inspecao tbody tr').forEach(row => {
      const item = row.dataset.item;
      const ok = row.querySelector('.ok').checked;
      const defeito = row.querySelector('.defeito').checked;
      const obs = row.querySelector('.obs-input').value.trim();
      itens[item] = { status: ok ? 'OK' : defeito ? 'DEFEITO' : '', obs: obs };
      if (item === 'ventilador') {
        itens[item].posicao = Array.from(row.querySelectorAll('.pos-btn.active'))
          .map(btn => btn.dataset.pos)
          .join(',');
      }
    });
    return { carro, terminal, fiscal, data, hora, itens };
  }

  async enviarInspecao() {
    if (!canCreateInspection) {
      alert('Seu perfil não permite criar inspeções.');
      return;
    }
    this.atualizarDataHora();
    const dados = this.coletarDados();
    if (!dados) return;

    const dadosEnvio = {
      carro: dados.carro,
      terminal: dados.terminal,
      fiscal: dados.fiscal,
      thoreb: dados.itens.thoreb,
      elevador: dados.itens.elevador,
      limpeza: dados.itens.limpeza,
      ventilador: dados.itens.ventilador,
    };

    let resumo = `CONFIRMAR ENVIO?\n\nCarro: ${dadosEnvio.carro}\nTerminal: ${dadosEnvio.terminal}\nFiscal: ${dadosEnvio.fiscal}\nData/Hora: ${dados.data} ${dados.hora}\n\nItens:\n`;
    for (const [item, info] of Object.entries(dados.itens)) {
      let status = info.status || 'NÃO INFORMADO';
      resumo += `- ${item.toUpperCase()}: ${status}`;
      if (info.obs) resumo += ` (Obs: ${info.obs})`;
      if (info.posicao) resumo += ` (Pos: ${info.posicao})`;
      resumo += '\n';
    }
    if (!confirm(resumo + '\n\nDeseja enviar os dados?')) return;

    try {
      await fetch(URL_PLANILHA, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          acao: 'inspecao_veicular',
          dados: JSON.stringify(dadosEnvio),
        }),
      });
      alert('✅ Inspeção enviada com sucesso!');
      this.resetarFormulario();
    } catch (err) {
      console.error(err);
      alert('❌ Erro ao enviar. Tente novamente.');
    }
  }

  // ======================== CONSULTAS COM VALIDAÇÕES ========================
  conferirInspecoes() {
    const hoje = new Date().toISOString().split('T')[0];
    this.conferirInspecoesComFiltro(hoje, hoje, null, null);
  }

  conferirInspecoesComFiltro(dataInicio, dataFim, carro, fiscalFiltro) {
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
    params.append('acao', 'consultar_inspecoes');
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);
    if (carro) params.append('carro', carro);
    if (fiscalFiltro) params.append('fiscalFiltro', fiscalFiltro);
    if (currentUserRole === 'FISCAL') {
      params.append(
        'fiscal',
        localStorage.getItem('inspectorApelido') ||
          localStorage.getItem('inspectorName')
      );
    }
    return this._executarConsultaInspecao(params);
  }

  _executarConsultaInspecao(params) {
    return new Promise((resolve, reject) => {
      const callbackName = 'consultarInspecoesCallback_' + Date.now();
      window[callbackName] = dados => {
        if (dados && dados.erro) {
          alert('Erro ao consultar: ' + dados.erro);
        } else {
          mostrarModalConferir(dados || [], currentUserRole, params);
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
// FUNÇÕES GLOBAIS DO MODAL DE CONSULTA (COM AGRUPAMENTO POR DATA)
// ====================================================================

function mostrarModalConferir(inspecoes, role, params) {
  const modal = getEl('modal-conferir-inspecoes');
  const container = getEl('lista-inspecoes');
  if (!modal || !container) return;

  const hoje = new Date().toISOString().split('T')[0];
  const isFiscal = role === 'FISCAL';

  // --- Cria o painel de filtros (se não existir) ---
  if (!document.getElementById('filtros-inspecao')) {
    const filtrosDiv = document.createElement('div');
    filtrosDiv.id = 'filtros-inspecao';
    filtrosDiv.style.marginBottom = '15px';
    filtrosDiv.style.padding = '10px';
    filtrosDiv.style.background = 'var(--card-bg)';
    filtrosDiv.style.borderRadius = '8px';

    let htmlFiltros = `
      <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end;">
        <div><label>Data Início</label><input type="date" id="filtro-inspecao-data-inicio" value="${hoje}" max="${hoje}"></div>
        <div><label>Data Fim</label><input type="date" id="filtro-inspecao-data-fim" value="${hoje}" max="${hoje}"></div>
        <div><label>Carro</label><input type="text" id="filtro-inspecao-carro" placeholder="Placa/Identificação"></div>
    `;

    if (!isFiscal) {
      htmlFiltros += `
        <div><label>Visualizar</label>
          <select id="filtro-inspecao-visualizar" style="padding: 6px 8px; border-radius: 6px;">
            <option value="TODOS">✅ Todas as inspeções</option>
            <option value="APENAS_DEFEITOS">⚠️ Apenas com defeitos</option>
          </select>
        </div>
      `;
    }

    if (role !== 'FISCAL') {
      htmlFiltros += `<div><label>Fiscal</label><input type="text" id="filtro-inspecao-fiscal" placeholder="Apelido"></div>`;
    }

    htmlFiltros += `
        <div><button id="btn-aplicar-filtros-inspecao" class="btn-secundario">🔍 Aplicar</button></div>
        <div><button id="btn-limpar-filtros-inspecao" class="btn-secundario">🗑️ Limpar</button></div>
      </div>
    `;

    filtrosDiv.innerHTML = htmlFiltros;
    container.parentNode.insertBefore(filtrosDiv, container);

    // Evento Aplicar
    document
      .getElementById('btn-aplicar-filtros-inspecao')
      .addEventListener('click', () => {
        const dataInicio = document.getElementById('filtro-inspecao-data-inicio').value;
        const dataFim = document.getElementById('filtro-inspecao-data-fim').value;
        const carro = document.getElementById('filtro-inspecao-carro').value;
        const fiscalFiltro =
          role !== 'FISCAL' ? document.getElementById('filtro-inspecao-fiscal').value : null;
        const visualizarSelect = document.getElementById('filtro-inspecao-visualizar');
        const visualizar = visualizarSelect ? visualizarSelect.value : 'TODOS';
        window.filtroExibicaoInspecao = visualizar;
        window.modals.inspecaoVeicular.conferirInspecoesComFiltro(
          dataInicio,
          dataFim,
          carro,
          fiscalFiltro
        );
      });

    // Evento Limpar
    document
      .getElementById('btn-limpar-filtros-inspecao')
      .addEventListener('click', () => {
        document.getElementById('filtro-inspecao-data-inicio').value = hoje;
        document.getElementById('filtro-inspecao-data-fim').value = hoje;
        document.getElementById('filtro-inspecao-carro').value = '';
        if (role !== 'FISCAL')
          document.getElementById('filtro-inspecao-fiscal').value = '';
        const visualizarSelect = document.getElementById('filtro-inspecao-visualizar');
        if (visualizarSelect) visualizarSelect.value = 'TODOS';
        window.filtroExibicaoInspecao = 'TODOS';
        window.modals.inspecaoVeicular.conferirInspecoes();
      });
  }

  // --- Recupera o filtro de exibição (TODOS / APENAS DEFEITOS) ---
  const visualizarSelect = document.getElementById('filtro-inspecao-visualizar');
  let filtroExibicaoAtual = 'TODOS';
  if (visualizarSelect) {
    filtroExibicaoAtual = visualizarSelect.value;
  } else if (window.filtroExibicaoInspecao) {
    filtroExibicaoAtual = window.filtroExibicaoInspecao;
  }
  if (isFiscal) filtroExibicaoAtual = 'TODOS';

  // --- Função auxiliar para verificar se há defeito ---
  function temDefeitos(ins) {
    return (
      ins.thoreb?.status === 'DEFEITO' ||
      ins.elevador?.status === 'DEFEITO' ||
      ins.limpeza?.status === 'DEFEITO' ||
      ins.ventilador?.status === 'DEFEITO'
    );
  }

  // --- Aplica filtro de defeito (se for o caso) ---
  let inspecoesFiltradas = inspecoes;
  if (!isFiscal && filtroExibicaoAtual === 'APENAS_DEFEITOS') {
    inspecoesFiltradas = inspecoes.filter(ins => temDefeitos(ins));
  }

  // --- Agrupa as inspeções por data (formato dd/MM/yyyy) ---
  const grouped = {};
  inspecoesFiltradas.forEach(ins => {
    let dataStr = 'Data desconhecida';
    if (ins.dataHora) {
      const partes = ins.dataHora.split(' ')[0]; // "dd/MM/yyyy"
      if (partes && partes.match(/\d{2}\/\d{2}\/\d{4}/)) {
        dataStr = partes;
      }
    }
    if (!grouped[dataStr]) grouped[dataStr] = [];
    grouped[dataStr].push(ins);
  });

  // Ordena as datas (da mais recente para a mais antiga)
  const datasOrdenadas = Object.keys(grouped).sort((a, b) => {
    const [da, ma, aa] = a.split('/');
    const [db, mb, ab] = b.split('/');
    return new Date(ab, mb - 1, db) - new Date(aa, ma - 1, da);
  });

  // --- Gera o HTML agrupado ---
  let html = `<div style="margin-bottom: 12px; text-align: right;">
                <button id="exportar-lista" class="btn-secundario">📋 Exportar para texto</button>
              </div>`;

  if (datasOrdenadas.length === 0) {
    let msg = 'Nenhuma inspeção encontrada para os filtros selecionados.';
    if (!isFiscal && filtroExibicaoAtual === 'APENAS_DEFEITOS' && inspecoes.length > 0) {
      msg = 'Nenhum veículo com defeito encontrado para esta data.';
    }
    html += `<div style="text-align: center; padding: 30px 10px; font-weight: 500;">${msg}</div>`;
  } else {
    for (const data of datasOrdenadas) {
      const inspecoesDaData = grouped[data];
      // Cabeçalho da data
      html += `<div style="margin-top: 20px; margin-bottom: 10px; padding: 8px; background: var(--accent); color: white; border-radius: 8px; font-weight: bold;">📅 ${data}</div>`;

      for (const ins of inspecoesDaData) {
        const itensDefeito = [];
        if (ins.thoreb?.status === 'DEFEITO')
          itensDefeito.push(`THOREB: ${ins.thoreb.obs || 'sem obs'}`);
        if (ins.elevador?.status === 'DEFEITO')
          itensDefeito.push(`ELEVADOR: ${ins.elevador.obs || 'sem obs'}`);
        if (ins.limpeza?.status === 'DEFEITO')
          itensDefeito.push(`LIMPEZA: ${ins.limpeza.obs || 'sem obs'}`);
        if (ins.ventilador?.status === 'DEFEITO') {
          let d = `VENTILADOR: ${ins.ventilador.obs || 'sem obs'}`;
          if (ins.ventilador.posicao) d += ` (Pos: ${ins.ventilador.posicao})`;
          itensDefeito.push(d);
        }

        const temDefeito = itensDefeito.length > 0;
        const borderColor = temDefeito ? 'var(--accent)' : '#10b981';
        const statusHtml = temDefeito
          ? itensDefeito.map(i => `<li style="color: #f59e0b;">⚠️ ${i}</li>`).join('')
          : `<li style="color: #10b981;">✅ Nenhum defeito apresentado</li>`;

        html += `<div style="background: var(--card-bg); margin: 10px 0; padding: 12px; border-radius: 8px; border-left: 4px solid ${borderColor};">`;
        html += `<strong>${ins.carro} - ${ins.terminal}</strong><br>`;
        if (role !== 'FISCAL' && !isFiscal) {
          html += `<small>Responsável: ${ins.fiscal}</small><br>`;
        }
        html += `<ul style="margin-top: 8px; list-style: none; padding-left: 0;">${statusHtml}</ul>`;
        html += `</div>`;
      }
    }
  }

  container.innerHTML = html;

  // --- Evento do botão de exportação (copia texto agrupado) ---
  const exportBtn = document.getElementById('exportar-lista');
  if (exportBtn) {
    const novoBtn = exportBtn.cloneNode(true);
    exportBtn.parentNode.replaceChild(novoBtn, exportBtn);
    novoBtn.addEventListener('click', () => {
      const texto = gerarTextoExportacaoComFiltro(inspecoesFiltradas, role, isFiscal);
      navigator.clipboard
        .writeText(texto)
        .then(() => alert('Lista copiada!'))
        .catch(() => alert('Erro ao copiar.'));
    });
  }

  modal.classList.add('is-open');
}

// ====================================================================
// EXPORTAÇÃO PARA TEXTO (AGRUPADA POR DATA)
// ====================================================================
function gerarTextoExportacaoComFiltro(inspecoes, role, isFiscal) {
  let texto = `=== INSPEÇÕES REALIZADAS ===\n\n`;

  // Agrupa por data novamente
  const grouped = {};
  inspecoes.forEach(ins => {
    let dataStr = 'Data desconhecida';
    if (ins.dataHora) {
      const partes = ins.dataHora.split(' ')[0];
      if (partes && partes.match(/\d{2}\/\d{2}\/\d{4}/)) dataStr = partes;
    }
    if (!grouped[dataStr]) grouped[dataStr] = [];
    grouped[dataStr].push(ins);
  });

  const datasOrdenadas = Object.keys(grouped).sort((a, b) => {
    const [da, ma, aa] = a.split('/');
    const [db, mb, ab] = b.split('/');
    return new Date(ab, mb - 1, db) - new Date(aa, ma - 1, da);
  });

  for (const data of datasOrdenadas) {
    texto += `📅 ${data}\n`;
    texto += `----------------------------------------\n`;
    for (const ins of grouped[data]) {
      const itensDefeito = [];
      if (ins.thoreb?.status === 'DEFEITO')
        itensDefeito.push(`THOREB: ${ins.thoreb.obs || 'sem obs'}`);
      if (ins.elevador?.status === 'DEFEITO')
        itensDefeito.push(`ELEVADOR: ${ins.elevador.obs || 'sem obs'}`);
      if (ins.limpeza?.status === 'DEFEITO')
        itensDefeito.push(`LIMPEZA: ${ins.limpeza.obs || 'sem obs'}`);
      if (ins.ventilador?.status === 'DEFEITO') {
        let d = `VENTILADOR: ${ins.ventilador.obs || 'sem obs'}`;
        if (ins.ventilador.posicao) d += ` (Pos: ${ins.ventilador.posicao})`;
        itensDefeito.push(d);
      }

      texto += `Carro: ${ins.carro} (${ins.terminal})\n`;
      if (role !== 'FISCAL' && !isFiscal) {
        texto += `Responsável: ${ins.fiscal}\n`;
      }
      if (itensDefeito.length === 0) {
        texto += `Status: ✅ Nenhum defeito apresentado\n`;
      } else {
        texto += `Defeitos encontrados:\n${itensDefeito.map(d => `  - ${d}`).join('\n')}\n`;
      }
      texto += `\n`;
    }
    texto += `\n`;
  }
  return texto;
}

// Função para fechar o modal de consulta (já existente, mas mantemos)
function fecharModalConferir() {
  const m = getEl('modal-conferir-inspecoes');
  if (m) m.classList.remove('is-open');
}
