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
let todosTerminaisCache = [];

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
// TERMINAIS
// ====================================================================
let terminaisPromise = null;
function carregarTerminais(forceRefresh = false) {
  if (!forceRefresh && terminaisCache.length > 0) return Promise.resolve(terminaisCache);
  if (terminaisPromise) return terminaisPromise;
  terminaisPromise = new Promise((resolve) => {
    const callbackName = 'carregarTerminaisCallback_' + Date.now();
    window[callbackName] = function(terminais) {
      terminaisCache = terminais;
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

// Carregar TODOS os terminais (para o campo Local)
let todosTerminaisPromise = null;
function carregarTodosTerminais(forceRefresh = false) {
  if (!forceRefresh && todosTerminaisCache.length > 0) return Promise.resolve(todosTerminaisCache);
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
    showWelcomeToast(nome);
    const logoutBtn = insp.querySelector('.logout-btn');
    if (logoutBtn) logoutBtn.innerHTML = `Sair<small>Inspetor ${nome}</small>`;
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
function showWelcomeToast(nome) {
  const toast = getEl('welcome-toast');
  if (!toast) return;
  getEl('toast-name').textContent = nome;
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
// INSPEÇÃO VEICULAR
// ====================================================================
class InspecaoVeicular {
  constructor() { this.modal = new ModalController('modal-inspecao-veicular'); this.initEventListeners(); }
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
  async open() { if (canCreateInspection) { await carregarTerminais(true); preencherSelectTerminais(); this.openForm(); } else await this.conferirInspecoes(); }
  openForm() { this.modal.open(); this.preencherAutomatico(); this.resetarFormulario(); const btn = getEl('btn-conferir-inspecoes'); if (btn) btn.style.display = (currentUserRole === 'FISCAL' || currentUserRole === 'INSPETOR') ? 'block' : 'none'; }
  preencherAutomatico() {
    const nome = localStorage.getItem('inspectorName') || 'Inspetor';
    if (getEl('fiscal')) getEl('fiscal').value = nome;
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
    const getDataBrasil = () => {
      const d = new Date();
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    };
    const hoje = getDataBrasil();
    let fiscalParam = '';
    if (currentUserRole === 'FISCAL') {
      const fiscalNome = localStorage.getItem('inspectorName');
      if (fiscalNome && fiscalNome !== 'undefined' && fiscalNome !== 'null') {
        fiscalParam = `&fiscal=${encodeURIComponent(fiscalNome)}`;
      }
    }
    return new Promise((resolve, reject) => {
      const callbackName = 'consultarInspecoesCallback_' + Date.now();
      window[callbackName] = (dados) => {
        if (dados && dados.erro) {
          alert('Erro ao consultar: ' + dados.erro);
        } else if (!dados || (Array.isArray(dados) && dados.length === 0)) {
          alert('Nenhuma inspeção encontrada para hoje.');
        } else {
          mostrarModalConferir(dados, currentUserRole);
        }
        delete window[callbackName];
        resolve();
      };
      const url = `${URL_PLANILHA}?acao=consultar_inspecoes&data=${encodeURIComponent(hoje)}${fiscalParam}&callback=${callbackName}`;
      const script = document.createElement('script');
      script.src = url;
      script.onerror = () => { delete window[callbackName]; alert('Erro ao consultar.'); reject(); };
      document.body.appendChild(script);
    });
  }
}
function mostrarModalConferir(inspecoes, role) {
  const modal = getEl('modal-conferir-inspecoes'), container = getEl('lista-inspecoes');
  if (!modal || !container) return;
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
// ENVIO DE INFORMAÇÕES (com novas regras)
// ====================================================================
let rascunhoAtualId = null;

function abrirModalEnvio() {
  const modal = getEl('modal-envio-informacoes');
  if (modal) modal.classList.add('is-open');
  preencherDataAtual();
  preencherSelectLocal();
  preencherResponsavel();
  carregarRascunho();
  aplicarRegrasPorArea(); // inicial
  aplicarRegrasPorMotivo(); // inicial
  // Adicionar event listeners para área e motivo
  document.querySelectorAll('input[name="areaDestino"]').forEach(radio => {
    radio.removeEventListener('change', aplicarRegrasPorArea);
    radio.addEventListener('change', aplicarRegrasPorArea);
  });
  document.querySelectorAll('input[name="motivo"]').forEach(radio => {
    radio.removeEventListener('change', aplicarRegrasPorMotivo);
    radio.addEventListener('change', aplicarRegrasPorMotivo);
  });
}
function fecharModalEnvio() { const m = getEl('modal-envio-informacoes'); if (m) m.classList.remove('is-open'); }
function preencherDataAtual() { const d = getEl('envio-data'); if (d && !d.value) d.value = new Date().toISOString().split('T')[0]; }
function preencherResponsavel() {
  const nome = localStorage.getItem('inspectorName') || localStorage.getItem('inspectorApelido') || '';
  const resp = getEl('envio-responsavel');
  if (resp) resp.value = nome;
}
function aplicarRegrasPorArea() {
  const areaSelecionada = document.querySelector('input[name="areaDestino"]:checked')?.value;
  const motivos = document.querySelectorAll('input[name="motivo"]');
  const avariasRadio = document.querySelector('input[name="motivo"][value="AVARIAS"]');
  const outrosRadio = document.querySelector('input[name="motivo"][value="OUTROS"]');
  const pedidoRadio = document.querySelector('input[name="motivo"][value="PEDIDO DE FOLGAS"]');
  const solicitacaoRadio = document.querySelector('input[name="motivo"][value="SOLICITAÇÃO DE MATERIAIS"]');
  
  if (areaSelecionada === 'SAF' || areaSelecionada === 'PLANTÃO' || areaSelecionada === 'OUTRAS ÁREAS') {
    // Apenas Avarias e Outros habilitados
    if (avariasRadio) avariasRadio.disabled = false;
    if (outrosRadio) outrosRadio.disabled = false;
    if (pedidoRadio) pedidoRadio.disabled = true;
    if (solicitacaoRadio) solicitacaoRadio.disabled = true;
    // Se algum desabilitado estiver marcado, desmarcar
    if (pedidoRadio?.checked) pedidoRadio.checked = false;
    if (solicitacaoRadio?.checked) solicitacaoRadio.checked = false;
  } else {
    // Fiscalização: todos habilitados
    motivos.forEach(m => m.disabled = false);
  }
  // Reaplicar regras de motivo após possível mudança
  aplicarRegrasPorMotivo();
}
function aplicarRegrasPorMotivo() {
  const motivo = document.querySelector('input[name="motivo"]:checked')?.value;
  const campos = ['envio-carro', 'envio-linha', 'envio-motorista', 'envio-hora', 'envio-sentido'];
  const inputs = campos.map(id => getEl(id));
  if (motivo === 'AVARIAS') {
    // Campos habilitados e obrigatórios
    inputs.forEach(inp => { if (inp) { inp.disabled = false; inp.required = true; } });
  } else if (motivo === 'OUTROS') {
    // Campos habilitados, não obrigatórios
    inputs.forEach(inp => { if (inp) { inp.disabled = false; inp.required = false; } });
  } else if (motivo === 'PEDIDO DE FOLGAS' || motivo === 'SOLICITAÇÃO DE MATERIAIS') {
    // Campos desabilitados e não obrigatórios
    inputs.forEach(inp => { if (inp) { inp.disabled = true; inp.required = false; inp.value = ''; } });
  } else {
    // Nenhum motivo selecionado: desabilita? Melhor manter habilitado? Vamos manter habilitado não obrigatório.
    inputs.forEach(inp => { if (inp) { inp.disabled = false; inp.required = false; } });
  }
}
function salvarRascunho() {
  const dados = {
    id: rascunhoAtualId || Date.now().toString(),
    areaDestino: document.querySelector('input[name="areaDestino"]:checked')?.value || '',
    motivo: document.querySelector('input[name="motivo"]:checked')?.value || '',
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
    responsavel: getEl('envio-responsavel').value
  };
  localStorage.setItem(`rascunho_${dados.id}`, JSON.stringify(dados));
  rascunhoAtualId = dados.id;
  alert('Rascunho salvo!');
}
function carregarRascunho() {
  if (!rascunhoAtualId) {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('rascunho_'));
    if (keys.length) rascunhoAtualId = keys[0].replace('rascunho_', '');
    else { limparFormularioEnvio(); return; }
  }
  const dados = JSON.parse(localStorage.getItem(`rascunho_${rascunhoAtualId}`));
  if (dados) {
    if (dados.areaDestino) document.querySelector(`input[name="areaDestino"][value="${dados.areaDestino}"]`).checked = true;
    if (dados.motivo) document.querySelector(`input[name="motivo"][value="${dados.motivo}"]`).checked = true;
    getEl('envio-carro').value = dados.carro || '';
    getEl('envio-linha').value = dados.linha || '';
    getEl('envio-motorista').value = dados.motorista || '';
    getEl('envio-cobrador').value = dados.cobrador || '';
    getEl('envio-hora').value = dados.hora || '';
    getEl('envio-sentido').value = dados.sentido || '';
    getEl('envio-historico').value = dados.historico || '';
    getEl('envio-local').value = dados.local || '';
    getEl('envio-data').value = dados.data || '';
    getEl('envio-responsavel').value = dados.responsavel || localStorage.getItem('inspectorName') || '';
    localStorage.setItem('anexoAtual', dados.anexo || '');
    // Aplicar regras novamente após carregar
    aplicarRegrasPorArea();
    aplicarRegrasPorMotivo();
  } else limparFormularioEnvio();
}
function limparFormularioEnvio() {
  document.querySelectorAll('input[name="areaDestino"], input[name="motivo"]').forEach(r => r.checked = false);
  getEl('envio-carro').value = ''; getEl('envio-linha').value = ''; getEl('envio-motorista').value = ''; getEl('envio-cobrador').value = '';
  getEl('envio-hora').value = ''; getEl('envio-sentido').value = ''; getEl('envio-historico').value = ''; getEl('envio-local').value = '';
  getEl('envio-data').value = ''; getEl('envio-responsavel').value = localStorage.getItem('inspectorName') || '';
  preencherDataAtual();
  rascunhoAtualId = null;
  localStorage.removeItem('anexoAtual');
}
function enviarRelatorio() {
  const areaDestino = document.querySelector('input[name="areaDestino"]:checked')?.value;
  const motivo = document.querySelector('input[name="motivo"]:checked')?.value;
  const carro = getEl('envio-carro').value.trim();
  const linha = getEl('envio-linha').value.trim();
  const motorista = getEl('envio-motorista').value.trim();
  const hora = getEl('envio-hora').value;
  const sentido = getEl('envio-sentido').value;
  const data = getEl('envio-data').value;
  const local = getEl('envio-local').value;
  const responsavel = getEl('envio-responsavel').value;

  if (!areaDestino) { alert('Selecione a Área de Destino.'); return; }
  if (!motivo) { alert('Selecione o Motivo.'); return; }
  if (!data) { alert('Preencha a Data.'); return; }
  if (!local) { alert('Selecione o Local.'); return; }

  // Validações específicas para Avarias
  if (motivo === 'AVARIAS') {
    if (!carro) { alert('O campo CARRO é obrigatório para Avarias.'); return; }
    if (!linha) { alert('O campo LINHA é obrigatório para Avarias.'); return; }
    if (!motorista) { alert('O campo MOT. é obrigatório para Avarias.'); return; }
    if (!hora) { alert('O campo HORA é obrigatório para Avarias.'); return; }
    if (!sentido) { alert('O campo SENT. é obrigatório para Avarias.'); return; }
  }

  const dadosEnvio = {
    areaDestino, motivo,
    carro, linha, motorista,
    cobrador: getEl('envio-cobrador').value,
    hora, sentido,
    historico: getEl('envio-historico').value,
    local, data,
    anexo: localStorage.getItem('anexoAtual') || '',
    fiscal: responsavel || localStorage.getItem('inspectorName')
  };
  if (confirm('Enviar relatório? Os dados serão salvos na planilha.')) {
    fetch(URL_PLANILHA, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ acao: 'envio_informacoes', dados: JSON.stringify(dadosEnvio) }) })
      .then(() => { alert('Relatório enviado!'); if (rascunhoAtualId) localStorage.removeItem(`rascunho_${rascunhoAtualId}`); limparFormularioEnvio(); fecharModalEnvio(); })
      .catch(() => alert('Erro ao enviar.'));
  }
}
function anexarArquivo() { const anexo = prompt('Cole o link do anexo (Google Drive, OneDrive) ou descreva:'); if (anexo) { localStorage.setItem('anexoAtual', anexo); alert('Anexo adicionado!'); } }
function consultarEnvios() {
  const fiscal = localStorage.getItem('inspectorName'), hoje = new Date().toLocaleDateString('pt-BR');
  const callbackName = 'mostrarListaEnvios';
  window[callbackName] = function(dados) {
    const container = getEl('lista-envios-container'), modal = getEl('modal-lista-envios');
    if (!container || !modal) return;
    if (dados.length === 0) container.innerHTML = '<p>Nenhum envio encontrado para hoje.</p>';
    else {
      let html = '';
      dados.forEach(e => { html += `<div class="envio-item"><strong>${e.carro} - ${e.data}</strong><br>Área: ${e.areaDestino} | Motivo: ${e.motivo}<br>Local: ${e.local || 'N/I'} | Histórico: ${e.historico || 'N/I'}<br>Anexo: ${e.anexo ? `<a href="${e.anexo}" target="_blank">Ver anexo</a>` : 'Nenhum'}</div>`; });
      container.innerHTML = html;
    }
    modal.classList.add('is-open');
    delete window[callbackName];
  };
  const script = document.createElement('script');
  script.src = `${URL_PLANILHA}?acao=consultar_envios&fiscal=${encodeURIComponent(fiscal)}&data=${encodeURIComponent(hoje)}&callback=${callbackName}`;
  script.onerror = () => alert('Erro ao consultar envios.');
  document.body.appendChild(script);
}
function fecharModalListaEnvios() { const m = getEl('modal-lista-envios'); if (m) m.classList.remove('is-open'); }

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
}
function applyTheme(theme) { if (theme === "dark") { document.body.classList.add("dark"); getEl('theme-toggle').innerHTML = "☀️"; } else { document.body.classList.remove("dark"); getEl('theme-toggle').innerHTML = "🌙"; } }
function initTheme() { const tt = getEl('theme-toggle'); if (!tt) return; const saved = localStorage.getItem("theme") || "light"; applyTheme(saved); tt.addEventListener("click", () => { const cur = localStorage.getItem("theme") === "dark" ? "light" : "dark"; localStorage.setItem("theme", cur); applyTheme(cur); }); }
function registerServiceWorker() { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').then(r => console.log('SW registrado:', r.scope)).catch(e => console.error('Falha no SW:', e)); }
async function inicializar() {
  initModals(); initEventListeners(); initTheme(); registerServiceWorker();
  await refreshInspetores(); checkLoginStatus(); mostrarBannerAviso(); aplicarBloqueioDeDatas();
  await carregarTerminais(); preencherSelectTerminais();
  await carregarTodosTerminais(); // pré-carrega para o campo local
  window.addEventListener('pageshow', async (e) => { if (e.persisted) { await refreshInspetores(); checkLoginStatus(); await carregarTerminais(true); preencherSelectTerminais(); await carregarTodosTerminais(true); } });
  document.addEventListener('visibilitychange', async () => { if (document.visibilityState === 'visible') { await refreshInspetores(); checkLoginStatus(); await carregarTerminais(true); preencherSelectTerminais(); await carregarTodosTerminais(true); } });
}
window.addEventListener('load', inicializar);
