import { useEffect, useState } from 'react'
import { STUDIO_NAME, LOGO_SRC } from '../lib/brand'

const DISMISS_KEY = 'install:dismissed'

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

function isIOS() {
  return (
    /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
    !window.MSStream
  )
}

/**
 * Install affordance for both platforms:
 *  - Android/Chrome: captures `beforeinstallprompt` and offers a one-tap Install.
 *  - iOS Safari (no such event): shows the manual "Add to Home Screen" hint.
 * Hidden once installed, or after the user dismisses it.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [show, setShow] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    if (localStorage.getItem(DISMISS_KEY)) return

    const onBeforeInstall = (e) => {
      e.preventDefault()
      setDeferred(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // iOS never fires beforeinstallprompt — show the manual hint instead.
    let iosTimer
    if (isIOS()) {
      iosTimer = setTimeout(() => {
        setIosHint(true)
        setShow(true)
      }, 1200)
    }

    const onInstalled = () => setShow(false)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      if (iosTimer) clearTimeout(iosTimer)
    }
  }, [])

  function dismiss() {
    setShow(false)
    localStorage.setItem(DISMISS_KEY, '1')
  }

  async function install() {
    if (!deferred) return
    deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="install-prompt" role="dialog" aria-label="Install app">
      <img src={LOGO_SRC} alt="" className="install-icon" />
      <div className="install-text">
        <strong>Install {STUDIO_NAME}</strong>
        {iosHint ? (
          <span className="muted small">
            Tap the Share icon, then “Add to Home Screen”.
          </span>
        ) : (
          <span className="muted small">Add it to your home screen for quick access.</span>
        )}
      </div>
      {!iosHint && (
        <button className="btn primary install-btn" onClick={install}>
          Install
        </button>
      )}
      <button className="install-close" onClick={dismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}
