// Segmented tab switcher shown only when a student is enrolled in more than
// one class — dues, history and everything else on Home/Payments are scoped
// to whichever class is selected here.
export default function ClassSwitcher({ enrollments, activeId, onChange, style }) {
  return (
    <div className="seg" style={{ marginTop: 14, ...style }}>
      {enrollments.map((e) => (
        <button
          key={e.batch}
          type="button"
          className={`seg-opt ${e.batch === activeId ? 'active' : ''}`}
          onClick={() => onChange(e.batch)}
        >
          {e.batch_label}
        </button>
      ))}
    </div>
  )
}
