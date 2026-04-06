// ====================================================================
// CONFIGURAÇÕES GERAIS
// ====================================================================

const DATA_INICIO_BANNER = new Date('2026-07-10T00:00:00');
const DATA_FIM_BANNER    = new Date('2026-07-21T00:01:00');

const disableDates = {
  'btn-osasco': new Date('2026-07-19'),
  'btn-santana': new Date('2026-07-03')
};

// ====================================================================
// INICIALIZAÇÃO
// ====================================================================
function initModals() {
  window.modals = {
    login: new ModalController('modal-login'),
    clandestinosRto: new ModalController('modal-clandestinos-rto'),
    levantamentos: new ModalController('modal-levantamentos'),
    inspecoes5s: new ModalController('modal-inspecoes-5s')
  };
  window.modals.inspecaoVeicular = new InspecaoVeicular();
}
function initEventListeners() {
  getEl('btn-segunda-tela')?.addEventListener('click', (e) => { e.preventDefault(); getEl('login-error').style.display = 'none'; getEl('password').value = ''; window.modals.login.open(); });
  const loginForm = getEl('login-form'); if (loginForm) { loginForm.removeEventListener('submit', login); loginForm.addEventListener('submit', login); }
  getEl('btn-clandestinos-rto')?.addEventListener('click', (e) => { e.preventDefault(); window.modals.clandestinosRto.open(); });
  getEl('btn-levantamentos')?.addEventListener('click', (e) => { e.preventDefault(); window.modals.levantamentos.open(); });
  getEl('btn-inspecoes-5s')?.addEventListener('click', (e) => { e.preventDefault(); window.modals.inspecoes5s.open(); });
  getEl('btn-fechar-banner')?.addEventListener('click', fecharBanner);
  getEl('btn-envio-informacoes')?.addEventListener('click', (e) => { e.preventDefault(); abrirModalEnvio(); });
  getEl('btn-salvar-rascunho')?.addEventListener('click', salvarRascunho);
  getEl('btn-enviar-relatorio')?.addEventListener('click', enviarRelatorio);
  getEl('btn-consultar-envios')?.addEventListener('click', consultarEnvios);
  document.querySelectorAll('input[name="areaDestino"]').forEach(radio => radio.addEventListener('change', aplicarRegrasPorArea));
  document.querySelectorAll('input[name="motivo"]').forEach(radio => radio.addEventListener('change', aplicarRegrasPorMotivo));

  // Painel de filtros para envios
  const modalLista = getEl('modal-lista-envios');
  if (modalLista && !document.getElementById('filtros-envio')) {
    const content = modalLista.querySelector('.modal-content');
    const filtrosDiv = document.createElement('div');
    filtrosDiv.id = 'filtros-envio';
    filtrosDiv.style.marginBottom = '15px';
    filtrosDiv.style.padding = '10px';
    filtrosDiv.style.background = 'var(--card-bg)';
    filtrosDiv.style.borderRadius = '8px';
    const role = currentUserRole;
    const maxDias = role === 'FISCAL' ? 15 : (role === 'ENCARREGADO' || role === 'INSPETOR' || role === 'PLANTONISTA') ? 30 : (role === 'SAF' ? 180 : 0);
    const maxDiasTexto = maxDias ? ` (máx ${maxDias} dias)` : ' (ilimitado)';
    filtrosDiv.innerHTML = `
      <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end;">
        <div><label>Data Início</label><input type="date" id="filtro-envio-data-inicio"></div>
        <div><label>Data Fim${maxDiasTexto}</label><input type="date" id="filtro-envio-data-fim"></div>
        <div><label>Motivo</label><select id="filtro-envio-motivo"><option value="">Todos</option><option value="AVARIAS">AVARIAS</option><option value="PEDIDO DE FOLGAS">PEDIDO DE FOLGAS</option><option value="SOLICITAÇÃO DE MATERIAIS">SOLICITAÇÃO DE MATERIAIS</option><option value="OUTROS">OUTROS</option></select></div>
        <div><label>Carro</label><input type="text" id="filtro-envio-carro" placeholder="Placa/Identificação"></div>
        ${role !== 'FISCAL' ? `<div><label>Fiscal</label><input type="text" id="filtro-envio-fiscal" placeholder="Apelido"></div>` : ''}
        <div><button id="btn-aplicar-filtros-envio" class="btn-secundario">🔍 Aplicar</button></div>
        <div><button id="btn-limpar-filtros-envio" class="btn-secundario">🗑️ Limpar</button></div>
      </div>
    `;
    const header = content.querySelector('.modal-header');
    if (header) header.insertAdjacentElement('afterend', filtrosDiv);
    else content.insertBefore(filtrosDiv, content.firstChild);
    document.getElementById('btn-aplicar-filtros-envio').addEventListener('click', () => {
      const dataInicio = document.getElementById('filtro-envio-data-inicio').value;
      let dataFim = document.getElementById('filtro-envio-data-fim').value;
      const motivo = document.getElementById('filtro-envio-motivo').value;
      const carro = document.getElementById('filtro-envio-carro').value;
      const fiscalFiltro = role !== 'FISCAL' ? document.getElementById('filtro-envio-fiscal').value : null;
      if (maxDias > 0 && dataInicio && dataFim) {
        const diff = (new Date(dataFim) - new Date(dataInicio)) / (1000 * 60 * 60 * 24);
        if (diff > maxDias) { alert(`Período máximo de ${maxDias} dias. Ajuste as datas.`); return; }
      }
      consultarEnviosComFiltro(dataInicio, dataFim, motivo, carro, fiscalFiltro);
    });
    document.getElementById('btn-limpar-filtros-envio').addEventListener('click', () => {
      document.getElementById('filtro-envio-data-inicio').value = '';
      document.getElementById('filtro-envio-data-fim').value = '';
      document.getElementById('filtro-envio-motivo').value = '';
      document.getElementById('filtro-envio-carro').value = '';
      if (role !== 'FISCAL') document.getElementById('filtro-envio-fiscal').value = '';
      consultarEnvios();
    });
  }
}
function applyTheme(theme) { if (theme === "dark") { document.body.classList.add("dark"); getEl('theme-toggle').innerHTML = "☀️"; } else { document.body.classList.remove("dark"); getEl('theme-toggle').innerHTML = "🌙"; } }
function initTheme() { const tt = getEl('theme-toggle'); if (!tt) return; const saved = localStorage.getItem("theme") || "light"; applyTheme(saved); tt.addEventListener("click", () => { const cur = localStorage.getItem("theme") === "dark" ? "light" : "dark"; localStorage.setItem("theme", cur); applyTheme(cur); }); }
function registerServiceWorker() { if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').then(r => console.log('SW registrado:', r.scope)).catch(e => console.error('Falha no SW:', e)); }
async function inicializar() {
  initModals(); initEventListeners(); initTheme(); registerServiceWorker();
  
  checkLoginStatus(); // Tiramos o await refreshInspetores() daqui
  mostrarBannerAviso(); 
  aplicarBloqueioDeDatas();
  
  carregarTerminais().then(() => preencherSelectTerminais());
  
  window.addEventListener('pageshow', async (e) => { 
    if (e.persisted) { 
      checkLoginStatus(); 
      await carregarTerminais(true); 
      preencherSelectTerminais(); 
    } 
  });
  
  document.addEventListener('visibilitychange', async () => { 
    if (document.visibilityState === 'visible') { 
      checkLoginStatus(); 
      await carregarTerminais(true); 
      preencherSelectTerminais(); 
    } 
  });
}
window.addEventListener('load', inicializar);
