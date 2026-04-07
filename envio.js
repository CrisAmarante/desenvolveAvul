// ====================================================================
// ENVIO DE INFORMAÇÕES (com até 4 anexos, rascunho, upload)
// ====================================================================
let rascunhoAtualId = null;
let enviosLista = [];
let anexosArray = [];          // cada elemento: { base64, mimeType, nome }

function getEl(id) { return document.getElementById(id); }

// --- Abrir/fechar modal ---
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
}

function fecharModalEnvio() {
  const m = getEl('modal-envio-informacoes');
  if (m) m.classList.remove('is-open');
}

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

// ====================================================================
// PREENCHER CAMPO LOCAL COM TODOS OS TERMINAIS (listarTodosTerminais)
// ====================================================================
async function preencherSelectLocal() {
  const selectLocal = getEl('envio-local');
  if (!selectLocal) return;

  // Limpa opções anteriores (exceto a primeira "Selecione...")
  selectLocal.innerHTML = '<option value="">Selecione o Local / Terminal</option>';

  try {
    const callbackName = 'carregarTerminaisEnvio_' + Date.now();
    
    window[callbackName] = function(terminais) {
      if (Array.isArray(terminais) && terminais.length > 0) {
        terminais.forEach(terminal => {
          const option = document.createElement('option');
          option.value = terminal;
          option.textContent = terminal;
          selectLocal.appendChild(option);
        });
      } else {
        // Fallback caso não consiga carregar
        const fallback = ["Terminal A", "Terminal B", "Terminal C", "Terminal D"];
        fallback.forEach(t => {
          const option = document.createElement('option');
          option.value = t;
          option.textContent = t;
          selectLocal.appendChild(option);
        });
      }
      delete window[callbackName];
    };

    const url = `${URL_PLANILHA}?acao=terminais_todos&callback=${callbackName}`;
    const script = document.createElement('script');
    script.src = url;
    script.onerror = () => {
      delete window[callbackName];
      console.warn('Falha ao carregar terminais via JSONP. Usando fallback.');
      // Fallback em caso de erro
      const fallback = ["Terminal A", "Terminal B", "Terminal C", "Terminal D"];
      fallback.forEach(t => {
        const option = document.createElement('option');
        option.value = t;
        option.textContent = t;
        selectLocal.appendChild(option);
      });
    };
    document.body.appendChild(script);

  } catch (err) {
    console.error('Erro ao preencher locais:', err);
    // Fallback em caso de erro
    const fallback = ["Terminal A", "Terminal B", "Terminal C", "Terminal D"];
    fallback.forEach(t => {
      const option = document.createElement('option');
      option.value = t;
      option.textContent = t;
      selectLocal.appendChild(option);
    });
  }
}

function habilitarCamposSecundarios(habilitar) {
  const ids = ['envio-carro', 'envio-linha', 'envio-motorista', 'envio-cobrador', 'envio-hora', 'envio-sentido', 'envio-historico', 'envio-local', 'btn-salvar-rascunho', 'btn-enviar-relatorio'];
  ids.forEach(id => {
    const campo = getEl(id);
    if (campo) campo.disabled = !habilitar;
  });
}

// ====================================================================
// REGRAS DE ÁREA, MOTIVO E VALIDAÇÕES (copiadas do seu arquivo original)
// ====================================================================
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

// ====================================================================
// ANEXOS MÚLTIPLOS (até 4) - COMPRESSÃO E BASE64
// ====================================================================
function criarInputMultiploAnexos() {
  const input = document.createElement('input');
  input.type = 'file';
  input.id = 'input-arquivos-multiplos';
  input.multiple = true;
  input.accept = 'image/*,application/pdf';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', processarArquivosSelecionados);
}

function anexarArquivos() {
  const input = getEl('input-arquivos-multiplos');
  if (input) input.click();
}

async function processarArquivosSelecionados(event) {
  const files = Array.from(event.target.files);
  if (anexosArray.length + files.length > 4) {
    alert('Máximo de 4 anexos por envio.');
    event.target.value = '';
    return;
  }
  const promises = files.map(file => processarArquivo(file));
  const novosAnexos = await Promise.all(promises);
  const validos = novosAnexos.filter(a => a !== null);
  anexosArray.push(...validos);
  atualizarListaAnexos();
  event.target.value = '';
}

function processarArquivo(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      if (file.type.includes('pdf')) {
        resolve({
          base64: e.target.result.split(',')[1],
          mimeType: file.type,
          nome: file.name
        });
      } else if (file.type.includes('image')) {
        comprimirImagem(e.target.result, file.type, (base64Compressed) => {
          resolve({
            base64: base64Compressed,
            mimeType: file.type,
            nome: file.name
          });
        });
      } else {
        alert(`Formato não suportado: ${file.name}`);
        resolve(null);
      }
    };
    reader.readAsDataURL(file);
  });
}

function comprimirImagem(dataUrl, mimeType, callback) {
  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement('canvas');
    let width = img.width;
    let height = img.height;
    const MAX = 1200;
    if (width > height) {
      if (width > MAX) { height *= MAX / width; width = MAX; }
    } else {
      if (height > MAX) { width *= MAX / height; height = MAX; }
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

function atualizarListaAnexos() {
  const container = getEl('lista-anexos');
  if (!container) return;
  if (anexosArray.length === 0) {
    container.innerHTML = '<small>Nenhum anexo selecionado (máx. 4)</small>';
    return;
  }
  container.innerHTML = anexosArray.map((a, idx) => `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
      <span>📎 ${a.nome}</span>
      <button type="button" onclick="removerAnexo(${idx})" style="background:#d11a2d; color:white; border:none; border-radius:4px; padding:2px 8px;">❌</button>
    </div>
  `).join('');
}

function removerAnexo(idx) {
  anexosArray.splice(idx, 1);
  atualizarListaAnexos();
}

// ====================================================================
// RASCUNHO (salva e carrega os anexos)
// ====================================================================
function salvarRascunho() {
  if (!validarFormulario()) return;
  const areaDestino = document.querySelector('input[name="areaDestino"]:checked')?.value;
  let areaDestinoFinal = areaDestino === 'OUTRAS ÁREAS' ? getEl('envio-outras-area').value.trim() : areaDestino;
  const motivo = document.querySelector('input[name="motivo"]:checked')?.value;
  let motivoFinal = motivo === 'OUTROS' ? getEl('envio-outros-motivo').value.trim() : motivo;
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
    anexos: anexosArray.map(a => ({ base64: a.base64, mimeType: a.mimeType, nome: a.nome }))
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
    // Área de destino
    if (['FISCALIZAÇÃO','SAF','PLANTÃO'].includes(dados.areaDestino)) {
      document.querySelector(`input[name="areaDestino"][value="${dados.areaDestino}"]`).checked = true;
    } else {
      document.querySelector(`input[name="areaDestino"][value="OUTRAS ÁREAS"]`).checked = true;
      getEl('envio-outras-area').value = dados.areaDestino;
      getEl('campo-outras-area').style.display = 'block';
    }
    // Motivo
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

// ====================================================================
// ENVIO PARA O SERVIDOR (COM ARRAY DE ANEXOS)
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
    fiscal: localStorage.getItem('inspectorApelido') || localStorage.getItem('inspectorName')
  };

  console.log('📤 Enviando dados:', dadosEnvio);
  console.log('📎 Número de anexos:', dadosEnvio.anexos.length);

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
// CONSULTAS DE ENVIOS (com suporte a múltiplos anexos)
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
  if (window.currentUserRole === 'FISCAL') {
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
  let anexosHtml = 'Nenhum';
  if (envio.anexos && envio.anexos !== 'Nenhum') {
    const links = envio.anexos.split(' ; ');
    anexosHtml = links.map(link => `<a href="${link}" target="_blank" style="color:#10b981; text-decoration:underline;">Anexo</a>`).join(' | ');
  }
  let html = `
    <div style="font-family: monospace; background: var(--card-bg); padding: 20px; border-radius: 12px;">
      <div><strong>MOTIVO:</strong> ${envio.motivo || 'N/I'}</div>
      <div><strong>HORA:</strong> ${horaFormatada} <strong>COB.:</strong> ${envio.cobrador || 'N/I'} <strong>SENT.:</strong> ${envio.sentido || 'N/I'}</div>
      <div><strong>CARRO:</strong> ${envio.carro || 'N/I'}</div>
      <div><strong>MOT.:</strong> ${envio.motorista || 'N/I'}</div>
      <div><strong>LINHA:</strong> ${envio.linha || 'N/I'} <strong>HISTÓRICO:</strong> ${envio.historico || 'N/I'}</div>
      <div><strong>LOCAL:</strong> ${envio.local || 'N/I'} <strong>DATA:</strong> ${dataFormatada}</div>
      <div><strong>ANEXOS:</strong> ${anexosHtml}</div>
      <div><strong>RESPONSÁVEL:</strong> ${envio.fiscal || 'N/I'}</div>
    </div>
  `;
  container.innerHTML = html;
  modal.classList.add('is-open');
  const btnExport = document.getElementById('btn-exportar-detalhe');
  if (btnExport) {
    btnExport.onclick = () => {
      const texto = gerarTextoDetalheEnvio(envio);
      navigator.clipboard.writeText(texto).then(() => alert('Detalhes copiados!'));
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
  texto += `ANEXOS: ${envio.anexos || 'Nenhum'}\n`;
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
// ====================================================================
// EXPORTAÇÃO PARA PDF - MODELO URUBUPUNGÁ (Versão Ajustada)
// ====================================================================
async function exportarParaPDF(envio) {
  if (typeof jsPDF === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    document.head.appendChild(script);
    await new Promise(resolve => { script.onload = resolve; });
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 22;

  // ==================== CABEÇALHO ====================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("AUTO VIAÇÃO URUBUPUNGÁ LTDA.", pageWidth/2, y, { align: "center" });
  
  y += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Avenida Presidente Médici nº 1.340 - Telefone: 3658-7777", pageWidth/2, y, { align: "center" });

  y += 14;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("RELATÓRIO À CHEFIA DO TRÁFEGO", pageWidth/2, y, { align: "center" });

  y += 18;

  // ==================== CAMPOS SUPERIORES ====================
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");

  const leftCol = margin;
  const rightCol = pageWidth / 2 + 12;

  doc.text(`Carro: ${envio.carro || '________________'}`, leftCol, y);
  doc.text(`Hora: ${formatarHora(envio.hora) || '________'}`, rightCol, y);
  y += 9;

  doc.text(`Mot.: ${envio.motorista || '________________'}`, leftCol, y);
  doc.text(`Cob.: ${envio.cobrador || '________________'}`, rightCol, y);
  y += 9;

  doc.text(`Linha: ${envio.linha || '________________'}`, leftCol, y);
  doc.text(`Sent.: ${envio.sentido || '________'}`, rightCol, y);
  y += 16;

  // ==================== TEXTO PRINCIPAL (HISTÓRICO) ====================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Sr. Chefe", margin, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11.5);

  const texto = (envio.historico || "").trim() || "Sem informações adicionais.";
  const linhas = doc.splitTextToSize(texto, pageWidth - margin * 2);

  linhas.forEach(linha => {
    doc.text(linha, margin, y);
    y += 7.5;
  });

  y += 12;

  // ==================== RODAPÉ ====================
  const dataFormatada = formatarData(envio.data) || '__/__/____';
  const local = (envio.local || 'Osasco').trim();

  // Local e Data (esquerda)
  doc.text(`${local}, ${dataFormatada}`, margin, y);

  // Responsável no lugar de "Visto" (direita)
  const responsavel = envio.fiscal || '________________';
  doc.text(responsavel, pageWidth - margin - 45, y);

  // Linha para assinatura (apenas visual)
  doc.line(pageWidth - margin - 70, y + 6, pageWidth - margin, y + 6);

  y += 22;

  // Rodapé inferior
  doc.setFontSize(8);
  doc.text("MOD. 058 - 500 Bls. 50x1 - 05/2025 - GRÁFICA COTRIM", pageWidth/2, y, { align: "center" });

  // ==================== SALVAR ====================
  const nomeArquivo = `Relatorio_Trafego_${envio.carro || 'SemCarro'}_${dataFormatada.replace(/\//g, '-')}.pdf`;
  
  doc.save(nomeArquivo);
  alert('✅ PDF gerado com sucesso!\nO arquivo foi baixado automaticamente.');
}
// ====================================================================
// FUNÇÕES AUXILIARES DE FORMATAÇÃO
// ====================================================================
function formatarData(dataStr) {
  if (!dataStr) return '';
  if (dataStr.includes('/')) return dataStr;
  const partes = dataStr.split('-');
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return dataStr;
}

function formatarHora(horaStr) {
  if (!horaStr) return '';
  if (horaStr.includes(':')) return horaStr;
  if (horaStr.includes('T')) return horaStr.split('T')[1].substring(0,5);
  return horaStr;
}
