// ====================================================================
// CONFIGURAÇÕES GERAIS
// ====================================================================
const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbwDxXaO5YctO81H8fd8SoQzeuK0QVbij2FMr9KVvldKNhMGvikQ4dlWR5d7KANIu3_R/exec";

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
let terminaisCache = []; // cache dos terminais carregados

function logDebug(...args) {
  console.log('[PENSO]', ...args);
}

function getEl(id) {
  return document.getElementById(id);
}

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
// LOG
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
// CARREGAR INSPETORES
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
// CARREGAR TERMINAIS (via JSONP)
// ====================================================================
let terminaisPromise = null;

function carregarTerminais(forceRefresh = false) {
  if (!forceRefresh && terminaisCache.length > 0) {
    return Promise.resolve(terminaisCache);
  }

  if (terminaisPromise) return terminaisPromise;

  terminaisPromise = new Promise((resolve, reject) => {
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
      // Fallback para terminais padrão
      const fallback = ['Terminal A', 'Terminal B', 'Terminal C', 'Terminal D'];
      terminaisCache = fallback;
      console.warn('Usando terminais padrão devido a erro de carregamento');
      resolve(fallback);
    };
    document.body.appendChild(script);
  });

  return terminaisPromise;
}

function preencherSelectTerminais() {
  const select = getEl('terminal');
  if (!select) return;

  carregarTerminais().then(terminais => {
    // Mantém o valor atual selecionado (se houver)
    const valorAtual = select.value;
    select.innerHTML = '<option value="">Selecione...</option>';
    terminais.forEach(terminal => {
      const option = document.createElement('option');
      option.value = terminal;
      option.textContent = terminal;
      select.appendChild(option);
    });
    if (valorAtual && terminais.includes(valorAtual)) {
      select.value = valorAtual;
    }
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

  if (logado === 'true' && nome) {
    if (apelido && INSPETORES[apelido]) {
      const role = INSPETORES[apelido].funcao;
      currentUserRole = role;
      canCreateInspection = (role === 'FISCAL' || role === 'INSPETOR');

      localStorage.setItem('inspectorRole', role);

      if (btnInspecao && role !== 'MONITOR') {
        btnInspecao.style.display = 'flex';
      } else if (btnInspecao) {
        btnInspecao.style.display = 'none';
      }

      main.style.display = 'none';
      insp.style.display = 'flex';
      showWelcomeToast(nome);
      const logoutBtn = insp.querySelector('.logout-btn');
      if (logoutBtn) {
        logoutBtn.innerHTML = `Sair<small>Inspetor ${nome}</small>`;
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
// INSPEÇÃO VEICULAR
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

    // Exclusão mútua
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

    // Posições (múltiplas)
    document.querySelectorAll('.pos-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        btn.classList.toggle('active');
      });
    });

    // Enviar
    const btnEnviar = getEl('btn-enviar-inspecao');
    if (btnEnviar) {
      btnEnviar.addEventListener('click', () => this.enviarInspecao());
    }

    // Conferir
    const btnConferir = getEl('btn-conferir-inspecoes');
    if (btnConferir) {
      btnConferir.addEventListener('click', () => this.conferirInspecoes());
    }
  }

  async open() {
    if (canCreateInspection) {
      // Recarrega os terminais antes de abrir o formulário
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
    const fiscalInput = getEl('fiscal');
    if (fiscalInput) fiscalInput.value = nome;

    const agora = new Date();
    const dataInput = getEl('data');
    if (dataInput) dataInput.value = agora.toLocaleDateString('pt-BR');
    const horaInput = getEl('hora');
    if (horaInput) horaInput.value = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  atualizarDataHora() {
    const agora = new Date();
    const dataInput = getEl('data');
    const horaInput = getEl('hora');
    if (dataInput) dataInput.value = agora.toLocaleDateString('pt-BR');
    if (horaInput) horaInput.value = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  resetarFormulario() {
    const carroInput = getEl('carro');
    if (carroInput) carroInput.value = '';

    document.querySelectorAll('#tabela-inspecao tbody tr .ok, #tabela-inspecao tbody tr .defeito').forEach(cb => cb.checked = false);
    document.querySelectorAll('.obs-input').forEach(inp => inp.value = '');
    document.querySelectorAll('.pos-btn').forEach(btn => btn.classList.remove('active'));
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

      if (item === 'ventilador') {
        const posSelecionadas = Array.from(row.querySelectorAll('.pos-btn.active'))
          .map(btn => btn.dataset.pos);
        itens[item].posicao = posSelecionadas.join(',');
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
      usb: dados.itens.usb,
      ventilador: dados.itens.ventilador
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
          dados: JSON.stringify(dadosEnvio)
        })
      });
      alert('✅ Inspeção enviada com sucesso!');
      this.resetarFormulario();
    } catch (err) {
      console.error('Erro ao enviar inspeção:', err);
      alert('❌ Erro ao enviar. Tente novamente.');
    }
  }

  conferirInspecoes() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    let fiscalParam = '';
    if (currentUserRole === 'FISCAL') {
      const fiscalNome = localStorage.getItem('inspectorName');
      fiscalParam = `&fiscal=${encodeURIComponent(fiscalNome)}`;
    }

    return new Promise((resolve, reject) => {
      const callbackName = 'consultarInspecoesCallback_' + Date.now();
      window[callbackName] = (dados) => {
        if (dados.length === 0) {
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
// EXIBIÇÃO E EXPORTAÇÃO
// ====================================================================
function mostrarModalConferir(inspecoes, role) {
  const modal = getEl('modal-conferir-inspecoes');
  const container = getEl('lista-inspecoes');
  if (!modal || !container) return;

  let html = '<div style="margin-bottom: 12px; text-align: right;"><button id="exportar-lista" class="btn-secundario">📋 Exportar para texto</button></div>';
  html += '<div id="lista-inspecoes-conteudo">';

  inspecoes.forEach(ins => {
    const itensDefeito = [];
    if (ins.thoreb.status === 'DEFEITO') itensDefeito.push(`THOREB: ${ins.thoreb.obs || 'sem obs'}`);
    if (ins.elevador.status === 'DEFEITO') itensDefeito.push(`ELEVADOR: ${ins.elevador.obs || 'sem obs'}`);
    if (ins.usb.status === 'DEFEITO') itensDefeito.push(`USB: ${ins.usb.obs || 'sem obs'}`);
    if (ins.ventilador.status === 'DEFEITO') {
      let defeito = `VENTILADOR: ${ins.ventilador.obs || 'sem obs'}`;
      if (ins.ventilador.posicao) defeito += ` (Pos: ${ins.ventilador.posicao})`;
      itensDefeito.push(defeito);
    }

    if (itensDefeito.length === 0) return;

    let linha = `<div style="background: var(--card-bg); margin: 10px 0; padding: 12px; border-radius: 8px; border-left: 4px solid var(--accent);">
                  <strong>${ins.carro} - ${ins.terminal}</strong><br>`;
    if (role !== 'FISCAL') {
      linha += `<small>Responsável: ${ins.fiscal}</small><br>`;
    }
    linha += `<ul style="margin-top: 8px; list-style: none; padding-left: 0;">`;
    itensDefeito.forEach(item => linha += `<li>⚠️ ${item}</li>`);
    linha += `</ul></div>`;
    html += linha;
  });

  html += '</div>';
  container.innerHTML = html;

  const btnExport = document.getElementById('exportar-lista');
  if (btnExport) {
    btnExport.onclick = () => {
      const texto = gerarTextoExportacao(inspecoes, role);
      navigator.clipboard.writeText(texto).then(() => {
        alert('Lista copiada para a área de transferência!');
      }).catch(() => {
        alert('Erro ao copiar. Tente selecionar e copiar manualmente.');
      });
    };
  }

  modal.classList.add('is-open');
}

function gerarTextoExportacao(inspecoes, role) {
  let texto = `=== INSPEÇÕES DO DIA ${new Date().toLocaleDateString('pt-BR')} ===\n\n`;
  inspecoes.forEach(ins => {
    const itensDefeito = [];
    if (ins.thoreb.status === 'DEFEITO') itensDefeito.push(`THOREB: ${ins.thoreb.obs || 'sem obs'}`);
    if (ins.elevador.status === 'DEFEITO') itensDefeito.push(`ELEVADOR: ${ins.elevador.obs || 'sem obs'}`);
    if (ins.usb.status === 'DEFEITO') itensDefeito.push(`USB: ${ins.usb.obs || 'sem obs'}`);
    if (ins.ventilador.status === 'DEFEITO') {
      let defeito = `VENTILADOR: ${ins.ventilador.obs || 'sem obs'}`;
      if (ins.ventilador.posicao) defeito += ` (Pos: ${ins.ventilador.posicao})`;
      itensDefeito.push(defeito);
    }
    if (itensDefeito.length === 0) return;

    texto += `CARRO: ${ins.carro} (${ins.terminal})\n`;
    if (role !== 'FISCAL') texto += `Responsável: ${ins.fiscal}\n`;
    texto += `Defeitos:\n${itensDefeito.map(d => `- ${d}`).join('\n')}\n\n`;
  });
  return texto;
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
// TEMA
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
// SERVICE WORKER
// ====================================================================
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => console.log('SW registrado:', registration.scope))
      .catch(error => console.error('Falha no SW:', error));
  }
}

// ====================================================================
// INICIALIZAÇÃO
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

  // Pré-carrega os terminais (fallback se necessário)
  await carregarTerminais();
  preencherSelectTerminais();

  window.addEventListener('pageshow', async (event) => {
    if (event.persisted) {
      await refreshInspetores();
      checkLoginStatus();
      await carregarTerminais(true);
      preencherSelectTerminais();
    }
  });

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      await refreshInspetores();
      checkLoginStatus();
      await carregarTerminais(true);
      preencherSelectTerminais();
    }
  });

  logDebug("PWA PENSO carregada.");
}

window.addEventListener('load', inicializar);
