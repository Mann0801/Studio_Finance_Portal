import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
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
