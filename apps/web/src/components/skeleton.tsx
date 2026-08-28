export function Skeleton({
  w,
  h = 14,
  radius,
  className,
  style
}: {
  w?: number | string;
  h?: number | string;
  radius?: number | string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`sk ${className ?? ''}`.trim()}
      aria-hidden="true"
      style={{ width: w, height: h, borderRadius: radius, ...style }}
    />
  );
}

export function SkeletonStatRow({ count = 4 }: { count?: number }) {
  return (
    <div className="stats">
      {Array.from({ length: count }, (_, i) => (
        <div className="stat" key={i}>
          <Skeleton w={90} h={12} />
          <Skeleton w={120} h={26} style={{ marginTop: 12 }} />
          <Skeleton w={110} h={11} style={{ marginTop: 10 }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card" style={{ padding: 'var(--s5)' }}>
      <Skeleton w={160} h={15} />
      <div style={{ marginTop: 'var(--s4)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} w={i === lines - 1 ? '60%' : '100%'} h={12} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="page">
      <div className="main-in">
        <div className="pagehead">
          <div>
            <Skeleton w={220} h={30} />
            <Skeleton w={360} h={13} style={{ marginTop: 10 }} />
          </div>
        </div>
        <SkeletonStatRow />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s4)', marginTop: 'var(--s3)' }}>
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
        </div>
      </div>
    </div>
  );
}
