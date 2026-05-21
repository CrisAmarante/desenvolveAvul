// ====================================================================
// MÓDULO OCORRÊNCIAS - COM AUTOCOMPLETE E RASCUNHO COMPARTILHADO
// ====================================================================

let rascunhoAtualRav = null;
let anexosOcorrenciaArray = [];        // { base64, mimeType, nome }

// Dados temporários para pré‑preenchimento
let dadosVeiculoSelecionado = null;
let dadosMotoristaSelecionado = null;
let dadosCobradorSelecionado = null;

// ====================================================================
// ABRIR/FECHAR MODAL
// ====================================================================
function abrirModalOcorrencia(ravParaCarregar = null) {
  const modal = getEl('modal-ocorrencia');
  if (modal) modal.classList.add('is-open');
  
  limparFormularioOcorrencia();
  anexosOcorrenciaArray = [];
  atualizarListaAnexosOcorrencia();
  preencherDadosBasicosOcorrencia();
  if (!getEl('input-arquivos-ocorrencia')) criarInputMultiploAnexosOcorrencia();
  
  if (ravParaCarregar) {
    carregarRascunhoDoBackend(ravParaCarregar);
  } else {
    carregarListaRascunhos();
  }
  configurarBuscas();
}

function fecharModalOcorrencia() {
  const modal = getEl('modal-ocorrencia');
  if (modal) modal.classList.remove('is-open');
}

function preencherDadosBasicosOcorrencia() {
  const agora = new Date();
  const dataField = getEl('ocorrencia-data');
  const horaField = getEl('ocorrencia-hora');
  if (dataField && !dataField.value) dataField.value = agora.toISOString().split('T')[0];
  if (horaField && !horaField.value) horaField.value = agora.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  const criadoField = getEl('ocorrencia-criado-por');
  if (criadoField) criadoField.value = localStorage.getItem('inspectorApelido') || '';
}

// ====================================================================
// AUTOCOMPLETE: VEÍCULOS, COLABORADORES, LINHAS
// ====================================================================
function configurarBuscas() {
  const inputPrefixo = getEl('ocorrencia-prefixo');
  const inputMotorista = getEl('ocorrencia-condutor-nome');
  const inputCobrador = getEl('ocorrencia-cobrador-nome');
  const inputLinha = getEl('ocorrencia-linha');
  
  if (inputPrefixo) inputPrefixo.addEventListener('input', debounce(() => buscarVeiculos(inputPrefixo.value), 300));
  if (inputMotorista) inputMotorista.addEventListener('input', debounce(() => buscarColaboradores(inputMotorista.value, 'motorista'), 300));
  if (inputCobrador) inputCobrador.addEventListener('input', debounce(() => buscarColaboradores(inputCobrador.value, 'cobrador'), 300));
  if (inputLinha) inputLinha.addEventListener('input', debounce(() => buscarLinhas(inputLinha.value), 300));
}

function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

async function buscarVeiculos(termo) {
  if (termo.length < 2) return;
  const callback = 'buscaVeiculos_' + Date.now();
  window[callback] = (dados) => {
    delete window[callback];
    exibirSugestoes('veiculos', dados, termo);
  };
  const script = document.createElement('script');
  script.src = `${URL_PLANILHA}?acao=buscar_veiculos&termo=${encodeURIComponent(termo)}&callback=${callback}`;
  document.body.appendChild(script);
}

function exibirSugestoes(tipo, itens, termo) {
  let datalist = getEl(`sugestoes-${tipo}`);
  if (!datalist) {
    datalist = document.createElement('datalist');
    datalist.id = `sugestoes-${tipo}`;
    document.body.appendChild(datalist);
    const input = getEl(`ocorrencia-${tipo === 'veiculos' ? 'prefixo' : (tipo === 'colaboradores-motorista' ? 'condutor-nome' : 'cobrador-nome')}`);
    if (input) input.setAttribute('list', `sugestoes-${tipo}`);
  }
  if (tipo === 'veiculos') {
    datalist.innerHTML = itens.map(v => `<option value="${v.prefixo}">${v.prefixo} - ${v.placa} - ${v.modelo}</option>`).join('');
    const inputPrefixo = getEl('ocorrencia-prefixo');
    inputPrefixo.addEventListener('change', () => {
      const selecionado = itens.find(v => v.prefixo === inputPrefixo.value);
      if (selecionado) preencherDadosVeiculo(selecionado);
    });
  } else if (tipo === 'colaboradores-motorista') {
    // similar
  }
}

function preencherDadosVeiculo(veic) {
  getEl('ocorrencia-placa').value = veic.placa || '';
  getEl('ocorrencia-marca').value = veic.marca || '';
  getEl('ocorrencia-modelo').value = veic.modelo || '';
  getEl('ocorrencia-ano').value = veic.ano_fabricacao || '';
  getEl('ocorrencia-cor').value = veic.cor || '';
  dadosVeiculoSelecionado = veic;
}

// Funções para colaboradores e linhas seguem o mesmo padrão...

// ====================================================================
// ANEXOS (até 12)
// ====================================================================
function criarInputMultiploAnexosOcorrencia() { /* igual ao original, limite 12 */ }
function anexarArquivosOcorrencia() { /* igual */ }
async function processarArquivosSelecionadosOcorrencia(event) { /* igual, limite 12 */ }
function atualizarListaAnexosOcorrencia() { /* igual */ }
function removerAnexoOcorrencia(idx) { /* igual */ }

// ====================================================================
// RASCUNHO (salvar e carregar do backend)
// ====================================================================
function salvarRascunhoOcorrencia() {
  const dados = coletarDadosOcorrencia();
  if (!dados) return;
  const rav = rascunhoAtualRav || '';
  const formData = new FormData();
  formData.append('acao', 'salvar_rascunho_ocorrencia');
  formData.append('rav', rav);
  formData.append('dados', JSON.stringify(dados));
  formData.append('usuario', localStorage.getItem('inspectorApelido'));
  fetch(URL_PLANILHA, { method: 'POST', mode: 'no-cors', body: formData })
    .then(() => alert('Rascunho salvo!'))
    .catch(() => alert('Erro ao salvar rascunho'));
}

function carregarListaRascunhos() {
  const usuario = localStorage.getItem('inspectorApelido');
  const perfil = localStorage.getItem('inspectorRole');
  const callback = 'listaRascunhos_' + Date.now();
  window[callback] = (rascunhos) => {
    delete window[callback];
    exibirListaRascunhos(rascunhos);
  };
  const script = document.createElement('script');
  script.src = `${URL_PLANILHA}?acao=listar_rascunhos&usuario=${usuario}&perfil=${perfil}&callback=${callback}`;
  document.body.appendChild(script);
}

function exibirListaRascunhos(lista) {
  const container = getEl('lista-rascunhos-container');
  if (!container) return;
  if (!lista.length) { container.innerHTML = ''; return; }
  let html = '<div><strong>Rascunhos disponíveis:</strong><ul>';
  lista.forEach(r => {
    html += `<li><a href="#" onclick="carregarRascunhoDoBackend('${r.rav}')">${r.rav} (${r.criadoPor}) - ${r.dataMod}</a></li>`;
  });
  html += '</ul></div>';
  container.innerHTML = html;
}

function carregarRascunhoDoBackend(rav) {
  const callback = 'carregarRascunho_' + Date.now();
  window[callback] = (dados) => {
    delete window[callback];
    if (dados && Object.keys(dados).length) {
      preencherFormularioComDados(dados);
      rascunhoAtualRav = rav;
      if (dados.anexos) {
        anexosOcorrenciaArray = dados.anexos;
        atualizarListaAnexosOcorrencia();
      }
    } else alert('Rascunho não encontrado');
  };
  const script = document.createElement('script');
  script.src = `${URL_PLANILHA}?acao=carregar_rascunho&rav=${rav}&callback=${callback}`;
  document.body.appendChild(script);
}

// ====================================================================
// FINALIZAR OCORRÊNCIA
// ====================================================================
function enviarOcorrencia() {
  const dados = coletarDadosOcorrencia();
  if (!validarOcorrencia(dados)) return;
  dados.anexos = anexosOcorrenciaArray;
  const formData = new FormData();
  formData.append('acao', 'finalizar_ocorrencia');
  formData.append('dados', JSON.stringify(dados));
  formData.append('usuario', localStorage.getItem('inspectorApelido'));
  fetch(URL_PLANILHA, { method: 'POST', mode: 'no-cors', body: formData })
    .then(() => {
      alert('Ocorrência finalizada com sucesso!');
      fecharModalOcorrencia();
    })
    .catch(() => alert('Erro ao finalizar'));
}

function coletarDadosOcorrencia() {
  return {
    tipo: getEl('ocorrencia-tipo')?.value,
    dataOcorrencia: getEl('ocorrencia-data')?.value,
    horaOcorrencia: getEl('ocorrencia-hora')?.value,
    local: getEl('ocorrencia-local')?.value,
    prefixo: getEl('ocorrencia-prefixo')?.value,
    placa: getEl('ocorrencia-placa')?.value,
    marca: getEl('ocorrencia-marca')?.value,
    modelo: getEl('ocorrencia-modelo')?.value,
    ano: getEl('ocorrencia-ano')?.value,
    cor: getEl('ocorrencia-cor')?.value,
    linha: getEl('ocorrencia-linha')?.value,
    sentido: getEl('ocorrencia-sentido')?.value,
    condutorNome: getEl('ocorrencia-condutor-nome')?.value,
    condutorCNH: getEl('ocorrencia-condutor-cnh')?.value,
    condutorTelefone: getEl('ocorrencia-condutor-telefone')?.value,
    cobradorNome: getEl('ocorrencia-cobrador-nome')?.value,
    descricaoMotorista: getEl('ocorrencia-desc-motorista')?.value,
    descricaoInspetor: getEl('ocorrencia-desc-inspetor')?.value,
    defesaTexto: getEl('ocorrencia-defesa-texto')?.value,
  };
}

function validarOcorrencia(dados) {
  if (!dados.tipo || !dados.dataOcorrencia || !dados.local || !dados.prefixo || !dados.condutorNome) {
    alert('Preencha todos os campos obrigatórios (Tipo, Data, Local, Prefixo, Condutor).');
    return false;
  }
  return true;
}

function limparFormularioOcorrencia() {
  // limpar todos os campos
  const campos = ['tipo','data','hora','local','prefixo','placa','marca','modelo','ano','cor','linha','sentido',
                  'condutor-nome','condutor-cnh','condutor-telefone','cobrador-nome','desc-motorista','desc-inspetor','defesa-texto'];
  campos.forEach(c => { const el = getEl(`ocorrencia-${c}`); if (el) el.value = ''; });
  anexosOcorrenciaArray = [];
  atualizarListaAnexosOcorrencia();
  rascunhoAtualRav = null;
}
