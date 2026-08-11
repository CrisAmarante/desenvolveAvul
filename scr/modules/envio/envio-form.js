/**
 * Módulo de Envio de Informações - Parte 2
 * Regras de área, motivo, validações e anexos
 */

// ====================================================================
// REGRAS DE ÁREA E MOTIVO
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
  
  habilitarCamposSecundarios(areaSelecionada ? true : false);
  
  const radiosMotivo = document.querySelectorAll('input[name="motivo"]');
  radiosMotivo.forEach(radio => radio.disabled = false);
  
  if (areaSelecionada === 'SAF' || areaSelecionada === 'PLANTÃO' || areaSelecionada === 'OUTRAS ÁREAS') {
    radiosMotivo.forEach(radio => {
      if (radio.value !== 'AVARIAS' && radio.value !== 'OUTROS') {
        radio.disabled = true;
        if (radio.checked) radio.checked = false;
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

// ====================================================================
// VALIDAÇÃO DO FORMULÁRIO
// ====================================================================
function validarFormulario() {
  const areaSelecionada = document.querySelector('input[name="areaDestino"]:checked')?.value;
  
  if (!areaSelecionada) {
    alert('Selecione a Área de Destino.');
    return false;
  }
  
  if (areaSelecionada === 'OUTRAS ÁREAS') {
    const outrasArea = getEl('envio-outras-area').value.trim();
    if (!outrasArea) {
      alert('Digite a Área de Destino.');
      return false;
    }
  }
  
  const motivoSelecionado = document.querySelector('input[name="motivo"]:checked')?.value;
  
  if (!motivoSelecionado) {
    alert('Selecione o Motivo.');
    return false;
  }
  
  if (motivoSelecionado === 'OUTROS') {
    const outrosMotivo = getEl('envio-outros-motivo').value.trim();
    if (!outrosMotivo) {
      alert('Descreva o motivo resumidamente.');
      return false;
    }
  }
  
  const carro = getEl('envio-carro').value.trim();
  if (motivoSelecionado === 'AVARIAS' && !carro) {
    alert('Para o motivo AVARIAS, o campo CARRO é obrigatório.');
    return false;
  }
  
  const data = getEl('envio-data').value;
  if (!data) {
    alert('Preencha a Data.');
    return false;
  }
  
  const hoje = new Date().toISOString().split('T')[0];
  if (data > hoje) {
    alert('A data não pode ser maior que a data atual.');
    return false;
  }
  
  const historico = getEl('envio-historico').value;
  const MAX_CARACTERES = 1400;
  const MAX_LINHAS = 16;
  const linhas = historico.split(/\r?\n/).length;
  
  if (historico.length > MAX_CARACTERES) {
    alert(`O histórico excede o limite de ${MAX_CARACTERES} caracteres.`);
    return false;
  }
  
  if (linhas > MAX_LINHAS) {
    alert(`O histórico excede o limite de ${MAX_LINHAS} linhas.`);
    return false;
  }
  
  return true;
}

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

// Exportar para escopo global
window.aplicarRegrasPorArea = aplicarRegrasPorArea;
window.aplicarRegrasPorMotivo = aplicarRegrasPorMotivo;
window.validarFormulario = validarFormulario;
window.criarInputMultiploAnexos = criarInputMultiploAnexos;
window.anexarArquivos = anexarArquivos;
window.atualizarListaAnexos = atualizarListaAnexos;
window.removerAnexo = removerAnexo;
