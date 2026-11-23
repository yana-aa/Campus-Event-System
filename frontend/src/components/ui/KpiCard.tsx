import type { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'info';
}

export function KpiCard({ label, value, hint, icon, tone = 'brand' }: KpiCardProps) {
  return (
    <article className={`kpi kpi--${tone}`} aria-label={label}>
      <span className="kpi__icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <p className="kpi__label">{label}</p>
        <p className="kpi__value">{value}</p>
        {hint && <p className="kpi__hint">{hint}</p>}
      </div>
    </article>
  );
}
