/**
 * Módulo de Envio de Informações - Parte 3
 * Rascunho, envio e consulta de relatórios
 */

// ====================================================================
// RASCUNHO
// ====================================================================
function salvarRascunho() {
  if (!validarFormulario()) return;
  
  const areaDestino = document.querySelector('input[name="areaDestino"]:checked')?.value;
  let areaDestinoFinal = areaDestino === 'OUTRAS ÁREAS' ? getEl('envio-outras-area').value.trim() : areaDestino;
  
  const motivo = document.querySelector('input[name="motivo"]:checked')?.value;
  let motivoFinal = motivo === 'OUTROS' ? getEl('envio-outros-motivo').value.trim() : motivo;
  
  const agora = new Date();
  const dataPreenchimento = agora.toLocaleDateString('pt-BR');
  const horaPreenchimento = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  
  const dados = {
    id: rascunhoAtualId || Date.now().toString(),
    areaDestino: areaDestinoFinal,
    motivo: motivoFinal,
    carro: getEl('envio-carro').value,
    linha: getEl('envio-linha').value,
    motorista: getEl('envio-motorista').value,
    cobrador: getEl('envio-cobrador').value,
    hora: getEl('envio-hora').value,
    sentido: getEl('envio-sentido').value,
    historico: getEl('envio-historico').value,
    local: getEl('envio-local').value,
    data: getEl('envio-data').value,
    anexos: anexosArray.map(a => ({ base64: a.base64, mimeType: a.mimeType, nome: a.nome })),
    fiscal: localStorage.getItem('inspectorApelido') || localStorage.getItem('inspectorName'),
    dataPreenchimento: dataPreenchimento,
    horaPreenchimento: horaPreenchimento
  };
  
  localStorage.setItem(`rascunho_${dados.id}`, JSON.stringify(dados));
  rascunhoAtualId = dados.id;
  alert('Rascunho salvo!');
}

function carregarRascunho() {
  if (!rascunhoAtualId) {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('rascunho_'));
    if (keys.length) rascunhoAtualId = keys[0].replace('rascunho_', '');
    else { limparFormularioEnvio(); preencherResponsavel(); return; }
  }
  
  const dados = JSON.parse(localStorage.getItem(`rascunho_${rascunhoAtualId}`));
  if (dados) {
    if (['FISCALIZAÇÃO','SAF','PLANTÃO'].includes(dados.areaDestino)) {
      document.querySelector(`input[name="areaDestino"][value="${dados.areaDestino}"]`).checked = true;
    } else {
      document.querySelector(`input[name="areaDestino"][value="OUTRAS ÁREAS"]`).checked = true;
      getEl('envio-outras-area').value = dados.areaDestino;
      getEl('campo-outras-area').style.display = 'block';
    }
    
    if (['AVARIAS','PEDIDO DE FOLGAS','SOLICITAÇÃO DE MATERIAIS'].includes(dados.motivo)) {
      document.querySelector(`input[name="motivo"][value="${dados.motivo}"]`).checked = true;
    } else {
      document.querySelector(`input[name="motivo"][value="OUTROS"]`).checked = true;
      getEl('envio-outros-motivo').value = dados.motivo;
      getEl('campo-outros-motivo').style.display = 'block';
    }
    
    getEl('envio-carro').value = dados.carro || '';
    getEl('envio-linha').value = dados.linha || '';
    getEl('envio-motorista').value = dados.motorista || '';
    getEl('envio-cobrador').value = dados.cobrador || '';
    getEl('envio-hora').value = dados.hora || '';
    getEl('envio-sentido').value = dados.sentido || '';
    getEl('envio-historico').value = dados.historico || '';
    getEl('envio-local').value = dados.local || '';
    getEl('envio-data').value = dados.data || '';
    
    if (dados.anexos && Array.isArray(dados.anexos)) {
      anexosArray = dados.anexos;
      atualizarListaAnexos();
    }
    
    preencherResponsavel();
    habilitarCamposSecundarios(true);
    aplicarRegrasPorArea();
    aplicarRegrasPorMotivo();
  } else {
    limparFormularioEnvio();
    preencherResponsavel();
  }
}

function limparFormularioEnvio() {
  document.querySelectorAll('input[name="areaDestino"], input[name="motivo"]').forEach(r => r.checked = false);
  getEl('envio-outras-area').value = '';
  getEl('campo-outras-area').style.display = 'none';
  getEl('envio-outros-motivo').value = '';
  getEl('campo-outros-motivo').style.display = 'none';
  getEl('envio-carro').value = '';
  getEl('envio-linha').value = '';
  getEl('envio-motorista').value = '';
  getEl('envio-cobrador').value = '';
  getEl('envio-hora').value = '';
  getEl('envio-sentido').value = '';
  getEl('envio-historico').value = '';
  getEl('envio-local').value = '';
  anexosArray = [];
  atualizarListaAnexos();
  
  const inputArq = getEl('input-arquivos-multiplos');
  if (inputArq) inputArq.value = '';
  
  preencherDataAtual();
  rascunhoAtualId = null;
  habilitarCamposSecundarios(false);
  habilitarCamposAvarias(true);
}

// ====================================================================
// ENVIO PARA O SERVIDOR
// ====================================================================
function enviarRelatorio() {
  if (!validarFormulario()) return;
  
  const areaDestino = document.querySelector('input[name="areaDestino"]:checked')?.value;
  let areaDestinoFinal = areaDestino === 'OUTRAS ÁREAS' ? getEl('envio-outras-area').value.trim() : areaDestino;
  
  const motivo = document.querySelector('input[name="motivo"]:checked')?.value;
  let motivoFinal = motivo === 'OUTROS' ? getEl('envio-outros-motivo').value.trim() : motivo;

  const btnEnviar = getEl('btn-enviar-relatorio');
  const textoBotaoOriginal = btnEnviar.innerHTML;
  btnEnviar.innerHTML = '⏳ Enviando...';
  btnEnviar.disabled = true;

  const agora = new Date();
  const dataPreenchimento = agora.toLocaleDateString('pt-BR');
  const horaPreenchimento = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const dadosEnvio = {
    areaDestino: areaDestinoFinal,
    motivo: motivoFinal,
    carro: getEl('envio-carro').value,
    linha: getEl('envio-linha').value,
    motorista: getEl('envio-motorista').value,
    cobrador: getEl('envio-cobrador').value,
    hora: getEl('envio-hora').value,
    sentido: getEl('envio-sentido').value,
    historico: getEl('envio-historico').value,
    local: getEl('envio-local').value,
    data: getEl('envio-data').value,
    anexos: anexosArray.map(a => ({ base64: a.base64, mimeType: a.mimeType, nome: a.nome })),
    fiscal: localStorage.getItem('inspectorApelido') || localStorage.getItem('inspectorName'),
    dataPreenchimento: dataPreenchimento,
    horaPreenchimento: horaPreenchimento
  };

  console.log('📤 Enviando dados:', dadosEnvio);

  const formData = new FormData();
  formData.append('acao', 'envio_informacoes');
  formData.append('dados', JSON.stringify(dadosEnvio));

  fetch(URL_PLANILHA, {
    method: 'POST',
    mode: 'no-cors',
    body: formData
  })
    .then(() => {
      alert('✅ Relatório e anexos enviados com sucesso!');
      if (rascunhoAtualId) localStorage.removeItem(`rascunho_${rascunhoAtualId}`);
      limparFormularioEnvio();
      fecharModalEnvio();
    })
    .catch((error) => {
      console.error('❌ Erro no fetch:', error);
      alert('Erro ao enviar. Verifique o console.');
    })
    .finally(() => {
      btnEnviar.innerHTML = textoBotaoOriginal;
      btnEnviar.disabled = false;
    });
}

// Exportar para escopo global
window.salvarRascunho = salvarRascunho;
window.carregarRascunho = carregarRascunho;
window.limparFormularioEnvio = limparFormularioEnvio;
window.enviarRelatorio = enviarRelatorio;
