const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbwOdmBDWJPVRkepk05SZ7JDSYSCzW8kW6Hb8YTjLWQDp-vykS7bd5-_e_thkwpcbVFL/exec";
let INSPETORES = {};

// ====================================================================
// FUNÇÃO PARA REGISTRAR LOG DE ACESSO (via POST)
// ====================================================================
async function registrarLog(nomeApelido) {
  try {
    const formData = new URLSearchParams();
    formData.append("nome", nomeApelido);
    formData.append("acao", "Login bem-sucedido");

    const response = await fetch(URL_PLANILHA, {
      method: "POST",
      body: formData,
      mode: "no-cors"   // importante para evitar problemas de CORS em PWAs
    });

    console.log("Log de acesso enviado para:", nomeApelido);
  } catch (err) {
    console.warn("Não foi possível registrar o log:", err);
    // Não bloqueia o login — apenas avisa no console
  }
}

// ====================================================================
// CARREGAMENTO DA LISTA DE USUÁRIOS (JSONP)
// ====================================================================
function processarDadosPlanilha(dados) {
  INSPETORES = dados;
  console.log("Lista de inspetores carregada com sucesso.");
  // Opcional: remover o overlay de loading se você quiser
  // document.getElementById('loading-overlay').style.display = 'none';
}

function carregarInspetores() {
  const script = document.createElement('script');
  script.src = `${URL_PLANILHA}?callback=processarDadosPlanilha`;
  document.body.appendChild(script);
}

// ====================================================================
// VERIFICA SE JÁ ESTÁ LOGADO (localStorage)
// ====================================================================
function checkLoginStatus() {
  const logado = localStorage.getItem('inspectorLoggedIn');
  const nomeInspetor = localStorage.getItem('inspectorName');

  if (logado === 'true' && nomeInspetor) {
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('inspector-screen').style.display = 'flex';
    
    const welcomeMsg = document.getElementById('welcome-msg');
    if (welcomeMsg) {
      welcomeMsg.innerText = `Bem-vindo, Inspetor ${nomeInspetor}!`;
    }
  } else {
    document.getElementById('main-screen').style.display = 'flex';
    document.getElementById('inspector-screen').style.display = 'none';
  }
}

// ====================================================================
// PROCESSA O LOGIN
// ====================================================================
function login(e) {
  e.preventDefault();
  
  const senhaDigitada = document.getElementById('password').value.trim();
  const nomeEncontrado = Object.keys(INSPETORES).find(
    nome => INSPETORES[nome] === senhaDigitada
  );

  if (nomeEncontrado) {
    // Salva no localStorage
    localStorage.setItem('inspectorLoggedIn', 'true');
    localStorage.setItem('inspectorName', nomeEncontrado);

    // Registra o log de acesso
    registrarLog(nomeEncontrado);

    // Fecha modal e atualiza tela
    closeModal('modal-login');
    checkLoginStatus();
  } else {
    document.getElementById('login-error').style.display = 'block';
    document.getElementById('password').value = '';
    document.getElementById('password').focus();
  }
}

// ====================================================================
// LOGOUT
// ====================================================================
function logoutInspector() {
  localStorage.removeItem('inspectorLoggedIn');
  localStorage.removeItem('inspectorName');
  checkLoginStatus();
}

// ====================================================================
// FUNÇÕES DE MODAL
// ====================================================================
function openModal(modalId) {
  document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

// ====================================================================
// BLOQUEIO DE BOTÕES POR DATA (exemplo fixo)
// ====================================================================
const disableDates = {
  'btn-osasco': new Date('2026-02-19'),
  'btn-santana': new Date('2026-02-03')
};

function aplicarBloqueioDeDatas() {
  const now = new Date();
  for (const [id, date] of Object.entries(disableDates)) {
    const btn = document.getElementById(id);
    if (btn && now < date) {
      btn.classList.add('disabled');
      btn.setAttribute('href', '#');
      btn.title = 'Disponível a partir de ' + date.toLocaleDateString('pt-BR');
    }
  }
}
// Período do banner — ajuste conforme necessário
const dataInicio = new Date('2026-03-10T00:00:00');  // ← temporário para teste HOJE
const dataFim    = new Date('2026-03-21T00:01:00');

function fecharBanner() {
    const banner = document.getElementById('aviso-temporario');
    if (banner) {
        banner.style.display = 'none';
        console.log("Banner fechado pelo botão");
    }
}

function mostrarBannerAviso() {
    const agora = new Date();
    const banner = document.getElementById('aviso-temporario');
    
    if (!banner) {
        console.warn("Elemento #aviso-temporario não encontrado");
        return;
    }

    console.log("Verificando banner:", agora.toLocaleString('pt-BR'));

    if (agora >= dataInicio && agora < dataFim) {
        console.log("→ Banner deve aparecer");
        banner.style.display = 'flex';

        // Timeout para fechar automaticamente
        setTimeout(() => {
            if (banner.style.display !== 'none') {
                banner.style.display = 'none';
                console.log("Banner fechado automaticamente após 3s");
            }
        }, 3000);

    } else {
        console.log("→ Banner fora do período → escondido");
        banner.style.display = 'none';
    }
}

// ====================================================================
// INICIALIZAÇÃO
// ====================================================================
window.addEventListener('load', () => {
  // Mostra overlay enquanto carrega (opcional)
  // document.getElementById('loading-overlay').style.display = 'flex';
  
  carregarInspetores();
  checkLoginStatus();
  aplicarBloqueioDeDatas();
});

// ====================================================================
// EVENT LISTENERS
// ====================================================================
document.getElementById('btn-segunda-tela').addEventListener('click', (e) => {
  e.preventDefault();
  openModal('modal-login');
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('password').value = '';
  document.getElementById('password').focus();
});

document.getElementById('login-form').addEventListener('submit', login);

document.getElementById('btn-clandestinos-rto').addEventListener('click', (e) => {
  e.preventDefault();
  openModal('modal-clandestinos-rto');
});

document.getElementById('btn-levantamentos').addEventListener('click', (e) => {
  e.preventDefault();
  openModal('modal-levantamentos');
});

document.getElementById('btn-inspecoes-5s').addEventListener('click', (e) => {
  e.preventDefault();
  openModal('modal-inspecoes-5s');
});

// Fecha modais ao clicar fora
window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.style.display = 'none';
  }
});

// Fecha modais com ESC
document.addEventListener('keydown', (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
  }
});
