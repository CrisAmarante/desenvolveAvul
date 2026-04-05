// ====================================================================
// ENVIO DE INFORMAÇÕES (com até 4 anexos) - VERSÃO CORRIGIDA
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

function preencherSelectLocal() {
  // Mantenha sua lógica original de preenchimento de locais
}

function habilitarCamposSecundarios(habilitar) {
  const ids = ['envio-carro', 'envio-linha', 'envio-motorista', 'envio-cobrador', 'envio-hora', 'envio-sentido', 'envio-historico', 'envio-local', 'btn-salvar-rascunho', 'btn-enviar-relatorio'];
  ids.forEach(id => {
    const campo = getEl(id);
    if (campo) campo.disabled = !habilitar;
  });
}

// --- Regras (copie suas funções originais) ---
function aplicarRegrasPorArea() { /* seu código original */ }
function aplicarRegrasPorMotivo() { /* seu código original */ }
function habilitarCamposAvarias(habilitar) { /* seu código original */ }
function validarFormulario() { /* seu código original */ }

// ====================================================================
// ANEXOS MÚLTIPLOS (até 4)
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
    // Preenche os campos
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

  // LOG para depuração
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
// CONSULTAS (inalteradas, apenas adaptação para múltiplos anexos)
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

// Funções auxiliares de formatação (se não existirem)
function formatarData(dataStr) {
  if (!dataStr) return '';
  const partes = dataStr.split('-');
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return dataStr;
}
function formatarHora(horaStr) {
  if (!horaStr) return '';
  return horaStr;
}
