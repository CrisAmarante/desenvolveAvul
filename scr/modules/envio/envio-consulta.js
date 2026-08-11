/**
 * Módulo de Envio de Informações - Parte 4
 * Consulta, detalhes, exportação PDF e notificações
 */

// ====================================================================
// CONSULTAS DE ENVIOS - COM ENVIO DO PAPEL AO BACKEND
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
  
  // Obtém papel e apelido do usuário logado
  const role = window.currentUserRole || localStorage.getItem('inspectorRole') || '';
  const apelido = localStorage.getItem('inspectorApelido') || localStorage.getItem('inspectorName') || '';
  
  // Envia o papel e o apelido para o backend aplicar as regras de permissão
  params.append('papel', role);
  params.append('apelido', apelido);
  
  return _executarConsultaEnvios(params);
}

function _executarConsultaEnvios(params) {
  return new Promise((resolve, reject) => {
    const url = `${URL_PLANILHA}?${params.toString()}`;
    console.log('📂 Consultando URL (fetch):', url);
    
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
    

    // FILTRO PARA SAF/ENCARREGADO: Adiciona notificações apenas para envios destinados a eles
    const role = window.currentUserRole || localStorage.getItem('inspectorRole') || '';
    const perfisFiltramNotificacoes = ['SAF', 'ENCARREGADO'];
    
    if (perfisFiltramNotificacoes.includes(role)) {
      // Filtra apenas envios destinados ao perfil do usuário
      const areaDestinoEsperada = role === 'SAF' ? 'SAF' : null; // Encarregado pode ver todos
      
      dados.forEach((envio, idx) => {
        // Verifica se o envio é destinado a este perfil
        const areaEnvio = envio.areaDestino || '';
        const deveAdicionarNotificacao = areaDestinoEsperada 
          ? areaEnvio === areaDestinoEsperada 
          : true; // Encarregado vê todos
        
        if (deveAdicionarNotificacao && envio.id) {
          adicionarNotificacaoNaoLida(envio);
        }
      });
      
      // Atualiza painel após processar
      atualizarPainelNotificacoes();
    }
    let html = '';
    dados.forEach((envio, idx) => {
      // Exibe o responsável (apelido) acima do motivo
      html += `
        <div class="envio-item" data-idx="${idx}" style="cursor: pointer;">
          <strong>👤 RESPONSÁVEL: ${envio.fiscal || 'N/I'}</strong><br>
          <strong>MOTIVO: ${envio.motivo || 'N/I'}</strong><br>
          CARRO: ${envio.carro || 'N/I'} | DATA: ${formatarData(envio.data)} | MOTORISTA: ${envio.motorista || 'N/I'}
        </div>
      `;
    });
    container.innerHTML = html;
    
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
// MOSTRAR DETALHES DO ENVIO
// ====================================================================
function mostrarDetalheEnvio(envio) {
  const modal = getEl('modal-detalhe-envio');
  const container = getEl('detalhe-envio-conteudo');
  if (!modal || !container) return;

  const horaFormatada = formatarHora(envio.hora);
  const dataFormatada = formatarData(envio.data);

  let anexosHtml = 'Nenhum anexo';
  // Usa anexosDetalhados se disponível (novo formato do backend), senão usa o método antigo
  if (envio.anexosDetalhados && Array.isArray(envio.anexosDetalhados) && envio.anexosDetalhados.length > 0) {
    const anexosProcessados = envio.anexosDetalhados.map(anexo => processarLinkAnexoDetalhado(anexo));
    anexosHtml = `<div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px;">${anexosProcessados.join('')}</div>`;
  } else if (envio.anexo && envio.anexo !== 'Nenhum' && envio.anexo.trim() !== '') {
    const links = envio.anexo.split(' ; ');
    const anexosProcessados = links.map(link => processarLinkAnexo(link));
    anexosHtml = `<div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px;">${anexosProcessados.join('')}</div>`;
  }

  const infoFixaHtml = `
    <div class="info-fixa">
      <div><strong>MOTIVO:</strong> ${envio.motivo || 'N/I'}</div>
      <div><strong>CARRO:</strong> ${envio.carro || 'N/I'}</div>
      <div><strong>HORA:</strong> ${horaFormatada} <strong>| COB.:</strong> ${envio.cobrador || 'N/I'} <strong>| SENT.:</strong> ${envio.sentido || 'N/I'}</div>
      <div><strong>MOTORISTA:</strong> ${envio.motorista || 'N/I'}</div>
      <div><strong>LINHA:</strong> ${envio.linha || 'N/I'}</div>
      <div><strong>LOCAL:</strong> ${envio.local || 'N/I'} <strong>| DATA:</strong> ${dataFormatada}</div>
      <div><strong>RESPONSÁVEL:</strong> ${envio.fiscal || 'N/I'}</div>
      ${envio.dataPreenchimento ? `<div><strong>DATA PREENCHIMENTO:</strong> ${envio.dataPreenchimento}</div>` : ''}
    </div>
  `;

  const areaRolavelHtml = `
    <div class="area-rolavel" style="overflow-y: auto; max-height: 300px;">
      <div><strong>HISTÓRICO:</strong></div>
      <div style="background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; margin: 8px 0 16px 0; white-space: pre-wrap;">${(envio.historico || 'N/I').replace(/\n/g, '<br>')}</div>
      <div><strong>ANEXOS:</strong></div>
      <div>${anexosHtml}</div>
    </div>
  `;

  const rodapeHtml = `
    <div class="modal-footer">
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <button id="btn-gerar-pdf" class="btn-principal">📄 Gerar PDF (Modelo Oficial)</button>
        <button id="btn-copiar-completo" class="btn-secundario">📋 Copiar Texto Completo</button>
        <button id="btn-copiar-historico" class="btn-secundario">📋 Copiar apenas o Histórico</button>
      </div>
    </div>
  `;

  container.innerHTML = infoFixaHtml + areaRolavelHtml + rodapeHtml;
  modal.classList.add('is-open');

  setTimeout(() => {
    const btnPDF = document.getElementById('btn-gerar-pdf');
    const btnCompleto = document.getElementById('btn-copiar-completo');
    const btnHistorico = document.getElementById('btn-copiar-historico');

    if (btnPDF) {
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
// PROCESSAR LINK DO ANEXO (THUMBNAIL)
// ====================================================================
function processarLinkAnexoDetalhado(anexo) {
  // anexo tem: urlOriginal, urlDownload, urlVisualizacao, fileId
  if (!anexo || !anexo.urlOriginal) return '';
  
  const downloadUrl = anexo.urlDownload || anexo.urlOriginal;
  const viewUrl = anexo.urlVisualizacao || anexo.urlOriginal;
  const fileId = anexo.fileId;
  
  if (fileId) {
    const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w300`;
    
    return `
      <div style="display: inline-block; margin: 5px; text-align: center; vertical-align: top; width: 130px;">
        <a href="${viewUrl}" target="_blank" style="text-decoration: none;">
          <img src="${thumbnailUrl}" 
               alt="Pré-visualização" 
               style="max-width: 120px; max-height: 120px; border-radius: 8px; border: 1px solid #ccc; cursor: pointer; background: #f0f0f0; object-fit: cover;"
               onerror="this.onerror=null; this.parentElement.parentElement.innerHTML='<a href=\\'${downloadUrl}\\' target=\\'_blank\\' style=\\'color:#10b981; text-decoration:underline;\\'>📎 Anexo (imagem não disponível)</a>'">
        </a>
        <div style="margin-top: 5px;">
          <small><a href="${downloadUrl}" target="_blank" download style="color: #10b981; font-weight: bold;">⬇️ Baixar</a></small>
        </div>
        <div><small><a href="${viewUrl}" target="_blank" style="color: #6b7280;">👁️ Visualizar</a></small></div>
      </div>
    `;
  }

  return `
    <div style="margin: 5px; text-align: center;">
      <a href="${downloadUrl}" target="_blank" download style="color: #10b981; text-decoration: underline; font-weight: bold;">⬇️ Baixar Anexo</a>
      <br>
      <small><a href="${viewUrl}" target="_blank" style="color: #6b7280;">👁️ Visualizar</a></small>
    </div>
  `;
}

function processarLinkAnexo(link) {
  link = link.trim();
  if (!link) return '';

  let fileId = null;
  const patterns = [
    /\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /file\/d\/([a-zA-Z0-9_-]+)/,
    /uc\?id=([a-zA-Z0-9_-]+)/,
    /open\?id=([a-zA-Z0-9_-]+)/,
    /\/u\/\d\/d\/([a-zA-Z0-9_-]+)/
  ];
  
  for (const pattern of patterns) {
    const match = link.match(pattern);
    if (match && match[1]) {
      fileId = match[1];
      break;
    }
  }

  if (fileId) {
    const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w300`;
    const originalUrl = `https://drive.google.com/uc?id=${fileId}`;
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    
    return `
      <div style="display: inline-block; margin: 5px; text-align: center; vertical-align: top; width: 130px;">
        <a href="${originalUrl}" target="_blank" style="text-decoration: none;">
          <img src="${thumbnailUrl}" 
               alt="Pré-visualização" 
               style="max-width: 120px; max-height: 120px; border-radius: 8px; border: 1px solid #ccc; cursor: pointer; background: #f0f0f0; object-fit: cover;"
               onerror="this.onerror=null; this.parentElement.parentElement.innerHTML='<a href=\\'${downloadUrl}\\' target=\\'_blank\\' style=\\'color:#10b981; text-decoration:underline;\\'>📎 Anexo (imagem não disponível)</a>'">
        </a>
        <div style="margin-top: 5px;">
          <small><a href="${downloadUrl}" target="_blank" download style="color: #10b981; font-weight: bold;">⬇️ Baixar</a></small>
        </div>
        <div><small><a href="${originalUrl}" target="_blank" style="color: #6b7280;">👁️ Visualizar</a></small></div>
      </div>
    `;
  }

  return `<div style="margin: 5px;"><a href="${link}" target="_blank" style="color: #10b981; text-decoration: underline;">📎 Anexo</a></div>`;
}

// ====================================================================
// EXPORTAÇÃO PARA PDF
// ====================================================================
function limitarHistorico(texto, limiteCaracteres = 1400, limiteLinhas = 16) {
  if (!texto) return { texto: '', foiTruncado: false };
  
  let textoFinal = texto;
  let motivoTruncamento = '';
  
  if (textoFinal.length > limiteCaracteres) {
    let textoTruncado = textoFinal.substring(0, limiteCaracteres);
    const ultimoEspaco = textoTruncado.lastIndexOf(' ');
    if (ultimoEspaco > 0) {
      textoTruncado = textoTruncado.substring(0, ultimoEspaco);
    }
    textoFinal = textoTruncado;
    motivoTruncamento = `Limite de ${limiteCaracteres} caracteres`;
  }
  
  const linhas = textoFinal.split(/\r?\n/);
  if (linhas.length > limiteLinhas) {
    const linhasTruncadas = linhas.slice(0, limiteLinhas);
    textoFinal = linhasTruncadas.join('\n');
    motivoTruncamento = motivoTruncamento 
      ? `${motivoTruncamento} e ${limiteLinhas} linhas`
      : `Limite de ${limiteLinhas} linhas`;
  }
  
  const foiTruncado = textoFinal.length !== texto.length || textoFinal.split(/\r?\n/).length !== linhas.length;
  
  if (foiTruncado) {
    textoFinal = textoFinal + `\n\n[... TEXTO TRUNCADO - ${motivoTruncamento}]`;
  }
  
  return { texto: textoFinal, foiTruncado: foiTruncado, textoOriginal: texto };
}

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

    const historicoOriginal = (envio.historico || "").trim() || "Sem informações adicionais.";
    const { texto: historicoLimitado, foiTruncado } = limitarHistorico(historicoOriginal, 1400, 16);
    
    const linhas = doc.splitTextToSize(historicoLimitado, pageWidth - margin * 2);
    
    const alturaRestante = doc.internal.pageSize.getHeight() - y - 40;
    if (linhas.length * 7.5 > alturaRestante) {
      doc.addPage();
      y = 22;
    }
    
    linhas.forEach(linha => {
      if (y > doc.internal.pageSize.getHeight() - 25) {
        doc.addPage();
        y = 22;
      }
      doc.text(linha, margin, y);
      y += 7.5;
    });

    if (foiTruncado) {
      y += 5;
      doc.setFontSize(9);
      doc.setTextColor(150, 100, 0);
      doc.text("⚠️ ATENÇÃO: Este histórico foi truncado para fins de impressão.", margin, y);
      doc.setTextColor(0);
    }

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

    if (y > doc.internal.pageSize.getHeight() - 35) {
      doc.addPage();
      y = 22;
    }

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

    // Adiciona data de preenchimento abaixo do hash e detalhes da exportação
    if (envio.dataPreenchimento) {
      y += 8;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`Data Preenchimento: ${envio.dataPreenchimento}`, margin, y);
    }

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
  if (envio.dataPreenchimento) {
    texto += `DATA PREENCHIMENTO: ${envio.dataPreenchimento}\n`;
  }
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
// MICROFONE - RECONHECIMENTO DE VOZ
// ====================================================================
let reconhecimentoVoz = null;

function iniciarReconhecimentoVoz() {
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
  if (texto && texto.length > 0) {
    texto = texto.charAt(0).toUpperCase() + texto.slice(1);
  }
  const historicoField = getEl('envio-historico');
  if (historicoField) {
    const textoAtual = historicoField.value;
    let novoTexto;
    if (textoAtual.trim() === '') {
      novoTexto = texto;
    } else {
      novoTexto = textoAtual + '\n' + texto;
    }
    
    const MAX_CARACTERES = 1400;
    const MAX_LINHAS = 16;
    const linhas = novoTexto.split(/\r?\n/).length;
    
    if (novoTexto.length > MAX_CARACTERES) {
      alert(`Limite de ${MAX_CARACTERES} caracteres atingido. Texto não adicionado.`);
      return;
    }
    
    if (linhas > MAX_LINHAS) {
      alert(`Limite de ${MAX_LINHAS} linhas atingido. Texto não adicionado.`);
      return;
    }
    
    historicoField.value = novoTexto;
    historicoField.dispatchEvent(new Event('input'));
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
// SISTEMA DE NOTIFICAÇÕES "LIDOS/NÃO LIDOS" (localStorage)
// Para perfis SAF e Encarregado
// ====================================================================

const STORAGE_KEY_NOTIFICACOES = 'penso_notificacoes_nao_lidas';

/**
 * Adiciona uma notificação ao localStorage
 * @param {Object} envio - Objeto do envio recebido da API
 */
function adicionarNotificacaoNaoLida(envio) {
  if (!envio || !envio.id) return;
  
  const notificacoes = getNotificacoesNaoLidas();
  
  // Verifica se já existe
  const existe = notificacoes.some(n => n.id === envio.id);
  if (existe) return;
  
  const novaNotificacao = {
    id: envio.id,
    motivo: envio.motivo || 'N/I',
    fiscal: envio.fiscal || 'N/I',
    carro: envio.carro || 'N/I',
    data: envio.data || '',
    timestamp: Date.now()
  };
  
  notificacoes.push(novaNotificacao);
  localStorage.setItem(STORAGE_KEY_NOTIFICACOES, JSON.stringify(notificacoes));
  atualizarPainelNotificacoes();
}

/**
 * Obtém todas as notificações não lidas do localStorage
 * @returns {Array} Array de notificações
 */
function getNotificacoesNaoLidas() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_NOTIFICACOES);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Erro ao ler notificações:', e);
    return [];
  }
}

/**
 * Marca uma notificação como lida
 * @param {string} id - ID do envio/notificação
 */
function marcarComoLida(id) {
  const notificacoes = getNotificacoesNaoLidas();
  const filtradas = notificacoes.filter(n => n.id !== id);
  localStorage.setItem(STORAGE_KEY_NOTIFICACOES, JSON.stringify(filtradas));
  atualizarPainelNotificacoes();
}

/**
 * Marca todas as notificações como lidas
 */
function marcarTodosComoLidos() {
  localStorage.removeItem(STORAGE_KEY_NOTIFICACOES);
  atualizarPainelNotificacoes();
}

/**
 * Atualiza o painel lateral de notificações na tela
 */
function atualizarPainelNotificacoes() {
  const painel = document.getElementById('painel-notificacoes');
  const lista = document.getElementById('lista-notificacoes');
  const contador = document.getElementById('contador-nao-lidos');
  
  if (!painel || !lista || !contador) return;
  
  const notificacoes = getNotificacoesNaoLidas();
  const naoLidasCount = notificacoes.length;
  
  // Atualiza contador
  contador.textContent = naoLidasCount;
  
  // Mostra/esconde painel baseado no perfil e se há notificações
  const role = window.currentUserRole || localStorage.getItem('inspectorRole') || '';
  const perfisComPainel = ['SAF', 'ENCARREGADO'];
  
  if (perfisComPainel.includes(role) && naoLidasCount > 0) {
    painel.classList.add('visivel');
  } else {
    painel.classList.remove('visivel');
  }
  
  // Renderiza lista
  if (naoLidasCount === 0) {
    lista.innerHTML = '<p class="sem-notificacoes">Nenhuma notificação não lida</p>';
  } else {
    lista.innerHTML = notificacoes.map(notif => `
      <div class="notificacao-item" onclick="clicarNotificacao('${notif.id}')">
        <div class="notificacao-motivo">${notif.motivo}</div>
        <div class="notificacao-detalhes">
          👤 ${notif.fiscal} | 🚗 ${notif.carro}<br>
          📅 ${formatarData(notif.data)}
        </div>
      </div>
    `).join('');
  }
}

/**
 * Handler para clique em notificação
 * @param {string} id - ID do envio
 */
function clicarNotificacao(id) {
  // Marca como lida
  marcarComoLida(id);
  
  // Abre modal de detalhes do envio
  consultarEnviosPorId(id);
}

/**
 * Consulta um envio específico por ID e mostra detalhes
 * @param {string} id - ID do envio
 */
function consultarEnviosPorId(id) {
  const params = new URLSearchParams();
  params.append('acao', 'consultar_envio_por_id');
  params.append('id', id);
  
  const url = `${URL_PLANILHA}?${params.toString()}`;
  
  fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } })
    .then(response => response.json())
    .then(envio => {
      if (envio && !envio.erro) {
        mostrarDetalheEnvio(envio);
      } else {
        alert('Não foi possível carregar os detalhes deste envio.');
      }
    })
    .catch(err => {
      console.error('Erro ao consultar envio por ID:', err);
      alert('Erro de conexão. Tente novamente.');
    });
}

/**
 * Verifica e atualiza notificações ao carregar a página
 */
function verificarNotificacoesAoIniciar() {
  const role = window.currentUserRole || localStorage.getItem('inspectorRole') || '';
  const perfisComPainel = ['SAF', 'ENCARREGADO'];
  
  if (perfisComPainel.includes(role)) {
    atualizarPainelNotificacoes();
  }
}

// Exporta funções para o escopo global
window.consultarEnvios = consultarEnvios;
window.consultarEnviosComFiltro = consultarEnviosComFiltro;
window.mostrarListaEnvios = mostrarListaEnvios;
window.mostrarDetalheEnvio = mostrarDetalheEnvio;
window.processarLinkAnexoDetalhado = processarLinkAnexoDetalhado;
window.processarLinkAnexo = processarLinkAnexo;
window.limitarHistorico = limitarHistorico;
window.exportarParaPDF = exportarParaPDF;
window.formatarData = formatarData;
window.formatarHora = formatarHora;
window.gerarHashValidacao = gerarHashValidacao;
window.copiarParaAreaDeTransferencia = copiarParaAreaDeTransferencia;
window.gerarTextoDetalheEnvio = gerarTextoDetalheEnvio;
window.fecharModalDetalheEnvio = fecharModalDetalheEnvio;
window.fecharModalListaEnvios = fecharModalListaEnvios;
window.iniciarReconhecimentoVoz = iniciarReconhecimentoVoz;
window.adicionarNotificacaoNaoLida = adicionarNotificacaoNaoLida;
window.getNotificacoesNaoLidas = getNotificacoesNaoLidas;
window.marcarComoLida = marcarComoLida;
window.marcarTodosComoLidos = marcarTodosComoLidos;
window.atualizarPainelNotificacoes = atualizarPainelNotificacoes;
window.clicarNotificacao = clicarNotificacao;
window.consultarEnviosPorId = consultarEnviosPorId;
window.verificarNotificacoesAoIniciar = verificarNotificacoesAoIniciar;
