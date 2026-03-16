const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbxlo0yjd020iNdfE0zaPawlRcR3dAZtPjdIVLsLZ7eBjwjIJ10gXYlewxvvZpyNKaM/exec";
let INSPETORES = {};
let CONFIG_GLOBAL = {};
let BOTOES_LEVANTAMENTO = [];

// ==========================================================================
// 1. SINCRONIZAÇÃO INICIAL
// ==========================================================================

function processarDadosPlanilha(dados) {
    if (dados && !dados.erro) {
        INSPETORES = dados.inspetores;
        CONFIG_GLOBAL = dados.config;
        BOTOES_LEVANTAMENTO = dados.botoesLevantamento;
        
        // Configurar Banner
        const banner = document.getElementById('aviso-temporario');
        if (CONFIG_GLOBAL['banner-ativo'] === true) {
            banner.style.display = 'flex';
            document.getElementById('banner-mensagem-texto').innerText = CONFIG_GLOBAL['banner-texto'] || "";
        }

        renderizarLevantamentos();
        renderizarGestaoSAF();
        aplicarBloqueios();
        checkLoginStatus();
    }
    document.getElementById('loading-overlay').style.display = 'none';
}

function carregarDados() {
    document.getElementById('loading-overlay').style.display = 'flex';
    const script = document.createElement('script');
    script.src = `${URL_PLANILHA}?callback=processarDadosPlanilha&t=${new Date().getTime()}`;
    document.body.appendChild(script);
}

// ==========================================================================
// 2. GESTÃO DE INTERFACE
// ==========================================================================

function renderizarLevantamentos() {
    const container = document.getElementById('container-botoes-levantamento');
    container.innerHTML = "";
    BOTOES_LEVANTAMENTO.forEach(item => {
        const btn = document.createElement('a');
        btn.className = 'button';
        btn.href = item.link;
        btn.target = '_blank';
        btn.innerHTML = `<i class="fas fa-file-alt"></i> ${item.nome}`;
        container.appendChild(btn);
    });
}

function renderizarGestaoSAF() {
    // Atualiza Checkboxes
    document.getElementById('check-5s-santana').checked = CONFIG_GLOBAL['btn-santana'] === true;
    document.getElementById('check-5s-osasco').checked = CONFIG_GLOBAL['btn-osasco'] === true;
    document.getElementById('check-5s-guaritas').checked = CONFIG_GLOBAL['btn-5s-guaritas'] === true;
    document.getElementById('check-banner-ativo').checked = CONFIG_GLOBAL['banner-ativo'] === true;
    document.getElementById('input-banner-texto').value = CONFIG_GLOBAL['banner-texto'] || "";

    // Atualiza Labels de Status [ATIVADO/BLOQUEADO]
    const ids = [['status-santana','btn-santana'], ['status-osasco','btn-osasco'], ['status-guaritas','btn-5s-guaritas']];
    ids.forEach(pair => {
        const label = document.getElementById(pair[0]);
        const ativo = CONFIG_GLOBAL[pair[1]] === true;
        label.innerHTML = ativo ? '<b style="color:green;">[ ATIVADO ]</b>' : '<b style="color:red;">[ BLOQUEADO ]</b>';
    });

    // Lista de gestão para apagar levantamentos
    const listContainer = document.getElementById('lista-gestao-levantamentos');
    listContainer.innerHTML = "";
    BOTOES_LEVANTAMENTO.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.style = "display:flex; justify-content:space-between; padding:5px; font-size:0.8rem; border-bottom:1px solid #eee;";
        itemDiv.innerHTML = `<span>${item.nome}</span> <i class="fas fa-trash" onclick="gerenciarLevantamento('${item.nome}','deletar')" style="color:red; cursor:pointer;"></i>`;
        listContainer.appendChild(itemDiv);
    });
}

function aplicarBloqueios() {
    const ids = ['btn-santana', 'btn-osasco', 'btn-5s-guaritas'];
    ids.forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const liberado = CONFIG_GLOBAL[id] === true;
        btn.style.opacity = liberado ? "1" : "0.4";
        btn.style.pointerEvents = liberado ? "auto" : "none";
    });
}

// ==========================================================================
// 3. AÇÕES SAF E LOGIN
// ==========================================================================

document.getElementById('btn-salvar-config').addEventListener('click', async () => {
    document.getElementById('loading-overlay').style.display = 'flex';
    
    const settings = [
        { id: 'btn-santana', val: document.getElementById('check-5s-santana').checked },
        { id: 'btn-osasco', val: document.getElementById('check-5s-osasco').checked },
        { id: 'btn-5s-guaritas', val: document.getElementById('check-5s-guaritas').checked },
        { id: 'banner-ativo', val: document.getElementById('check-banner-ativo').checked },
        { id: 'banner-texto', val: document.getElementById('input-banner-texto').value }
    ];

    for (const s of settings) {
        await fetch(`${URL_PLANILHA}?tipo=config_fixa&idBotao=${s.id}&status=${encodeURIComponent(s.val)}`, { method: 'POST', mode: 'no-cors' });
    }

    const novoNome = document.getElementById('novo-nome-botao').value;
    const novoLink = document.getElementById('novo-link-botao').value;
    if (novoNome && novoLink) {
        await fetch(`${URL_PLANILHA}?tipo=novo_levantamento&nome=${encodeURIComponent(novoNome)}&link=${encodeURIComponent(novoLink)}`, { method: 'POST', mode: 'no-cors' });
    }

    location.reload();
});

async function gerenciarLevantamento(nome, acao) {
    if (confirm(`Deseja eliminar "${nome}"?`)) {
        await fetch(`${URL_PLANILHA}?tipo=gestao_levantamento&nome=${encodeURIComponent(nome)}&acao=${acao}`, { method: 'POST', mode: 'no-cors' });
        location.reload();
    }
}

function login(e) {
    e.preventDefault();
    const hash = CryptoJS.SHA256(document.getElementById('password').value).toString();
    const user = Object.keys(INSPETORES).find(n => INSPETORES[n].senha === hash);
    if (user) {
        localStorage.setItem('inspectorLoggedIn', 'true');
        localStorage.setItem('inspectorName', user);
        localStorage.setItem('inspectorPerfil', INSPETORES[user].perfil);
        location.reload();
    } else {
        document.getElementById('login-error').style.display = 'block';
    }
}

function checkLoginStatus() {
    if (localStorage.getItem('inspectorLoggedIn') === 'true') {
        document.getElementById('main-screen').style.display = 'none';
        document.getElementById('inspector-screen').style.display = 'flex';
        document.getElementById('welcome-msg').innerText = `Olá, ${localStorage.getItem('inspectorName')}!`;
        if (localStorage.getItem('inspectorPerfil') === 'SAF') document.getElementById('admin-area').style.display = 'block';
    }
}

function logoutInspector() { localStorage.clear(); location.reload(); }
window.addEventListener('load', carregarDados);
document.getElementById('login-form').addEventListener('submit', login);
document.getElementById('btn-segunda-tela').addEventListener('click', () => openModal('modal-login'));
