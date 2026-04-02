// ====================================================================
// CONFIGURAÇÕES GERAIS
// ====================================================================
const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbzM47z9njqsKW5BT2OiKq9nGKwZrgrrbMI4F4JTi1oJzd2xDAvXtCSvBH-C_4-VlO6K/exec";

let INSPETORES = {};

const DATA_INICIO_BANNER = new Date('2026-07-10T00:00:00');
const DATA_FIM_BANNER    = new Date('2026-07-21T00:01:00');

const disableDates = {
  'btn-osasco': new Date('2026-07-19'),
  'btn-santana': new Date('2026-07-03')
};

const ROLES_ALLOWED_INSPECTION = ['INSPETOR', 'ENCARREGADO', 'ADMIN', 'GERENTE', 'FISCAL', 'PLANTONISTA'];

let currentUserRole = '';
let canCreateInspection = false;
let terminaisCache = [];
let terminaisTimestamp = 0;
const TERMINAIS_CACHE_DURACAO = 30 * 60 * 1000; // 30 minutos

function logDebug(...args) { console.log('[PENSO]', ...args); }
function getEl(id) { return document.getElementById(id); }

// ====================================================================
// HASH
// ====================================================================
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ====================================================================
// MODAL
// ====================================================================
class ModalController {
  constructor(modalId) {
    this.modal = getEl(modalId);
    if (!this.modal) return;
    this.content = this.modal.querySelector('.modal-content');
    this.isOpen = false;
    this.handleBackgroundClick = this.handleBackgroundClick.bind(this);
    this.handleEsc = this.handleEsc.bind(this);
  }
  open() {
    if (!this.modal || this.isOpen) return;
    this.modal.classList.add('is-open');
    document.body.classList.add('no-scroll');
    this.isOpen = true;
    this.modal.addEventListener('click', this.handleBackgroundClick);
    document.addEventListener('keydown', this.handleEsc);
    const firstFocusable = this.modal.querySelector('input, button, a, select, textarea');
    if (firstFocusable) firstFocusable.focus();
  }
  close() {
    if (!this.modal || !this.isOpen) return;
    this.modal.classList.add('is-closing');
    setTimeout(() => {
      this.modal.classList.remove('is-open', 'is-closing');
      document.body.classList.remove('no-scroll');
      this.isOpen = false;
      this.modal.removeEventListener('click', this.handleBackgroundClick);
      document.removeEventListener('keydown', this.handleEsc);
    }, 220);
  }
  handleBackgroundClick(e) { if (e.target === this.modal) this.close(); }
  handleEsc(e) { if (e.key === 'Escape') this.close(); }
}

// ====================================================================
// LOG
// ====================================================================
async function registrarLog(nomeApelido) {
  try {
    const formData = new URLSearchParams();
    formData.append("nome", nomeApelido);
    formData.append("acao", "Login bem-sucedido");
    await fetch(URL_PLANILHA, { method: "POST", body: formData, mode: "no-cors" });
  } catch (err) { console.warn("Falha ao registrar log:", err); }
}

// ====================================================================
// CARREGAR INSPETORES
// ====================================================================
let refreshPromise = null;
function processarDadosPlanilha(dados) {
  if (Array.isArray(dados)) {
    const novoObjeto = {};
    dados.forEach(row => {
      if (row.apelido && row.hash && row.ativo === "SIM") {
        novoObjeto[row.apelido] = { hash: row.hash, nome: row.nome, funcao: row.funcao };
      }
    });
    INSPETORES = novoObjeto;
  } else { INSPETORES = dados || {}; }
}
async function refreshInspetores() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = new Promise((resolve, reject) => {
    const callbackName = 'processarDadosPlanilha_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    window[callbackName] = function(dados) {
      processarDadosPlanilha(dados);
      delete window[callbackName];
      refreshPromise = null;
      resolve();
    };
    const script = document.createElement('script');
    script.src = `${URL_PLANILHA}?callback=${callbackName}&_=${Date.now()}`;
    script.onerror = () => { delete window[callbackName]; refreshPromise = null; reject(); };
    document.body.appendChild(script);
  });
  return refreshPromise;
}

// ====================================================================
// TERMINAIS (apenas SIM) com cache
// ====================================================================
let terminaisPromise = null;
function carregarTerminais(forceRefresh = false) {
  const agora = Date.now();
  if (!forceRefresh && terminaisCache.length && (agora - terminaisTimestamp < TERMINAIS_CACHE_DURACAO)) {
    return Promise.resolve(terminaisCache);
  }
  if (terminaisPromise) return terminaisPromise;
  terminaisPromise = new Promise((resolve) => {
    const callbackName = 'carregarTerminaisCallback_' + Date.now();
    window[callbackName] = function(terminais) {
      terminaisCache = terminais;
      terminaisTimestamp = Date.now();
      delete window[callbackName];
      terminaisPromise = null;
      resolve(terminais);
    };
    const script = document.createElement('script');
    script.src = `${URL_PLANILHA}?acao=terminais&callback=${callbackName}&_=${Date.now()}`;
    script.onerror = () => {
      delete window[callbackName];
      terminaisPromise = null;
      terminaisCache = ['Terminal A', 'Terminal B', 'Terminal C', 'Terminal D'];
      terminaisTimestamp = Date.now();
      resolve(terminaisCache);
    };
    document.body.appendChild(script);
  });
  return terminaisPromise;
}
function preencherSelectTerminais() {
  const select = getEl('terminal');
  if (!select) return;
  carregarTerminais().then(terminais => {
    const valorAtual = select.value;
    select.innerHTML = '<option value="">Selecione...</option>';
    terminais.forEach(t => { const opt = document.createElement('option'); opt.value = t; opt.textContent = t; select.appendChild(opt); });
    if (valorAtual && terminais.includes(valorAtual)) select.value = valorAtual;
  });
}

// ====================================================================
// TERMINAIS (todos, para local no envio)
// ====================================================================
let todosTerminaisCache = [];
let todosTerminaisPromise = null;
function carregarTodosTerminais(forceRefresh = false) {
  if (!forceRefresh && todosTerminaisCache.length) return Promise.resolve(todosTerminaisCache);
  if (todosTerminaisPromise) return todosTerminaisPromise;
  todosTerminaisPromise = new Promise((resolve) => {
    const callbackName = 'carregarTodosTerminaisCallback_' + Date.now();
    window[callbackName] = function(terminais) {
      todosTerminaisCache = terminais;
      delete window[callbackName];
      todosTerminaisPromise = null;
      resolve(terminais);
    };
    const script = document.createElement('script');
    script.src = `${URL_PLANILHA}?acao=terminais_todos&callback=${callbackName}&_=${Date.now()}`;
    script.onerror = () => {
      delete window[callbackName];
      todosTerminaisPromise = null;
      todosTerminaisCache = ['Terminal A', 'Terminal B', 'Terminal C', 'Terminal D'];
      resolve(todosTerminaisCache);
    };
    document.body.appendChild(script);
  });
  return todosTerminaisPromise;
}
function preencherSelectLocal() {
  const select = getEl('envio-local');
  if (!select) return;
  carregarTodosTerminais().then(terminais => {
    const valorAtual = select.value;
    select.innerHTML = '<option value="">Selecione...</option>';
    terminais.forEach(t => { const opt = document.createElement('option'); opt.value = t; opt.textContent = t; select.appendChild(opt); });
    if (valorAtual && terminais.includes(valorAtual)) select.value = valorAtual;
  });
}

// ====================================================================
// LOGIN/LOGOUT
// ====================================================================
async function checkLoginStatus() {
  const logado = localStorage.getItem('inspectorLoggedIn');
  const nome = localStorage.getItem('inspectorName');
  const apelido = localStorage.getItem('inspectorApelido');
  const main = getEl('main-screen');
  const insp = getEl('inspector-screen');
  const btnInspecao = getEl('btn-inspecao-veicular');
  const btnEnvio = getEl('btn-envio-informacoes');
  if (logado === 'true' && nome && apelido && INSPETORES[apelido]) {
    const role = INSPETORES[apelido].funcao;
    currentUserRole = role;
    canCreateInspection = (role === 'FISCAL' || role === 'INSPETOR');
    localStorage.setItem('inspectorRole', role);
    if (btnInspecao && role !== 'MONITOR') btnInspecao.style.display = 'flex';
    else if (btnInspecao) btnInspecao.style.display = 'none';
    if (btnEnvio && role !== 'MONITOR') btnEnvio.style.display = 'flex';
    else if (btnEnvio) btnEnvio.style.display = 'none';
    main.style.display = 'none';
    insp.style.display = 'flex';
    showWelcomeToast(apelido);
    const logoutBtn = insp.querySelector('.logout-btn');
    if (logoutBtn) logoutBtn.innerHTML = `Sair<small>Inspetor ${apelido}</small>`;
  } else {
    localStorage.removeItem('inspectorLoggedIn');
    localStorage.removeItem('inspectorName');
    localStorage.removeItem('inspectorApelido');
    localStorage.removeItem('inspectorRole');
    main.style.display = 'flex';
    insp.style.display = 'none';
  }
}
async function login(e) {
  e.preventDefault();
  const senha = getEl('password').value.trim();
  const errorMsg = getEl('login-error');
  let nomeEncontrado = null, apelidoEncontrado = null;
  for (const [apelido, info] of Object.entries(INSPETORES)) {
    if (await hashPassword(senha, apelido) === info.hash) {
      nomeEncontrado = info.nome;
      apelidoEncontrado = apelido;
      break;
    }
  }
  if (nomeEncontrado) {
    localStorage.setItem('inspectorLoggedIn', 'true');
    localStorage.setItem('inspectorName', nomeEncontrado);
    localStorage.setItem('inspectorApelido', apelidoEncontrado);
    localStorage.setItem('inspectorRole', INSPETORES[apelidoEncontrado].funcao);
    registrarLog(apelidoEncontrado);
    window.modals.login.close();
    checkLoginStatus();
  } else {
    errorMsg.style.display = 'block';
    getEl('password').value = '';
    getEl('password').focus();
  }
}
function logoutInspector() {
  localStorage.removeItem('inspectorLoggedIn');
  localStorage.removeItem('inspectorName');
  localStorage.removeItem('inspectorApelido');
  localStorage.removeItem('inspectorRole');
  checkLoginStatus();
}
function showWelcomeToast(apelido) {
  const toast = getEl('welcome-toast');
  if (!toast) return;
  getEl('toast-name').textContent = apelido;
  toast.classList.add('show');
  setTimeout(() => hideWelcomeToast(), 3500);
  const clickHandler = () => { hideWelcomeToast(); document.removeEventListener('click', clickHandler); };
  setTimeout(() => document.addEventListener('click', clickHandler), 300);
}
function hideWelcomeToast() { const t = getEl('welcome-toast'); if (t) t.classList.remove('show'); }
function aplicarBloqueioDeDatas() {
  const now = new Date();
  for (const [id, date] of Object.entries(disableDates)) {
    const btn = getEl(id);
    if (btn && now < date) { btn.classList.add('disabled'); btn.setAttribute('href', '#'); btn.title = `Disponível a partir de ${date.toLocaleDateString('pt-BR')}`; btn.style.pointerEvents = 'none'; btn.style.opacity = '0.45'; }
  }
}
function fecharBanner() { const b = getEl('aviso-temporario'); if (b) b.style.display = 'none'; }
function mostrarBannerAviso() {
  const agora = new Date();
  const banner = getEl('aviso-temporario');
  if (banner) banner.style.display = (agora >= DATA_INICIO_BANNER && agora < DATA_FIM_BANNER) ? 'flex' : 'none';
}

// ====================================================================
// UTILITÁRIO DE FORMATAÇÃO DE DATA E HORA
// ====================================================================
function formatarData(data) {
  if (!data) return 'N/I';
  if (data instanceof Date) {
    const dia = data.getDate().toString().padStart(2, '0');
    const mes = (data.getMonth() + 1).toString().padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }
  if (typeof data === 'string') {
    let dataStr = data.split('T')[0].split(' ')[0];
    if (dataStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      const [ano, mes, dia] = dataStr.split('-');
      return `${dia}/${mes}/${ano}`;
    }
    if (dataStr.match(/^\d{2}\/\d{2}\/\d{4}/)) return dataStr;
  }
  const match = String(data).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) return match[0];
  return 'N/I';
}
function formatarHora(hora) {
  if (!hora) return 'N/I';
  if (hora instanceof Date) {
    const horas = hora.getHours().toString().padStart(2, '0');
    const minutos = hora.getMinutes().toString().padStart(2, '0');
    return `${horas}:${minutos}`;
  }
  if (typeof hora === 'string') {
    if (hora.includes('T')) {
      const match = hora.match(/T(\d{2}):(\d{2})/);
      if (match) return `${match[1]}:${match[2]}`;
    }
    if (hora.match(/^\d{2}:\d{2}/)) return hora;
  }
  return 'N/I';
}

// ====================================================================
// INSPEÇÃO VEICULAR
// ====================================================================
class InspecaoVeicular {
  constructor() { this.modal = new ModalController('modal-inspecao-veicular'); this.initEventListeners(); }
  close() { this.modal.close(); }
  initEventListeners() {
    getEl('btn-inspecao-veicular')?.addEventListener('click', (e) => { e.preventDefault(); this.open(); });
    document.querySelectorAll('#tabela-inspecao tbody tr').forEach(row => {
      const cbOk = row.querySelector('.ok'), cbDef = row.querySelector('.defeito');
      if (cbOk && cbDef) {
        cbOk.addEventListener('change', () => { if (cbOk.checked) cbDef.checked = false; });
        cbDef.addEventListener('change', () => { if (cbDef.checked) cbOk.checked = false; });
      }
    });
    document.querySelectorAll('.pos-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); btn.classList.toggle('active'); }));
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
  resetarFormulario() { if (getEl('carro')) getEl('carro').value = ''; document.querySelectorAll('#tabela-inspecao tbody tr .ok, #tabela-inspecao tbody tr .defeito').forEach(cb => cb.checked = false); document.querySelectorAll('.obs-input').forEach(inp => inp.value = ''); document.querySelectorAll('.pos-btn').forEach(btn => btn.classList.remove('active')); }
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
    const dadosEnvio = { carro: dados.carro, terminal: dados.terminal, fiscal: dados.fiscal, thoreb: dados.itens.thoreb, elevador: dados.itens.elevador, usb: dados.itens.usb, ventilador: dados.itens.ventilador };
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
    this.conferirInspecoesComFiltro(null, null, null, null);
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
        } else if (!dados || (Array.isArray(dados) && dados.length === 0)) {
          alert('Nenhuma inspeção encontrada.');
        } else {
          mostrarModalConferir(dados, currentUserRole);
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
function mostrarModalConferir(inspecoes, role) {
  const modal = getEl('modal-conferir-inspecoes'), container = getEl('lista-inspecoes');
  if (!modal || !container) return;
  if (!document.getElementById('filtros-inspecao')) {
    const filtrosDiv = document.createElement('div');
    filtrosDiv.id = 'filtros-inspecao';
    filtrosDiv.style.marginBottom = '15px';
    filtrosDiv.style.padding = '10px';
    filtrosDiv.style.background = 'var(--card-bg)';
    filtrosDiv.style.borderRadius = '8px';
    filtrosDiv.innerHTML = `
      <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end;">
        <div><label>Data Início</label><input type="date" id="filtro-inspecao-data-inicio"></div>
        <div><label>Data Fim</label><input type="date" id="filtro-inspecao-data-fim"></div>
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
      document.getElementById('filtro-inspecao-data-inicio').value = '';
      document.getElementById('filtro-inspecao-data-fim').value = '';
      document.getElementById('filtro-inspecao-carro').value = '';
      if (role !== 'FISCAL') document.getElementById('filtro-inspecao-fiscal').value = '';
      window.modals.inspecaoVeicular.conferirInspecoes();
    });
  }
  let html = '<div style="margin-bottom: 12px; text-align: right;"><button id="exportar-lista" class="btn-secundario">📋 Exportar para texto</button></div><div id="lista-inspecoes-conteudo">';
  inspecoes.forEach(ins => {
    const itensDefeito = [];
    if (ins.thoreb.status === 'DEFEITO') itensDefeito.push(`THOREB: ${ins.thoreb.obs || 'sem obs'}`);
    if (ins.elevador.status === 'DEFEITO') itensDefeito.push(`ELEVADOR: ${ins.elevador.obs || 'sem obs'}`);
    if (ins.usb.status === 'DEFEITO') itensDefeito.push(`USB: ${ins.usb.obs || 'sem obs'}`);
    if (ins.ventilador.status === 'DEFEITO') { let d = `VENTILADOR: ${ins.ventilador.obs || 'sem obs'}`; if (ins.ventilador.posicao) d += ` (Pos: ${ins.ventilador.posicao})`; itensDefeito.push(d); }
    if (itensDefeito.length === 0) return;
    let linha = `<div style="background: var(--card-bg); margin: 10px 0; padding: 12px; border-radius: 8px; border-left: 4px solid var(--accent);"><strong>${ins.carro} - ${ins.terminal}</strong><br>`;
    if (role !== 'FISCAL') linha += `<small>Responsável: ${ins.fiscal}</small><br>`;
    linha += `<ul style="margin-top: 8px; list-style: none; padding-left: 0;">${itensDefeito.map(i => `<li>⚠️ ${i}</li>`).join('')}</ul></div>`;
    html += linha;
  });
  html += '</div>';
  container.innerHTML = html;
  document.getElementById('exportar-lista')?.addEventListener('click', () => { const texto = gerarTextoExportacao(inspecoes, role); navigator.clipboard.writeText(texto).then(() => alert('Lista copiada!')).catch(() => alert('Erro ao copiar.')); });
  modal.classList.add('is-open');
}
function gerarTextoExportacao(inspecoes, role) {
  let texto = `=== INSPEÇÕES DO DIA ${new Date().toLocaleDateString('pt-BR')} ===\n\n`;
  inspecoes.forEach(ins => {
    const itensDefeito = [];
    if (ins.thoreb.status === 'DEFEITO') itensDefeito.push(`THOREB: ${ins.thoreb.obs || 'sem obs'}`);
    if (ins.elevador.status === 'DEFEITO') itensDefeito.push(`ELEVADOR: ${ins.elevador.obs || 'sem obs'}`);
    if (ins.usb.status === 'DEFEITO') itensDefeito.push(`USB: ${ins.usb.obs || 'sem obs'}`);
    if (ins.ventilador.status === 'DEFEITO') { let d = `VENTILADOR: ${ins.ventilador.obs || 'sem obs'}`; if (ins.ventilador.posicao) d += ` (Pos: ${ins.ventilador.posicao})`; itensDefeito.push(d); }
    if (itensDefeito.length === 0) return;
    texto += `CARRO: ${ins.carro} (${ins.terminal})\n` + (role !== 'FISCAL' ? `Responsável: ${ins.fiscal}\n` : '') + `Defeitos:\n${itensDefeito.map(d => `- ${d}`).join('\n')}\n\n`;
  });
  return texto;
}
function fecharModalConferir() { const m = getEl('modal-conferir-inspecoes'); if (m) m.classList.remove('is-open'); }

// ====================================================================
// ENVIO DE INFORMAÇÕES (com fluxo obrigatório)
// ====================================================================
let rascunhoAtualId = null;
let enviosLista = [];

function abrirModalEnvio() {
  const m = getEl('modal-envio-informacoes');
  if (m) m.classList.add('is-open');
  preencherDataAtual();
  preencherResponsavel();
  preencherSelectLocal();
  carregarRascunho();
  // Desabilita campos até área selecionada
  habilitarCamposSecundarios(false);
}
function fecharModalEnvio() { const m = getEl('modal-envio-informacoes'); if (m) m.classList.remove('is-open'); }
function preencherDataAtual() { 
  const d = getEl('envio-data'); 
  if (d && !d.value) {
    const hoje = new Date().toISOString().split('T')[0];
    d.value = hoje;
    d.max = hoje; // não permite data futura
  }
}
function preencherResponsavel() {
  const resp = getEl('envio-responsavel');
  if (resp) {
    const apelido = localStorage.getItem('inspectorApelido') || localStorage.getItem('inspectorName') || 'Inspetor';
    resp.value = apelido;
  }
}
function habilitarCamposSecundarios(habilitar) {
  const ids = ['envio-carro', 'envio-linha', 'envio-motorista', 'envio-cobrador', 'envio-hora', 'envio-sentido', 'envio-historico', 'envio-local', 'btn-salvar-rascunho', 'btn-enviar-relatorio'];
  ids.forEach(id => {
    const campo = getEl(id);
    if (campo) {
      if (id.startsWith('btn')) campo.disabled = !habilitar;
      else campo.disabled = !habilitar;
    }
  });
}
function aplicarRegrasPorArea() {
  const areaSelecionada = document.querySelector('input[name="areaDestino"]:checked')?.value;
  const campoOutrasArea = getEl('campo-outras-area');
  const inputOutrasArea = getEl('envio-outras-area');
  
  if (areaSelecionada === 'OUTRAS ÁREAS') {
    campoOutrasArea.style.display = 'block';
    inputOutrasArea.required = true;
  } else {
    campoOutrasArea.style.display = 'none';
    inputOutrasArea.required = false;
    inputOutrasArea.value = '';
  }
  
  // Habilita os campos secundários apenas se área foi selecionada
  if (areaSelecionada) {
    habilitarCamposSecundarios(true);
  } else {
    habilitarCamposSecundarios(false);
  }
  
  // Regras de motivos por área
  const radiosMotivo = document.querySelectorAll('input[name="motivo"]');
  radiosMotivo.forEach(radio => radio.disabled = false);
  if (areaSelecionada === 'SAF' || areaSelecionada === 'PLANTÃO' || areaSelecionada === 'OUTRAS ÁREAS') {
    radiosMotivo.forEach(radio => {
      if (radio.value !== 'AVARIAS' && radio.value !== 'OUTROS') {
        radio.disabled = true;
        if (radio.checked) radio.checked = false;
      } else {
        radio.disabled = false;
      }
    });
    const motivoAtual = document.querySelector('input[name="motivo"]:checked');
    if (motivoAtual && motivoAtual.disabled) motivoAtual.checked = false;
  }
  aplicarRegrasPorMotivo();
}
function aplicarRegrasPorMotivo() {
  const motivoSelecionado = document.querySelector('input[name="motivo"]:checked')?.value;
  const campoOutrosMotivo = getEl('campo-outros-motivo');
  const inputOutrosMotivo = getEl('envio-outros-motivo');
  
  if (motivoSelecionado === 'OUTROS') {
    campoOutrosMotivo.style.display = 'block';
    inputOutrosMotivo.required = true;
  } else {
    campoOutrosMotivo.style.display = 'none';
    inputOutrosMotivo.required = false;
    inputOutrosMotivo.value = '';
  }
  
  if (motivoSelecionado === 'AVARIAS') {
    habilitarCamposAvarias(true);
    ['envio-carro', 'envio-linha', 'envio-motorista', 'envio-hora', 'envio-sentido'].forEach(id => {
      const campo = getEl(id);
      if (campo) campo.required = true;
    });
  } else if (motivoSelecionado === 'OUTROS') {
    habilitarCamposAvarias(true);
    ['envio-carro', 'envio-linha', 'envio-motorista', 'envio-hora', 'envio-sentido'].forEach(id => {
      const campo = getEl(id);
      if (campo) campo.required = false;
    });
  } else if (motivoSelecionado === 'PEDIDO DE FOLGAS' || motivoSelecionado === 'SOLICITAÇÃO DE MATERIAIS') {
    habilitarCamposAvarias(false);
    ['envio-carro', 'envio-linha', 'envio-motorista', 'envio-hora', 'envio-sentido'].forEach(id => {
      const campo = getEl(id);
      if (campo) campo.required = false;
    });
  } else {
    habilitarCamposAvarias(false);
  }
}
function habilitarCamposAvarias(habilitar) {
  const ids = ['envio-carro', 'envio-linha', 'envio-motorista', 'envio-hora', 'envio-sentido'];
  ids.forEach(id => {
    const campo = getEl(id);
    if (campo) {
      campo.disabled = !habilitar;
      if (!habilitar) campo.value = '';
    }
  });
}
function validarFormulario() {
  const areaSelecionada = document.querySelector('input[name="areaDestino"]:checked')?.value;
  if (!areaSelecionada) { alert('Selecione a Área de Destino.'); return false; }
  if (areaSelecionada === 'OUTRAS ÁREAS') {
    const outrasArea = getEl('envio-outras-area').value.trim();
    if (!outrasArea) { alert('Digite a Área de Destino.'); return false; }
  }
  const motivoSelecionado = document.querySelector('input[name="motivo"]:checked')?.value;
  if (!motivoSelecionado) { alert('Selecione o Motivo.'); return false; }
  if (motivoSelecionado === 'OUTROS') {
    const outrosMotivo = getEl('envio-outros-motivo').value.trim();
    if (!outrosMotivo) { alert('Descreva o motivo resumidamente.'); return false; }
  }
  const carro = getEl('envio-carro').value.trim();
  if (motivoSelecionado === 'AVARIAS' && !carro) { alert('Para o motivo AVARIAS, o campo CARRO é obrigatório.'); return false; }
  const data = getEl('envio-data').value;
  if (!data) { alert('Preencha a Data.'); return false; }
  const hoje = new Date().toISOString().split('T')[0];
  if (data > hoje) { alert('A data não pode ser maior que a data atual.'); return false; }
  return true;
}
function salvarRascunho() {
  if (!validarFormulario()) return;
  const areaDestino = document.querySelector('input[name="areaDestino"]:checked')?.value;
  let areaDestinoFinal = areaDestino;
  if (areaDestino === 'OUTRAS ÁREAS') {
    areaDestinoFinal = getEl('envio-outras-area').value.trim();
  }
  const motivo = document.querySelector('input[name="motivo"]:checked')?.value;
  let motivoFinal = motivo;
  if (motivo === 'OUTROS') {
    motivoFinal = getEl('envio-outros-motivo').value.trim();
  }
  const dados = {
    id: rascunhoAtualId || Date.now().toString(),
    areaDestino: areaDestinoFinal,
    motivo: motivoFinal,
    carro: getEl('envio-carro').value,
    linha: getEl('envio-linha').value,
    motorista: getEl('envio-motorista').value,
    cobrador: getEl('envio-cobrador').value,
    hora: getEl('envio-hora').value,
    sentido: getEl('envio-sentido').value,
    historico: getEl('envio-historico').value,
    local: getEl('envio-local').value,
    data: getEl('envio-data').value,
    anexo: localStorage.getItem('anexoAtual') || ''
  };
  localStorage.setItem(`rascunho_${dados.id}`, JSON.stringify(dados));
  rascunhoAtualId = dados.id;
  alert('Rascunho salvo!');
}
function carregarRascunho() {
  if (!rascunhoAtualId) {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('rascunho_'));
    if (keys.length) rascunhoAtualId = keys[0].replace('rascunho_', '');
    else { limparFormularioEnvio(); preencherResponsavel(); return; }
  }
  const dados = JSON.parse(localStorage.getItem(`rascunho_${rascunhoAtualId}`));
  if (dados) {
    // Restaurar área de destino
    const areaOriginal = dados.areaDestino;
    const areasPermitidas = ['FISCALIZAÇÃO', 'SAF', 'PLANTÃO'];
    if (areasPermitidas.includes(areaOriginal)) {
      document.querySelector(`input[name="areaDestino"][value="${areaOriginal}"]`).checked = true;
    } else {
      document.querySelector(`input[name="areaDestino"][value="OUTRAS ÁREAS"]`).checked = true;
      getEl('envio-outras-area').value = areaOriginal;
      getEl('campo-outras-area').style.display = 'block';
    }
    // Restaurar motivo
    const motivosPermitidos = ['AVARIAS', 'PEDIDO DE FOLGAS', 'SOLICITAÇÃO DE MATERIAIS'];
    if (motivosPermitidos.includes(dados.motivo)) {
      document.querySelector(`input[name="motivo"][value="${dados.motivo}"]`).checked = true;
    } else {
      document.querySelector(`input[name="motivo"][value="OUTROS"]`).checked = true;
      getEl('envio-outros-motivo').value = dados.motivo;
      getEl('campo-outros-motivo').style.display = 'block';
    }
    getEl('envio-carro').value = dados.carro || '';
    getEl('envio-linha').value = dados.linha || '';
    getEl('envio-motorista').value = dados.motorista || '';
    getEl('envio-cobrador').value = dados.cobrador || '';
    getEl('envio-hora').value = dados.hora || '';
    getEl('envio-sentido').value = dados.sentido || '';
    getEl('envio-historico').value = dados.historico || '';
    getEl('envio-local').value = dados.local || '';
    getEl('envio-data').value = dados.data || '';
    preencherResponsavel();
    habilitarCamposSecundarios(true);
    aplicarRegrasPorArea();
    aplicarRegrasPorMotivo();
  } else {
    limparFormularioEnvio();
    preencherResponsavel();
  }
}
function limparFormularioEnvio() {
  document.querySelectorAll('input[name="areaDestino"], input[name="motivo"]').forEach(r => r.checked = false);
  getEl('envio-outras-area').value = '';
  getEl('campo-outras-area').style.display = 'none';
  getEl('envio-outros-motivo').value = '';
  getEl('campo-outros-motivo').style.display = 'none';
  getEl('envio-carro').value = ''; getEl('envio-linha').value = ''; getEl('envio-motorista').value = ''; getEl('envio-cobrador').value = '';
  getEl('envio-hora').value = ''; getEl('envio-sentido').value = ''; getEl('envio-historico').value = ''; getEl('envio-local').value = '';
  preencherDataAtual();
  rascunhoAtualId = null;
  habilitarCamposSecundarios(false);
  habilitarCamposAvarias(true);
}
function enviarRelatorio() {
  if (!validarFormulario()) return;
  const areaDestino = document.querySelector('input[name="areaDestino"]:checked')?.value;
  let areaDestinoFinal = areaDestino;
  if (areaDestino === 'OUTRAS ÁREAS') {
    areaDestinoFinal = getEl('envio-outras-area').value.trim();
  }
  const motivo = document.querySelector('input[name="motivo"]:checked')?.value;
  let motivoFinal = motivo;
  if (motivo === 'OUTROS') {
    motivoFinal = getEl('envio-outros-motivo').value.trim();
  }
  const dadosEnvio = {
    areaDestino: areaDestinoFinal,
    motivo: motivoFinal,
    carro: getEl('envio-carro').value,
    linha: getEl('envio-linha').value,
    motorista: getEl('envio-motorista').value,
    cobrador: getEl('envio-cobrador').value,
    hora: getEl('envio-hora').value,
    sentido: getEl('envio-sentido').value,
    historico: getEl('envio-historico').value,
    local: getEl('envio-local').value,
    data: getEl('envio-data').value,
    anexo: localStorage.getItem('anexoAtual') || '',
    fiscal: localStorage.getItem('inspectorApelido') || localStorage.getItem('inspectorName')
  };
  if (confirm('Enviar relatório? Os dados serão salvos na planilha.')) {
    fetch(URL_PLANILHA, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ acao: 'envio_informacoes', dados: JSON.stringify(dadosEnvio) }) })
      .then(() => { alert('Relatório enviado!'); if (rascunhoAtualId) localStorage.removeItem(`rascunho_${rascunhoAtualId}`); limparFormularioEnvio(); fecharModalEnvio(); })
      .catch(() => alert('Erro ao enviar.'));
  }
}
function anexarArquivo() {
  alert('Funcionalidade de anexo será ativada em breve.');
}
function consultarEnvios() {
  consultarEnviosComFiltro(null, null, null, null, null);
}
function consultarEnviosComFiltro(dataInicio, dataFim, motivo, carro, fiscalFiltro) {
  const params = new URLSearchParams();
  params.append('acao', 'consultar_envios');
  if (dataInicio) params.append('dataInicio', dataInicio);
  if (dataFim) params.append('dataFim', dataFim);
  if (motivo) params.append('motivo', motivo);
  if (carro) params.append('carro', carro);
  if (fiscalFiltro) params.append('fiscalFiltro', fiscalFiltro);
  if (currentUserRole === 'FISCAL') {
    params.append('fiscal', localStorage.getItem('inspectorApelido') || localStorage.getItem('inspectorName'));
  }
  return _executarConsultaEnvios(params);
}
function _executarConsultaEnvios(params) {
  return new Promise((resolve, reject) => {
    const callbackName = 'mostrarListaEnvios_' + Date.now();
    window[callbackName] = function(dados) {
      enviosLista = dados;
      const container = getEl('lista-envios-container'), modal = getEl('modal-lista-envios');
      if (!container || !modal) return;
      if (dados.length === 0) {
        container.innerHTML = '<p>Nenhum envio encontrado.</p>';
      } else {
        let html = '';
        dados.forEach((envio, idx) => {
          html += `
            <div class="envio-item" data-idx="${idx}" style="cursor: pointer;">
              <strong>MOTIVO: ${envio.motivo || 'N/I'}</strong><br>
              CARRO: ${envio.carro || 'N/I'} | DATA: ${formatarData(envio.data)} | MOTORISTA: ${envio.motorista || 'N/I'}
            </div>
          `;
        });
        container.innerHTML = html;
        document.querySelectorAll('.envio-item').forEach(el => {
          el.addEventListener('click', (e) => {
            const idx = parseInt(el.dataset.idx);
            if (!isNaN(idx)) mostrarDetalheEnvio(enviosLista[idx]);
          });
        });
      }
      modal.classList.add('is-open');
      delete window[callbackName];
      resolve();
    };
    params.append('callback', callbackName);
    const url = `${URL_PLANILHA}?${params.toString()}`;
    const script = document.createElement('script');
    script.src = url;
    script.onerror = () => { delete window[callbackName]; alert('Erro ao consultar.'); reject(); };
    document.body.appendChild(script);
  });
}
function mostrarDetalheEnvio(envio) {
  const modal = getEl('modal-detalhe-envio');
  const container = getEl('detalhe-envio-conteudo');
  if (!modal || !container) return;
  const horaFormatada = formatarHora(envio.hora);
  const dataFormatada = formatarData(envio.data);
  let html = `
    <div style="font-family: monospace; background: var(--card-bg); padding: 20px; border-radius: 12px;">
      <div><strong>MOTIVO:</strong> ${envio.motivo || 'N/I'}</div>
      <div><strong>HORA:</strong> ${horaFormatada} <strong>COB.:</strong> ${envio.cobrador || 'N/I'} <strong>SENT.:</strong> ${envio.sentido || 'N/I'}</div>
      <div><strong>CARRO:</strong> ${envio.carro || 'N/I'}</div>
      <div><strong>MOT.:</strong> ${envio.motorista || 'N/I'}</div>
      <div><strong>LINHA:</strong> ${envio.linha || 'N/I'} <strong>HISTÓRICO:</strong> ${envio.historico || 'N/I'}</div>
      <div><strong>LOCAL:</strong> ${envio.local || 'N/I'} <strong>DATA:</strong> ${dataFormatada}</div>
      <div><strong>ANEXO:</strong> ${envio.anexo ? `<a href="${envio.anexo}" target="_blank">Ver anexo</a>` : 'Nenhum'}</div>
      <div><strong>RESPONSÁVEL:</strong> ${envio.fiscal || 'N/I'}</div>
    </div>
  `;
  container.innerHTML = html;
  modal.classList.add('is-open');
  const btnExport = document.getElementById('btn-exportar-detalhe');
  if (btnExport) {
    btnExport.onclick = () => {
      const texto = gerarTextoDetalheEnvio(envio);
      navigator.clipboard.writeText(texto).then(() => {
        alert('Detalhes copiados para a área de transferência!');
      }).catch(() => {
        alert('Erro ao copiar. Tente selecionar manualmente.');
      });
    };
  }
}
function gerarTextoDetalheEnvio(envio) {
  const horaFormatada = formatarHora(envio.hora);
  const dataFormatada = formatarData(envio.data);
  let texto = `=== RELATÓRIO À CHEFIA DO TRÁFEGO ===\n\n`;
  texto += `MOTIVO: ${envio.motivo || 'N/I'}\n`;
  texto += `HORA: ${horaFormatada}  COB.: ${envio.cobrador || 'N/I'}  SENT.: ${envio.sentido || 'N/I'}\n`;
  texto += `CARRO: ${envio.carro || 'N/I'}\n`;
  texto += `MOTORISTA: ${envio.motorista || 'N/I'}\n`;
  texto += `LINHA: ${envio.linha || 'N/I'}  HISTÓRICO: ${envio.historico || 'N/I'}\n`;
  texto += `LOCAL: ${envio.local || 'N/I'}  DATA: ${dataFormatada}\n`;
  texto += `ANEXO: ${envio.anexo || 'Nenhum'}\n`;
  texto += `RESPONSÁVEL: ${envio.fiscal || 'N/I'}\n`;
  return texto;
}
function fecharModalDetalheEnvio() {
  const modal = getEl('modal-detalhe-envio');
  if (modal) modal.classList.remove('is-open');
}
function fecharModalListaEnvios() {
  const modal = getEl('modal-lista-envios');
  if (modal) modal.classList.remove('is-open');
}

// ====================================================================
// INICIALIZAÇÃO
// ====================================================================
function initModals() {
  window.modals = {
    login: new ModalController('modal-login'),
    clandestinosRto: new ModalController('modal-clandestinos-rto'),
    levantamentos: new ModalController('modal-levantamentos'),
    inspecoes5s: new ModalController('modal-inspecoes-5s')
  };
  window.modals.inspecaoVeicular = new InspecaoVeicular();
}
function initEventListeners() {
  getEl('btn-segunda-tela')?.addEventListener('click', (e) => { e.preventDefault(); getEl('login-error').style.display = 'none'; getEl('password').value = ''; window.modals.login.open(); });
  const loginForm = getEl('login-form'); if (loginForm) { loginForm.removeEventListener('submit', login); loginForm.addEventListener('submit', login); }
  getEl('btn-clandestinos-rto')?.addEventListener('click', (e) => { e.preventDefault(); window.modals.clandestinosRto.open(); });
  getEl('btn-levantamentos')?.addEventListener('click', (e) => { e.preventDefault(); window.modals.levantamentos.open(); });
  getEl('btn-inspecoes-5s')?.addEventListener('click', (e) => { e.preventDefault(); window.modals.inspecoes5s.open(); });
  getEl('btn-fechar-banner')?.addEventListener('click', fecharBanner);
  getEl('btn-envio-informacoes')?.addEventListener('click', (e) => { e.preventDefault(); abrirModalEnvio(); });
  getEl('btn-salvar-rascunho')?.addEventListener('click', salvarRascunho);
  getEl('btn-enviar-relatorio')?.addEventListener('click', enviarRelatorio);
  getEl('btn-anexar')?.addEventListener('click', anexarArquivo);
  getEl('btn-consultar-envios')?.addEventListener('click', consultarEnvios);
  document.querySelectorAll('input[name="areaDestino"]').forEach(radio => radio.addEventListener('change', aplicarRegrasPorArea));
  document.querySelectorAll('input[name="motivo"]').forEach(radio => radio.addEventListener('change', aplicarRegrasPorMotivo));

  // Painel de filtros para envios
  const modalLista = getEl('modal-lista-envios');
  if (modalLista && !document.getElementById('filtros-envio')) {
    const content = modalLista.querySelector('.modal-content');
    const filtrosDiv = document.createElement('div');
    filtrosDiv.id = 'filtros-envio';
    filtrosDiv.style.marginBottom = '15px';
    filtrosDiv.style.padding = '10px';
    filtrosDiv.style.background = 'var(--card-bg)';
    filtrosDiv.style.borderRadius = '8px';
    const role = currentUserRole;
    const maxDias = role === 'FISCAL' ? 15 : (role === 'ENCARREGADO' || role === 'INSPETOR' || role === 'PLANTONISTA') ? 30 : (role === 'SAF' ? 180 : 0);
    const maxDiasTexto = maxDias ? ` (máx ${maxDias} dias)` : ' (ilimitado)';
    filtrosDiv.innerHTML = `
      <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end;">
        <div><label>Data Início</label><input type="date" id="filtro-envio-data-inicio"></div>
        <div><label>Data Fim${maxDiasTexto}</label><input type="date" id="filtro-envio-data-fim"></div>
        <div><label>Motivo</label><select id="filtro-envio-motivo"><option value="">Todos</option><option value="AVARIAS">AVARIAS</option><option value="PEDIDO DE FOLGAS">PEDIDO DE FOLGAS</option><option value="SOLICITAÇÃO DE MATERIAIS">SOLICITAÇÃO DE MATERIAIS</option><option value="OUTROS">OUTROS</option></select></div>
        <div><label>Carro</label><input type="text" id="filtro-envio-carro" placeholder="Placa/Identificação"></div>
        ${role !== 'FISCAL' ? `<div><label>Fiscal</label><input type="text" id="filtro-envio-fiscal" placeholder="Apelido"></div>` : ''}
        <div><button id="btn-aplicar-filtros-envio" class="btn-secundario">🔍 Aplicar</button></div>
        <div><button id="btn-limpar-filtros-envio" class="btn-secundario">🗑️ Limpar</button></div>
      </div>
    `;
    const header = content.querySelector('.modal-header');
    if (header) header.insertAdjacentElement('afterend', filtrosDiv);
    else content.insertBefore(filtrosDiv, content.firstChild);
    document.getElementById('btn-aplicar-filtros-envio').addEventListener('click', () => {
      const dataInicio = document.getElementById('filtro-envio-data-inicio').value;
      let dataFim = document.getElementById('filtro-envio-data-fim').value;
      const motivo = document.getElementById('filtro-envio-motivo').value;
      const carro = document.getElementById('filtro-envio-carro').value;
      const fiscalFiltro = role !== 'FISCAL' ? document.getElementById('filtro-envio-fiscal').value : null;
      if (maxDias > 0 && dataInicio && dataFim) {
        const diff = (new Date(dataFim) - new Date(dataInicio)) / (1000 * 60 * 60 * 24);
        if (diff > maxDias) { alert(`Período máximo de ${maxDias} dias. Ajuste as datas.`); return; }
      }
      consultarEnviosComFiltro(dataInicio, dataFim, motivo, carro, fiscalFiltro);
    });
    document.getElementById('btn-limpar-filtros-envio').addEventListener('click', () => {
      document.getElementById('filtro-envio-data-inicio').value = '';
      document.getElementById('filtro-envio-data-fim').value = '';
      document.getElementById('filtro-envio-motivo').value = '';
      document.getElementById('filtro-envio-carro').value = '';
      if (role !== 'FISCAL') document.getElementById('filtro-envio-fiscal').value = '';
      consultarEnvios();
    });
  }
}
function applyTheme(theme) { if (theme === "dark") { document.body.classList.add("dark"); getEl('theme-toggle').innerHTML = "☀️"; } else { document.body.classList.remove("dark"); getEl('theme-toggle').innerHTML = "🌙"; } }
function initTheme() { const tt = getEl('theme-toggle'); if (!tt) return; const saved = localStorage.getItem("theme") || "light"; applyTheme(saved); tt.addEventListener("click", () => { const cur = localStorage.getItem("theme") === "dark" ? "light" : "dark"; localStorage.setItem("theme", cur); applyTheme(cur); }); }
function registerServiceWorker() { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').then(r => console.log('SW registrado:', r.scope)).catch(e => console.error('Falha no SW:', e)); }
async function inicializar() {
  initModals(); initEventListeners(); initTheme(); registerServiceWorker();
  await refreshInspetores(); checkLoginStatus(); mostrarBannerAviso(); aplicarBloqueioDeDatas();
  carregarTerminais().then(() => preencherSelectTerminais());
  window.addEventListener('pageshow', async (e) => { if (e.persisted) { await refreshInspetores(); checkLoginStatus(); await carregarTerminais(true); preencherSelectTerminais(); } });
  document.addEventListener('visibilitychange', async () => { if (document.visibilityState === 'visible') { await refreshInspetores(); checkLoginStatus(); await carregarTerminais(true); preencherSelectTerminais(); } });
}
window.addEventListener('load', inicializar);
