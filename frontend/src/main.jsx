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
  if (!splash) return
  splash.classList.add('hide')
  setTimeout(() => splash.remove(), 450)
})

// Register the PWA service worker (production builds; harmless if it 404s in dev).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline support is best-effort */
    })
  })
}
