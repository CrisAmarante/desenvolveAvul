// ====================================================================
// ENVIO DE INFORMAÇÕES (com até 4 anexos, rascunho, upload, preview com lazy loading)
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
// ========== ADICIONAR EVENTOS DOS NOVOS BOTÕES ==========
  const btnMicrofone = getEl('btn-microfone');
  if (btnMicrofone) {
    // Remove evento anterior para evitar duplicação
    const novoBtn = btnMicrofone.cloneNode(true);
    btnMicrofone.parentNode.replaceChild(novoBtn, btnMicrofone);
    novoBtn.addEventListener('click', iniciarReconhecimentoVoz);
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
// PREENCHER CAMPO LOCAL COM TODOS OS TERMINAIS
// ====================================================================
async function preencherSelectLocal() {
  const selectLocal = getEl('envio-local');
  if (!selectLocal) return;
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
      const fallback = ["Terminal A", "terminal B", "Terminal C", "Terminal D"];
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
// REGRAS DE ÁREA, MOTIVO E VALIDAÇÕES
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
// CONSULTAS DE ENVIOS - VERSÃO ROBUSTA (FETCH + FALLBACK)
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
    const url = `${URL_PLANILHA}?${params.toString()}`;
    console.log('📂 Consultando URL (fetch):', url);
    
    // Tenta primeiro com fetch (mais confiável)
    fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(dados => {
      console.log('✅ Dados recebidos via fetch:', dados);
      mostrarListaEnvios(dados);
      resolve();
    })
    .catch(fetchError => {
      console.warn('Fetch falhou, tentando JSONP...', fetchError);
      // Fallback para JSONP
      tentarJSONP(params, resolve, reject);
    });
  });
}

function tentarJSONP(params, resolve, reject) {
  const callbackName = 'mostrarListaEnvios_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
  let timeoutId = setTimeout(() => {
    if (window[callbackName]) {
      delete window[callbackName];
      reject(new Error('Timeout'));
      alert('Tempo esgotado. Tente novamente.');
    }
  }, 15000);

  window[callbackName] = function(dados) {
    clearTimeout(timeoutId);
    console.log('✅ Dados recebidos via JSONP:', dados);
    mostrarListaEnvios(dados);
    delete window[callbackName];
    resolve();
  };

  const paramsCopy = new URLSearchParams(params);
  paramsCopy.append('callback', callbackName);
  const url = `${URL_PLANILHA}?${paramsCopy.toString()}`;
  console.log('📂 Consultando URL (JSONP):', url);

  const script = document.createElement('script');
  script.src = url;
  script.onerror = (err) => {
    clearTimeout(timeoutId);
    delete window[callbackName];
    reject(new Error('Falha JSONP'));
    alert('Erro ao consultar envios. Verifique sua internet.');
  };
  document.body.appendChild(script);
}

function mostrarListaEnvios(dados) {
  try {
    console.log('📋 Processando dados para exibição:', dados);
    
    const container = getEl('lista-envios-container');
    const modal = getEl('modal-lista-envios');
    
    if (!container) {
      console.error('❌ Elemento lista-envios-container não encontrado');
      return;
    }
    if (!modal) {
      console.error('❌ Modal modal-lista-envios não encontrado');
      return;
    }
    
    // Verifica se dados é um array (ou se tem erro)
    if (!dados || dados.erro) {
      container.innerHTML = `<p>${dados?.erro || 'Nenhum envio encontrado.'}</p>`;
      modal.classList.add('is-open');
      return;
    }
    
    if (!Array.isArray(dados) || dados.length === 0) {
      container.innerHTML = '<p>Nenhum envio encontrado.</p>';
      modal.classList.add('is-open');
      return;
    }
    
    // Monta a lista
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
    
    // Adiciona evento de clique em cada item
    document.querySelectorAll('.envio-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx);
        if (!isNaN(idx) && window.mostrarDetalheEnvio) {
          window.mostrarDetalheEnvio(dados[idx]);
        }
      });
    });
    
    modal.classList.add('is-open');
    console.log('✅ Lista exibida com sucesso');
    
  } catch (err) {
    console.error('❌ Erro em mostrarListaEnvios:', err);
    alert('Erro ao processar os dados da consulta.');
  }
}
// ====================================================================
// MOSTRAR DETALHES DO ENVIO - COM PRÉ-VISUALIZAÇÃO DE IMAGENS E LAZY LOADING
// ====================================================================
function mostrarDetalheEnvio(envio) {
  const modal = getEl('modal-detalhe-envio');
  const container = getEl('detalhe-envio-conteudo');
  if (!modal || !container) return;

  const horaFormatada = formatarHora(envio.hora);
  const dataFormatada = formatarData(envio.data);

  // Processa anexos (sua função processarLinkAnexo existente)
  let anexosHtml = 'Nenhum anexo';
  if (envio.anexo && envio.anexo !== 'Nenhum' && envio.anexo.trim() !== '') {
    const links = envio.anexo.split(' ; ');
    const anexosProcessados = links.map(link => processarLinkAnexo(link));
    anexosHtml = `<div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px;">${anexosProcessados.join('')}</div>`;
  }

  // ========== 1. INFORMAÇÕES FIXAS (tudo acima do HISTÓRICO) ==========
  const infoFixaHtml = `
    <div class="info-fixa">
      <div><strong>MOTIVO:</strong> ${envio.motivo || 'N/I'}</div>
      <div><strong>CARRO:</strong> ${envio.carro || 'N/I'}</div>
      <div><strong>HORA:</strong> ${horaFormatada} <strong>| COB.:</strong> ${envio.cobrador || 'N/I'} <strong>| SENT.:</strong> ${envio.sentido || 'N/I'}</div>
      <div><strong>MOTORISTA:</strong> ${envio.motorista || 'N/I'}</div>
      <div><strong>LINHA:</strong> ${envio.linha || 'N/I'}</div>
      <div><strong>LOCAL:</strong> ${envio.local || 'N/I'} <strong>| DATA:</strong> ${dataFormatada}</div>
      <div><strong>RESPONSÁVEL:</strong> ${envio.fiscal || 'N/I'}</div>
    </div>
  `;

  // ========== 2. ÁREA ROLÁVEL (HISTÓRICO + ANEXOS) ==========
  const areaRolavelHtml = `
    <div class="area-rolavel" style="overflow-y: auto; max-height: 300px;">
      <div><strong>HISTÓRICO:</strong></div>
      <div style="background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; margin: 8px 0 16px 0; white-space: pre-wrap;">${(envio.historico || 'N/I').replace(/\n/g, '<br>')}</div>
      <div><strong>ANEXOS:</strong></div>
      <div>${anexosHtml}</div>
    </div>
  `;

  // ========== 3. RODAPÉ COM BOTÕES (fixo) ==========
  const rodapeHtml = `
    <div class="modal-footer">
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <button id="btn-gerar-pdf" class="btn-principal">📄 Gerar PDF (Modelo Oficial)</button>
        <button id="btn-copiar-completo" class="btn-secundario">📋 Copiar Texto Completo</button>
        <button id="btn-copiar-historico" class="btn-secundario">📋 Copiar apenas o Histórico</button>
      </div>
    </div>
  `;

  // Monta o conteúdo no container (sem sobrescrever o cabeçalho original do modal)
  container.innerHTML = infoFixaHtml + areaRolavelHtml + rodapeHtml;
  modal.classList.add('is-open');

  // ========== REATRIBUIR EVENTOS DOS BOTÕES (mesmo código original) ==========
  // Usamos setTimeout para garantir que os elementos já existam no DOM
  setTimeout(() => {
    const btnPDF = document.getElementById('btn-gerar-pdf');
    const btnCompleto = document.getElementById('btn-copiar-completo');
    const btnHistorico = document.getElementById('btn-copiar-historico');

    if (btnPDF) {
      // Remove eventos antigos para evitar duplicação
      const novoBtnPDF = btnPDF.cloneNode(true);
      btnPDF.parentNode.replaceChild(novoBtnPDF, btnPDF);
      novoBtnPDF.addEventListener('click', () => exportarParaPDF(envio));
    }
    
    if (btnCompleto) {
      const novoBtnCompleto = btnCompleto.cloneNode(true);
      btnCompleto.parentNode.replaceChild(novoBtnCompleto, btnCompleto);
      novoBtnCompleto.addEventListener('click', () => {
        const texto = gerarTextoDetalheEnvio(envio);
        copiarParaAreaDeTransferencia(novoBtnCompleto, texto, "Texto completo copiado!");
      });
    }
    
    if (btnHistorico) {
      const novoBtnHistorico = btnHistorico.cloneNode(true);
      btnHistorico.parentNode.replaceChild(novoBtnHistorico, btnHistorico);
      novoBtnHistorico.addEventListener('click', () => {
        const historico = (envio.historico || "").trim() || "Nenhum histórico informado.";
        copiarParaAreaDeTransferencia(novoBtnHistorico, historico, "Histórico copiado!");
      });
    }
  }, 100);
}
// ====================================================================
// FUNÇÃO AUXILIAR: Processa link do anexo, gerando thumbnail com data-src
// ====================================================================
function processarLinkAnexo(link) {
  link = link.trim();
  if (!link) return '';

  // Extrai o ID do Google Drive
  let fileId = null;
  const patterns = [
    /\/d\/([a-zA-Z0-9_-]+)/,               // /d/ID
    /id=([a-zA-Z0-9_-]+)/,                 // ?id=ID
    /file\/d\/([a-zA-Z0-9_-]+)/,           // /file/d/ID
    /uc\?id=([a-zA-Z0-9_-]+)/,             // /uc?id=ID
    /open\?id=([a-zA-Z0-9_-]+)/,           // /open?id=ID
    /\/u\/\d\/d\/([a-zA-Z0-9_-]+)/         // /u/0/d/ID
  ];
  
  for (const pattern of patterns) {
    const match = link.match(pattern);
    if (match && match[1]) {
      fileId = match[1];
      break;
    }
  }

  if (fileId) {
    // Para qualquer arquivo do Drive, tenta gerar thumbnail (funciona para imagens e PDFs)
    // O tamanho 300 é bom para visualização
    const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w300`;
    const originalUrl = `https://drive.google.com/uc?id=${fileId}`;
    
    // Retorna o bloco com a thumbnail, mas com fallback para link se a imagem não carregar
    return `
      <div style="display: inline-block; margin: 5px; text-align: center; vertical-align: top; width: 130px;">
        <a href="${originalUrl}" target="_blank" style="text-decoration: none;">
          <img src="${thumbnailUrl}" 
               alt="Pré-visualização" 
               style="max-width: 120px; max-height: 120px; border-radius: 8px; border: 1px solid #ccc; cursor: pointer; background: #f0f0f0; object-fit: cover;"
               onerror="this.onerror=null; this.parentElement.parentElement.innerHTML='<a href=\\'${originalUrl}\\' target=\\'_blank\\' style=\\'color:#10b981; text-decoration:underline;\\'>📎 Anexo (imagem não disponível)</a>'">
        </a>
        <div><small><a href="${originalUrl}" target="_blank" style="color: #10b981;">Abrir original</a></small></div>
      </div>
    `;
  }

  // Fallback: link genérico (não-Drive)
  return `<div style="margin: 5px;"><a href="${link}" target="_blank" style="color: #10b981; text-decoration: underline;">📎 Anexo</a></div>`;
}
// ====================================================================
// LAZY LOADING VIA INTERSECTION OBSERVER
// ====================================================================
function iniciarLazyLoadingImagens() {
  const imagens = document.querySelectorAll('#detalhe-envio-conteudo img[data-src]');
  if (imagens.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const dataSrc = img.getAttribute('data-src');
        if (dataSrc) {
          img.src = dataSrc;
          img.removeAttribute('data-src');
        }
        observer.unobserve(img);
      }
    });
  }, { threshold: 0.1 });

  imagens.forEach(img => observer.observe(img));
}

// ====================================================================
// EXPORTAÇÃO PARA PDF E TEXTOS
// ====================================================================
async function exportarParaPDF(envio) {
  try {
    if (typeof window.jspdf === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      document.head.appendChild(script);
      await new Promise(resolve => { script.onload = resolve; });
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 22;

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

    doc.setFontSize(12);
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

    y += 22;

    const dataFormatada = formatarData(envio.data) || '__/__/____';
    const responsavel = envio.fiscal || '________________';
    const localSelecionado = envio.local || 'Não informado';

    const agora = new Date();
    const dataGeracao = agora.toLocaleDateString('pt-BR', { 
      day: '2-digit', month: '2-digit', year: 'numeric' 
    }) + ' ' + agora.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });

    const dadosParaHash = `${envio.carro || ''}|${envio.data || ''}|${envio.hora || ''}|${responsavel}|${Date.now()}`;
    const hashValidacao = await gerarHashValidacao(dadosParaHash);

    doc.text(`Osasco, ${dataFormatada}`, margin, y);
    doc.text(responsavel, pageWidth - margin - 45, y);
    y += 18;

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "bold");
    doc.text("HASH DE VALIDAÇÃO:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(hashValidacao, margin + 42, y);

    y += 7;
    doc.setFontSize(8);
    doc.text(`Gerado em: ${dataGeracao} • Responsável: ${responsavel} • Local: ${localSelecionado}`, margin, y);

    y += 10;
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.text("Documento gerado eletronicamente • Valide o hash para verificar integridade", pageWidth/2, y, { align: "center" });

    doc.setTextColor(0);

    const motoristaNome = (envio.motorista || 'SemMotorista')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 15);
    const dataArquivo = dataFormatada.replace(/\//g, '_');
    const nomeArquivo = `${envio.carro || 'SemCarro'}_${dataArquivo}_${motoristaNome}.pdf`;

    doc.save(nomeArquivo);
    alert('✅ PDF gerado com sucesso!\n\nNome do arquivo: ' + nomeArquivo);
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    alert('❌ Erro ao gerar o PDF:\n' + error.message);
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
// MICROFONE (Reconhecimento de Voz)
// ====================================================================
let reconhecimentoVoz = null;

function iniciarReconhecimentoVoz() {
  // Verifica suporte do navegador
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert('Seu navegador não suporta reconhecimento de voz. Use Chrome, Edge ou Safari.');
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  reconhecimentoVoz = new SpeechRecognition();
  reconhecimentoVoz.lang = 'pt-BR';
  reconhecimentoVoz.continuous = false;
  reconhecimentoVoz.interimResults = false;
  reconhecimentoVoz.maxAlternatives = 1;

  reconhecimentoVoz.onstart = function() {
    const btn = getEl('btn-microfone');
    if (btn) {
      btn.style.background = '#10b981';
      btn.style.color = 'white';
      btn.textContent = '🎤 Ouvindo...';
    }
  };

  reconhecimentoVoz.onend = function() {
    const btn = getEl('btn-microfone');
    if (btn) {
      btn.style.background = '';
      btn.style.color = '';
      btn.textContent = '🎤';
    }
  };

    reconhecimentoVoz.onresult = function(event) {
    let texto = event.results[0][0].transcript;
    // Capitaliza a primeira letra da string
    if (texto && texto.length > 0) {
      texto = texto.charAt(0).toUpperCase() + texto.slice(1);
    }
    const historicoField = getEl('envio-historico');
    if (historicoField) {
      const textoAtual = historicoField.value;
      if (textoAtual.trim() === '') {
        historicoField.value = texto;
      } else {
        historicoField.value = textoAtual + '\n' + texto;
      }
    }
  };

  reconhecimentoVoz.onerror = function(event) {
    console.error('Erro no reconhecimento de voz:', event.error);
    alert('Erro ao capturar áudio: ' + event.error);
    reconhecimentoVoz.stop();
  };

  reconhecimentoVoz.start();
}

// ====================================================================
// FUNÇÕES AUXILIARES (formatação, hash, copiar)
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

async function gerarHashValidacao(texto) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(texto);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  } catch (e) {
    let hash = 0;
    for (let i = 0; i < texto.length; i++) {
      hash = ((hash << 5) - hash) + texto.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).toUpperCase().padStart(64, '0');
  }
}

function copiarParaAreaDeTransferencia(botaoElemento, texto, mensagemSucesso = "Copiado!") {
  if (!texto || texto.trim() === "") {
    alert("Não há texto para copiar.");
    return;
  }

  navigator.clipboard.writeText(texto).then(() => {
    const textoOriginal = botaoElemento.innerHTML;
    botaoElemento.innerHTML = `✅ ${mensagemSucesso}`;
    botaoElemento.style.background = '#10b981';
    botaoElemento.style.color = 'white';

    setTimeout(() => {
      botaoElemento.innerHTML = textoOriginal;
      botaoElemento.style.background = '';
      botaoElemento.style.color = '';
    }, 2500);
  }).catch(err => {
    console.error("Erro ao copiar:", err);
    alert("Não foi possível copiar o texto.");
  });
}
