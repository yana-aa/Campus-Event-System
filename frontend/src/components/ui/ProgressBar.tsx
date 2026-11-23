interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
  tone?: 'brand' | 'warning' | 'danger' | 'success';
}

export function ProgressBar({ value, max, label, tone = 'brand' }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className={`progress progress--${tone}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div className="progress__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
