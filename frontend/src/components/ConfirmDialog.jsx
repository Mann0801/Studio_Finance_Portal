/* Small centered confirmation sheet — used for destructive/irreversible actions
   like logging out. Renders nothing when `open` is false. */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <div className="sheet confirm-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-title">{title}</div>
        {message && <p className="confirm-msg">{message}</p>}
        <button
          className={`btn ${danger ? 'danger' : 'primary'} block`}
          style={{ marginTop: 16 }}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
        <button className="btn ghost block" style={{ marginTop: 8 }} onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </div>
  )
}
