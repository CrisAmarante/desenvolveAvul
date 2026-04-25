// ====================================================================
// VARIÁVEIS GLOBAIS E CONFIGURAÇÕES
// ====================================================================
let rascunhoAtualId = null;
let enviosLista = [];
let anexosArray = []; 
const MAX_CARACTERES = 1400;
const MAX_LINHAS = 16;

function getEl(id) { return document.getElementById(id); }

// ====================================================================
// FUNÇÃO: abrirModalEnvio
// Descrição: Inicializa o modal, recupera rascunhos e configura eventos.
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
  iniciarContadorHistorico();
  
  if (!getEl('input-arquivos-multiplos')) criarInputMultiploAnexos();

  const btnMicrofone = getEl('btn-microfone');
  if (btnMicrofone) {
    const novoBtn = btnMicrofone.cloneNode(true);
    btnMicrofone.parentNode.replaceChild(novoBtn, btnMicrofone);
    novoBtn.addEventListener('click', iniciarReconhecimentoVoz);
  }
}

// ====================================================================
// FUNÇÃO: fecharModalEnvio
// Descrição: Encerra o modal e limpa os campos para evitar poluição de dados.
// ====================================================================
function fecharModalEnvio() {
  const m = getEl('modal-envio-informacoes');
  if (m) m.classList.remove('is-open');
  limparFormularioEnvio();
}

// ====================================================================
// FUNÇÃO: gerenciarAnexos
// Descrição: Comprime imagens via Canvas (0.7) e as converte para Base64.
// ====================================================================
function gerenciarAnexos(files) {
  if (anexosArray.length + files.length > 4) {
    alert("Limite máximo de 4 anexos.");
    return;
  }

  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const max = 1200;

        if (width > height && width > max) { height *= max / width; width = max; }
        else if (height > max) { width *= max / height; height = max; }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        anexosArray.push({ base64, mimeType: 'image/jpeg', nome: file.name });
        atualizarListaAnexos();
        salvarRascunhoAutomatico();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ====================================================================
// FUNÇÃO: iniciarReconhecimentoVoz
// Descrição: Captura áudio e transcreve para o histórico respeitando limites.
// ====================================================================
function iniciarReconhecimentoVoz() {
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Speech) return alert("Navegador não suporta reconhecimento de voz.");

  const reco = new Speech();
  reco.lang = 'pt-BR';
  
  reco.onstart = () => { 
    const btn = getEl('btn-microfone');
    btn.textContent = '🎤 Ouvindo...';
    btn.style.background = '#ff4444';
  };
  
  reco.onend = () => { 
    const btn = getEl('btn-microfone');
    btn.textContent = '🎤';
    btn.style.background = '';
  };
  
  reco.onresult = (event) => {
    let texto = event.results[0][0].transcript;
    texto = texto.charAt(0).toUpperCase() + texto.slice(1);
    const campo = getEl('envio-historico');
    const novoTexto = campo.value ? campo.value + "\n" + texto : texto;
    
    if (validarLimitesTexto(novoTexto)) {
      campo.value = novoTexto;
      iniciarContadorHistorico();
      salvarRascunhoAutomatico();
    }
  };
  reco.start();
}

// ====================================================================
// FUNÇÃO: validarLimitesTexto
// Descrição: Validação em tempo real de caracteres (1400) e linhas (16).
// ====================================================================
function validarLimitesTexto(texto) {
  const linhas = texto.split(/\r?\n/).length;
  if (texto.length > MAX_CARACTERES) {
    alert(`Limite de ${MAX_CARACTERES} caracteres excedido.`);
    return false;
  }
  if (linhas > MAX_LINHAS) {
    alert(`Limite de ${MAX_LINHAS} linhas excedido.`);
    return false;
  }
  return true;
}

// ====================================================================
// FUNÇÃO: consultarEnvioInformacoes
// Descrição: Busca dados no backend filtrados por perfil e critérios de busca.
// ====================================================================
function consultarEnvioInformacoes() {
  const btn = getEl('btn-consultar-envios');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Buscando...';

  const filtros = {
    dataInicio: getEl('filtro-data-inicio').value,
    dataFim: getEl('filtro-data-fim').value,
    carro: getEl('filtro-carro').value,
    local: getEl('filtro-local').value,
    perfilUsuario: localStorage.getItem('perfilUsuario') || 'FISCAL',
    nomeUsuarioLogado: localStorage.getItem('usuarioLogado') || ''
  };

  google.script.run
    .withSuccessHandler(res => {
      enviosLista = res;
      renderizarTabelaEnvios(res);
      btn.disabled = false;
      btn.textContent = 'Consultar';
    })
    .withFailureHandler(err => {
      alert("Erro na consulta: " + err);
      btn.disabled = false;
      btn.textContent = 'Consultar';
    })
    .consultarEnvios(filtros);
}

// ====================================================================
// FUNÇÃO: renderizarTabelaEnvios
// Descrição: Alimenta a tabela HTML com os dados autorizados pelo perfil.
// ====================================================================
function renderizarTabelaEnvios(lista) {
  const corpo = getEl('tabela-envios-corpo');
  corpo.innerHTML = '';

  if (lista.length === 0) {
    corpo.innerHTML = '<tr><td colspan="5" style="text-align:center">Nenhum registro encontrado.</td></tr>';
    return;
  }

  lista.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.dataHora}</td>
      <td>${item.carro}</td>
      <td>${item.responsavel}</td>
      <td>${item.motivo}</td>
      <td><button onclick="verDetalhesEnvio(${index})" class="btn-detalhes">Ver Detalhes</button></td>
    `;
    corpo.appendChild(tr);
  });
}

// ====================================================================
// FUNÇÃO: verDetalhesEnvio
// Descrição: Abre modal de detalhamento utilizando innerHTML para montagem.
// ====================================================================
function verDetalhesEnvio(index) {
  const item = enviosLista[index];
  const detalhesDiv = getEl('detalhes-envio-conteudo');
  
  let htmlAnexos = '';
  if (item.anexos && item.anexos.length > 0) {
    htmlAnexos = '<div class="galeria-detalhes">';
    item.anexos.forEach(link => {
      htmlAnexos += `<img src="${link}" onclick="window.open('${link}')" title="Clique para ampliar">`;
    });
    htmlAnexos += '</div>';
  }

  detalhesDiv.innerHTML = `
    <div class="detalhe-item"><strong>Data/Hora:</strong> ${item.dataHora}</div>
    <div class="detalhe-item"><strong>Carro:</strong> ${item.carro}</div>
    <div class="detalhe-item"><strong>Responsável:</strong> ${item.responsavel}</div>
    <div class="detalhe-item"><strong>Local:</strong> ${item.local}</div>
    <div class="detalhe-item"><strong>Motivo:</strong> ${item.motivo}</div>
    <div class="detalhe-item"><strong>Histórico:</strong><br><pre>${item.historico}</pre></div>
    ${htmlAnexos}
  `;

  getEl('modal-detalhes-envio').classList.add('is-open');
}

// ====================================================================
// FUNÇÃO: salvarRascunhoAutomatico
// Descrição: Salva o estado atual do formulário no LocalStorage.
// ====================================================================
function salvarRascunhoAutomatico() {
  const rascunho = {
    carro: getEl('envio-carro').value,
    local: getEl('envio-local').value,
    motivo: getEl('envio-motivo').value,
    historico: getEl('envio-historico').value,
    anexos: anexosArray,
    dataSalvo: new Date().getTime()
  };
  localStorage.setItem('rascunho_envio', JSON.stringify(rascunho));
}

// ====================================================================
// FUNÇÃO: carregarRascunho
// Descrição: Recupera dados não enviados para evitar retrabalho.
// ====================================================================
function carregarRascunho() {
  const salvo = localStorage.getItem('rascunho_envio');
  if (!salvo) return;

  const r = JSON.parse(salvo);
  getEl('envio-carro').value = r.carro || '';
  getEl('envio-local').value = r.local || '';
  getEl('envio-motivo').value = r.motivo || '';
  getEl('envio-historico').value = r.historico || '';
  anexosArray = r.anexos || [];
  
  if (r.carro) habilitarCamposSecundarios(true);
  atualizarListaAnexos();
}

// ====================================================================
// FUNÇÃO: salvarEnvio
// Descrição: Finaliza e envia o formulário completo para o Google Sheets.
// ====================================================================
function salvarEnvio() {
  const btn = getEl('btn-salvar-envio');
  const dados = {
    carro: getEl('envio-carro').value,
    local: getEl('envio-local').value,
    responsavel: getEl('envio-responsavel').value,
    motivo: getEl('envio-motivo').value,
    historico: getEl('envio-historico').value,
    anexos: anexosArray
  };

  if (!dados.carro || !dados.historico) {
    alert("Campos 'Carro' e 'Histórico' são obrigatórios.");
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Enviando...';

  google.script.run
    .withSuccessHandler(() => {
      alert("Registro enviado com sucesso!");
      localStorage.removeItem('rascunho_envio');
      fecharModalEnvio();
      consultarEnvioInformacoes();
    })
    .withFailureHandler(err => {
      alert("Erro ao salvar: " + err);
      btn.disabled = false;
      btn.textContent = 'Salvar Envio';
    })
    .salvarEnvioInformacao(dados);
}
