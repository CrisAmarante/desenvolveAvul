const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbxlo0yjd020iNdfE0zaPawlRcR3dAZtPjdIVLsLZ7eBjwjIJ10gXYlewxvvZpyNKaM/exec";



let INSPETORES = {};
let CONFIG_GLOBAL = {};

const disableDates = {
    'btn-osasco': new Date('2026-02-19'),
    'btn-santana': new Date('2026-06-03')
};

// ==========================================================================
// SINCRONIZAÇÃO COM GOOGLE SHEETS
// ==========================================================================

function processarDadosPlanilha(dados) {
    if (dados && !dados.erro) {
        INSPETORES = dados.inspetores;
        CONFIG_GLOBAL = dados.config; // Recebe as travas da aba "Config"
        
        console.log("✅ Dados e Configurações sincronizados");
        
        // Atualiza os botões assim que os dados chegam
        aplicarBloqueioDeDatas();
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
// SISTEMA DE LOGIN E STATUS
// ==========================================================================

function login(e) {
    e.preventDefault();
    const senhaDigitada = document.getElementById('password').value.trim();
    const hashDigitado = CryptoJS.SHA256(senhaDigitada).toString();

    const nomeEncontrado = Object.keys(INSPETORES).find(nome => {
        return INSPETORES[nome].senha === hashDigitado;
    });

    if (nomeEncontrado) {
        const perfil = INSPETORES[nomeEncontrado].perfil || "PADRÃO";
        localStorage.setItem('inspectorLoggedIn', 'true');
        localStorage.setItem('inspectorName', nomeEncontrado);
        localStorage.setItem('inspectorPerfil', perfil);
        
        document.getElementById('modal-login').style.display = 'none';
        checkLoginStatus();
    } else {
        document.getElementById('login-error').style.display = 'block';
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

        if (perfil === "SAF") {
            adminArea.style.display = 'block';
            // Sincroniza os checks da tela com o que veio da planilha
            document.getElementById('check-5s-santana').checked = CONFIG_GLOBAL['btn-santana'] === true;
            document.getElementById('check-levantamentos').checked = CONFIG_GLOBAL['btn-levantamentos'] === true;
        }
    } else {
        mainScreen.style.display = 'flex';
        inspectorScreen.style.display = 'none';
    }
}

// ==========================================================================
// LOGICA DE BLOQUEIO (DATA vs CONFIG SAF)
// ==========================================================================

function aplicarBloqueioDeDatas() {
    const now = new Date();
    
    // Lista de botões para verificar
    const botoes = [
        { id: 'btn-santana', configKey: 'btn-santana' },
        { id: 'btn-osasco', configKey: 'btn-osasco' }
    ];

    botoes.forEach(item => {
        const btn = document.getElementById(item.id);
        if (!btn) return;

        const dataLimite = disableDates[item.id];
        const liberadoPeloSAF = CONFIG_GLOBAL[item.configKey] === true;

        // Regra: Bloqueia se a data não chegou E o SAF não liberou manualmente
        if (now < dataLimite && !liberadoPeloSAF) {
            btn.classList.add('disabled');
            btn.style.opacity = "0.5";
            btn.style.pointerEvents = "none";
        } else {
            btn.classList.remove('disabled');
            btn.style.opacity = "1";
            btn.style.pointerEvents = "auto";
        }
    });
}

// ==========================================================================
// SALVAR CONFIGURAÇÃO GLOBAL (ÁREA SAF)
// ==========================================================================

async function salvarConfiguracaoGlobal(idBotao, status) {
    const overlay = document.getElementById('loading-overlay');
    overlay.style.display = 'flex';

    const url = `${URL_PLANILHA}?tipo=config_botoes&idBotao=${idBotao}&status=${status}`;

    try {
        // Usamos modo no-cors para evitar erros de política de segurança do Google
        await fetch(url, { method: 'POST', mode: 'no-cors' });
        alert("Configuração salva para todos os usuários!");
        location.reload(); // Recarrega para validar a nova config
    } catch (e) {
        alert("Erro ao salvar no banco de dados.");
    } finally {
        overlay.style.display = 'none';
    }
}

// Evento do botão Salvar do Painel Admin
document.querySelector('#admin-area button').addEventListener('click', () => {
    const checkSantana = document.getElementById('check-5s-santana').checked;
    const checkLevant = document.getElementById('check-levantamentos').checked;
    
    // Salva o de Santana (podemos expandir para salvar múltiplos de uma vez se quiser)
    salvarConfiguracaoGlobal('btn-santana', checkSantana);
});

// Outros eventos
window.addEventListener('load', () => { carregarInspetores(); checkLoginStatus(); });
document.getElementById('login-form').addEventListener('submit', login);
document.getElementById('btn-segunda-tela').addEventListener('click', () => {
    document.getElementById('modal-login').style.display = 'flex';
});
function logoutInspector() { localStorage.clear(); location.reload(); }
