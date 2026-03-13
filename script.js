const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbxlo0yjd020iNdfE0zaPawlRcR3dAZtPjdIVLsLZ7eBjwjIJ10gXYlewxvvZpyNKaM/exec";

let INSPETORES = {};

const disableDates = {
    'btn-osasco': new Date('2026-02-19'),
    'btn-santana': new Date('2026-06-03')
};

// ==========================================================================
// SINCRONIZAÇÃO COM GOOGLE SHEETS
// ==========================================================================

function processarDadosPlanilha(dados) {
    if (dados && !dados.erro) {
        INSPETORES = dados;
        console.log("✅ Dados sincronizados");
    }
    document.getElementById('loading-overlay').style.display = 'none';
}

function carregarInspetores() {
    document.getElementById('loading-overlay').style.display = 'flex';
    const script = document.createElement('script');
    script.src = `${URL_PLANILHA}?callback=processarDadosPlanilha&t=${new Date().getTime()}`;
    document.body.appendChild(script);
}

// ==========================================================================
// SISTEMA DE LOGIN E CONTROLE DE PERFIL (SAF)
// ==========================================================================

function login(e) {
    e.preventDefault();
    const senhaDigitada = document.getElementById('password').value.trim();
    const hashDigitado = CryptoJS.SHA256(senhaDigitada).toString();

    const nomeEncontrado = Object.keys(INSPETORES).find(nome => {
        const item = INSPETORES[nome];
        return (typeof item === 'object' ? item.senha : item) === hashDigitado;
    });

    if (nomeEncontrado) {
        const dadosUsuario = INSPETORES[nomeEncontrado];
        const perfil = dadosUsuario.perfil || dadosUsuario.funcao || "PADRÃO";

        localStorage.setItem('inspectorLoggedIn', 'true');
        localStorage.setItem('inspectorName', nomeEncontrado);
        localStorage.setItem('inspectorPerfil', perfil);
        
        document.getElementById('modal-login').style.display = 'none';
        checkLoginStatus();
    } else {
        document.getElementById('login-error').style.display = 'block';
        document.getElementById('password').value = '';
    }
}

function checkLoginStatus() {
    const logado = localStorage.getItem('inspectorLoggedIn');
    const nome = localStorage.getItem('inspectorName');
    const perfilRaw = localStorage.getItem('inspectorPerfil') || "";
    const perfil = perfilRaw.trim().toUpperCase();

    const mainScreen = document.getElementById('main-screen');
    const inspectorScreen = document.getElementById('inspector-screen');
    const adminArea = document.getElementById('admin-area');

    if (logado === 'true') {
        mainScreen.style.display = 'none';
        inspectorScreen.style.display = 'flex';
        
        const saudacao = (perfil === "SAF") 
            ? `Olá, ${nome} do <strong>${perfilRaw}</strong>!` 
            : `Olá ${nome}, <strong>${perfilRaw}</strong>!`;
        document.getElementById('welcome-msg').innerHTML = saudacao;

        // SE FOR SAF, MOSTRA ÁREA E SINCRONIZA CHECKBOXES
        if (perfil === "SAF") {
            adminArea.style.display = 'block';
            
            // ITEM 3: Sincroniza o desenho do checkbox com a memória do navegador
            document.getElementById('check-5s-santana').checked = localStorage.getItem('config_5s_santana_force') === 'true';
            document.getElementById('check-levantamentos').checked = localStorage.getItem('config_levantamentos_force') === 'true';
        } else {
            adminArea.style.display = 'none';
        }
        
        aplicarBloqueioDeDatas(); // Garante que os botões atualizem ao entrar
    } else {
        mainScreen.style.display = 'flex';
        inspectorScreen.style.display = 'none';
    }
}

function logoutInspector() {
    localStorage.clear();
    location.reload();
}

// ==========================================================================
// LÓGICA DE BLOQUEIO E LIBERAÇÃO DE BOTÕES
// ==========================================================================

function aplicarBloqueioDeDatas() {
    const now = new Date();
    
    // Controle do Botão Santana de Parnaíba
    const btnSantana = document.getElementById('btn-santana');
    if (btnSantana) {
        const dataBloqueio = disableDates['btn-santana'];
        const liberadoPeloAdmin = localStorage.getItem('config_5s_santana_force') === 'true';

        if (now < dataBloqueio && !liberadoPeloAdmin) {
            btnSantana.classList.add('disabled');
            btnSantana.style.pointerEvents = 'none';
            btnSantana.style.opacity = '0.5';
        } else {
            btnSantana.classList.remove('disabled');
            btnSantana.style.pointerEvents = 'auto';
            btnSantana.style.opacity = '1';
        }
    }

    // Controle do Botão Osasco
    const btnOsasco = document.getElementById('btn-osasco');
    if (btnOsasco) {
        if (now < disableDates['btn-osasco']) {
            btnOsasco.classList.add('disabled');
        } else {
            btnOsasco.classList.remove('disabled');
        }
    }
}

// ==========================================================================
// EVENTOS E INICIALIZAÇÃO
// ==========================================================================

window.addEventListener('load', () => {
    carregarInspetores();
    checkLoginStatus();
});

document.getElementById('btn-segunda-tela').addEventListener('click', () => {
    document.getElementById('modal-login').style.display = 'flex';
});

document.getElementById('login-form').addEventListener('submit', login);

// LISTENERS PARA OS CHECKBOXES DA ÁREA SAF
document.getElementById('check-5s-santana').addEventListener('change', function(e) {
    localStorage.setItem('config_5s_santana_force', e.target.checked);
    aplicarBloqueioDeDatas();
});

document.getElementById('check-levantamentos').addEventListener('change', function(e) {
    localStorage.setItem('config_levantamentos_force', e.target.checked);
    aplicarBloqueioDeDatas();
});

// FUNÇÃO PARA FECHAR MODAIS (CHAMADA PELO HTML)
function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}
function openModal(id) {
    document.getElementById(id).style.display = 'flex';
}
