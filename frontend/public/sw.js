/* Studio PWA service worker — minimal offline app shell.
 *
 * Strategy:
 *  - Navigations: network-first, fall back to cached app shell (so the installed
 *    app opens even offline).
 *  - Same-origin static assets (JS/CSS/icons): stale-while-revalidate.
 *  - Everything else (the API on another origin, Razorpay, Supabase): passthrough
 *    — never cache dynamic/authenticated requests.
 */
const CACHE = 'studio-shell-v3'
const SHELL = ['/', '/index.html', '/logo.png', '/favicon.png', '/icon-512.png', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  const sameOrigin = url.origin === self.location.origin

  // App navigations → network first, fall back to cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/', copy))
          return res
        })
        .catch(() => caches.match('/').then((r) => r || caches.match('/index.html'))),
    )
    return
  }

  // Only cache our own static assets; let API/3rd-party pass straight through.
  if (!sameOrigin) return

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(request, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
