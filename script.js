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
        
        console.log("✅ Dados sincronizados globalmente");
        
        renderizarBotoesLevantamento(); // Modal Público
        renderizarGestaoSAF();           // Painel Admin
        aplicarBloqueioDeDatas();
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

// Renderiza botões no Modal de Levantamentos (Visão do Usuário)
function renderizarBotoesLevantamento() {
    const container = document.getElementById('container-botoes-levantamento');
    if (!container) return;
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

// Renderiza a lista de gestão (Visão do Admin SAF)
function renderizarGestaoSAF() {
    const container = document.getElementById('lista-gestao-levantamentos');
    if (!container) return;
    container.innerHTML = "";

    if (BOTOES_LEVANTAMENTO.length === 0) {
        container.innerHTML = "<p style='font-size:0.8rem; color:gray;'>Nenhum levantamento criado.</p>";
        return;
    }

    BOTOES_LEVANTAMENTO.forEach(item => {
        const div = document.createElement('div');
        div.style = "display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee; background: #fafafa; margin-bottom: 5px; border-radius: 5px;";
        
        div.innerHTML = `
            <div style="display: flex; flex-direction: column;">
                <span style="font-weight: bold; font-size: 0.9rem;">${item.nome}</span>
                <span style="font-size: 0.7rem; color: #666; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.link}</span>
            </div>
            <button onclick="gerenciarLevantamento('${item.nome}', 'deletar')" 
                    style="background: #ffebee; border: 1px solid #ffcdd2; color: #d32f2f; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        container.appendChild(div);
    });
}

// ==========================================================================
// 2. SISTEMA DE LOGIN E PERFIS
// ==========================================================================

function login(e) {
    e.preventDefault();
    const senhaDigitada = document.getElementById('password').value.trim();
    const hashDigitado = CryptoJS.SHA256(senhaDigitada).toString();

    const nomeEncontrado = Object.keys(INSPETORES).find(nome => INSPETORES[nome].senha === hashDigitado);

    if (nomeEncontrado) {
        localStorage.setItem('inspectorLoggedIn', 'true');
        localStorage.setItem('inspectorName', nomeEncontrado);
        localStorage.setItem('inspectorPerfil', INSPETORES[nomeEncontrado].perfil || "PADRÃO");
        document.getElementById('modal-login').style.display = 'none';
        checkLoginStatus();
    } else {
        document.getElementById('login-error').style.display = 'block';
    }
}

function checkLoginStatus() {
    const logado = localStorage.getItem('inspectorLoggedIn');
    const nome = localStorage.getItem('inspectorName');
    const perfil = (localStorage.getItem('inspectorPerfil') || "").toUpperCase();

    const mainScreen = document.getElementById('main-screen');
    const inspectorScreen = document.getElementById('inspector-screen');
    const adminArea = document.getElementById('admin-area');

    if (logado === 'true') {
        mainScreen.style.display = 'none';
        inspectorScreen.style.display = 'flex';
        document.getElementById('welcome-msg').innerHTML = `Olá, ${nome}!`;

        if (perfil.includes("SAF")) {
            adminArea.style.display = 'block';
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
// 3. AÇÕES DE GESTÃO (COMUNICAÇÃO COM O SERVIDOR)
// ==========================================================================

// Apagar levantamento
async function gerenciarLevantamento(nome, acao) {
    if (acao === 'deletar' && !confirm(`Tem certeza que deseja apagar o botão "${nome}"?`)) return;

    document.getElementById('loading-overlay').style.display = 'flex';
    const url = `${URL_PLANILHA}?tipo=gestao_levantamento&nome=${encodeURIComponent(nome)}&acao=${acao}`;
    
    try {
        await fetch(url, { method: 'POST', mode: 'no-cors' });
        alert("Botão removido com sucesso!");
        location.reload();
    } catch (e) {
        alert("Erro ao processar a exclusão.");
        document.getElementById('loading-overlay').style.display = 'none';
    }
}

// Salvar novos botões ou status de Santana
document.getElementById('btn-salvar-config').addEventListener('click', async () => {
    const loader = document.getElementById('loading-overlay');
    const statusSantana = document.getElementById('check-5s-santana').checked;
    const novoNome = document.getElementById('novo-nome-botao').value.trim();
    const novoLink = document.getElementById('novo-link-botao').value.trim();

    loader.style.display = 'flex';

    try {
        // 1. Atualiza Santana
        await fetch(`${URL_PLANILHA}?tipo=config_fixa&idBotao=btn-santana&status=${statusSantana}`, { method: 'POST', mode: 'no-cors' });

        // 2. Se houver dados novos, cria o botão
        if (novoNome && novoLink) {
            await fetch(`${URL_PLANILHA}?tipo=novo_levantamento&nome=${encodeURIComponent(novoNome)}&link=${encodeURIComponent(novoLink)}`, { method: 'POST', mode: 'no-cors' });
        }

        alert("Alterações guardadas!");
        location.reload();
    } catch (e) {
        alert("Erro ao salvar.");
        loader.style.display = 'none';
    }
});

// ==========================================================================
// 4. BLOQUEIOS DE DATA
// ==========================================================================

function aplicarBloqueioDeDatas() {
    const now = new Date();
    const btnSantana = document.getElementById('btn-santana');
    if (btnSantana) {
        const liberadoSAF = CONFIG_GLOBAL['btn-santana'] === true;
        if (now < disableDates['btn-santana'] && !liberadoSAF) {
            btnSantana.style.opacity = "0.5";
            btnSantana.style.pointerEvents = "none";
        } else {
            btnSantana.style.opacity = "1";
            btnSantana.style.pointerEvents = "auto";
        }
    }
}

// Inicialização
window.addEventListener('load', carregarDados);
document.getElementById('login-form').addEventListener('submit', login);
document.getElementById('btn-segunda-tela').addEventListener('click', () => {
    document.getElementById('modal-login').style.display = 'flex';
});
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
