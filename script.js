const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbxlo0yjd020iNdfE0zaPawlRcR3dAZtPjdIVLsLZ7eBjwjIJ10gXYlewxvvZpyNKaM/exec";

let INSPETORES = {};
let CONFIG_GLOBAL = {};
let BOTOES_LEVANTAMENTO = [];

const disableDates = {
    'btn-osasco': new Date('2026-02-19'),
    'btn-santana': new Date('2026-06-03'),
    'btn-5s-guaritas': new Date('2026-01-01') 
};

// ==========================================================================
// 1. SINCRONIZAÇÃO E RENDERIZAÇÃO
// ==========================================================================

function processarDadosPlanilha(dados) {
    if (dados && !dados.erro) {
        INSPETORES = dados.inspetores;
        CONFIG_GLOBAL = dados.config;
        BOTOES_LEVANTAMENTO = dados.botoesLevantamento;
        
        console.log("✅ Sincronização Completa");
        
        renderizarBotoesLevantamento(); // Modal Público
        renderizarGestaoSAF();           // Painel Admin (Tabela e Checks)
        aplicarBloqueioDeDatas();        // Atualiza botões nas telas
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
// 2. GESTÃO VISUAL SAF (O QUE VOCÊ PEDIU)
// ==========================================================================


// Procure a função renderizarGestaoSAF e garanta que os IDs batem com o HTML:
function renderizarGestaoSAF() {
    const container = document.getElementById('lista-gestao-levantamentos');
    
    // Atualiza Labels de Status
    const mapeamento = [
        { chk: 'check-5s-santana', lbl: 'status-santana', key: 'btn-santana' },
        { chk: 'check-5s-osasco', lbl: 'status-osasco', key: 'btn-osasco' },
        { chk: 'check-5s-guaritas', lbl: 'status-guaritas', key: 'btn-5s-guaritas' }
    ];

    mapeamento.forEach(item => {
        const checkbox = document.getElementById(item.chk);
        const label = document.getElementById(item.lbl);
        const ativo = CONFIG_GLOBAL[item.key] === true;

        if (checkbox) checkbox.checked = ativo;
        if (label) {
            label.innerHTML = ativo ? 
                '<b style="color:green;">[ ATIVADO ]</b>' : 
                '<b style="color:red;">[ BLOQUEADO ]</b>';
        }
    });
    // 2. LISTA DE LEVANTAMENTOS DINÂMICOS
    container.innerHTML = "";
    BOTOES_LEVANTAMENTO.forEach(item => {
        const div = document.createElement('div');
        div.style = "display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee; background: #fafafa; margin-bottom: 5px; border-radius: 5px;";
        div.innerHTML = `
            <div style="display: flex; flex-direction: column;">
                <span style="font-weight: bold; font-size: 0.9rem;">${item.nome} <span style="color:green;">(Ativo)</span></span>
                <span style="font-size: 0.7rem; color: #666;">Link vinculado</span>
            </div>
            <button onclick="gerenciarLevantamento('${item.nome}', 'deletar')" style="background:#ffebee; border:1px solid #ffcdd2; color:#d32f2f; padding:5px; border-radius:4px; cursor:pointer;">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        container.appendChild(div);
    });
}

// ==========================================================================
// 3. BLOQUEIOS DE INTERFACE
// ==========================================================================

// Procure a função aplicarBloqueioDeDatas e substitua por esta:
function aplicarBloqueioDeDatas() {
    const now = new Date();
    const IDs = ['btn-santana', 'btn-osasco', 'btn-5s-guaritas'];

    IDs.forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;

        // PRIORIDADE 1: O que o SAF definiu na planilha
        const liberadoSAF = CONFIG_GLOBAL[id] === true;
        
        // PRIORIDADE 2: A data limite (se existir)
        const dataLimite = disableDates[id];
        const dataPassou = dataLimite && now >= dataLimite;

        // REGRA: Se o SAF liberou OU a data passou, fica ativo. 
        // Se o SAF bloqueou (false), ele ignora a data e bloqueia.
        if (liberadoSAF) {
            btn.style.opacity = "1";
            btn.style.pointerEvents = "auto";
            btn.classList.remove('disabled');
        } else {
            // Se estiver falso na planilha, bloqueia independente da data
            btn.style.opacity = "0.4";
            btn.style.pointerEvents = "none";
            btn.classList.add('disabled');
        }
    });
}

    // Renderiza a lista de levantamentos com botão de excluir
    if (container) {
        container.innerHTML = "";
        BOTOES_LEVANTAMENTO.forEach(item => {
            const div = document.createElement('div');
            div.className = "item-gestao"; // Use uma classe para facilitar o CSS
            div.style = "display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #eee;";
            div.innerHTML = `
                <span>${item.nome}</span>
                <button onclick="gerenciarLevantamento('${item.nome}', 'deletar')" style="color:red; border:none; background:none; cursor:pointer;">
                    <i class="fas fa-trash"></i>
                </button>`;
            container.appendChild(div);
        });
    }
}

// ==========================================================================
// 4. AÇÕES DO PAINEL SAF
// ==========================================================================

document.getElementById('btn-salvar-config').addEventListener('click', async () => {
    const loader = document.getElementById('loading-overlay');
    loader.style.display = 'flex';

    // Captura estados dos checks
    const statusSantana = document.getElementById('check-5s-santana').checked;
    const statusOsasco = document.getElementById('check-5s-osasco').checked;
    const statusGuaritas = document.getElementById('check-5s-guaritas').checked;
    
    const novoNome = document.getElementById('novo-nome-botao').value.trim();
    const novoLink = document.getElementById('novo-link-botao').value.trim();

    try {
        // Envia atualizações dos botões fixos
        await fetch(`${URL_PLANILHA}?tipo=config_fixa&idBotao=btn-santana&status=${statusSantana}`, { method: 'POST', mode: 'no-cors' });
        await fetch(`${URL_PLANILHA}?tipo=config_fixa&idBotao=btn-osasco&status=${statusOsasco}`, { method: 'POST', mode: 'no-cors' });
        await fetch(`${URL_PLANILHA}?tipo=config_fixa&idBotao=btn-5s-guaritas&status=${statusGuaritas}`, { method: 'POST', mode: 'no-cors' });

        // Se tiver novo levantamento, envia também
        if (novoNome && novoLink) {
            await fetch(`${URL_PLANILHA}?tipo=novo_levantamento&nome=${encodeURIComponent(novoNome)}&link=${encodeURIComponent(novoLink)}`, { method: 'POST', mode: 'no-cors' });
        }

        alert("Sistema atualizado com sucesso!");
        location.reload();
    } catch (e) {
        alert("Erro na conexão.");
        loader.style.display = 'none';
    }
});

// Outras funções (Login, Logout, Modais) permanecem iguais...
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

    if (logado === 'true') {
        document.getElementById('main-screen').style.display = 'none';
        document.getElementById('inspector-screen').style.display = 'flex';
        document.getElementById('welcome-msg').innerHTML = `Olá, ${nome}!`;
        if (perfil.includes("SAF")) document.getElementById('admin-area').style.display = 'block';
    }
}

function logoutInspector() { localStorage.clear(); location.reload(); }
window.addEventListener('load', carregarDados);
document.getElementById('login-form').addEventListener('submit', login);
document.getElementById('btn-segunda-tela').addEventListener('click', () => { document.getElementById('modal-login').style.display = 'flex'; });
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
async function gerenciarLevantamento(nome, acao) {
    if (!confirm(`Confirmar exclusão de "${nome}"?`)) return;
    const url = `${URL_PLANILHA}?tipo=gestao_levantamento&nome=${encodeURIComponent(nome)}&acao=${acao}`;
    await fetch(url, { method: 'POST', mode: 'no-cors' });
    location.reload();
}
