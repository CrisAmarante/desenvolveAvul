/**
 * API Supabase - Comunicação com backend Supabase
 * Substitui a comunicação anterior com Google Apps Script
 */

// Cria o cliente Supabase apenas se ainda não existir
if (typeof window.supabaseClient === 'undefined') {
  window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Referencia o cliente global
const supabaseClientInstance = window.supabaseClient;

let INSPETORES = {};
let refreshPromise = null;
let terminaisCache = [];
let terminaisTimestamp = 0;
const TERMINAIS_CACHE_DURACAO = 30 * 60 * 1000; // 30 minutos
let terminaisPromise = null;
let todosTerminaisCache = [];
let todosTerminaisPromise = null;

// ====================================================================
// LOGIN COM SUPABASE
// ====================================================================
async function loginSupabase(senha) {
  try {
    // Hash da senha em SHA-256 (mesmo formato do Apps Script)
    const encoder = new TextEncoder();
    const data = encoder.encode(senha);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const senhaHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Busca usuário na tabela users
    const { data: usuario, error } = await supabaseClientInstance
      .from('users')
      .select('apelido, nome, funcao, hash, ativo')
      .eq('hash', senhaHash)
      .eq('ativo', 'SIM')
      .single();

    if (error || !usuario) {
      return { sucesso: false, erro: 'Usuário ou senha inválidos' };
    }

    return {
      sucesso: true,
      apelido: usuario.apelido,
      nome: usuario.nome,
      funcao: usuario.funcao
    };
  } catch (err) {
    console.error('Erro no login:', err);
    return { sucesso: false, erro: 'Erro de conexão' };
  }
}

// ====================================================================
// LOG DE ATIVIDADES
// ====================================================================
async function registrarLog(nomeApelido) {
  try {
    const { error } = await supabaseClientInstance
      .from('logs')
      .insert([{ 
        usuario: nomeApelido, 
        acao: 'Login bem-sucedido',
        data_hora: new Date().toISOString()
      }]);
    
    if (error) console.warn('Falha ao registrar log:', error);
  } catch (err) { 
    console.warn("Falha ao registrar log:", err); 
  }
}

// ====================================================================
// CARREGAR INSPETORES
// ====================================================================
function processarDadosUsuarios(dados) {
  if (Array.isArray(dados)) {
    const novoObjeto = {};
    dados.forEach(row => {
      if (row.apelido && row.hash && row.ativo === "SIM") {
        novoObjeto[row.apelido] = { 
          hash: row.hash, 
          nome: row.nome, 
          funcao: row.funcao 
        };
      }
    });
    INSPETORES = novoObjeto;
  } else { 
    INSPETORES = dados || {}; 
  }
}

async function refreshInspetores() {
  if (refreshPromise) return refreshPromise;
  
  refreshPromise = new Promise(async (resolve, reject) => {
    try {
      const { data, error } = await supabaseClientInstance
        .from('users')
        .select('apelido, hash, nome, funcao, ativo');
      
      if (error) throw error;
      
      processarDadosUsuarios(data);
      refreshPromise = null;
      resolve();
    } catch (err) {
      console.error('Erro ao carregar inspetores:', err);
      refreshPromise = null;
      reject(err);
    }
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
  
  terminaisPromise = new Promise(async (resolve) => {
    try {
      const { data, error } = await supabaseClientInstance
        .from('terminais')
        .select('nome')
        .eq('ativo', true);
      
      if (error) throw error;
      
      terminaisCache = data.map(t => t.nome);
      terminaisTimestamp = Date.now();
      terminaisPromise = null;
      resolve(terminaisCache);
    } catch (err) {
      console.warn('Erro ao carregar terminais, usando fallback:', err);
      terminaisPromise = null;
      terminaisCache = ['Terminal A', 'Terminal B', 'Terminal C', 'Terminal D'];
      terminaisTimestamp = Date.now();
      resolve(terminaisCache);
    }
  });
  
  return terminaisPromise;
}

function preencherSelectTerminais() {
  const selects = [getEl('terminal'), getEl('tacografo-terminal')].filter(Boolean);
  if (!selects.length) return;
  
  carregarTerminais().then(terminais => {
    selects.forEach(select => {
      const valorAtual = select.value;
      select.innerHTML = '<option value="">Selecione...</option>';
      terminais.forEach(t => { 
        const opt = document.createElement('option'); 
        opt.value = t; 
        opt.textContent = t; 
        select.appendChild(opt); 
      });
      if (valorAtual && terminais.includes(valorAtual)) select.value = valorAtual;
    });
  });
}

// ====================================================================
// TODOS OS TERMINAIS (para local no envio)
// ====================================================================
function carregarTodosTerminais(forceRefresh = false) {
  if (!forceRefresh && todosTerminaisCache.length) {
    return Promise.resolve(todosTerminaisCache);
  }
  
  if (todosTerminaisPromise) return todosTerminaisPromise;
  
  todosTerminaisPromise = new Promise(async (resolve) => {
    try {
      const { data, error } = await supabaseClientInstance
        .from('terminais')
        .select('nome');
      
      if (error) throw error;
      
      todosTerminaisCache = data.map(t => t.nome);
      todosTerminaisPromise = null;
      resolve(todosTerminaisCache);
    } catch (err) {
      console.warn('Erro ao carregar todos terminais, usando fallback:', err);
      todosTerminaisPromise = null;
      todosTerminaisCache = ['Terminal A', 'Terminal B', 'Terminal C', 'Terminal D'];
      resolve(todosTerminaisCache);
    }
  });
  
  return todosTerminaisPromise;
}

function preencherSelectLocal() {
  const select = getEl('envio-local');
  if (!select) return;
  
  carregarTodosTerminais().then(terminais => {
    const valorAtual = select.value;
    select.innerHTML = '<option value="">Selecione...</option>';
    terminais.forEach(t => { 
      const opt = document.createElement('option'); 
      opt.value = t; 
      opt.textContent = t; 
      select.appendChild(opt); 
    });
    if (valorAtual && terminais.includes(valorAtual)) select.value = valorAtual;
  });
}

// ====================================================================
// CONFIGURAÇÕES DO ADMIN
// ====================================================================
async function carregarTimeoutInatividade() {
  try {
    const { data, error } = await supabaseClientInstance
      .from('config')
      .select('valor')
      .eq('chave', 'timeout_inatividade')
      .single();
    
    if (error || !data) return;
    
    const timeout = parseInt(data.valor);
    if (timeout) {
      INACTIVITY_TIMEOUT = timeout;
      console.log(`✅ Timeout de inatividade carregado: ${INACTIVITY_TIMEOUT / 60000} minutos`);
    }
  } catch (err) {
    console.warn('⚠️ Falha ao carregar timeout do servidor, usando padrão:', err);
  }
}

// Exportar para escopo global
window.INSPETORES = INSPETORES;
window.refreshInspetores = refreshInspetores;
window.carregarTerminais = carregarTerminais;
window.preencherSelectTerminais = preencherSelectTerminais;
window.carregarTodosTerminais = carregarTodosTerminais;
window.preencherSelectLocal = preencherSelectLocal;
window.registrarLog = registrarLog;
window.loginSupabase = loginSupabase;
window.carregarTimeoutInatividade = carregarTimeoutInatividade;
// Alias para compatibilidade com código legado
window.loginViaGoogleScript = loginSupabase;
