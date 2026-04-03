// ====================================================================
// ENVIO DE INFORMAÇÕES (com fluxo obrigatório)
// ====================================================================
let rascunhoAtualId = null;
let enviosLista = [];

function abrirModalEnvio() {
  const m = getEl('modal-envio-informacoes');
  if (m) m.classList.add('is-open');
  preencherDataAtual();
  preencherResponsavel();
  preencherSelectLocal();
  carregarRascunho();
  // Desabilita campos até área selecionada
  habilitarCamposSecundarios(false);
}
function fecharModalEnvio() { const m = getEl('modal-envio-informacoes'); if (m) m.classList.remove('is-open'); }
function preencherDataAtual() { 
  const d = getEl('envio-data'); 
  if (d && !d.value) {
    const hoje = new Date().toISOString().split('T')[0];
    d.value = hoje;
    d.max = hoje; // não permite data futura
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
  
  // Habilita os campos secundários apenas se área foi selecionada
  if (areaSelecionada) {
    habilitarCamposSecundarios(true);
  } else {
    habilitarCamposSecundarios(false);
  }
  
  // Regras de motivos por área
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
    // Restaurar área de destino
    const areaOriginal = dados.areaDestino;
    const areasPermitidas = ['FISCALIZAÇÃO', 'SAF', 'PLANTÃO'];
    if (areasPermitidas.includes(areaOriginal)) {
      document.querySelector(`input[name="areaDestino"][value="${areaOriginal}"]`).checked = true;
    } else {
      document.querySelector(`input[name="areaDestino"][value="OUTRAS ÁREAS"]`).checked = true;
      getEl('envio-outras-area').value = areaOriginal;
      getEl('campo-outras-area').style.display = 'block';
    }
    // Restaurar motivo
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
function limparFormularioEnvio() {
  document.querySelectorAll('input[name="areaDestino"], input[name="motivo"]').forEach(r => r.checked = false);
  getEl('envio-outras-area').value = '';
  getEl('campo-outras-area').style.display = 'none';
  getEl('envio-outros-motivo').value = '';
  getEl('campo-outros-motivo').style.display = 'none';
  getEl('envio-carro').value = ''; getEl('envio-linha').value = ''; getEl('envio-motorista').value = ''; getEl('envio-cobrador').value = '';
  getEl('envio-hora').value = ''; getEl('envio-sentido').value = ''; getEl('envio-historico').value = ''; getEl('envio-local').value = '';
  preencherDataAtual();
  rascunhoAtualId = null;
  habilitarCamposSecundarios(false);
  habilitarCamposAvarias(true);
}
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
    anexo: localStorage.getItem('anexoAtual') || '',
    fiscal: localStorage.getItem('inspectorApelido') || localStorage.getItem('inspectorName')
  };
  if (confirm('Enviar relatório? Os dados serão salvos na planilha.')) {
    fetch(URL_PLANILHA, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ acao: 'envio_informacoes', dados: JSON.stringify(dadosEnvio) }) })
      .then(() => { alert('Relatório enviado!'); if (rascunhoAtualId) localStorage.removeItem(`rascunho_${rascunhoAtualId}`); limparFormularioEnvio(); fecharModalEnvio(); })
      .catch(() => alert('Erro ao enviar.'));
  }
}
function anexarArquivo() {
  alert('Funcionalidade de anexo será ativada em breve.');
}
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
      <div><strong>ANEXO:</strong> ${envio.anexo ? `<a href="${envio.anexo}" target="_blank">Ver anexo</a>` : 'Nenhum'}</div>
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
