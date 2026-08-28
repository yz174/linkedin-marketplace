'use client';

import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridRows } from '@visx/grid';
import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';
import { scaleBand, scaleLinear } from '@visx/scale';
import { useTooltip } from '@visx/tooltip';
import { max } from 'd3-array';
import { count, money } from '@/lib/format';

export type BarDatum = { label: string; value: number };

const FORMATTERS = { number: count, currency: money } as const;
type FormatKind = keyof typeof FORMATTERS;

const MARGIN = { top: 8, right: 8, bottom: 30, left: 48 };
const TICK_TEXT = { fill: 'var(--muted)', fontSize: 11, fontFamily: 'var(--font)' } as const;

function topRoundedPath(x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h} L${x},${y + rad} Q${x},${y} ${x + rad},${y} L${x + w - rad},${y} Q${x + w},${y} ${x + w},${y + rad} L${x + w},${y + h} Z`;
}

function truncate(text: string, n = 12) {
  return text.length > n ? `${text.slice(0, n - 1)}…` : text;
}

export function BarChart({
  title,
  data,
  format = 'number',
  height = 240
}: {
  title: string;
  data: BarDatum[];
  format?: FormatKind;
  height?: number;
}) {
  const fmt = FORMATTERS[format];
  return (
    <figure className="chart">
      <figcaption className="chart-title">{title}</figcaption>
      {data.length === 0 ? (
        <p className="chart-empty">No data yet.</p>
      ) : (
        <div className="chart-plot" style={{ height }}>
          <ParentSize>
            {({ width }) =>
              width > 0 ? <Plot width={width} height={height} data={data} format={fmt} /> : null
            }
          </ParentSize>
        </div>
      )}
    </figure>
  );
}

function Plot({
  width,
  height,
  data,
  format
}: {
  width: number;
  height: number;
  data: BarDatum[];
  format: (n: number) => string;
}) {
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } =
    useTooltip<BarDatum>();

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const x = scaleBand({
    domain: data.map((d) => d.label),
    range: [0, innerW],
    padding: 0.34
  });
  const y = scaleLinear({
    domain: [0, max(data, (d) => d.value) || 1],
    range: [innerH, 0],
    nice: true
  });

  const bandwidth = x.bandwidth();

  return (
    <>
      <svg width={width} height={height} role="img" aria-label="Bar chart">
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridRows scale={y} width={innerW} numTicks={4} stroke="var(--line)" strokeWidth={1} />

          {data.map((d) => {
            const bx = x(d.label) ?? 0;
            const by = y(d.value);
            const bh = innerH - by;
            const active = tooltipOpen && tooltipData?.label === d.label;
            return (
              <path
                key={d.label}
                className="chart-bar"
                data-faded={tooltipOpen && !active ? '1' : undefined}
                d={topRoundedPath(bx, by, bandwidth, bh, 4)}
                onMouseMove={(event) => {
                  const rect = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  showTooltip({
                    tooltipData: d,
                    tooltipLeft: event.clientX - rect.left,
                    tooltipTop: event.clientY - rect.top
                  });
                }}
                onMouseLeave={hideTooltip}
              />
            );
          })}

          <AxisLeft
            scale={y}
            numTicks={4}
            hideAxisLine
            hideTicks
            tickFormat={(v) => format(v as number)}
            tickLabelProps={() => ({ ...TICK_TEXT, textAnchor: 'end', dx: -6, dy: 3 })}
          />
          <AxisBottom
            top={innerH}
            scale={x}
            hideAxisLine
            hideTicks
            tickFormat={(v) => truncate(String(v))}
            tickLabelProps={() => ({ ...TICK_TEXT, textAnchor: 'middle', dy: 4 })}
          />
        </Group>
      </svg>

      {tooltipOpen && tooltipData ? (
        <div className="chart-tip" style={{ left: tooltipLeft ?? 0, top: (tooltipTop ?? 0) - 8 }}>
          <span className="chart-tip-label">{tooltipData.label}</span>
          <span className="chart-tip-value">{format(tooltipData.value)}</span>
        </div>
      ) : null}
    </>
  );
}
