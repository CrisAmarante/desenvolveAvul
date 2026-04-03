const CACHE_NAME = 'penso-cache-v20260330';

// Lista de arquivos para cache imediato (estáticos)
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './config.js',
  './utils.js',
  './api.js',
  './auth.js',
  './inspecao.js',
  './envio.js',
  './main.js',
  './manifest.json',
  './icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css'
];

// Instalação: Cria o cache e armazena os arquivos base
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cache aberto e instalando assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Ativação: Limpa caches antigos quando houver atualização de versão
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Removendo cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estratégia: Stale-While-Revalidate (Usa o cache mas atualiza em segundo plano)
// Ideal para o PENSO, pois carrega rápido e busca mudanças nos scripts
self.addEventListener('fetch', (event) => {
  // Ignorar requisições de API (Planilha Google) para não travar os dados em cache
  if (event.request.url.includes('script.google.com')) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((response) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // Se a resposta for válida, atualiza o cache
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
            // Se falhar a rede (offline), já retornamos o cache abaixo
        });

        return response || fetchPromise;
      });
    })
  );
});
