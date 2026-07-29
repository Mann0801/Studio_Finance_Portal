import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { MegaphoneIcon } from '../../components/Icons'
import { ListSkeleton } from '../../components/Skeleton'

const fmt = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

export default function Announcements() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api('/api/announcements')
      .then((d) => active && setItems(d))
      .catch((e) => active && setError(e.message))
    return () => {
      active = false
    }
  }, [])

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <h1>Announcements</h1>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {items === null ? (
        <ListSkeleton rows={3} />
      ) : items.length === 0 ? (
        <div className="card empty">No announcements yet.</div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {items.map((a, i) => (
            <div className="card announce-item" key={a.id}>
              <div className="ann-top">
                <MegaphoneIcon className="ann-ic" width={17} height={17} />
                {i === 0 && <span className="ann-latest">Latest</span>}
                <span className="ann-date">{fmt(a.created_at)}</span>
              </div>
              <p className="ann-msg">{a.message}</p>
            </div>
          ))}
        </div>
      )}
      <div style={{ height: 28 }} />
    </>
  )
}
