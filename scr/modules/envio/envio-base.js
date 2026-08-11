/**
 * Módulo de Envio de Informações - Parte 1
 * Variáveis globais, abertura/fechamento de modal e utilitários
 */

let rascunhoAtualId = null;
let enviosLista = [];
let anexosArray = []; // cada elemento: { base64, mimeType, nome }

// ====================================================================
// ABRIR/FECHAR MODAL
// ====================================================================
function abrirModalEnvio() {
  const m = getEl('modal-envio-informacoes');
  if (m) m.classList.add('is-open');
  
  preencherDataAtual();
  preencherResponsavel();
  preencherSelectLocal();
  carregarRascunho();
  habilitarCamposSecundarios(false);
  
  anexosArray = [];
  atualizarListaAnexos();
  
  if (!getEl('input-arquivos-multiplos')) criarInputMultiploAnexos();
  iniciarContadorHistorico();
  
  const btnMicrofone = getEl('btn-microfone');
  if (btnMicrofone) {
    const novoBtn = btnMicrofone.cloneNode(true);
    btnMicrofone.parentNode.replaceChild(novoBtn, btnMicrofone);
    novoBtn.addEventListener('click', iniciarReconhecimentoVoz);
  }
}

function fecharModalEnvio() {
  const m = getEl('modal-envio-informacoes');
  if (m) m.classList.remove('is-open');
}

// ====================================================================
// CONTADOR DE CARACTERES DO HISTÓRICO
// ====================================================================
function iniciarContadorHistorico() {
  const historicoField = getEl('envio-historico');
  const contadorSpan = getEl('historico-contador');
  if (!historicoField || !contadorSpan) return;
  
  const MAX_CARACTERES = 1400;
  const MAX_LINHAS = 16;
  
  const atualizarContador = () => {
    let texto = historicoField.value;
    let linhas = texto.split(/\r?\n/);
    let ultrapassouLinhas = linhas.length > MAX_LINHAS;
    let ultrapassouCaracteres = texto.length > MAX_CARACTERES;
    
    if (ultrapassouLinhas) {
      const novasLinhas = linhas.slice(0, MAX_LINHAS);
      historicoField.value = novasLinhas.join('\n');
      texto = historicoField.value;
      linhas = texto.split(/\r?\n/);
      ultrapassouLinhas = false;
    }
    
    if (ultrapassouCaracteres) {
      historicoField.value = texto.substring(0, MAX_CARACTERES);
      texto = historicoField.value;
      ultrapassouCaracteres = false;
    }
    
    const len = historicoField.value.length;
    const linhasAtuais = historicoField.value.split(/\r?\n/).length;
    contadorSpan.textContent = `(${len}/${MAX_CARACTERES} | ${linhasAtuais}/${MAX_LINHAS} linhas)`;
    
    if (len > MAX_CARACTERES * 0.9 || linhasAtuais > MAX_LINHAS - 2) {
      contadorSpan.style.color = '#f59e0b';
    } else {
      contadorSpan.style.color = '';
    }
  };
  
  historicoField.addEventListener('input', atualizarContador);
  historicoField.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      const linhasAtuais = historicoField.value.split(/\r?\n/).length;
      if (linhasAtuais >= MAX_LINHAS) {
        e.preventDefault();
        alert(`Limite de ${MAX_LINHAS} linhas atingido.`);
        return false;
      }
    }
  });
  
  atualizarContador();
}

// ====================================================================
// PREENCHIMENTO DE CAMPOS BÁSICOS
// ====================================================================
function preencherDataAtual() {
  const d = getEl('envio-data');
  if (d && !d.value) {
    const hoje = new Date().toISOString().split('T')[0];
    d.value = hoje;
    d.max = hoje;
  }
}

function preencherResponsavel() {
  const resp = getEl('envio-responsavel');
  if (resp) {
    const apelido = localStorage.getItem('inspectorApelido') || localStorage.getItem('inspectorName') || 'Inspetor';
    resp.value = apelido;
  }
}

function habilitarCamposSecundarios(habilitar) {
  const ids = ['envio-carro', 'envio-linha', 'envio-motorista', 'envio-cobrador', 'envio-hora', 'envio-sentido', 'envio-historico', 'envio-local', 'btn-salvar-rascunho', 'btn-enviar-relatorio'];
  ids.forEach(id => {
    const campo = getEl(id);
    if (campo) campo.disabled = !habilitar;
  });
}

// Exportar para escopo global
window.rascunhoAtualId = rascunhoAtualId;
window.anexosArray = anexosArray;
window.abrirModalEnvio = abrirModalEnvio;
window.fecharModalEnvio = fecharModalEnvio;
window.iniciarContadorHistorico = iniciarContadorHistorico;
window.preencherDataAtual = preencherDataAtual;
window.preencherResponsavel = preencherResponsavel;
window.habilitarCamposSecundarios = habilitarCamposSecundarios;
