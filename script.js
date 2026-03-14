const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbxlo0yjd020iNdfE0zaPawlRcR3dAZtPjdIVLsLZ7eBjwjIJ10gXYlewxvvZpyNKaM/exec";


let INSPETORES = {};
let CONFIG_GLOBAL = {};
let BOTOES_LEVANTAMENTO = [];

const disableDates = {
    'btn-osasco': new Date('2026-02-19'),
    'btn-santana': new Date('2026-06-03')
};

// ==========================================================================
// 1. SINCRONIZAÇÃO E RENDERIZAÇÃO
// ==========================================================================

function processarDadosPlanilha(dados) {
    if (dados && !dados.erro) {
        INSPETORES = dados.inspetores;
        CONFIG_GLOBAL = dados.config;
        BOTOES_LEVANTAMENTO = dados.botoesLevantamento;
        
        console.log("✅ Dados sincronizados da nuvem");
        
        renderizarBotoesLevantamento();
        aplicarBloqueioDeDatas();
        checkLoginStatus(); // Atualiza a interface com os novos dados
    }
    document.getElementById('loading-overlay').style.display = 'none';
}

function carregarDados() {
    document.getElementById('loading-overlay').style.display = 'flex';
    const script = document.createElement('script');
    script.src = `${URL_PLANILHA}?callback=processarDadosPlanilha&t=${new Date().getTime()}`;
    document.body.appendChild(script);
}

// Cria os botões dentro do Modal de Levantamentos
function renderizarBotoesLevantamento() {
    const container = document.getElementById('container-botoes-levantamento');
    if (!container) return;
    
    container.innerHTML = ""; // Limpa os botões antigos
    
    BOTOES_LEVANTAMENTO.forEach(item => {
        const btn = document.createElement('a');
        btn.className = 'button';
        btn.href = item.link;
        btn.target = '_blank';
        btn.innerHTML = `<i class="fas fa-file-alt"></i> ${item.nome}`;
        container.appendChild(btn);
    });
}

// ==========================================================================
// 2. SISTEMA DE LOGIN E STATUS
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

        if (perfil === "SAF") {
            adminArea.style.display = 'block';
            // Sincroniza o check da tela com o que veio da planilha (FIXO)
            document.getElementById('check-5s-santana').checked = CONFIG_GLOBAL['btn-santana'] === true;
        } else {
            adminArea.style.display = 'none';
        }
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
// 3. BLOQUEIOS E GESTÃO SAF
// ==========================================================================

function aplicarBloqueioDeDatas() {
    const now = new Date();
    
    // Bloqueio de Santana (Fixo + Override do SAF)
    const btnSantana = document.getElementById('btn-santana');
    if (btnSantana) {
        const liberadoPeloSAF = CONFIG_GLOBAL['btn-santana'] === true;
        if (now < disableDates['btn-santana'] && !liberadoPeloSAF) {
            btnSantana.style.opacity = "0.5";
            btnSantana.style.pointerEvents = "none";
        } else {
            btnSantana.style.opacity = "1";
            btnSantana.style.pointerEvents = "auto";
        }
    }

    // Bloqueio de Osasco (Apenas Data)
    const btnOsasco = document.getElementById('btn-osasco');
    if (btnOsasco && now < disableDates['btn-osasco']) {
        btnOsasco.style.opacity = "0.5";
        btnOsasco.style.pointerEvents = "none";
    }
}

// Salvar todas as preferências do Painel SAF
document.getElementById('btn-salvar-config').addEventListener('click', async () => {
    const loader = document.getElementById('loading-overlay');
    loader.style.display = 'flex';

    const checkSantana = document.getElementById('check-5s-santana').checked;
    const novoNome = document.getElementById('novo-nome-botao').value.trim();
    const novoLink = document.getElementById('novo-link-botao').value.trim();

    try {
        // 1. Atualiza o status fixo de Santana
        await fetch(`${URL_PLANILHA}?tipo=config_fixa&idBotao=btn-santana&status=${checkSantana}`, { method: 'POST', mode: 'no-cors' });

        // 2. Se houver nome e link, cria um novo botão de levantamento
        if (novoNome && novoLink) {
            await fetch(`${URL_PLANILHA}?tipo=novo_levantamento&nome=${encodeURIComponent(novoNome)}&link=${encodeURIComponent(novoLink)}`, { method: 'POST', mode: 'no-cors' });
        }

        alert("Alterações salvas com sucesso!");
        location.reload();
    } catch (e) {
        alert("Erro ao comunicar com o servidor.");
    } finally {
        loader.style.display = 'none';
    }
});

// ==========================================================================
// 4. INICIALIZAÇÃO E EVENTOS
// ==========================================================================

window.addEventListener('load', carregarDados);

document.getElementById('login-form').addEventListener('submit', login);

document.getElementById('btn-segunda-tela').addEventListener('click', () => {
    document.getElementById('modal-login').style.display = 'flex';
});

// Funções chamadas pelo HTML
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
