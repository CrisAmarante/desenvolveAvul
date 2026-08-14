const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbwGV3DMn5ziRxTOUnQUyt22YIdOMxcEps64PPhsKNwoegkieLLe6fIYSGHrNeeGhk_E/exec";

// Configuração do Supabase
const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-key";

// Cliente Supabase (carregado via CDN)
let supabaseClient = null;

// Inicializa cliente Supabase
function initSupabase() {
  if (typeof createClient === 'function' && SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase inicializado');
  } else {
    console.warn('⚠️ Supabase não configurado corretamente');
  }
}
