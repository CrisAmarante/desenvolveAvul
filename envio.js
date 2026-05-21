// ====================================================================
// GERENCIAMENTO DE ABAS DO MODAL DE OCORRÊNCIAS
// ====================================================================
function switchOcorrenciaTab(event, tabId) {
  if (event) event.preventDefault();
  
  // Alterna botões
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  if (event) event.currentTarget.classList.add('active');
  
  // Alterna contêineres de conteúdo
  document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
  const targetContent = document.getElementById(tabId);
  if (targetContent) targetContent.style.display = 'block';
}

// Inicializadores dinâmicos das tabelas
function addVitimaRow(data = { nome: '', tipo: 'Passageiro', estado: '' }) {
  const tbody = document.querySelector('#table-vitimas tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="form-control vit-nome" value="${data.nome}" required oninput="salvarRascunhoAutomatico()"></td>
    <td>
      <select class="form-control vit-tipo" onchange="salvarRascunhoAutomatico()">
        <option value="Passageiro" ${data.tipo==='Passageiro'?'selected':''}>Passageiro</option>
        <option value="Pedestre" ${data.tipo==='Pedestre'?'selected':''}>Pedestre</option>
        <option value="Condutor Terceiro" ${data.tipo==='Condutor Terceiro'?'selected':''}>Condutor Terceiro</option>
        <option value="Outro" ${data.tipo==='Outro'?'selected':''}>Outro</option>
      </select>
    </td>
    <td><input type="text" class="form-control vit-estado" value="${data.estado}" placeholder="Ex: PS Osasco" oninput="salvarRascunhoAutomatico()"></td>
    <td style="text-align:center;"><button type="button" class="btn-remove-row" onclick="this.closest('tr').remove(); salvarRascunhoAutomatico();" style="background:none; border:none; cursor:pointer;">❌</button></td>
  `;
  tbody.appendChild(tr);
}

function addTerceiroRow(data = { nome: '', veiculo: '', telefone: '' }) {
  const tbody = document.querySelector('#table-terceiros tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="form-control ter-nome" value="${data.nome}" required oninput="salvarRascunhoAutomatico()"></td>
    <td><input type="text" class="form-control ter-veiculo" value="${data.veiculo}" placeholder="Fiat Uno - ABC1D23" required oninput="salvarRascunhoAutomatico()"></td>
    <td><input type="tel" class="form-control ter-fone" value="${data.telefone}" placeholder="(11) 99999-9999" oninput="salvarRascunhoAutomatico()"></td>
    <td style="text-align:center;"><button type="button" class="btn-remove-row" onclick="this.closest('tr').remove(); salvarRascunhoAutomatico();" style="background:none; border:none; cursor:pointer;">❌</button></td>
  `;
  tbody.appendChild(tr);
}

function addTestemunhaRow(data = { nome: '', telefone: '', obs: '' }) {
  const tbody = document.querySelector('#table-testemunhas tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="form-control tes-nome" value="${data.nome}" required oninput="salvarRascunhoAutomatico()"></td>
    <td><input type="tel" class="form-control tes-fone" value="${data.telefone}" placeholder="(11) 99999-9999" oninput="salvarRascunhoAutomatico()"></td>
    <td><input type="text" class="form-control tes-obs" value="${data.obs}" placeholder="Estava no ponto..." oninput="salvarRascunhoAutomatico()"></td>
    <td style="text-align:center;"><button type="button" class="btn-remove-row" onclick="this.closest('tr').remove(); salvarRascunhoAutomatico();" style="background:none; border:none; cursor:pointer;">❌</button></td>
  `;
  tbody.appendChild(tr);
}

// ====================================================================
// BUSCAS AUTOMÁTICAS BASEADAS EM CHAPAS E VEÍCULOS NO BACKEND
// ====================================================================
function buscarMotoristaPorChapa(chapa) {
  if (!chapa) return;
  const campoNome = document.getElementById('oc_nome_motorista');
  campoNome.value = "Buscando operador...";
  
  google.script.run
    .withSuccessHandler(function(nomeObtido) {
      if (nomeObtido) {
        campoNome.value = nomeObtido;
      } else {
        campoNome.value = "Operador não encontrado";
      }
      salvarRascunhoAutomatico();
    })
    .withFailureHandler(function() {
      campoNome.value = "Erro na pesquisa";
    })
    .buscarNomeOperadorPorChapaBackend(chapa);
}

function validarVeiculo(prefixo) {
  if (!prefixo) return;
  const feedback = document.getElementById('feedback-veiculo');
  feedback.textContent = "Validando prefixo...";
  feedback.style.color = "orange";
  
  google.script.run
    .withSuccessHandler(function(placaObtida) {
      if (placaObtida) {
        feedback.textContent = `✅ Veículo Ativo (Placa: ${placaObtida})`;
        feedback.style.color = "green";
      } else {
        feedback.textContent = "⚠️ Prefixo não localizado na frota ativa.";
        feedback.style.color = "red";
      }
    })
    .withFailureHandler(function() {
      feedback.textContent = "Erro ao validar veículo.";
    })
    .validarPrefixoVeiculoBackend(prefixo);
}

// Carregador dinâmico do Combobox de Linhas ao abrir o modal
function carregarLinhasSelect() {
  google.script.run
    .withSuccessHandler(function(listaLinhas) {
      const select = document.getElementById('oc_linha');
      select.innerHTML = '<option value="">Selecione a Linha...</option>';
      listaLinhas.forEach(function(linha) {
        const option = document.createElement('option');
        option.value = linha;
        option.textContent = linha;
        select.appendChild(option);
      });
      // Tenta recuperar rascunho após carregar as linhas
      recuperarRascunhoIncompleto();
    })
    .buscarListaLinhasBackend();
}

// Executar a carga de linhas quando abrir o modal de envio
const originalAbrirModalEnvio = abrirModalEnvio;
abrirModalEnvio = function() {
  originalAbrirModalEnvio();
  carregarLinhasSelect();
};

// ====================================================================
// SISTEMA DE RASCUNHOS / OCORRÊNCIAS INCOMPLETAS (LOCALSTORAGE)
// ====================================================================
function coletarDadosFormularioObjeto() {
  const vitimas = [];
  document.querySelectorAll('#table-vitimas tbody tr').forEach(tr => {
    vitimas.push({
      nome: tr.querySelector('.vit-nome').value,
      tipo: tr.querySelector('.vit-tipo').value,
      estado: tr.querySelector('.vit-estado').value
    });
  });

  const terceiros = [];
  document.querySelectorAll('#table-terceiros tbody tr').forEach(tr => {
    terceiros.push({
      nome: tr.querySelector('.ter-nome').value,
      veiculo: tr.querySelector('.ter-veiculo').value,
      telefone: tr.querySelector('.ter-fone').value
    });
  });

  const testemunhas = [];
  document.querySelectorAll('#table-testemunhas tbody tr').forEach(tr => {
    testemunhas.push({
      nome: tr.querySelector('.tes-nome').value,
      telefone: tr.querySelector('.tes-fone').value,
      obs: tr.querySelector('.tes-obs').value
    });
  });

  return {
    id_ocorrencia: document.getElementById('oc_id_ocorrencia').value || "RASCUNHO-" + Date.now(),
    data_acidente: document.getElementById('oc_data_acidente').value,
    hora_acidente: document.getElementById('oc_hora_acidente').value,
    linha: document.getElementById('oc_linha').value,
    prefixo_veiculo: document.getElementById('oc_prefixo_veiculo').value,
    chapa_motorista: document.getElementById('oc_chapa_motorista').value,
    nome_motorista: document.getElementById('oc_nome_motorista').value,
    local_acidente: document.getElementById('oc_local_acidente').value,
    sentido: document.getElementById('oc_sentido').value,
    boletim_ocorrência: document.getElementById('oc_boletim_ocorrencia').value,
    historico_relato: document.getElementById('envio-historico').value,
    vitimas: vitimas,
    terceiros: terceiros,
    testemunhas: testemunhas
  };
}

function salvarRascunhoAutomatico() {
  const dados = coletarDadosFormularioObjeto();
  localStorage.setItem('pwa_ocorrencia_incompleta', JSON.stringify(dados));
}

function salvarComoIncompletoManual() {
  salvarRascunhoAutomatico();
  alert("📝 Ocorrência salva como rascunho incompleto no dispositivo local!");
  fecharModalEnvio();
}

function recuperarRascunhoIncompleto() {
  const salvo = localStorage.getItem('pwa_ocorrencia_incompleta');
  if (!salvo) return;
  
  if (confirm("Identificamos uma ocorrência não concluída. Deseja recuperar os dados digitados anteriormente?")) {
    const dados = JSON.parse(salvo);
    document.getElementById('oc_id_ocorrencia').value = dados.id_ocorrencia;
    document.getElementById('oc_data_acidente').value = dados.data_acidente;
    document.getElementById('oc_hora_acidente').value = dados.hora_acidente;
    document.getElementById('oc_linha').value = dados.linha;
    document.getElementById('oc_prefixo_veiculo').value = dados.prefixo_veiculo;
    document.getElementById('oc_chapa_motorista').value = dados.chapa_motorista;
    document.getElementById('oc_nome_motorista').value = dados.nome_motorista;
    document.getElementById('oc_local_acidente').value = dados.local_acidente;
    document.getElementById('oc_sentido').value = dados.sentido;
    document.getElementById('oc_boletim_ocorrencia').value = dados.boletim_ocorrência;
    document.getElementById('envio-historico').value = dados.historico_relato;
    
    // Limpa tabelas antes de repovoar
    document.querySelector('#table-vitimas tbody').innerHTML = "";
    document.querySelector('#table-terceiros tbody').innerHTML = "";
    document.querySelector('#table-testemunhas tbody').innerHTML = "";
    
    if (dados.vitimas) dados.vitimas.forEach(v => addVitimaRow(v));
    if (dados.terceiros) dados.terceiros.forEach(t => addTerceiroRow(t));
    if (dados.testemunhas) dados.testemunhas.forEach(t => addTestemunhaRow(t));
    
    validarVeiculo(dados.prefixo_veiculo);
  }
}

// ====================================================================
// TRANSMISSÃO FINAL CONSOLIDADA PARA O PLANILHÃO DO GOOGLE SHEETS
// ====================================================================
function salvarOcorrenciaCompleta(event) {
  event.preventDefault();
  
  const dados = coletarDadosFormularioObjeto();
  
  // Captura o usuário logado no sistema da Prancheta Eletrônica
  dados.fiscal_responsavel = obterUsuarioLogadoSistema(); 
  
  // Insere a coleção de anexos em Base64 que a rotina nativa de compressão gerou em tempo real
  dados.anexos = anexosArray; 

  if (typeof showLoading === 'function') showLoading("Transmitindo ocorrência e enviando mídias comprimidas...");

  google.script.run
    .withSuccessHandler(function(sucesso) {
      if (typeof hideLoading === 'function') hideLoading();
      alert("🚀 Perfeito! Ocorrência enviada e consolidada com sucesso no Banco de Dados!");
      localStorage.removeItem('pwa_ocorrencia_incompleta'); // Limpa rascunho pós-envio com sucesso
      fecharModalEnvio();
    })
    .withFailureHandler(function(erro) {
      if (typeof hideLoading === 'function') hideLoading();
      alert("❌ Falha na sincronização com o banco do Google Sheets: " + erro.message);
    })
    .gravarOcorrenciaCompletaBackend(dados);
}

// Função auxiliar genérica para extrair dados da sessão ativa de login do usuário logado
function obterUsuarioLogadoSistema() {
  const usuarioSpan = document.getElementById('usuario-nome') || document.getElementById('fiscal-nome');
  return usuarioSpan ? usuarioSpan.textContent || usuarioSpan.value : "FISCAL ONLINE";
}
