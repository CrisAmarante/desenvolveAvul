// ====================================================================
// VARIÁVEIS DE AUTENTICAÇÃO E PERMISSÕES
// ====================================================================
const ROLES_ALLOWED_INSPECTION = ['INSPETOR', 'ENCARREGADO', 'ADMIN', 'GERENTE', 'FISCAL', 'PLANTONISTA'];
let currentUserRole = '';
let canCreateInspection = false;

// ====================================================================
// VERIFICAR STATUS DE LOGIN (VERSÃO CORRIGIDA)
// ====================================================================
async function checkLoginStatus() {
  const logado = localStorage.getItem('inspectorLoggedIn');
  const nome = localStorage.getItem('inspectorName');
  const apelido = localStorage.getItem('inspectorApelido');
  const roleSalva = localStorage.getItem('inspectorRole');
  const main = getEl('main-screen');
  const insp = getEl('inspector-screen');
  const btnInspecao = getEl('btn-inspecao-veicular');
  const btnEnvio = getEl('btn-envio-informacoes');
  
  if (logado === 'true' && nome && apelido) {
    // Tenta obter o papel do localStorage primeiro
    let role = roleSalva;
    
    // Se o INSPETORES já tiver o dado, usa para validar/atualizar
    if (INSPETORES[apelido]) {
      const roleFromServer = INSPETORES[apelido].funcao;
      if (roleFromServer !== role) {
        role = roleFromServer;
        localStorage.setItem('inspectorRole', role);
      }
    }
    
    if (!role) {
      // Sem papel, não pode continuar – força logout
      logoutInspector();
      return;
    }
    
    currentUserRole = role;
    canCreateInspection = (role === 'FISCAL' || role === 'INSPETOR');
    
    // Lógica existente para mostrar/ocultar os cards especiais (baseada no MONITOR)
    if (btnInspecao && role !== 'MONITOR') btnInspecao.style.display = 'flex';
    else if (btnInspecao) btnInspecao.style.display = 'none';
    
    if (btnEnvio && role !== 'MONITOR') btnEnvio.style.display = 'flex';
    else if (btnEnvio) btnEnvio.style.display = 'none';
    
    // Ajusta todos os cards conforme o perfil
    ajustarCardsPorPerfil(role);
    
    main.style.display = 'none';
    insp.style.display = 'flex';
    showWelcomeToast(apelido);
    
    const logoutBtn = insp.querySelector('.logout-btn');
    if (logoutBtn) logoutBtn.innerHTML = `Sair<small>${apelido}</small>`;
  } else {
    // Usuário não logado: garante que a tela principal apareça e a de inspetor suma
    localStorage.removeItem('inspectorLoggedIn');
    localStorage.removeItem('inspectorName');
    localStorage.removeItem('inspectorApelido');
    localStorage.removeItem('inspectorRole');
    main.style.display = 'flex';
    insp.style.display = 'none';
  }
}

// ====================================================================
// LOGIN (mantido igual, mas com refreshInspetores opcional após sucesso)
// ====================================================================
async function login(e) {
  e.preventDefault();
  const senha = getEl('password').value.trim();
  const errorMsg = getEl('login-error');
  const btnSubmit = e.target.querySelector('button[type="submit"]');
  
  const textoOriginal = btnSubmit.innerHTML;
  btnSubmit.innerHTML = 'Verificando...';
  btnSubmit.disabled = true;
  errorMsg.style.display = 'none';

  const callbackName = 'loginCallback_' + Date.now();
  
  window[callbackName] = async function(resposta) {
    delete window[callbackName];
    btnSubmit.innerHTML = textoOriginal;
    btnSubmit.disabled = false;

    if (resposta && resposta.sucesso) {
      localStorage.setItem('inspectorLoggedIn', 'true');
      localStorage.setItem('inspectorName', resposta.nome);
      localStorage.setItem('inspectorApelido', resposta.apelido);
      localStorage.setItem('inspectorRole', resposta.funcao);
      
      // Garante que os dados dos inspetores estejam atualizados (opcional)
      await refreshInspetores();
      
      registrarLog(resposta.apelido);
      window.modals.login.close();
      checkLoginStatus();
    } else {
      errorMsg.style.display = 'block';
      getEl('password').value = '';
      getEl('password').focus();
    }
  };

  const script = document.createElement('script');
  script.src = `${URL_PLANILHA}?acao=login&senha=${encodeURIComponent(senha)}&callback=${callbackName}`;
  script.onerror = () => {
    delete window[callbackName];
    btnSubmit.innerHTML = textoOriginal;
    btnSubmit.disabled = false;
    alert('Erro de conexão. Verifique sua internet.');
  };
  document.body.appendChild(script);
}

// ====================================================================
// DEMAIS FUNÇÕES (logout, toast, banner, etc.) PERMANECEM IGUAIS
// ====================================================================
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
    if (btn && now < date) {
      btn.classList.add('disabled');
      btn.setAttribute('href', '#');
      btn.title = `Disponível a partir de ${date.toLocaleDateString('pt-BR')}`;
      btn.style.pointerEvents = 'none';
      btn.style.opacity = '0.45';
    }
  }
}

function fecharBanner() { const b = getEl('aviso-temporario'); if (b) b.style.display = 'none'; }

function mostrarBannerAviso() {
  const agora = new Date();
  const banner = getEl('aviso-temporario');
  if (banner) banner.style.display = (agora >= DATA_INICIO_BANNER && agora < DATA_FIM_BANNER) ? 'flex' : 'none';
}

// ====================================================================
// AJUSTAR VISIBILIDADE DOS CARDS CONFORME PERFIL
// ====================================================================
function ajustarCardsPorPerfil(role) {
  const todosCards = document.querySelectorAll('#inspector-screen .inspector-card');
  const cardInspecao = document.getElementById('btn-inspecao-veicular');
  const cardEnvio = document.getElementById('btn-envio-informacoes');
  
  if (role === 'FISCAL') {
    todosCards.forEach(card => {
      if (card === cardInspecao || card === cardEnvio) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  } else {
    todosCards.forEach(card => {
      card.style.display = 'flex';
    });
  }
}
