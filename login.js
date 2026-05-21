// ====================================================================
// SISTEMA DE AUTENTICAÇÃO E SESSÃO
// ====================================================================

// Verifica se o utilizador já está logado ao carregar a página
document.addEventListener("DOMContentLoaded", function() {
    const usuarioSalvo = localStorage.getItem('pwa_usuario_logado');
    if (usuarioSalvo) {
        const usuario = JSON.parse(usuarioSalvo);
        carregarInterfaceApp(usuario);
    }
});

// Captura o evento de submissão do formulário de login
function realizarLogin(event) {
    event.preventDefault(); // Evita recarregar a página
    
    const matricula = document.getElementById('login-matricula').value;
    const senha = document.getElementById('login-senha').value;
    const msgBox = document.getElementById('login-mensagem');

    msgBox.textContent = "Aguarde, autenticando...";
    msgBox.style.color = "blue";

    // Chama o backend para validar
    google.script.run
        .withSuccessHandler(function(resultado) {
            if (resultado.sucesso) {
                // Salva a sessão no dispositivo
                localStorage.setItem('pwa_usuario_logado', JSON.stringify(resultado.usuario));
                msgBox.textContent = "";
                carregarInterfaceApp(resultado.usuario);
            } else {
                msgBox.textContent = resultado.mensagem || "Matrícula ou senha incorretos.";
                msgBox.style.color = "red";
            }
        })
        .withFailureHandler(function(erro) {
            msgBox.textContent = "Erro de conexão: " + erro.message;
            msgBox.style.color = "red";
        })
        .fazerLoginBackend(matricula, senha);
}

// Transição de tela e preenchimento de cabeçalho
function carregarInterfaceApp(usuario) {
    // Esconde tela de login e mostra app
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';
    
    // Preenche cabeçalho
    const nomeSpan = document.getElementById('usuario-nome');
    const funcaoSpan = document.getElementById('usuario-funcao');
    
    // Usa o Apelido, se não houver, usa o Nome completo
    if(nomeSpan) nomeSpan.textContent = usuario.apelido || usuario.nome;
    if(funcaoSpan) funcaoSpan.textContent = usuario.funcao;
}

// Função de Logout
function fazerLogout() {
    localStorage.removeItem('pwa_usuario_logado');
    
    document.getElementById('app-content').style.display = 'none';
    document.getElementById('tela-login').style.display = 'flex'; // Volta a tela de login
    
    document.getElementById('login-senha').value = '';
    document.getElementById('login-mensagem').textContent = '';
}
