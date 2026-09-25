import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'

// Error monitoring. Only active when VITE_SENTRY_DSN is set (so local dev stays
// quiet). sendDefaultPii:false keeps IPs/headers out of Sentry.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  Sentry.init({ dsn: sentryDsn, sendDefaultPii: false })
}

const fallback = (
  <div style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
      <p style={{ color: '#8b93a7', marginBottom: 16 }}>Please refresh the page and try again.</p>
      <button className="btn primary" onClick={() => window.location.reload()}>Refresh</button>
    </div>
  </div>
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={fallback}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)

// Fade out and remove the splash screen once the app has mounted.
requestAnimationFrame(() => {
  const splash = document.getElementById('splash')
  if (splash) {
    splash.classList.add('hide')
    setTimeout(() => splash.remove(), 450)
  }
  // The app booted fine this time (whether this is the first load or a
  // reload triggered by the stale-chunk handler below) — clear the guard so
  // a LATER deploy's staleness can still trigger one more reload if needed.
  sessionStorage.removeItem('vitePreloadErrorReloaded')
})

// A new deploy ships chunk files with different hashed names — if a tab was
// left open from before that deploy (e.g. someone's PWA, or just an old tab)
// and it tries a lazy import (like the Receipt page's html2canvas/jspdf
// load), the browser asks for a file that no longer exists on the server:
// "Failed to fetch dynamically imported module". Vite fires this event for
// exactly that case; reloading picks up the current build's real references.
// Guarded to at most once per tab so a genuinely broken deploy can't loop.
window.addEventListener('vite:preloadError', () => {
  const key = 'vitePreloadErrorReloaded'
  if (sessionStorage.getItem(key)) return
  sessionStorage.setItem(key, '1')
  window.location.reload()
})

// Register the PWA service worker (production builds; harmless if it 404s in dev).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline support is best-effort */
    })
  })
}
