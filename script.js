const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbxlo0yjd020iNdfE0zaPawlRcR3dAZtPjdIVLsLZ7eBjwjIJ10gXYlewxvvZpyNKaM/exec";

let INSPETORES = {};

const disableDates = {
    'btn-osasco': new Date('2026-02-19'),
    'btn-santana': new Date('2026-06-03')
};

// ==========================================================================
// SINCRONIZAÇÃO COM GOOGLE SHEETS (JSONP)
// ==========================================================================

function processarDadosPlanilha(dados) {
    if (dados && !dados.erro) {
        INSPETORES = dados;
        console.log("✅ Dados sincronizados (Perfil SAF suportado)");
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
        // GARANTIA: Tenta ler 'perfil' ou 'funcao' para não dar erro
        const perfil = dadosUsuario.perfil || dadosUsuario.funcao || "PADRÃO";

        localStorage.setItem('inspectorLoggedIn', 'true');
        localStorage.setItem('inspectorName', nomeEncontrado);
        localStorage.setItem('inspectorPerfil', perfil);
        
        document.getElementById('modal-login').style.display = 'none';
        checkLoginStatus(); // Chama a verificação imediatamente
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
        
        // Saudação dinâmica
        const saudacao = (perfil === "SAF") 
            ? `Olá, ${nome} do <strong>${perfilRaw}</strong>!` 
            : `Olá ${nome}, <strong>${perfilRaw}</strong>!`;
        document.getElementById('welcome-msg').innerHTML = saudacao;

        // MOSTRAR ADMIN AREA
        if (perfil === "SAF") {
            adminArea.style.setProperty('display', 'block', 'important');
        } else {
            adminArea.style.display = 'none';
        }
    } else {
        mainScreen.style.display = 'flex';
        inspectorScreen.style.display = 'none';
    }
}
// Funções para abrir/fechar modais
function openModal(id) {
    document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function logoutInspector() {
    localStorage.clear();
    location.reload();
}

// ==========================================================================
// FUNCIONALIDADE DE UPLOAD DE DOCUMENTOS
// ==========================================================================

document.getElementById('upload-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('file-input');
    const descInput = document.getElementById('file-desc');
    const status = document.getElementById('upload-status');
    const btn = document.getElementById('btn-enviar-file');
    const inspetor = localStorage.getItem('inspectorName');

    if (!fileInput.files[0]) return;

    const file = fileInput.files[0];
    const reader = new FileReader();

    status.style.display = 'block';
    status.style.color = '#333';
    status.innerText = "⏳ Enviando arquivo...";
    btn.disabled = true;

    reader.onload = function(event) {
        const base64Data = event.target.result.split(',')[1];
        
        const formData = new URLSearchParams();
        formData.append('fileData', base64Data);
        formData.append('fileName', file.name);
        formData.append('mimeType', file.type);
        formData.append('descricao', descInput.value);
        formData.append('usuario', inspetor);

        fetch(URL_PLANILHA, {
            method: 'POST',
            body: formData,
            mode: 'no-cors'
        })
        .then(() => {
            status.innerText = "✅ Enviado com sucesso!";
            status.style.color = "green";
            document.getElementById('upload-form').reset();
        })
        .catch(() => {
            status.innerText = "❌ Erro no envio.";
            status.style.color = "red";
        })
        .finally(() => {
            btn.disabled = false;
        });
    };
    reader.readAsDataURL(file);
});

// ==========================================================================
// UTILITÁRIOS E INICIALIZAÇÃO
// ==========================================================================

function registrarLog(nome, acao) {
    const script = document.createElement('script');
    script.src = `${URL_PLANILHA}?callback=console.log&acao=log&nome=${encodeURIComponent(nome)}&msg=${encodeURIComponent(acao)}`;
    document.body.appendChild(script);
}

function aplicarBloqueioDeDatas() {
    const now = new Date();
    for (const [id, date] of Object.entries(disableDates)) {
        const btn = document.getElementById(id);
        if (btn && now < date) {
            btn.classList.add('disabled');
        }
    }
}

window.addEventListener('load', () => {
    carregarInspetores();
    checkLoginStatus();
    aplicarBloqueioDeDatas();
});

document.getElementById('btn-segunda-tela').addEventListener('click', () => {
    document.getElementById('modal-login').style.display = 'flex';
});

document.getElementById('login-form').addEventListener('submit', login);
