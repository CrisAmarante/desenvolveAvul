// ====================================================================
// ENVIO DE INFORMAÇÕES (com fluxo obrigatório e Upload)
// ====================================================================
let rascunhoAtualId = null;
let enviosLista = [];
let anexoAtualObj = null;

function abrirModalEnvio() {
  const m = getEl('modal-envio-informacoes');
  if (m) m.classList.add('is-open');
  preencherDataAtual();
  preencherResponsavel();
  preencherSelectLocal();
  carregarRascunho();
  habilitarCamposSecundarios(false);
}

function fecharModalEnvio() { const m = getEl('modal-envio-informacoes'); if (m) m.classList.remove('is-open'); }

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
    if (campo) {
      if (id.startsWith('btn')) campo.disabled = !habilitar;
      else campo.disabled = !habilitar;
    }
  });
}

function aplicarRegrasPorArea() {
  const areaSelecionada = document.querySelector('input[name="areaDestino"]:checked')?.value;
  const campoOutrasArea = getEl('campo-outras-area');
  const inputOutrasArea = getEl('envio-outras-area');
  
  if (areaSelecionada === 'OUTRAS ÁREAS') {
    campoOutrasArea.style.display = 'block';
    inputOutrasArea.required = true;
  } else {
    campoOutrasArea.style.display = 'none';
    inputOutrasArea.required = false;
    inputOutrasArea.value = '';
  }
  
  if (areaSelecionada) habilitarCamposSecundarios(true);
  else habilitarCamposSecundarios(false);
  
  const radiosMotivo = document.querySelectorAll('input[name="motivo"]');
  radiosMotivo.forEach(radio => radio.disabled = false);
  if (areaSelecionada === 'SAF' || areaSelecionada === 'PLANTÃO' || areaSelecionada === 'OUTRAS ÁREAS') {
    radiosMotivo.forEach(radio => {
      if (radio.value !== 'AVARIAS' && radio.value !== 'OUTROS') {
        radio.disabled = true;
        if (radio.checked) radio.checked = false;
      } else {
        radio.disabled = false;
      }
    });
    const motivoAtual = document.querySelector('input[name="motivo"]:checked');
    if (motivoAtual && motivoAtual.disabled) motivoAtual.checked = false;
  }
  aplicarRegrasPorMotivo();
}

function aplicarRegrasPorMotivo() {
  const motivoSelecionado = document.querySelector('input[name="motivo"]:checked')?.value;
  const campoOutrosMotivo = getEl('campo-outros-motivo');
  const inputOutrosMotivo = getEl('envio-outros-motivo');
  
  if (motivoSelecionado === 'OUTROS') {
    campoOutrosMotivo.style.display = 'block';
    inputOutrosMotivo.required = true;
  } else {
    campoOutrosMotivo.style.display = 'none';
    inputOutrosMotivo.required = false;
    inputOutrosMotivo.value = '';
  }
  
  if (motivoSelecionado === 'AVARIAS') {
    habilitarCamposAvarias(true);
    ['envio-carro', 'envio-linha', 'envio-motorista', 'envio-hora', 'envio-sentido'].forEach(id => {
      const campo = getEl(id);
      if (campo) campo.required = true;
    });
  } else if (motivoSelecionado === 'OUTROS') {
    habilitarCamposAvarias(true);
    ['envio-carro', 'envio-linha', 'envio-motorista', 'envio-hora', 'envio-sentido'].forEach(id => {
      const campo = getEl(id);
      if (campo) campo.required = false;
    });
  } else if (motivoSelecionado === 'PEDIDO DE FOLGAS' || motivoSelecionado === 'SOLICITAÇÃO DE MATERIAIS') {
    habilitarCamposAvarias(false);
    ['envio-carro', 'envio-linha', 'envio-motorista', 'envio-hora', 'envio-sentido'].forEach(id => {
      const campo = getEl(id);
      if (campo) campo.required = false;
    });
  } else {
    habilitarCamposAvarias(false);
  }
}

function habilitarCamposAvarias(habilitar) {
  const ids = ['envio-carro', 'envio-linha', 'envio-motorista', 'envio-hora', 'envio-sentido'];
  ids.forEach(id => {
    const campo = getEl(id);
    if (campo) {
      campo.disabled = !habilitar;
      if (!habilitar) campo.value = '';
    }
  });
}

function validarFormulario() {
  const areaSelecionada = document.querySelector('input[name="areaDestino"]:checked')?.value;
  if (!areaSelecionada) { alert('Selecione a Área de Destino.'); return false; }
  if (areaSelecionada === 'OUTRAS ÁREAS') {
    const outrasArea = getEl('envio-outras-area').value.trim();
    if (!outrasArea) { alert('Digite a Área de Destino.'); return false; }
  }
  const motivoSelecionado = document.querySelector('input[name="motivo"]:checked')?.value;
  if (!motivoSelecionado) { alert('Selecione o Motivo.'); return false; }
  if (motivoSelecionado === 'OUTROS') {
    const outrosMotivo = getEl('envio-outros-motivo').value.trim();
    if (!outrosMotivo) { alert('Descreva o motivo resumidamente.'); return false; }
  }
  const carro = getEl('envio-carro').value.trim();
  if (motivoSelecionado === 'AVARIAS' && !carro) { alert('Para o motivo AVARIAS, o campo CARRO é obrigatório.'); return false; }
  const data = getEl('envio-data').value;
  if (!data) { alert('Preencha a Data.'); return false; }
  const hoje = new Date().toISOString().split('T')[0];
  if (data > hoje) { alert('A data não pode ser maior que a data atual.'); return false; }
  return true;
}

function salvarRascunho() {
  if (!validarFormulario()) return;
  const areaDestino = document.querySelector('input[name="areaDestino"]:checked')?.value;
  let areaDestinoFinal = areaDestino;
  if (areaDestino === 'OUTRAS ÁREAS') {
    areaDestinoFinal = getEl('envio-outras-area').value.trim();
  }
  const motivo = document.querySelector('input[name="motivo"]:checked')?.value;
  let motivoFinal = motivo;
  if (motivo === 'OUTROS') {
    motivoFinal = getEl('envio-outros-motivo').value.trim();
  }
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
    anexo: localStorage.getItem('anexoAtual') || ''
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
    const areaOriginal = dados.areaDestino;
    const areasPermitidas = ['FISCALIZAÇÃO', 'SAF', 'PLANTÃO'];
    if (areasPermitidas.includes(areaOriginal)) {
      document.querySelector(`input[name="areaDestino"][value="${areaOriginal}"]`).checked = true;
    } else {
      document.querySelector(`input[name="areaDestino"][value="OUTRAS ÁREAS"]`).checked = true;
      getEl('envio-outras-area').value = areaOriginal;
      getEl('campo-outras-area').style.display = 'block';
    }
    const motivosPermitidos = ['AVARIAS', 'PEDIDO DE FOLGAS', 'SOLICITAÇÃO DE MATERIAIS'];
    if (motivosPermitidos.includes(dados.motivo)) {
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
    preencherResponsavel();
    habilitarCamposSecundarios(true);
    aplicarRegrasPorArea();
    aplicarRegrasPorMotivo();
  } else {
    limparFormularioEnvio();
    preencherResponsavel();
  }
}

// ====================================================================
// PROCESSAMENTO DE ANEXOS (COMPRESSÃO E BASE64)
// ====================================================================
function acionarInputArquivo() {
  getEl('input-arquivo-oculto').click();
}

function anexarArquivo() {
  acionarInputArquivo();
}

getEl('input-arquivo-oculto')?.addEventListener('change', function(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const btnAnexar = getEl('btn-anexar');
  btnAnexar.innerHTML = '⏳ Processando...';
  btnAnexar.disabled = true;

  const reader = new FileReader();
  reader.onload = function(e) {
    if (file.type.includes('pdf')) {
      anexoAtualObj = { base64: e.target.result.split(',')[1], mimeType: file.type };
      btnAnexar.innerHTML = '✅ Arquivo Anexado';
      btnAnexar.disabled = false;
      btnAnexar.style.borderColor = '#10b981';
      btnAnexar.style.color = '#10b981';
    } else if (file.type.includes('image')) {
      comprimirImagem(e.target.result, file.type, function(base64Compressed) {
        anexoAtualObj = { base64: base64Compressed, mimeType: file.type };
        btnAnexar.innerHTML = '✅ Foto Anexada';
        btnAnexar.disabled = false;
        btnAnexar.style.borderColor = '#10b981';
        btnAnexar.style.color = '#10b981';
      });
    } else {
      alert("Formato não suportado. Envie apenas imagens ou PDF.");
      btnAnexar.innerHTML = '📎 ANEXAR';
      btnAnexar.disabled = false;
    }
  };
  reader.readAsDataURL(file);
});

function comprimirImagem(dataUrl, mimeType, callback) {
  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement('canvas');
    const MAX_WIDTH = 1200; 
    const MAX_HEIGHT = 1200;
    let width = img.width;
    let height = img.height;

    if (width > height) {
      if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
    } else {
      if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
    }
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    
    const newDataUrl = canvas.toDataURL(mimeType, 0.7); 
    callback(newDataUrl.split(',')[1]);
  };
  img.src = dataUrl;
}

// ====================================================================
// ENVIO PARA O SERVIDOR E LIMPEZA
// ====================================================================
function enviarRelatorio() {
  if (!validarFormulario()) return;
  const areaDestino = document.querySelector('input[name="areaDestino"]:checked')?.value;
  let areaDestinoFinal = areaDestino;
  if (areaDestino === 'OUTRAS ÁREAS') {
    areaDestinoFinal = getEl('envio-outras-area').value.trim();
  }
  const motivo = document.querySelector('input[name="motivo"]:checked')?.value;
  let motivoFinal = motivo;
  if (motivo === 'OUTROS') {
    motivoFinal = getEl('envio-outros-motivo').value.trim();
  }
  
  const btnEnviar = getEl('btn-enviar-relatorio');
  const textoBotaoOriginal = btnEnviar.innerHTML;
  btnEnviar.innerHTML = '⏳ Enviando...';
  btnEnviar.disabled = true;

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
    anexoObj: anexoAtualObj,
    fiscal: localStorage.getItem('inspectorApelido') || localStorage.getItem('inspectorName')
  };
  
 // --- INÍCIO DO CÓDIGO ATUALIZADO ---
  const formData = new FormData();
  formData.append('acao', 'envio_informacoes');
  formData.append('dados', JSON.stringify(dadosEnvio));

  // ATENÇÃO: Ao usar FormData, não colocamos o cabeçalho 'Content-Type'
  fetch(URL_PLANILHA, { 
    method: 'POST', 
  // mode: 'no-cors', 
    body: formData 
  })
    .then(() => { 
      alert('Relatório e anexos enviados com sucesso!'); 
      if (rascunhoAtualId) localStorage.removeItem(`rascunho_${rascunhoAtualId}`); 
      limparFormularioEnvio(); 
      fecharModalEnvio(); 
      btnEnviar.innerHTML = textoBotaoOriginal;
      btnEnviar.disabled = false;
    })
    .catch(() => {
      alert('Erro ao enviar.');
      btnEnviar.innerHTML = textoBotaoOriginal;
      btnEnviar.disabled = false;
    });
  // --- FIM DO CÓDIGO ATUALIZADO ---
}

function limparFormularioEnvio() {
  document.querySelectorAll('input[name="areaDestino"], input[name="motivo"]').forEach(r => r.checked = false);
  getEl('envio-outras-area').value = '';
  getEl('campo-outras-area').style.display = 'none';
  getEl('envio-outros-motivo').value = '';
  getEl('campo-outros-motivo').style.display = 'none';
  getEl('envio-carro').value = ''; getEl('envio-linha').value = ''; getEl('envio-motorista').value = ''; getEl('envio-cobrador').value = '';
  getEl('envio-hora').value = ''; getEl('envio-sentido').value = ''; getEl('envio-historico').value = ''; getEl('envio-local').value = '';
  
  anexoAtualObj = null;
  const inputArq = getEl('input-arquivo-oculto');
  if(inputArq) inputArq.value = '';
  const btnAnexar = getEl('btn-anexar');
  if(btnAnexar) {
    btnAnexar.innerHTML = '📎 ANEXAR';
    btnAnexar.style.borderColor = '#64748b';
    btnAnexar.style.color = 'var(--text)';
  }

  preencherDataAtual();
  rascunhoAtualId = null;
  habilitarCamposSecundarios(false);
  habilitarCamposAvarias(true);
}

// ====================================================================
// CONSULTAS DE ENVIOS
// ====================================================================
function consultarEnvios() {
  consultarEnviosComFiltro(null, null, null, null, null);
}

function consultarEnviosComFiltro(dataInicio, dataFim, motivo, carro, fiscalFiltro) {
  const params = new URLSearchParams();
  params.append('acao', 'consultar_envios');
  if (dataInicio) params.append('dataInicio', dataInicio);
  if (dataFim) params.append('dataFim', dataFim);
  if (motivo) params.append('motivo', motivo);
  if (carro) params.append('carro', carro);
  if (fiscalFiltro) params.append('fiscalFiltro', fiscalFiltro);
  if (currentUserRole === 'FISCAL') {
    params.append('fiscal', localStorage.getItem('inspectorApelido') || localStorage.getItem('inspectorName'));
  }
  return _executarConsultaEnvios(params);
}

function _executarConsultaEnvios(params) {
  return new Promise((resolve, reject) => {
    const callbackName = 'mostrarListaEnvios_' + Date.now();
    window[callbackName] = function(dados) {
      enviosLista = dados;
      const container = getEl('lista-envios-container'), modal = getEl('modal-lista-envios');
      if (!container || !modal) return;
      if (dados.length === 0) {
        container.innerHTML = '<p>Nenhum envio encontrado.</p>';
      } else {
        let html = '';
        dados.forEach((envio, idx) => {
          html += `
            <div class="envio-item" data-idx="${idx}" style="cursor: pointer;">
              <strong>MOTIVO: ${envio.motivo || 'N/I'}</strong><br>
              CARRO: ${envio.carro || 'N/I'} | DATA: ${formatarData(envio.data)} | MOTORISTA: ${envio.motorista || 'N/I'}
            </div>
          `;
        });
        container.innerHTML = html;
        document.querySelectorAll('.envio-item').forEach(el => {
          el.addEventListener('click', (e) => {
            const idx = parseInt(el.dataset.idx);
            if (!isNaN(idx)) mostrarDetalheEnvio(enviosLista[idx]);
          });
        });
      }
      modal.classList.add('is-open');
      delete window[callbackName];
      resolve();
    };
    params.append('callback', callbackName);
    const url = `${URL_PLANILHA}?${params.toString()}`;
    const script = document.createElement('script');
    script.src = url;
    script.onerror = () => { delete window[callbackName]; alert('Erro ao consultar.'); reject(); };
    document.body.appendChild(script);
  });
}

function mostrarDetalheEnvio(envio) {
  const modal = getEl('modal-detalhe-envio');
  const container = getEl('detalhe-envio-conteudo');
  if (!modal || !container) return;
  const horaFormatada = formatarHora(envio.hora);
  const dataFormatada = formatarData(envio.data);
  let html = `
    <div style="font-family: monospace; background: var(--card-bg); padding: 20px; border-radius: 12px;">
      <div><strong>MOTIVO:</strong> ${envio.motivo || 'N/I'}</div>
      <div><strong>HORA:</strong> ${horaFormatada} <strong>COB.:</strong> ${envio.cobrador || 'N/I'} <strong>SENT.:</strong> ${envio.sentido || 'N/I'}</div>
      <div><strong>CARRO:</strong> ${envio.carro || 'N/I'}</div>
      <div><strong>MOT.:</strong> ${envio.motorista || 'N/I'}</div>
      <div><strong>LINHA:</strong> ${envio.linha || 'N/I'} <strong>HISTÓRICO:</strong> ${envio.historico || 'N/I'}</div>
      <div><strong>LOCAL:</strong> ${envio.local || 'N/I'} <strong>DATA:</strong> ${dataFormatada}</div>
      <div><strong>ANEXO:</strong> ${envio.anexo ? `<a href="${envio.anexo}" target="_blank" style="color: #10b981; text-decoration: underline;">Ver anexo</a>` : 'Nenhum'}</div>
      <div><strong>RESPONSÁVEL:</strong> ${envio.fiscal || 'N/I'}</div>
    </div>
  `;
  container.innerHTML = html;
  modal.classList.add('is-open');
  const btnExport = document.getElementById('btn-exportar-detalhe');
  if (btnExport) {
    btnExport.onclick = () => {
      const texto = gerarTextoDetalheEnvio(envio);
      navigator.clipboard.writeText(texto).then(() => {
        alert('Detalhes copiados para a área de transferência!');
      }).catch(() => {
        alert('Erro ao copiar. Tente selecionar manualmente.');
      });
    };
  }
}

function gerarTextoDetalheEnvio(envio) {
  const horaFormatada = formatarHora(envio.hora);
  const dataFormatada = formatarData(envio.data);
  let texto = `=== RELATÓRIO À CHEFIA DO TRÁFEGO ===\n\n`;
  texto += `MOTIVO: ${envio.motivo || 'N/I'}\n`;
  texto += `HORA: ${horaFormatada}  COB.: ${envio.cobrador || 'N/I'}  SENT.: ${envio.sentido || 'N/I'}\n`;
  texto += `CARRO: ${envio.carro || 'N/I'}\n`;
  texto += `MOTORISTA: ${envio.motorista || 'N/I'}\n`;
  texto += `LINHA: ${envio.linha || 'N/I'}  HISTÓRICO: ${envio.historico || 'N/I'}\n`;
  texto += `LOCAL: ${envio.local || 'N/I'}  DATA: ${dataFormatada}\n`;
  texto += `ANEXO: ${envio.anexo || 'Nenhum'}\n`;
  texto += `RESPONSÁVEL: ${envio.fiscal || 'N/I'}\n`;
  return texto;
}

function fecharModalDetalheEnvio() {
  const modal = getEl('modal-detalhe-envio');
  if (modal) modal.classList.remove('is-open');
}

function fecharModalListaEnvios() {
  const modal = getEl('modal-lista-envios');
  if (modal) modal.classList.remove('is-open');
}
