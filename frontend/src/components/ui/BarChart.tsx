export interface BarDatum {
  label: string;
  value: number;
}

/** Lightweight accessible bar chart (no chart library needed). */
export function BarChart({ data, title, unit = '' }: { data: BarDatum[]; title: string; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="bar-chart">
      <figcaption className="sr-only">{title}</figcaption>
      <div className="bar-chart__plot" role="list">
        {data.map((d) => (
          <div className="bar-chart__col" role="listitem" key={d.label} aria-label={`${d.label}: ${d.value}${unit}`}>
            <span className="bar-chart__value">{d.value}</span>
            <div className="bar-chart__track">
              <div className="bar-chart__bar" style={{ height: `${(d.value / max) * 100}%` }} />
            </div>
            <span className="bar-chart__label">{d.label}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}
