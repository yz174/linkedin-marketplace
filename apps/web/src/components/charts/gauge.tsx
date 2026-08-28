'use client';

const TAU = Math.PI * 2;

function clamp01(n: number) {
  return Math.max(0, Math.min(100, n)) / 100;
}

export function Gauge({
  value,
  label,
  centerValue,
  orientation = 'arc',
  totalNotches = 40,
  height = 160
}: {
  value: number;
  label?: string;
  centerValue?: string;
  orientation?: 'arc' | 'linear';
  totalNotches?: number;
  height?: number;
}) {
  const fraction = clamp01(value);
  const activeCount = Math.round(fraction * totalNotches);

  return (
    <figure className="gauge" data-orientation={orientation}>
      {orientation === 'arc' ? (
        <ArcGauge
          totalNotches={totalNotches}
          activeCount={activeCount}
          height={height}
          centerValue={centerValue}
          label={label}
        />
      ) : (
        <LinearGauge totalNotches={totalNotches} activeCount={activeCount}>
          {(centerValue || label) && (
            <figcaption className="gauge-caption">
              {centerValue ? <span className="gauge-value">{centerValue}</span> : null}
              {label ? <span className="gauge-label">{label}</span> : null}
            </figcaption>
          )}
        </LinearGauge>
      )}
    </figure>
  );
}

function ArcGauge({
  totalNotches,
  activeCount,
  height,
  centerValue,
  label
}: {
  totalNotches: number;
  activeCount: number;
  height: number;
  centerValue?: string;
  label?: string;
}) {
  const size = height;
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 4;
  const inner = outer - size * 0.11;
  const start = (135 / 360) * TAU;
  const sweep = (270 / 360) * TAU;

  const notches = Array.from({ length: totalNotches }, (_, i) => {
    const t = totalNotches === 1 ? 0 : i / (totalNotches - 1);
    const angle = start + t * sweep;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x1: cx + cos * inner,
      y1: cy + sin * inner,
      x2: cx + cos * outer,
      y2: cy + sin * outer,
      active: i < activeCount
    };
  });

  return (
    <div className="gauge-arc" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        {notches.map((n, i) => (
          <line
            key={i}
            x1={n.x1}
            y1={n.y1}
            x2={n.x2}
            y2={n.y2}
            className={n.active ? 'gauge-notch is-active' : 'gauge-notch'}
            strokeLinecap="round"
          />
        ))}
      </svg>
      {(centerValue || label) && (
        <figcaption className="gauge-caption">
          {centerValue ? <span className="gauge-value">{centerValue}</span> : null}
          {label ? <span className="gauge-label">{label}</span> : null}
        </figcaption>
      )}
    </div>
  );
}

function LinearGauge({
  totalNotches,
  activeCount,
  children
}: {
  totalNotches: number;
  activeCount: number;
  children?: React.ReactNode;
}) {
  return (
    <>
      <div className="gauge-track" role="img" aria-label="Gauge">
        {Array.from({ length: totalNotches }, (_, i) => (
          <span key={i} className={i < activeCount ? 'gauge-tick is-active' : 'gauge-tick'} />
        ))}
      </div>
      {children}
    </>
  );
}
