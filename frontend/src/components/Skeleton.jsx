/* Loading skeletons — used instead of spinners. */
export function Skeleton({ height = 16, width = '100%', radius = 10, style }) {
  return (
    <div
      className="skeleton"
      style={{ height, width, borderRadius: radius, ...style }}
    />
  )
}

export function CardSkeleton({ lines = 3 }) {
  return (
    <div className="card stack" style={{ gap: 12 }}>
      <Skeleton height={14} width="40%" />
      <Skeleton height={38} width="60%" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={14} width={`${80 - i * 12}%`} />
      ))}
    </div>
  )
}

export function ListSkeleton({ rows = 4 }) {
  return (
    <div className="stack" style={{ gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={58} radius={16} />
      ))}
    </div>
  )
}
