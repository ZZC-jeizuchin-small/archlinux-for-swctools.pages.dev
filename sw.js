// Service Worker for archlinux.pages.dev
// 预缓存关键文件，支持离线启动

const CACHE_NAME = 'swc-archlinux-v1';

// 需要预缓存的文件列表（注意路径与页面引用一致）
const PRECACHE_URLS = [
  './',                     // 页面本身
  './libv86.js',            // v86 主库
  './v86.wasm',             // WebAssembly 核心
  // 状态文件（外部链接，必须支持 CORS）
  'https://stuff.aoodyconcor.de/d/local/robin/v86state.bin?sign=rVokpNP7dAffY5DSjoNBAIRyQkww7sTcTdIbEv3hwqY=:0'
];

// 安装事件：预缓存所有资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] 开始预缓存资源');
        return cache.addAll(PRECACHE_URLS);
      })
      .catch(err => {
        console.error('[SW] 预缓存失败:', err);
      })
  );
  // 立即激活，不等待旧的 Service Worker
  self.skipWaiting();
});

// 激活事件：清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) {
            console.log('[SW] 删除旧缓存:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 拦截请求：优先使用缓存，网络失败时回退
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // 命中缓存，直接返回
          return cachedResponse;
        }

        // 未命中缓存，发起网络请求
        return fetch(event.request)
          .then(networkResponse => {
            // 对于跨域资源，仅缓存状态码为 0 或 200 的响应
            if (!networkResponse || networkResponse.status !== 200 && networkResponse.status !== 0) {
              return networkResponse;
            }

            // 动态缓存（可选：只缓存特定类型的资源）
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              })
              .catch(err => console.warn('[SW] 动态缓存失败:', err));

            return networkResponse;
          })
          .catch(error => {
            // 网络失败且无缓存，返回离线提示（对于页面请求）
            if (event.request.mode === 'navigate') {
              return new Response('离线模式 - 该页面未缓存', {
                status: 503,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
              });
            }
            throw error;
          });
      })
  );
});