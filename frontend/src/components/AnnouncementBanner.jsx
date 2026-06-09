import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { MegaphoneIcon } from './Icons'

/* Shows the admin's active announcement. Dismissible per-message: dismissing
   hides it until the admin posts a different message. */
export default function AnnouncementBanner() {
  const [ann, setAnn] = useState(null)

  useEffect(() => {
    let active = true
    api('/api/announcement')
      .then((data) => {
        if (!active || !data) return
        const dismissed = localStorage.getItem('announce:dismissed')
        if (dismissed === data.id) return
        setAnn(data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  if (!ann) return null

  return (
    <div className="announce" role="status">
      <MegaphoneIcon className="ic" width={18} height={18} />
      <div className="msg">{ann.message}</div>
      <button
        className="close"
        aria-label="Dismiss"
        onClick={() => {
          localStorage.setItem('announce:dismissed', ann.id)
          setAnn(null)
        }}
      >
        ×
      </button>
    </div>
  )
}
