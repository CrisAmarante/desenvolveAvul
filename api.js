let INSPETORES = {};
let refreshPromise = null;
let terminaisCache = [];
let terminaisTimestamp = 0;
const TERMINAIS_CACHE_DURACAO = 30 * 60 * 1000; // 30 minutos
let terminaisPromise = null;
let todosTerminaisCache = [];
let todosTerminaisPromise = null;
// ====================================================================
// LOG
// ====================================================================
async function registrarLog(nomeApelido) {
  try {
    const formData = new URLSearchParams();
    formData.append("nome", nomeApelido);
    formData.append("acao", "Login bem-sucedido");
    await fetch(URL_PLANILHA, { method: "POST", body: formData, mode: "no-cors" });
  } catch (err) { console.warn("Falha ao registrar log:", err); }
}
// ====================================================================
// CARREGAR INSPETORES
// ====================================================================
function processarDadosPlanilha(dados) {
  if (Array.isArray(dados)) {
    const novoObjeto = {};
    dados.forEach(row => {
      if (row.apelido && row.hash && row.ativo === "SIM") {
        novoObjeto[row.apelido] = { hash: row.hash, nome: row.nome, funcao: row.funcao };
      }
    });
    INSPETORES = novoObjeto;
  } else { INSPETORES = dados || {}; }
}
async function refreshInspetores() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = new Promise((resolve, reject) => {
    const callbackName = 'processarDadosPlanilha_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    window[callbackName] = function(dados) {
      processarDadosPlanilha(dados);
      delete window[callbackName];
      refreshPromise = null;
      resolve();
    };
    const script = document.createElement('script');
    script.src = `${URL_PLANILHA}?callback=${callbackName}&_=${Date.now()}`;
    script.onerror = () => { delete window[callbackName]; refreshPromise = null; reject(); };
    document.body.appendChild(script);
  });
  return refreshPromise;
}
// ====================================================================
// TERMINAIS (apenas SIM) com cache
// ====================================================================
function carregarTerminais(forceRefresh = false) {
  const agora = Date.now();
  if (!forceRefresh && terminaisCache.length && (agora - terminaisTimestamp < TERMINAIS_CACHE_DURACAO)) {
    return Promise.resolve(terminaisCache);
  }
  if (terminaisPromise) return terminaisPromise;
  terminaisPromise = new Promise((resolve) => {
    const callbackName = 'carregarTerminaisCallback_' + Date.now();
    window[callbackName] = function(terminais) {
      terminaisCache = terminais;
      terminaisTimestamp = Date.now();
      delete window[callbackName];
      terminaisPromise = null;
      resolve(terminais);
    };
    const script = document.createElement('script');
    script.src = `${URL_PLANILHA}?acao=terminais&callback=${callbackName}&_=${Date.now()}`;
    script.onerror = () => {
      delete window[callbackName];
      terminaisPromise = null;
      terminaisCache = ['Terminal A', 'Terminal B', 'Terminal C', 'Terminal D'];
      terminaisTimestamp = Date.now();
      resolve(terminaisCache);
    };
    document.body.appendChild(script);
  });
  return terminaisPromise;
}
function preencherSelectTerminais() {
  const select = getEl('terminal');
  if (!select) return;
  carregarTerminais().then(terminais => {
    const valorAtual = select.value;
    select.innerHTML = '<option value="">Selecione...</option>';
    terminais.forEach(t => { const opt = document.createElement('option'); opt.value = t; opt.textContent = t; select.appendChild(opt); });
    if (valorAtual && terminais.includes(valorAtual)) select.value = valorAtual;
  });
}
// ====================================================================
// TERMINAIS (todos, para local no envio)
// ====================================================================
function carregarTodosTerminais(forceRefresh = false) {
  if (!forceRefresh && todosTerminaisCache.length) return Promise.resolve(todosTerminaisCache);
  if (todosTerminaisPromise) return todosTerminaisPromise;
  todosTerminaisPromise = new Promise((resolve) => {
    const callbackName = 'carregarTodosTerminaisCallback_' + Date.now();
    window[callbackName] = function(terminais) {
      todosTerminaisCache = terminais;
      delete window[callbackName];
      todosTerminaisPromise = null;
      resolve(terminais);
    };
    const script = document.createElement('script');
    script.src = `${URL_PLANILHA}?acao=terminais_todos&callback=${callbackName}&_=${Date.now()}`;
    script.onerror = () => {
      delete window[callbackName];
      todosTerminaisPromise = null;
      todosTerminaisCache = ['Terminal A', 'Terminal B', 'Terminal C', 'Terminal D'];
      resolve(todosTerminaisCache);
    };
    document.body.appendChild(script);
  });
  return todosTerminaisPromise;
}
function preencherSelectLocal() {
  const select = getEl('envio-local');
  if (!select) return;
  carregarTodosTerminais().then(terminais => {
    const valorAtual = select.value;
    select.innerHTML = '<option value="">Selecione...</option>';
    terminais.forEach(t => { const opt = document.createElement('option'); opt.value = t; opt.textContent = t; select.appendChild(opt); });
    if (valorAtual && terminais.includes(valorAtual)) select.value = valorAtual;
  });
}
