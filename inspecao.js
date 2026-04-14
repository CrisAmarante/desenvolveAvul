
// ====================================================================
// INSPEÇÃO VEICULAR
// ====================================================================
class InspecaoVeicular {
  constructor() { this.modal = new ModalController('modal-inspecao-veicular'); this.initEventListeners(); }
  close() { this.modal.close(); }
initEventListeners() {
    getEl('btn-inspecao-veicular')?.addEventListener('click', (e) => { e.preventDefault(); this.open(); });
    
    document.querySelectorAll('#tabela-inspecao tbody tr').forEach(row => {
      const cbOk = row.querySelector('.ok');
      const cbDef = row.querySelector('.defeito');
      const obsInput = row.querySelector('.obs-input');
      const posBtns = row.querySelectorAll('.pos-btn');

      // Nova regra: Atualiza o bloqueio dos campos da linha
      const atualizarEstadoLinha = () => {
        const isDefective = cbDef.checked;
        
        // Bloqueia e limpa o input de observação se não estiver com defeito
        if (obsInput) {
          obsInput.disabled = !isDefective;
          if (!isDefective) obsInput.value = ''; 
        }
        
        // Bloqueia e limpa os botões de posição (F, M, T) se não estiver com defeito
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
          atualizarEstadoLinha(); // Chama a regra ao clicar
        });
        cbDef.addEventListener('change', () => { 
          if (cbDef.checked) cbOk.checked = false; 
          atualizarEstadoLinha(); // Chama a regra ao clicar
        });
      }
    });

    document.querySelectorAll('.pos-btn').forEach(btn => btn.addEventListener('click', (e) => { 
      e.stopPropagation(); 
      // Só deixa ativar o botão se ele não estiver bloqueado
      if (!btn.disabled) {
        btn.classList.toggle('active'); 
      }
    }));
    
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
    if (btn) btn.style.display = (currentUserRole === 'FISCAL' || currentUserRole === 'INSPETOR') ? 'block' : 'none';
  }
  preencherAutomatico() {
    const apelido = localStorage.getItem('inspectorApelido') || localStorage.getItem('inspectorName') || 'Inspetor';
    if (getEl('fiscal')) getEl('fiscal').value = apelido;
    const agora = new Date();
    if (getEl('data')) getEl('data').value = agora.toLocaleDateString('pt-BR');
    if (getEl('hora')) getEl('hora').value = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  atualizarDataHora() {
    const agora = new Date();
    if (getEl('data')) getEl('data').value = agora.toLocaleDateString('pt-BR');
    if (getEl('hora')) getEl('hora').value = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
 resetarFormulario() { 
    if (getEl('carro')) getEl('carro').value = ''; 
    document.querySelectorAll('#tabela-inspecao tbody tr .ok, #tabela-inspecao tbody tr .defeito').forEach(cb => cb.checked = false); 
    
    // Agora limpa e BLOQUEIA os inputs de texto por padrão
    document.querySelectorAll('.obs-input').forEach(inp => { 
      inp.value = ''; 
      inp.disabled = true; 
    }); 
    
    // Agora limpa e BLOQUEIA os botões F, M, T por padrão
    document.querySelectorAll('.pos-btn').forEach(btn => { 
      btn.classList.remove('active'); 
      btn.disabled = true; 
    }); 
  }
  coletarDados() {
    const carro = getEl('carro').value.trim(), terminal = getEl('terminal').value, fiscal = getEl('fiscal').value, data = getEl('data').value, hora = getEl('hora').value;
    if (!carro || !terminal) { alert('Preencha o campo CARRO e selecione o TERMINAL.'); return null; }
    const itens = {};
    document.querySelectorAll('#tabela-inspecao tbody tr').forEach(row => {
      const item = row.dataset.item, ok = row.querySelector('.ok').checked, defeito = row.querySelector('.defeito').checked, obs = row.querySelector('.obs-input').value.trim();
      itens[item] = { status: ok ? 'OK' : (defeito ? 'DEFEITO' : ''), obs: obs };
      if (item === 'ventilador') itens[item].posicao = Array.from(row.querySelectorAll('.pos-btn.active')).map(btn => btn.dataset.pos).join(',');
    });
    return { carro, terminal, fiscal, data, hora, itens };
  }
  async enviarInspecao() {
    if (!canCreateInspection) { alert('Seu perfil não permite criar inspeções.'); return; }
    this.atualizarDataHora();
    const dados = this.coletarDados();
    if (!dados) return;
    const dadosEnvio = { carro: dados.carro, terminal: dados.terminal, fiscal: dados.fiscal, thoreb: dados.itens.thoreb, elevador: dados.itens.elevador, limpeza: dados.itens.limpeza, ventilador: dados.itens.ventilador };
    let resumo = `CONFIRMAR ENVIO?\n\nCarro: ${dadosEnvio.carro}\nTerminal: ${dadosEnvio.terminal}\nFiscal: ${dadosEnvio.fiscal}\nData/Hora: ${dados.data} ${dados.hora}\n\nItens:\n`;
    for (const [item, info] of Object.entries(dados.itens)) { let status = info.status || 'NÃO INFORMADO'; resumo += `- ${item.toUpperCase()}: ${status}`; if (info.obs) resumo += ` (Obs: ${info.obs})`; if (info.posicao) resumo += ` (Pos: ${info.posicao})`; resumo += '\n'; }
    if (!confirm(resumo + '\n\nDeseja enviar os dados?')) return;
    try {
      await fetch(URL_PLANILHA, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ acao: 'inspecao_veicular', dados: JSON.stringify(dadosEnvio) }) });
      alert('✅ Inspeção enviada com sucesso!');
      this.resetarFormulario();
    } catch (err) { console.error(err); alert('❌ Erro ao enviar. Tente novamente.'); }
  }
  conferirInspecoes() {
    // Por padrão, pega a data exata de hoje no formato YYYY-MM-DD
    const hoje = new Date().toISOString().split('T')[0];
    this.conferirInspecoesComFiltro(hoje, hoje, null, null);
  }
  conferirInspecoesComFiltro(dataInicio, dataFim, carro, fiscalFiltro) {
    const params = new URLSearchParams();
    params.append('acao', 'consultar_inspecoes');
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);
    if (carro) params.append('carro', carro);
    if (fiscalFiltro) params.append('fiscalFiltro', fiscalFiltro);
    if (currentUserRole === 'FISCAL') {
      params.append('fiscal', localStorage.getItem('inspectorApelido') || localStorage.getItem('inspectorName'));
    }
    return this._executarConsultaInspecao(params);
  }
 _executarConsultaInspecao(params) {
    return new Promise((resolve, reject) => {
      const callbackName = 'consultarInspecoesCallback_' + Date.now();
      window[callbackName] = (dados) => {
        if (dados && dados.erro) {
          alert('Erro ao consultar: ' + dados.erro);
        } else {
          // Em vez de bloquear com um alert, sempre abre o modal
          // O modal cuidará de exibir a mensagem de "vazio" na tela
          mostrarModalConferir(dados || [], currentUserRole, params);
        }
        delete window[callbackName];
        resolve();
      };
      params.append('callback', callbackName);
      const url = `${URL_PLANILHA}?${params.toString()}`;
      const script = document.createElement('script');
      script.src = url;
      script.onerror = () => { delete window[callbackName]; alert('Erro ao consultar. Verifique sua conexão.'); reject(); };
      document.body.appendChild(script);
    });
  }
}
function mostrarModalConferir(inspecoes, role, params) {
  const modal = getEl('modal-conferir-inspecoes'), container = getEl('lista-inspecoes');
  if (!modal || !container) return;
  
  const hoje = new Date().toISOString().split('T')[0];

  // Monta o painel de filtros se ele ainda não existir
  if (!document.getElementById('filtros-inspecao')) {
    const filtrosDiv = document.createElement('div');
    filtrosDiv.id = 'filtros-inspecao';
    filtrosDiv.style.marginBottom = '15px';
    filtrosDiv.style.padding = '10px';
    filtrosDiv.style.background = 'var(--card-bg)';
    filtrosDiv.style.borderRadius = '8px';
    
    // Injeta os inputs de Data Início e Fim já preenchidos com o dia de hoje
    filtrosDiv.innerHTML = `
      <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end;">
        <div><label>Data Início</label><input type="date" id="filtro-inspecao-data-inicio" value="${hoje}"></div>
        <div><label>Data Fim</label><input type="date" id="filtro-inspecao-data-fim" value="${hoje}"></div>
        <div><label>Carro</label><input type="text" id="filtro-inspecao-carro" placeholder="Placa/Identificação"></div>
        ${role !== 'FISCAL' ? `<div><label>Fiscal</label><input type="text" id="filtro-inspecao-fiscal" placeholder="Apelido"></div>` : ''}
        <div><button id="btn-aplicar-filtros-inspecao" class="btn-secundario">🔍 Aplicar</button></div>
        <div><button id="btn-limpar-filtros-inspecao" class="btn-secundario">🗑️ Limpar</button></div>
      </div>
    `;
    container.parentNode.insertBefore(filtrosDiv, container);
    
    document.getElementById('btn-aplicar-filtros-inspecao').addEventListener('click', () => {
      const dataInicio = document.getElementById('filtro-inspecao-data-inicio').value;
      const dataFim = document.getElementById('filtro-inspecao-data-fim').value;
      const carro = document.getElementById('filtro-inspecao-carro').value;
      const fiscalFiltro = role !== 'FISCAL' ? document.getElementById('filtro-inspecao-fiscal').value : null;
      window.modals.inspecaoVeicular.conferirInspecoesComFiltro(dataInicio, dataFim, carro, fiscalFiltro);
    });
    
    document.getElementById('btn-limpar-filtros-inspecao').addEventListener('click', () => {
      document.getElementById('filtro-inspecao-data-inicio').value = hoje;
      document.getElementById('filtro-inspecao-data-fim').value = hoje;
      document.getElementById('filtro-inspecao-carro').value = '';
      if (role !== 'FISCAL') document.getElementById('filtro-inspecao-fiscal').value = '';
      window.modals.inspecaoVeicular.conferirInspecoes();
    });
  }

  // --- TRATAMENTO: O QUE ACONTECE SE A LISTA VIER VAZIA ---
  if (!inspecoes || inspecoes.length === 0) {
    // Confere se o usuário pesquisou só "hoje" ou usou outros filtros
    let isDefaultToday = true;
    if (params) {
      const pIn = params.get('dataInicio');
      const pFim = params.get('dataFim');
      const pCar = params.get('carro');
      const pFis = params.get('fiscalFiltro');
      if (pIn !== hoje || pFim !== hoje || pCar || pFis) {
        isDefaultToday = false;
      }
    }
    
    const msg = isDefaultToday ? 'Nenhuma inspeção nesta data.' : 'Nenhuma inspeção encontrada para estes filtros.';
    
    container.innerHTML = `<div style="text-align: center; padding: 30px 10px; font-weight: 500;">${msg}</div>`;
    modal.classList.add('is-open');
    return;
  }

  // --- SE TIVER RESULTADO, MONTA A LISTA NORMALMENTE ---
  let html = '<div style="margin-bottom: 12px; text-align: right;"><button id="exportar-lista" class="btn-secundario">📋 Exportar para texto</button></div><div id="lista-inspecoes-conteudo">';
  
  inspecoes.forEach(ins => {
    const itensDefeito = [];
    if (ins.thoreb.status === 'DEFEITO') itensDefeito.push(`THOREB: ${ins.thoreb.obs || 'sem obs'}`);
    if (ins.elevador.status === 'DEFEITO') itensDefeito.push(`ELEVADOR: ${ins.elevador.obs || 'sem obs'}`);
    if (ins.limpeza.status === 'DEFEITO') itensDefeito.push(`LIMPEZA: ${ins.limpeza.obs || 'sem obs'}`);
    if (ins.ventilador.status === 'DEFEITO') { let d = `VENTILADOR: ${ins.ventilador.obs || 'sem obs'}`; if (ins.ventilador.posicao) d += ` (Pos: ${ins.ventilador.posicao})`; itensDefeito.push(d); }
    
    if (itensDefeito.length === 0) return;
    
    let linha = `<div style="background: var(--card-bg); margin: 10px 0; padding: 12px; border-radius: 8px; border-left: 4px solid var(--accent);"><strong>${ins.carro} - ${ins.terminal}</strong><br>`;
    if (role !== 'FISCAL') linha += `<small>Responsável: ${ins.fiscal}</small><br>`;
    linha += `<ul style="margin-top: 8px; list-style: none; padding-left: 0;">${itensDefeito.map(i => `<li>⚠️ ${i}</li>`).join('')}</ul></div>`;
    html += linha;
  });
  
  html += '</div>';
  container.innerHTML = html;
  
  document.getElementById('exportar-lista')?.addEventListener('click', () => { 
    const texto = gerarTextoExportacao(inspecoes, role); 
    navigator.clipboard.writeText(texto).then(() => alert('Lista copiada!')).catch(() => alert('Erro ao copiar.')); 
  });
  
  modal.classList.add('is-open');
}
function gerarTextoExportacao(inspecoes, role) {
  let texto = `=== INSPEÇÕES DO DIA ${new Date().toLocaleDateString('pt-BR')} ===\n\n`;
  inspecoes.forEach(ins => {
    const itensDefeito = [];
    if (ins.thoreb.status === 'DEFEITO') itensDefeito.push(`THOREB: ${ins.thoreb.obs || 'sem obs'}`);
    if (ins.elevador.status === 'DEFEITO') itensDefeito.push(`ELEVADOR: ${ins.elevador.obs || 'sem obs'}`);
    if (ins.limpeza.status === 'DEFEITO') itensDefeito.push(`LIMPEZA: ${ins.usb.obs || 'sem obs'}`);
    if (ins.ventilador.status === 'DEFEITO') { let d = `VENTILADOR: ${ins.ventilador.obs || 'sem obs'}`; if (ins.ventilador.posicao) d += ` (Pos: ${ins.ventilador.posicao})`; itensDefeito.push(d); }
    if (itensDefeito.length === 0) return;
    texto += `CARRO: ${ins.carro} (${ins.terminal})\n` + (role !== 'FISCAL' ? `Responsável: ${ins.fiscal}\n` : '') + `Defeitos:\n${itensDefeito.map(d => `- ${d}`).join('\n')}\n\n`;
  });
  return texto;
}
function fecharModalConferir() { const m = getEl('modal-conferir-inspecoes'); if (m) m.classList.remove('is-open'); }
