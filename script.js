// ====================================================================
// CONFIGURAÇÕES GERAIS
// ====================================================================
const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbzDzqC5d30qOfp-2_8jYwnklvspOStsm1lHCOwBOqzxSIfCEuhwbx2MCBrCcuCNMezK/exec";

let INSPETORES = {}; // estrutura: { apelido: { hash, nome, funcao } }

// Período do banner
const DATA_INICIO_BANNER = new Date('2026-07-10T00:00:00');
const DATA_FIM_BANNER    = new Date('2026-07-21T00:01:00');

// Bloqueio de botões por data
const disableDates = {
  'btn-osasco': new Date('2026-07-19'),
  'btn-santana': new Date('2026-07-03')
};

// Perfis autorizados para acessar a inspeção veicular
const ROLES_ALLOWED_INSPECTION = ['INSPETOR', 'ENCARREGADO', 'ADMIN', 'GERENTE', 'FISCAL', 'PLANTONISTA'];

// ====================================================================
// UTILITÁRIOS
// ====================================================================
function logDebug(...args) {
  console.log('[PENSO]', ...args);
}

function getEl(id) {
  return document.getElementById(id);
}

// ====================================================================
// FUNÇÃO DE HASH (SHA-256) – mesmo algoritmo do servidor
// ====================================================================
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ====================================================================
// CONTROLE DE MODAIS
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
    logDebug(`Modal "${this.modal.id}" aberto.`);
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
      logDebug(`Modal "${this.modal.id}" fechado.`);
    }, 220);
  }

  handleBackgroundClick(e) {
    if (e.target === this.modal) this.close();
  }

  handleEsc(e) {
    if (e.key === 'Escape') this.close();
  }
}

// ====================================================================
// LOG DE ACESSO
// ====================================================================
async function registrarLog(nomeApelido) {
  try {
    const formData = new URLSearchParams();
    formData.append("nome", nomeApelido);
    formData.append("acao", "Login bem-sucedido");
    await fetch(URL_PLANILHA, { method: "POST", body: formData, mode: "no-cors" });
    logDebug("Log enviado:", nomeApelido);
  } catch (err) {
    console.warn("Falha ao registrar log:", err);
  }
}

// ====================================================================
// CARREGAMENTO DA LISTA DE INSPETORES (com hash) – VERSÃO MELHORADA
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
          funcao: row.funcao
        };
      }
    });
    INSPETORES = novoObjeto;
  } else {
    INSPETORES = dados || {};
  }
  logDebug("Inspetores carregados com hash.");
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
    script.onerror = () => {
      console.error('Erro ao carregar inspetores');
      delete window[callbackName];
      refreshPromise = null;
      reject(new Error('Falha no carregamento dos inspetores'));
    };
    document.body.appendChild(script);
  });

  return refreshPromise;
}

// ====================================================================
// LOGIN / LOGOUT + TOAST + NOME NO BOTÃO – COM VERIFICAÇÃO DE VALIDADE
// ====================================================================
async function checkLoginStatus() {
  const logado = localStorage.getItem('inspectorLoggedIn');
  const nome = localStorage.getItem('inspectorName');
  const apelido = localStorage.getItem('inspectorApelido');

  const main = getEl('main-screen');
  const insp = getEl('inspector-screen');
  const btnInspecao = getEl('btn-inspecao-veicular');

  if (logado === 'true' && nome) {
    if (apelido && INSPETORES[apelido]) {
      const role = INSPETORES[apelido].funcao;
      localStorage.setItem('inspectorRole', role);

      if (btnInspecao && ROLES_ALLOWED_INSPECTION.includes(role)) {
        btnInspecao.style.display = 'flex';
      } else if (btnInspecao) {
        btnInspecao.style.display = 'none';
      }

      main.style.display = 'none';
      insp.style.display = 'flex';
      showWelcomeToast(nome);
      const logoutBtn = insp.querySelector('.logout-btn');
      if (logoutBtn) {
        logoutBtn.innerHTML = `
          Sair
          <small>Inspetor ${nome}</small>
        `;
      }
    } else {
      localStorage.removeItem('inspectorLoggedIn');
      localStorage.removeItem('inspectorName');
      localStorage.removeItem('inspectorApelido');
      localStorage.removeItem('inspectorRole');
      main.style.display = 'flex';
      insp.style.display = 'none';
      const toast = getEl('welcome-toast');
      if (toast) {
        getEl('toast-name').textContent = 'Sessão expirada';
        toast.classList.add('show');
        setTimeout(() => hideWelcomeToast(), 3000);
      }
    }
  } else {
    main.style.display = 'flex';
    insp.style.display = 'none';
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

// ====================== TOAST TEMPORÁRIO DE BOAS-VINDAS ======================
function showWelcomeToast(nome) {
  const toast = getEl('welcome-toast');
  if (!toast) return;
  
  getEl('toast-name').textContent = nome;
  toast.classList.add('show');

  const autoHide = setTimeout(() => hideWelcomeToast(), 3500);

  const clickHandler = () => {
    hideWelcomeToast();
    document.removeEventListener('click', clickHandler);
    clearTimeout(autoHide);
  };
  
  setTimeout(() => document.addEventListener('click', clickHandler), 300);
}

function hideWelcomeToast() {
  const toast = getEl('welcome-toast');
  if (toast) toast.classList.remove('show');
}

// ====================================================================
// BLOQUEIO DE BOTÕES POR DATA
// ====================================================================
function aplicarBloqueioDeDatas() {
  const now = new Date();
  for (const [id, date] of Object.entries(disableDates)) {
    const btn = getEl(id);
    if (btn && now < date) {
      btn.classList.add('disabled');
      btn.setAttribute('href', '#');
      btn.title = `Disponível a partir de ${date.toLocaleDateString('pt-BR')}`;
      btn.style.pointerEvents = 'none';
      btn.style.opacity = '0.45';
    }
  }
}

// ====================================================================
// BANNER TEMPORÁRIO
// ====================================================================
function fecharBanner() {
  const banner = getEl('aviso-temporario');
  if (banner) banner.style.display = 'none';
}

function mostrarBannerAviso() {
  const agora = new Date();
  const banner = getEl('aviso-temporario');
  if (!banner) return;
  banner.style.display = (agora >= DATA_INICIO_BANNER && agora < DATA_FIM_BANNER) ? 'flex' : 'none';
}

// ====================================================================
// INSPEÇÃO VEICULAR DIÁRIA – VERSÃO COM REGISTRO ÚNICO
// ====================================================================
class InspecaoVeicular {
  constructor() {
    this.modal = new ModalController('modal-inspecao-veicular');
    this.initEventListeners();
  }

  initEventListeners() {
    const btnAbrir = document.getElementById('btn-inspecao-veicular');
    if (btnAbrir) {
      btnAbrir.addEventListener('click', (e) => {
        e.preventDefault();
        this.open();
      });
    }

    // Mutually exclusive checkboxes for each row
    document.querySelectorAll('#tabela-inspecao tbody tr').forEach(row => {
      const cbOk = row.querySelector('.ok');
      const cbDefeito = row.querySelector('.defeito');
      if (cbOk && cbDefeito) {
        cbOk.addEventListener('change', () => {
          if (cbOk.checked) cbDefeito.checked = false;
        });
        cbDefeito.addEventListener('change', () => {
          if (cbDefeito.checked) cbOk.checked = false;
        });
      }
    });

    // Position buttons – allow multiple selections (toggle class active)
    document.querySelectorAll('.pos-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        btn.classList.toggle('active');
      });
    });

    // Botão ENVIAR
    const btnEnviar = document.getElementById('btn-enviar-inspecao');
    if (btnEnviar) {
      btnEnviar.addEventListener('click', () => this.enviarInspecao());
    }

    // Botão CONFERIR INSPEÇÕES (para fiscais)
    const btnConferir = document.getElementById('btn-conferir-inspecoes');
    if (btnConferir) {
      btnConferir.addEventListener('click', () => this.conferirInspecoes());
    }
  }

  open() {
    this.modal.open();
    this.preencherAutomatico();
    // Reset any previous selections
    document.querySelectorAll('#tabela-inspecao tbody tr .ok, #tabela-inspecao tbody tr .defeito').forEach(cb => cb.checked = false);
    document.querySelectorAll('.pos-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.obs-input').forEach(inp => inp.value = '');

    const role = localStorage.getItem('inspectorRole');
    const btnConferir = document.getElementById('btn-conferir-inspecoes');
    if (btnConferir) {
      btnConferir.style.display = (role === 'FISCAL') ? 'block' : 'none';
    }
  }

  preencherAutomatico() {
    const nome = localStorage.getItem('inspectorName') || 'Inspetor';
    const fiscalInput = document.getElementById('fiscal');
    if (fiscalInput) fiscalInput.value = nome;

    const agora = new Date();
    const dataInput = document.getElementById('data');
    if (dataInput) {
      dataInput.value = agora.toLocaleDateString('pt-BR');
    }
    const horaInput = document.getElementById('hora');
    if (horaInput) {
      horaInput.value = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
  }

  coletarDados() {
    const carro = document.getElementById('carro').value.trim();
    const terminal = document.getElementById('terminal').value;
    const fiscal = document.getElementById('fiscal').value;
    const data = document.getElementById('data').value;
    const hora = document.getElementById('hora').value;

    if (!carro || !terminal) {
      alert('Preencha o campo CARRO e selecione o TERMINAL.');
      return null;
    }

    const itens = {};
    const rows = document.querySelectorAll('#tabela-inspecao tbody tr');
    rows.forEach(row => {
      const item = row.dataset.item;
      const ok = row.querySelector('.ok').checked;
      const defeito = row.querySelector('.defeito').checked;
      const obs = row.querySelector('.obs-input').value.trim();
      
      itens[item] = {
        status: ok ? 'OK' : (defeito ? 'DEFEITO' : ''),
        obs: obs
      };

      // Para ventilador, capturar posições selecionadas (múltiplas)
      if (item === 'ventilador') {
        const posSelecionadas = Array.from(row.querySelectorAll('.pos-btn.active'))
          .map(btn => btn.dataset.pos);
        itens[item].posicao = posSelecionadas.join(',');
      }
    });

    return { carro, terminal, fiscal, data, hora, itens };
  }

  async enviarInspecao() {
    const dados = this.coletarDados();
    if (!dados) return;

    // Gerar resumo para confirmação
    let resumo = `CONFIRMAR ENVIO?\n\nCarro: ${dados.carro}\nTerminal: ${dados.terminal}\nFiscal: ${dados.fiscal}\nData/Hora: ${dados.data} ${dados.hora}\n\nItens:\n`;
    for (const [item, info] of Object.entries(dados.itens)) {
      let status = info.status || 'NÃO INFORMADO';
      resumo += `- ${item.toUpperCase()}: ${status}`;
      if (info.obs) resumo += ` (Obs: ${info.obs})`;
      if (info.posicao) resumo += ` (Pos: ${info.posicao})`;
      resumo += '\n';
    }

    const confirmado = confirm(resumo + '\n\nDeseja enviar os dados?');
    if (!confirmado) return;

    try {
      const response = await fetch(URL_PLANILHA, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          acao: 'inspecao_veicular',
          dados: JSON.stringify(dados)
        })
      });
      alert('✅ Inspeção enviada com sucesso!');
      this.modal.close();
    } catch (err) {
      console.error('Erro ao enviar inspeção:', err);
      alert('❌ Erro ao enviar. Tente novamente.');
    }
  }

  async conferirInspecoes() {
    const fiscalNome = localStorage.getItem('inspectorName');
    const hoje = new Date().toLocaleDateString('pt-BR');

    try {
      const response = await fetch(`${URL_PLANILHA}?acao=consultar_inspecoes&fiscal=${encodeURIComponent(fiscalNome)}&data=${encodeURIComponent(hoje)}`);
      const dados = await response.json();
      if (dados.length === 0) {
        alert('Nenhuma inspeção encontrada para hoje.');
      } else {
        mostrarModalConferir(dados);
      }
    } catch (err) {
      console.error('Erro ao consultar inspeções:', err);
      alert('Erro ao consultar. Tente novamente.');
    }
  }
}

// Função auxiliar para exibir modal de conferência
function mostrarModalConferir(inspecoes) {
  const modal = getEl('modal-conferir-inspecoes');
  const container = getEl('lista-inspecoes');
  if (!modal || !container) return;
  
  let html = '<ul style="list-style: none; padding: 0;">';
  inspecoes.forEach(ins => {
    html += `<li><strong>${ins.item.toUpperCase()}</strong>: ${ins.ok === 'SIM' ? '✅ OK' : '⚠️ DEFEITO'} `;
    if (ins.obs) html += `(Obs: ${ins.obs}) `;
    if (ins.posicao) html += `(Pos: ${ins.posicao}) `;
    html += `- ${ins.carro} / ${ins.terminal} - ${ins.dataHora}</li>`;
  });
  html += '</ul>';
  container.innerHTML = html;
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
    inspecoes5s: new ModalController('modal-inspecoes-5s')
  };
  window.modals.inspecaoVeicular = new InspecaoVeicular();
}

function initEventListeners() {
  getEl('btn-segunda-tela')?.addEventListener('click', (e) => {
    e.preventDefault();
    getEl('login-error').style.display = 'none';
    getEl('password').value = '';
    window.modals.login.open();
  });

  const loginForm = getEl('login-form');
  if (loginForm) {
    loginForm.removeEventListener('submit', login);
    loginForm.addEventListener('submit', login);
  }

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

// ====================================================================
// TEMA CLARO / ESCURO
// ====================================================================
function applyTheme(theme) {
  if (theme === "dark") {
    document.body.classList.add("dark");
    getEl('theme-toggle').innerHTML = "☀️";
  } else {
    document.body.classList.remove("dark");
    getEl('theme-toggle').innerHTML = "🌙";
  }
}

function initTheme() {
  const themeToggle = getEl('theme-toggle');
  if (!themeToggle) return;
  const savedTheme = localStorage.getItem("theme") || "light";
  applyTheme(savedTheme);
  themeToggle.addEventListener("click", () => {
    const current = localStorage.getItem("theme") === "dark" ? "light" : "dark";
    localStorage.setItem("theme", current);
    applyTheme(current);
  });
}

// ====================================================================
// REGISTRO DO SERVICE WORKER
// ====================================================================
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('Service Worker registrado com sucesso:', registration.scope);
      })
      .catch(error => {
        console.error('Falha ao registrar Service Worker:', error);
      });
  }
}

// ====================================================================
// INICIALIZAÇÃO GERAL COM ATUALIZAÇÃO DINÂMICA
// ====================================================================
async function inicializar() {
  initModals();
  initEventListeners();
  initTheme();
  registerServiceWorker();

  await refreshInspetores();
  checkLoginStatus();
  mostrarBannerAviso();
  aplicarBloqueioDeDatas();

  window.addEventListener('pageshow', async (event) => {
    if (event.persisted) {
      await refreshInspetores();
      checkLoginStatus();
    }
  });

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      await refreshInspetores();
      checkLoginStatus();
    }
  });

  logDebug("PWA PENSO carregada com sucesso (atualização dinâmica de inspetores).");
}

window.addEventListener('load', inicializar);
