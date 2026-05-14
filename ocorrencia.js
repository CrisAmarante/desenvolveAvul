// ====================================================================
// REGISTRO DE OCORRÊNCIAS - Módulo independente
// ====================================================================

let rascunhoOcorrenciaAtualId = null;
let ocorrenciasLista = [];
let anexosOcorrenciaArray = [];          // cada elemento: { base64, mimeType, nome }
let ocorrenciaEditando = null;           // objeto para edição

// ====================================================================
// ABRIR/FECHAR MODAL
// ====================================================================
function abrirModalOcorrencia(ocorrenciaId = null) {
  const modal = getEl('modal-ocorrencia');
  if (modal) modal.classList.add('is-open');
  preencherDadosBasicosOcorrencia();
  carregarRascunhoOcorrencia();
  anexosOcorrenciaArray = [];
  atualizarListaAnexosOcorrencia();
  if (!getEl('input-arquivos-ocorrencia')) criarInputMultiploAnexosOcorrencia();
  
  // Se for edição de uma ocorrência existente, carregar dados
  if (ocorrenciaId) {
    carregarOcorrenciaParaEdicao(ocorrenciaId);
  }
}

function fecharModalOcorrencia() {
  const modal = getEl('modal-ocorrencia');
  if (modal) modal.classList.remove('is-open');
}

function preencherDadosBasicosOcorrencia() {
  // Data/hora atual
  const agora = new Date();
  const dataField = getEl('ocorrencia-data');
  const horaField = getEl('ocorrencia-hora');
  if (dataField && !dataField.value) {
    dataField.value = agora.toLocaleDateString('pt-BR');
  }
  if (horaField && !horaField.value) {
    horaField.value = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  // Responsável (criado por)
  const criadoPorField = getEl('ocorrencia-criado-por');
  if (criadoPorField) {
    const apelido = localStorage.getItem('inspectorApelido') || localStorage.getItem('inspectorName') || 'Inspetor';
    criadoPorField.value = apelido;
  }
}

// ====================================================================
// ANEXOS (até 12, independentes do envio.js)
// ====================================================================
function criarInputMultiploAnexosOcorrencia() {
  const input = document.createElement('input');
  input.type = 'file';
  input.id = 'input-arquivos-ocorrencia';
  input.multiple = true;
  input.accept = 'image/*,application/pdf';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', processarArquivosSelecionadosOcorrencia);
}

function anexarArquivosOcorrencia() {
  const input = getEl('input-arquivos-ocorrencia');
  if (input) input.click();
}

async function processarArquivosSelecionadosOcorrencia(event) {
  const files = Array.from(event.target.files);
  if (anexosOcorrenciaArray.length + files.length > 12) {
    alert('Máximo de 12 anexos por ocorrência.');
    event.target.value = '';
    return;
  }
  const promises = files.map(file => processarArquivoOcorrencia(file));
  const novosAnexos = await Promise.all(promises);
  const validos = novosAnexos.filter(a => a !== null);
  anexosOcorrenciaArray.push(...validos);
  atualizarListaAnexosOcorrencia();
  event.target.value = '';
}

function processarArquivoOcorrencia(file) {
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
        comprimirImagemOcorrencia(e.target.result, file.type, (base64Compressed) => {
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

function comprimirImagemOcorrencia(dataUrl, mimeType, callback) {
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

function atualizarListaAnexosOcorrencia() {
  const container = getEl('lista-anexos-ocorrencia');
  if (!container) return;
  if (anexosOcorrenciaArray.length === 0) {
    container.innerHTML = '<small>Nenhum anexo selecionado (máx. 12)</small>';
    return;
  }
  container.innerHTML = anexosOcorrenciaArray.map((a, idx) => `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
      <span>📎 ${a.nome}</span>
      <button type="button" onclick="removerAnexoOcorrencia(${idx})" style="background:#d11a2d; color:white; border:none; border-radius:4px; padding:2px 8px;">❌</button>
    </div>
  `).join('');
}

function removerAnexoOcorrencia(idx) {
  anexosOcorrenciaArray.splice(idx, 1);
  atualizarListaAnexosOcorrencia();
}

// ====================================================================
// RASCUNHO
// ====================================================================
function salvarRascunhoOcorrencia() {
  const dados = coletarDadosOcorrencia();
  if (!dados) return;
  dados.id = rascunhoOcorrenciaAtualId || Date.now().toString();
  dados.anexos = anexosOcorrenciaArray.map(a => ({ base64: a.base64, mimeType: a.mimeType, nome: a.nome }));
  localStorage.setItem(`rascunho_ocorrencia_${dados.id}`, JSON.stringify(dados));
  rascunhoOcorrenciaAtualId = dados.id;
  alert('Rascunho salvo!');
}

function carregarRascunhoOcorrencia() {
  if (!rascunhoOcorrenciaAtualId) {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('rascunho_ocorrencia_'));
    if (keys.length) rascunhoOcorrenciaAtualId = keys[0].replace('rascunho_ocorrencia_', '');
    else { limparFormularioOcorrencia(); preencherDadosBasicosOcorrencia(); return; }
  }
  const dados = JSON.parse(localStorage.getItem(`rascunho_ocorrencia_${rascunhoOcorrenciaAtualId}`));
  if (dados) {
    preencherFormularioComDados(dados);
    if (dados.anexos && Array.isArray(dados.anexos)) {
      anexosOcorrenciaArray = dados.anexos;
      atualizarListaAnexosOcorrencia();
    }
  } else {
    limparFormularioOcorrencia();
    preencherDadosBasicosOcorrencia();
  }
}

function limparFormularioOcorrencia() {
  // limpar todos os campos (implementar conforme necessário)
  const fields = ['ocorrencia-tipo', 'ocorrencia-data', 'ocorrencia-hora', 'ocorrencia-local',
                  'ocorrencia-prefixo', 'ocorrencia-linha', 'ocorrencia-sentido',
                  'ocorrencia-condutor-nome', 'ocorrencia-condutor-reg',
                  'ocorrencia-cobrador-nome', 'ocorrencia-cobrador-reg',
                  'ocorrencia-desc-motorista', 'ocorrencia-desc-inspetor',
                  'ocorrencia-defesa-texto', 'ocorrencia-defesa-email'];
  fields.forEach(id => { const el = getEl(id); if (el) el.value = ''; });
  // limpar listas dinâmicas
  document.getElementById('veiculos-terceiros-container').innerHTML = '';
  document.getElementById('testemunhas-container').innerHTML = '';
  document.getElementById('vitimas-container').innerHTML = '';
  anexosOcorrenciaArray = [];
  atualizarListaAnexosOcorrencia();
  rascunhoOcorrenciaAtualId = null;
}

// ====================================================================
// COLETA DE DADOS DO FORMULÁRIO
// ====================================================================
function coletarDadosOcorrencia() {
  const tipo = getEl('ocorrencia-tipo')?.value;
  const dataOcorrencia = getEl('ocorrencia-data')?.value;
  const horaOcorrencia = getEl('ocorrencia-hora')?.value;
  const local = getEl('ocorrencia-local')?.value;
  const prefixo = getEl('ocorrencia-prefixo')?.value;
  const linha = getEl('ocorrencia-linha')?.value;
  const sentido = getEl('ocorrencia-sentido')?.value;
  const condutorNome = getEl('ocorrencia-condutor-nome')?.value;
  const condutorReg = getEl('ocorrencia-condutor-reg')?.value;
  const cobradorNome = getEl('ocorrencia-cobrador-nome')?.value;
  const cobradorReg = getEl('ocorrencia-cobrador-reg')?.value;
  const descricaoMotorista = getEl('ocorrencia-desc-motorista')?.value;
  const descricaoInspetor = getEl('ocorrencia-desc-inspetor')?.value;
  const defesaTexto = getEl('ocorrencia-defesa-texto')?.value;
  const observacoes = getEl('ocorrencia-observacoes')?.value;
  
  // Coletar veículos terceiros (array de objetos)
  const terceiros = [];
  document.querySelectorAll('.veiculo-terceiro-item').forEach(item => {
    terceiros.push({
      placa: item.querySelector('.placa')?.value,
      cor: item.querySelector('.cor')?.value,
      marca: item.querySelector('.marca')?.value,
      modelo: item.querySelector('.modelo')?.value,
      ano: item.querySelector('.ano')?.value,
      danos: item.querySelector('.danos')?.value,
      orcamento: item.querySelector('.orcamento')?.value,
      proprietario: item.querySelector('.proprietario')?.value
    });
  });
  
  // Testemunhas
  const testemunhas = [];
  document.querySelectorAll('.testemunha-item').forEach(item => {
    testemunhas.push({
      nome: item.querySelector('.test-nome')?.value,
      telefone: item.querySelector('.test-telefone')?.value
    });
  });
  
  // Vítimas
  const vitimas = [];
  document.querySelectorAll('.vitima-item').forEach(item => {
    vitimas.push({
      nome: item.querySelector('.vit-nome')?.value,
      idade: item.querySelector('.vit-idade')?.value,
      rg: item.querySelector('.vit-rg')?.value,
      telefone: item.querySelector('.vit-telefone')?.value,
      endereco: item.querySelector('.vit-endereco')?.value,
      danosPessoais: item.querySelector('.vit-danos')?.value
    });
  });
  
  // Fotos da defesa
  const fotoCrachá = getEl('ocorrencia-defesa-foto-cracha')?.files[0];
  const fotoCNH = getEl('ocorrencia-defesa-foto-cnh')?.files[0];
  // Processar fotos da defesa (separadamente, não como anexos comuns)
  // Por simplicidade, enviaremos as fotos em base64 também.
  
  return {
    tipo, dataOcorrencia, horaOcorrencia, local,
    prefixo, linha, sentido,
    condutorNome, condutorReg, cobradorNome, cobradorReg,
    descricaoMotorista, descricaoInspetor,
    defesaTexto, observacoes,
    terceiros, testemunhas, vitimas,
    fotoCrachá, fotoCNH,
    criadoPor: localStorage.getItem('inspectorApelido')
  };
}

// ====================================================================
// ENVIO PARA O SERVIDOR
// ====================================================================
async function enviarOcorrencia() {
  const dados = coletarDadosOcorrencia();
  if (!dados) return;
  
  // Validar campos obrigatórios
  if (!dados.tipo || !dados.dataOcorrencia || !dados.horaOcorrencia || !dados.local ||
      !dados.prefixo || !dados.condutorNome) {
    alert('Preencha todos os campos obrigatórios: tipo, data, hora, local, prefixo e condutor.');
    return;
  }
  
  const btnEnviar = getEl('btn-enviar-ocorrencia');
  const textoOriginal = btnEnviar.innerHTML;
  btnEnviar.innerHTML = '⏳ Enviando...';
  btnEnviar.disabled = true;
  
  // Processar fotos da defesa (upload separado)
  let fotoCracháBase64 = null, fotoCNHBase64 = null;
  if (dados.fotoCrachá) {
    fotoCracháBase64 = await lerArquivoBase64(dados.fotoCrachá);
  }
  if (dados.fotoCNH) {
    fotoCNHBase64 = await lerArquivoBase64(dados.fotoCNH);
  }
  
  const payload = {
    ...dados,
    fotoCracháBase64, fotoCNHBase64,
    anexos: anexosOcorrenciaArray.map(a => ({ base64: a.base64, mimeType: a.mimeType, nome: a.nome })),
    rav: null, // será atribuído pelo SAF posteriormente
    status: 'EM_ANDAMENTO'
  };
  
  const formData = new FormData();
  formData.append('acao', 'salvar_ocorrencia');
  formData.append('dados', JSON.stringify(payload));
  formData.append('usuario', localStorage.getItem('inspectorApelido'));
  
  fetch(URL_PLANILHA, { method: 'POST', mode: 'no-cors', body: formData })
    .then(() => {
      alert('✅ Ocorrência salva com sucesso!');
      if (rascunhoOcorrenciaAtualId) localStorage.removeItem(`rascunho_ocorrencia_${rascunhoOcorrenciaAtualId}`);
      limparFormularioOcorrencia();
      fecharModalOcorrencia();
    })
    .catch(error => {
      console.error('Erro:', error);
      alert('Erro ao enviar.');
    })
    .finally(() => {
      btnEnviar.innerHTML = textoOriginal;
      btnEnviar.disabled = false;
    });
}

function lerArquivoBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result.split(',')[1]);
    reader.readAsDataURL(file);
  });
}

// ====================================================================
// CONSULTAR OCORRÊNCIAS
// ====================================================================
function consultarOcorrencias() {
  const params = new URLSearchParams();
  params.append('acao', 'consultar_ocorrencias');
  params.append('filtros', JSON.stringify({}));
  
  const callbackName = 'consultarOcorrenciasCallback_' + Date.now();
  window[callbackName] = function(dados) {
    ocorrenciasLista = dados;
    mostrarListaOcorrencias(dados);
    delete window[callbackName];
  };
  params.append('callback', callbackName);
  const url = `${URL_PLANILHA}?${params.toString()}`;
  const script = document.createElement('script');
  script.src = url;
  document.body.appendChild(script);
}

function mostrarListaOcorrencias(lista) {
  const modal = getEl('modal-lista-ocorrencias');
  const container = getEl('lista-ocorrencias-container');
  if (!modal || !container) return;
  if (!lista || lista.length === 0) {
    container.innerHTML = '<p>Nenhuma ocorrência encontrada.</p>';
  } else {
    let html = '';
    lista.forEach((occ, idx) => {
      html += `<div class="ocorrencia-item" data-idx="${idx}" style="cursor: pointer; border:1px solid #ccc; margin:5px; padding:8px;">
        <strong>RAV: ${occ.rav || 'Pendente'}</strong><br>
        Data: ${occ.dataOcorrencia} | Prefixo: ${occ.prefixo} | Status: ${occ.status}
      </div>`;
    });
    container.innerHTML = html;
    document.querySelectorAll('.ocorrencia-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx);
        mostrarDetalheOcorrencia(ocorrenciasLista[idx]);
      });
    });
  }
  modal.classList.add('is-open');
}

function mostrarDetalheOcorrencia(ocorrencia) {
  // implementar modal de detalhe (similar ao envio)
  alert('Detalhe da ocorrência: ' + JSON.stringify(ocorrencia));
}

// ====================================================================
// DEFESA DO MOTORISTA – ENVIAR E-MAIL
// ====================================================================
async function enviarEmailDefesa() {
  const rav = getEl('ocorrencia-rav')?.value || 'Pendente';
  const email = getEl('ocorrencia-defesa-email')?.value;
  const defesaTexto = getEl('ocorrencia-defesa-texto')?.value;
  if (!email || !defesaTexto) {
    alert('Preencha o e-mail e o texto da defesa.');
    return;
  }
  
  const anexosURLs = []; // não implementado agora, futuro
  const payload = { rav, email, defesaTexto, anexos: anexosURLs };
  
  const callbackName = 'enviarEmailCallback_' + Date.now();
  window[callbackName] = function(resposta) {
    if (resposta.enviado) alert('E-mail enviado com sucesso!');
    else alert('Erro ao enviar e-mail.');
    delete window[callbackName];
  };
  const script = document.createElement('script');
  script.src = `${URL_PLANILHA}?acao=enviar_email_defesa&dados=${encodeURIComponent(JSON.stringify(payload))}&callback=${callbackName}`;
  document.body.appendChild(script);
}

// ====================================================================
// RENDERIZAÇÃO DO FORMULÁRIO COM ABAS (será chamado na abertura)
// ====================================================================
function renderizarFormularioOcorrencia() {
  const container = getEl('ocorrencia-form');
  if (!container) return;
  container.innerHTML = `
    <div class="ocorrencia-tabs">
      <button class="tablink active" data-tab="dados">Dados do Acidente</button>
      <button class="tablink" data-tab="veiculos">Veículos/Envolvidos</button>
      <button class="tablink" data-tab="descricoes">Descrições</button>
      <button class="tablink" data-tab="testemunhas">Testemunhas/Vítimas</button>
      <button class="tablink" data-tab="defesa">Defesa do Motorista</button>
      <button class="tablink" data-tab="anexos">Anexos</button>
    </div>
    <div id="tab-dados" class="tab-conteudo">${tabDados()}</div>
    <div id="tab-veiculos" class="tab-conteudo" style="display:none">${tabVeiculos()}</div>
    <div id="tab-descricoes" class="tab-conteudo" style="display:none">${tabDescricoes()}</div>
    <div id="tab-testemunhas" class="tab-conteudo" style="display:none">${tabTestemunhas()}</div>
    <div id="tab-defesa" class="tab-conteudo" style="display:none">${tabDefesa()}</div>
    <div id="tab-anexos" class="tab-conteudo" style="display:none">${tabAnexos()}</div>
  `;
  // Eventos das abas
  document.querySelectorAll('.tablink').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tablink').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-conteudo').forEach(div => div.style.display = 'none');
      const tabDiv = getEl(`tab-${tab}`);
      if (tabDiv) tabDiv.style.display = 'block';
    });
  });
}

function tabDados() { return `
  <div class="form-section">
    <label>Tipo de Ocorrência *</label>
    <select id="ocorrencia-tipo"><option value="">Selecione</option><option>Colisão</option><option>Queda acidental</option><option>Atropelamento</option></select>
  </div>
  <div class="form-row"><div class="field"><label>Data *</label><input type="text" id="ocorrencia-data" placeholder="DD/MM/AAAA"></div>
  <div class="field"><label>Hora *</label><input type="text" id="ocorrencia-hora" placeholder="HH:MM"></div></div>
  <div class="form-section"><label>Local *</label><input type="text" id="ocorrencia-local"></div>
  <div class="form-row"><div class="field"><label>Prefixo *</label><input type="text" id="ocorrencia-prefixo"></div>
  <div class="field"><label>Linha</label><input type="text" id="ocorrencia-linha"></div>
  <div class="field"><label>Sentido</label><input type="text" id="ocorrencia-sentido"></div></div>
  <div class="form-row"><div class="field"><label>Condutor *</label><input type="text" id="ocorrencia-condutor-nome"></div>
  <div class="field"><label>Registro</label><input type="text" id="ocorrencia-condutor-reg"></div></div>
  <div class="form-row"><div class="field"><label>Cobrador</label><input type="text" id="ocorrencia-cobrador-nome"></div>
  <div class="field"><label>Registro</label><input type="text" id="ocorrencia-cobrador-reg"></div></div>
  <div class="form-section"><label>Criado por</label><input type="text" id="ocorrencia-criado-por" readonly></div>
`; }

function tabVeiculos() { return `
  <div class="form-section"><h4>Veículo(s) / Bem(ns) de Terceiros</h4>
  <div id="veiculos-terceiros-container"></div>
  <button type="button" class="btn-secundario" onclick="adicionarVeiculoTerceiro()">+ Adicionar Veículo</button></div>
`; }

function tabDescricoes() { return `
  <div class="form-section"><label>Descrição do Motorista</label><textarea id="ocorrencia-desc-motorista" rows="4"></textarea></div>
  <div class="form-section"><label>Descrição do Inspetor</label><textarea id="ocorrencia-desc-inspetor" rows="4"></textarea></div>
`; }

function tabTestemunhas() { return `
  <div class="form-section"><h4>Testemunhas</h4><div id="testemunhas-container"></div><button type="button" class="btn-secundario" onclick="adicionarTestemunha()">+ Adicionar Testemunha</button></div>
  <div class="form-section"><h4>Vítimas</h4><div id="vitimas-container"></div><button type="button" class="btn-secundario" onclick="adicionarVitima()">+ Adicionar Vítima</button></div>
`; }

function tabDefesa() { return `
  <div class="form-section"><label>Texto da Defesa (descrição do acidente pelo motorista)</label><textarea id="ocorrencia-defesa-texto" rows="6" placeholder="O motorista descreve como ocorreu..."></textarea>
  <button type="button" id="btn-microfone-defesa" class="btn-icon">🎤</button></div>
  <div class="form-section"><label>Foto do Crachá</label><input type="file" id="ocorrencia-defesa-foto-cracha" accept="image/*"></div>
  <div class="form-section"><label>Foto da CNH</label><input type="file" id="ocorrencia-defesa-foto-cnh" accept="image/*"></div>
  <div class="form-section"><label>E-mail para envio do recibo</label><input type="email" id="ocorrencia-defesa-email" placeholder="motorista@exemplo.com"></div>
  <div class="form-section"><button type="button" class="btn-principal" onclick="enviarEmailDefesa()">📧 Enviar Defesa por E-mail</button></div>
`; }

function tabAnexos() { return `
  <div class="form-section"><button type="button" class="btn-secundario" onclick="anexarArquivosOcorrencia()">📎 Anexar Arquivos (até 12)</button>
  <div id="lista-anexos-ocorrencia" style="margin-top:10px;"></div></div>
`; }

// Funções auxiliares para adicionar elementos dinâmicos
window.adicionarVeiculoTerceiro = function() {
  const container = getEl('veiculos-terceiros-container');
  const idx = Date.now();
  const div = document.createElement('div');
  div.className = 'veiculo-terceiro-item';
  div.innerHTML = `<div class="form-row"><input type="text" class="placa" placeholder="Placa*"><input type="text" class="cor" placeholder="Cor*"><input type="text" class="marca" placeholder="Marca*"><input type="text" class="modelo" placeholder="Modelo*"><input type="text" class="ano" placeholder="Ano*"></div>
  <div class="form-row"><input type="text" class="danos" placeholder="Descrição dos danos*"><input type="text" class="orcamento" placeholder="Valor orçamento*"><input type="text" class="proprietario" placeholder="Proprietário (opcional)"></div>
  <button class="btn-excluir" onclick="this.parentElement.remove()">Remover</button><hr>`;
  container.appendChild(div);
};
window.adicionarTestemunha = function() { /* similar */ };
window.adicionarVitima = function() { /* similar */ };

// Inicializar o módulo (será chamado no carregamento da página)
function inicializarOcorrencia() {
  renderizarFormularioOcorrencia();
  const btnMicrofone = getEl('btn-microfone-defesa');
  if (btnMicrofone) btnMicrofone.addEventListener('click', () => iniciarReconhecimentoVoz('ocorrencia-defesa-texto'));
}

// Reutilizar reconhecimento de voz (adaptado)
function iniciarReconhecimentoVoz(targetId) {
  if (!('webkitSpeechRecognition' in window)) return alert('Navegador não suporta.');
  const recognition = new window.webkitSpeechRecognition();
  recognition.lang = 'pt-BR';
  recognition.onresult = (e) => {
    const texto = e.results[0][0].transcript;
    const field = getEl(targetId);
    if (field) field.value = (field.value + ' ' + texto).trim();
  };
  recognition.start();
}
