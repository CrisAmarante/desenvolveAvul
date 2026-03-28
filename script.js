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
// CARREGAMENTO DA LISTA DE INSPETORES (com hash) – ATUALIZADO COM CACHE BUSTING E CALLBACK ÚNICO
// ====================================================================
let refreshPromise = null;

function processarDadosPlanilha(dados) {
  // Espera-se que 'dados' seja um objeto com chave = apelido e valor = { hash, nome, funcao }
  // Se a planilha retornar um array (caso o doGet ainda não esteja ajustado), converta:
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
    // Já é objeto no formato esperado
    INSPETORES = dados || {};
  }
  logDebug("Inspetores carregados com hash.");
}

async function refreshInspetores() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = new Promise((resolve, reject) => {
    // Remove qualquer script antigo com o atributo específico
    const oldScript = document.querySelector('script[data-inspetores-callback]');
    if (oldScript) oldScript.remove();

    const callbackName = 'processarDadosPlanilha_' + Date.now();
    window[callbackName] = function(dados) {
      processarDadosPlanilha(dados);
      delete window[callbackName];
      refreshPromise = null;
      resolve();
    };

    const script = document.createElement('script');
    script.setAttribute('data-inspetores-callback', 'true');
    // Adiciona cache busting com timestamp
    script.src = `${URL_PLANILHA}?callback=${callbackName}&_=${Date.now()}`;
    script.onerror = (err) => {
      console.error('Erro ao carregar inspetores', err);
      delete window[callbackName];
      refreshPromise = null;
      reject(err);
    };
    document.body.appendChild(script);
  });

  return refreshPromise;
}

// Mantém uma função para compatibilidade
function carregarInspetores() {
  return refreshInspetores();
}

// ====================================================================
// LOGIN / LOGOUT + TOAST + NOME NO BOTÃO – COM VERIFICAÇÃO DE SESSÃO APÓS RECARGA
// ====================================================================
async function checkLoginStatus() {
  const logado = localStorage.getItem('inspectorLoggedIn');
  const nome = localStorage.getItem('inspectorName');
  const apelido = localStorage.getItem('inspectorApelido');

  const main = getEl('main-screen');
  const insp = getEl('inspector-screen');

  if (logado === 'true' && nome) {
    // Verifica se o inspetor ainda está na lista atualizada
    if (apelido && INSPETORES[apelido]) {
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
      // Inspetor não existe mais ou foi desativado: desloga automaticamente
      localStorage.removeItem('inspectorLoggedIn');
      localStorage.removeItem('inspectorName');
      localStorage.removeItem('inspectorApelido');
      main.style.display = 'flex';
      insp.style.display = 'none';
      // Opcional: mostrar mensagem de sessão expirada (usar toast)
      showToastMessage('Sessão expirada. Faça login novamente.', 3000);
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

  // Garante que os inspetores estejam carregados antes de tentar autenticar
  await refreshInspetores();

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
    registrarLog(apelidoEncontrado); // envia o apelido para o log
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

// Toast genérico para mensagens (opcional)
function showToastMessage(message, duration = 3000) {
  let toast = getEl('message-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'message-toast';
    toast.className = 'toast-message';
    document.body.appendChild(toast);
    // Adicionar estilos inline simples ou usar CSS
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = 'rgba(0,0,0,0.8)';
    toast.style.color = '#fff';
    toast.style.padding = '8px 16px';
    toast.style.borderRadius = '8px';
    toast.style.zIndex = '11000';
    toast.style.fontSize = '0.9rem';
    toast.style.display = 'none';
  }
  toast.textContent = message;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, duration);
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
// INSPEÇÃO VEICULAR DIÁRIA
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

    // Botões SALVAR por linha
    document.querySelectorAll('.btn-salvar').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        this.salvarLinha(row);
      });
    });

    // Posição F/M/T
    document.querySelectorAll('.pos-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
      });
    });

    // Botão ENVIAR
    const btnEnviar = document.getElementById('btn-enviar-inspecao');
    if (btnEnviar) {
      btnEnviar.addEventListener('click', () => this.enviarInspecao());
    }

    // Botões EDITAR e APAGAR (implementação básica)
    const btnEditar = document.getElementById('btn-editar-inspecao');
    if (btnEditar) {
      btnEditar.addEventListener('click', () => this.editarInspecao());
    }
    const btnApagar = document.getElementById('btn-apagar-inspecao');
    if (btnApagar) {
      btnApagar.addEventListener('click', () => this.apagarInspecao());
    }
  }

  open() {
    this.modal.open();
    this.preencherAutomatico();
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

  salvarLinha(row) {
    const item = row.dataset.item;
    const ok = row.querySelector('.ok').checked;
    const defeito = row.querySelector('.defeito').checked;
    const obs = row.querySelector('.obs-input').value.trim();

    console.log(`✅ Salvo: ${item} | OK: ${ok} | Defeito: ${defeito} | Obs: ${obs}`);
    // Aqui você pode armazenar localmente, por exemplo em um objeto ou localStorage
    alert(`✅ Item ${item.toUpperCase()} salvo com sucesso!`);
  }

  enviarInspecao() {
    if (confirm('Deseja enviar a inspeção agora?')) {
      console.log('📤 Inspeção enviada para o Google Sheets (futuro)');
      alert('✅ Inspeção enviada com sucesso!');
      this.modal.close();
    }
  }

  editarInspecao() {
    // Exemplo: reabrir para edição
    console.log('Editar inspeção');
    alert('Funcionalidade de edição em desenvolvimento.');
  }

  apagarInspecao() {
    if (confirm('Tem certeza que deseja apagar todos os dados da inspeção atual?')) {
      // Limpar campos
      document.getElementById('carro').value = '';
      document.getElementById('linha').value = '';
      document.getElementById('terminal').value = '';
      // Resetar checkboxes e observações
      document.querySelectorAll('#tabela-inspecao .ok, #tabela-inspecao .defeito').forEach(cb => cb.checked = false);
      document.querySelectorAll('#tabela-inspecao .obs-input').forEach(inp => inp.value = '');
      document.querySelectorAll('.pos-btn.active').forEach(btn => btn.classList.remove('active'));
      alert('Dados da inspeção apagados.');
    }
  }
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
// SERVICE WORKER REGISTRATION (se suportado)
// ====================================================================
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        logDebug('Service Worker registrado com escopo:', registration.scope);
      })
      .catch(error => {
        console.error('Falha ao registrar Service Worker:', error);
      });
  }
}

// ====================================================================
// INICIALIZAÇÃO GERAL COM RECARGA DE INSPETORES NO LOAD, PAGESHOW E VISIBILITY
// ====================================================================
async function initializeApp() {
  // Carrega inspetores primeiro
  await refreshInspetores();
  
  initModals();
  initEventListeners();
  initTheme();
  registerServiceWorker();
  
  checkLoginStatus();
  mostrarBannerAviso();
  aplicarBloqueioDeDatas();
  
  logDebug("PWA PENSO carregada com sucesso (hash implementado e atualização automática).");
}

// Dispara no load
window.addEventListener('load', initializeApp);

// Dispara quando a página é restaurada do cache (bfcache)
window.addEventListener('pageshow', async (event) => {
  if (event.persisted) {
    await refreshInspetores();
    checkLoginStatus();
    logDebug("Inspetores recarregados após pageshow (bfcache).");
  }
});

// Dispara quando a visibilidade muda (ex: volta de outra aba)
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    await refreshInspetores();
    checkLoginStatus();
    logDebug("Inspetores recarregados após visibilitychange.");
  }
});
