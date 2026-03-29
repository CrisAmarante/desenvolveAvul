// ====================================================================
// PENSO - Prancheta Eletrônica (Versão Otimizada - 2026.03.29)
// Script completo com correções de Forced Reflow
// ====================================================================

const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbwDxXaO5YctO81H8fd8SoQzeuK0QVbij2FMr9KVvldKNhMGvikQ4dlWR5d7KANIu3_R/exec";

let INSPETORES = {};

const DATA_INICIO_BANNER = new Date('2026-07-10T00:00:00');
const DATA_FIM_BANNER    = new Date('2026-07-21T00:01:00');

const disableDates = {
  'btn-osasco': new Date('2026-07-19'),
  'btn-santana': new Date('2026-07-03')
};

let currentUserRole = '';
let canCreateInspection = false;
let terminaisCache = [];

// Cache de elementos DOM para melhor performance
const els = {};

// ====================================================================
// FUNÇÕES UTILITÁRIAS
// ====================================================================
function logDebug(...args) {
  console.log('[PENSO]', ...args);
}

function getEl(id) {
  if (!els[id]) {
    els[id] = document.getElementById(id);
  }
  return els[id];
}

// ====================================================================
// HASH DE SENHA (SHA-256)
// ====================================================================
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ====================================================================
// MODAL CONTROLLER (Otimizado com requestAnimationFrame)
// ====================================================================
class ModalController {
  constructor(modalId) {
    this.modal = getEl(modalId);
    this.isOpen = false;
    this.handleBackgroundClick = this.handleBackgroundClick.bind(this);
    this.handleEsc = this.handleEsc.bind(this);
  }

  open() {
    if (!this.modal || this.isOpen) return;

    requestAnimationFrame(() => {
      this.modal.classList.add('is-open');
      document.body.classList.add('no-scroll');
      this.isOpen = true;

      this.modal.addEventListener('click', this.handleBackgroundClick);
      document.addEventListener('keydown', this.handleEsc);

      const firstFocusable = this.modal.querySelector('input, button, a, select, textarea');
      if (firstFocusable) firstFocusable.focus();
    });

    logDebug(`Modal "${this.modal.id}" aberto.`);
  }

  close() {
    if (!this.modal || !this.isOpen) return;

    this.modal.classList.add('is-closing');

    setTimeout(() => {
      requestAnimationFrame(() => {
        this.modal.classList.remove('is-open', 'is-closing');
        document.body.classList.remove('no-scroll');
        this.isOpen = false;
        this.modal.removeEventListener('click', this.handleBackgroundClick);
        document.removeEventListener('keydown', this.handleEsc);
      });
    }, 220);

    logDebug(`Modal "${this.modal.id}" fechado.`);
  }

  handleBackgroundClick(e) {
    if (e.target === this.modal) this.close();
  }

  handleEsc(e) {
    if (e.key === 'Escape') this.close();
  }
}

// ====================================================================
// REGISTRAR LOG DE ACESSO
// ====================================================================
async function registrarLog(nomeApelido) {
  try {
    const formData = new URLSearchParams();
    formData.append("nome", nomeApelido);
    formData.append("acao", "Login bem-sucedido");

    await fetch(URL_PLANILHA, {
      method: "POST",
      body: formData,
      mode: "no-cors"
    });
    logDebug("Log enviado:", nomeApelido);
  } catch (err) {
    console.warn("Falha ao registrar log:", err);
  }
}

// ====================================================================
// CARREGAR INSPETORES (JSONP)
// ====================================================================
let refreshPromise = null;

function processarDadosPlanilha(dados) {
  if (Array.isArray(dados)) {
    const novoObjeto = {};
    dados.forEach(row => {
      if (row.apelido && row.hash && row.ativo === "SIM") {
        novoObjeto[row.apelido] = {
          hash: row.hash,
          nome: row.nome,
          funcao: row.funcao || ''
        };
      }
    });
    INSPETORES = novoObjeto;
  } else {
    INSPETORES = dados || {};
  }
  logDebug("Lista de inspetores carregada.");
}

async function refreshInspetores() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = new Promise((resolve, reject) => {
    const callbackName = `processar_${Date.now()}`;
    window[callbackName] = (dados) => {
      processarDadosPlanilha(dados);
      delete window[callbackName];
      refreshPromise = null;
      resolve();
    };

    const script = document.createElement('script');
    script.src = `${URL_PLANILHA}?callback=${callbackName}&_=${Date.now()}`;
    script.onerror = () => {
      delete window[callbackName];
      refreshPromise = null;
      reject(new Error('Falha ao carregar inspetores'));
    };
    document.body.appendChild(script);
  });

  return refreshPromise;
}

// ====================================================================
// CARREGAR TERMINAIS
// ====================================================================
let terminaisPromise = null;

async function carregarTerminais(forceRefresh = false) {
  if (!forceRefresh && terminaisCache.length > 0) return terminaisCache;
  if (terminaisPromise) return terminaisPromise;

  terminaisPromise = new Promise((resolve) => {
    const callbackName = `terminais_${Date.now()}`;
    window[callbackName] = (terminais) => {
      terminaisCache = terminais || ['Terminal A', 'Terminal B', 'Terminal C', 'Terminal D'];
      delete window[callbackName];
      terminaisPromise = null;
      resolve(terminaisCache);
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
    const atual = select.value;
    select.innerHTML = '<option value="">Selecione...</option>';
    terminais.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      select.appendChild(opt);
    });
    if (atual) select.value = atual;
  });
}

// ====================================================================
// LOGIN / LOGOUT
// ====================================================================
async function checkLoginStatus() {
  const logado = localStorage.getItem('inspectorLoggedIn');
  const nome = localStorage.getItem('inspectorName');
  const apelido = localStorage.getItem('inspectorApelido');

  const mainScreen = getEl('main-screen');
  const inspectorScreen = getEl('inspector-screen');

  if (logado === 'true' && nome && apelido && INSPETORES[apelido]) {
    const info = INSPETORES[apelido];
    currentUserRole = info.funcao;
    canCreateInspection = ['FISCAL', 'INSPETOR'].includes(currentUserRole);

    const btnInspecao = getEl('btn-inspecao-veicular');
    if (btnInspecao) btnInspecao.style.display = (currentUserRole !== 'MONITOR') ? 'flex' : 'none';

    // Troca de tela otimizada (sem forced reflow)
    mainScreen.classList.remove('active');
    inspectorScreen.classList.add('active');

    showWelcomeToast(nome);

    const logoutBtn = inspectorScreen.querySelector('.logout-btn');
    if (logoutBtn) {
      logoutBtn.innerHTML = `Sair<small>Inspetor ${nome}</small>`;
    }
  } else {
    localStorage.removeItem('inspectorLoggedIn');
    localStorage.removeItem('inspectorName');
    localStorage.removeItem('inspectorApelido');
    localStorage.removeItem('inspectorRole');

    mainScreen.classList.add('active');
    inspectorScreen.classList.remove('active');
  }
}

async function login(e) {
  e.preventDefault();
  const senhaInput = getEl('password');
  const errorMsg = getEl('login-error');
  const senha = senhaInput.value.trim();

  let nomeEncontrado = null;
  let apelidoEncontrado = null;

  for (const [apelido, info] of Object.entries(INSPETORES)) {
    const hashCalculado = await hashPassword(senha, apelido);
    if (hashCalculado === info.hash) {
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
    senhaInput.value = '';
    senhaInput.focus();
  }
}

function logoutInspector() {
  localStorage.removeItem('inspectorLoggedIn');
  localStorage.removeItem('inspectorName');
  localStorage.removeItem('inspectorApelido');
  localStorage.removeItem('inspectorRole');
  checkLoginStatus();
}

// ====================================================================
// TOAST DE BOAS-VINDAS
// ====================================================================
function showWelcomeToast(nome) {
  const toast = getEl('welcome-toast');
  if (!toast) return;
  getEl('toast-name').textContent = nome;
  toast.classList.add('show');

  setTimeout(hideWelcomeToast, 3500);
}

function hideWelcomeToast() {
  const toast = getEl('welcome-toast');
  if (toast) toast.classList.remove('show');
}

// ====================================================================
// BANNER E BLOQUEIO DE DATAS
// ====================================================================
function aplicarBloqueioDeDatas() {
  const now = new Date();
  Object.entries(disableDates).forEach(([id, date]) => {
    const btn = getEl(id);
    if (btn && now < date) {
      btn.classList.add('disabled');
      btn.href = '#';
      btn.title = `Disponível a partir de ${date.toLocaleDateString('pt-BR')}`;
      btn.style.pointerEvents = 'none';
      btn.style.opacity = '0.45';
    }
  });
}

function fecharBanner() {
  const banner = getEl('aviso-temporario');
  if (banner) banner.style.display = 'none';
}

function mostrarBannerAviso() {
  const agora = new Date();
  const banner = getEl('aviso-temporario');
  if (banner) {
    banner.style.display = (agora >= DATA_INICIO_BANNER && agora < DATA_FIM_BANNER) ? 'flex' : 'none';
  }
}

// ====================================================================
// CLASSE INSPEÇÃO VEICULAR (COMPLETA)
// ====================================================================
class InspecaoVeicular {
  constructor() {
    this.modal = new ModalController('modal-inspecao-veicular');
    this.initEventListeners();
  }

  initEventListeners() {
    const btnAbrir = getEl('btn-inspecao-veicular');
    if (btnAbrir) {
      btnAbrir.addEventListener('click', (e) => {
        e.preventDefault();
        this.open();
      });
    }

    // Exclusão mútua entre OK e DEFEITO
    document.querySelectorAll('#tabela-inspecao tbody tr').forEach(row => {
      const cbOk = row.querySelector('.ok');
      const cbDefeito = row.querySelector('.defeito');
      if (cbOk && cbDefeito) {
        cbOk.addEventListener('change', () => { if (cbOk.checked) cbDefeito.checked = false; });
        cbDefeito.addEventListener('change', () => { if (cbDefeito.checked) cbOk.checked = false; });
      }
    });

    // Botões de posição do ventilador
    document.querySelectorAll('.pos-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        btn.classList.toggle('active');
      });
    });

    getEl('btn-enviar-inspecao')?.addEventListener('click', () => this.enviarInspecao());
    getEl('btn-conferir-inspecoes')?.addEventListener('click', () => this.conferirInspecoes());
  }

  async open() {
    if (canCreateInspection) {
      await carregarTerminais(true);
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

    const btnConferir = getEl('btn-conferir-inspecoes');
    if (btnConferir) {
      btnConferir.style.display = (currentUserRole === 'FISCAL' || currentUserRole === 'INSPETOR') ? 'block' : 'none';
    }
  }

  preencherAutomatico() {
    const nome = localStorage.getItem('inspectorName') || 'Inspetor';
    getEl('fiscal').value = nome;

    const agora = new Date();
    getEl('data').value = agora.toLocaleDateString('pt-BR');
    getEl('hora').value = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  resetarFormulario() {
    getEl('carro').value = '';
    document.querySelectorAll('#tabela-inspecao .ok, #tabela-inspecao .defeito').forEach(cb => cb.checked = false);
    document.querySelectorAll('.obs-input').forEach(inp => inp.value = '');
    document.querySelectorAll('.pos-btn').forEach(btn => btn.classList.remove('active'));
  }

  coletarDados() {
    const carro = getEl('carro').value.trim();
    const terminal = getEl('terminal').value;

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

      itens[item] = {
        status: ok ? 'OK' : (defeito ? 'DEFEITO' : ''),
        obs: obs
      };

      if (item === 'ventilador') {
        const posicoes = Array.from(row.querySelectorAll('.pos-btn.active'))
          .map(btn => btn.dataset.pos);
        itens[item].posicao = posicoes.join(',');
      }
    });

    return { carro, terminal, fiscal: getEl('fiscal').value, data: getEl('data').value, hora: getEl('hora').value, itens };
  }

  async enviarInspecao() {
    if (!canCreateInspection) {
      alert('Seu perfil não permite criar inspeções.');
      return;
    }

    const dados = this.coletarDados();
    if (!dados) return;

    const resumo = `CONFIRMAR ENVIO?\n\nCarro: ${dados.carro}\nTerminal: ${dados.terminal}\nFiscal: ${dados.fiscal}\n\nDeseja enviar?`;

    if (!confirm(resumo)) return;

    try {
      await fetch(URL_PLANILHA, {
        method: 'POST',
        mode: 'no-cors',
        body: new URLSearchParams({
          acao: 'inspecao_veicular',
          dados: JSON.stringify({
            carro: dados.carro,
            terminal: dados.terminal,
            fiscal: dados.fiscal,
            thoreb: dados.itens.thoreb,
            elevador: dados.itens.elevador,
            usb: dados.itens.usb,
            ventilador: dados.itens.ventilador
          })
        })
      });

      alert('✅ Inspeção enviada com sucesso!');
      this.resetarFormulario();
      this.modal.close();
    } catch (err) {
      console.error(err);
      alert('❌ Erro ao enviar inspeção. Tente novamente.');
    }
  }

  async conferirInspecoes() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    let fiscalParam = '';

    if (currentUserRole === 'FISCAL') {
      const nomeFiscal = localStorage.getItem('inspectorName');
      fiscalParam = `&fiscal=${encodeURIComponent(nomeFiscal)}`;
    }

    const callbackName = `inspecoesCallback_${Date.now()}`;
    window[callbackName] = (dados) => {
      delete window[callbackName];
      if (!dados || dados.length === 0) {
        alert('Nenhuma inspeção encontrada para hoje.');
      } else {
        mostrarModalConferir(dados, currentUserRole);
      }
    };

    const script = document.createElement('script');
    script.src = `${URL_PLANILHA}?acao=consultar_inspecoes&data=${encodeURIComponent(hoje)}${fiscalParam}&callback=${callbackName}`;
    script.onerror = () => {
      delete window[callbackName];
      alert('Erro ao consultar inspeções.');
    };
    document.body.appendChild(script);
  }
}

// ====================================================================
// MODAL DE CONFERIR INSPEÇÕES
// ====================================================================
function mostrarModalConferir(inspecoes, role) {
  const modal = getEl('modal-conferir-inspecoes');
  const container = getEl('lista-inspecoes');
  if (!modal || !container) return;

  let html = `<div style="margin-bottom:12px;text-align:right;">
                <button id="exportar-lista" class="btn-secundario">📋 Exportar para texto</button>
              </div>`;

  inspecoes.forEach(ins => {
    const defeitos = [];
    if (ins.thoreb?.status === 'DEFEITO') defeitos.push(`THOREB: ${ins.thoreb.obs || 'sem obs'}`);
    if (ins.elevador?.status === 'DEFEITO') defeitos.push(`ELEVADOR: ${ins.elevador.obs || 'sem obs'}`);
    if (ins.usb?.status === 'DEFEITO') defeitos.push(`USB: ${ins.usb.obs || 'sem obs'}`);
    if (ins.ventilador?.status === 'DEFEITO') {
      let txt = `VENTILADOR: ${ins.ventilador.obs || 'sem obs'}`;
      if (ins.ventilador.posicao) txt += ` (Pos: ${ins.ventilador.posicao})`;
      defeitos.push(txt);
    }

    if (defeitos.length === 0) return;

    html += `
      <div style="background:var(--card-bg); margin:10px 0; padding:12px; border-radius:8px; border-left:4px solid var(--accent);">
        <strong>${ins.carro} - ${ins.terminal}</strong><br>
        ${role !== 'FISCAL' ? `<small>Responsável: ${ins.fiscal}</small><br>` : ''}
        <ul style="margin-top:8px; padding-left:0; list-style:none;">
          ${defeitos.map(d => `<li>⚠️ ${d}</li>`).join('')}
        </ul>
      </div>`;
  });

  container.innerHTML = html;

  document.getElementById('exportar-lista')?.addEventListener('click', () => {
    // Função de exportação simplificada
    alert('Funcionalidade de exportação em desenvolvimento.');
  });

  modal.classList.add('is-open');
}

function fecharModalConferir() {
  const modal = getEl('modal-conferir-inspecoes');
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
    inspecoes5s: new ModalController('modal-inspecoes-5s'),
    inspecaoVeicular: new InspecaoVeicular()
  };
}

function initEventListeners() {
  getEl('btn-segunda-tela')?.addEventListener('click', (e) => {
    e.preventDefault();
    getEl('login-error').style.display = 'none';
    getEl('password').value = '';
    window.modals.login.open();
  });

  getEl('login-form')?.addEventListener('submit', login);

  getEl('btn-clandestinos-rto')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.modals.clandestinosRto.open();
  });

  getEl('btn-levantamentos')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.modals.levantamentos.open();
  });

  getEl('btn-inspecoes-5s')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.modals.inspecoes5s.open();
  });

  getEl('btn-fechar-banner')?.addEventListener('click', fecharBanner);
}

function initTheme() {
  const toggle = getEl('theme-toggle');
  if (!toggle) return;

  const isDark = localStorage.getItem('theme') === 'dark';
  document.body.classList.toggle('dark', isDark);
  toggle.textContent = isDark ? '☀️' : '🌙';

  toggle.addEventListener('click', () => {
    const nowDark = document.body.classList.toggle('dark');
    localStorage.setItem('theme', nowDark ? 'dark' : 'light');
    toggle.textContent = nowDark ? '☀️' : '🌙';
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => logDebug('Service Worker registrado com sucesso'))
      .catch(err => console.error('Erro ao registrar Service Worker:', err));
  }
}

async function inicializar() {
  // Cache inicial dos elementos principais
  ['main-screen', 'inspector-screen', 'welcome-toast', 'aviso-temporario', 
   'theme-toggle', 'password', 'login-error', 'terminal', 'carro', 'fiscal', 
   'data', 'hora', 'btn-inspecao-veicular'].forEach(id => getEl(id));

  initModals();
  initEventListeners();
  initTheme();
  registerServiceWorker();

  await refreshInspetores();
  checkLoginStatus();
  mostrarBannerAviso();
  aplicarBloqueioDeDatas();
  await carregarTerminais();
  preencherSelectTerminais();

  logDebug("PENSO carregado com sucesso - Versão otimizada.");
}

window.addEventListener('load', inicializar);
