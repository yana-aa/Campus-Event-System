export function Spinner({ label = 'Loading', fullPage = false }: { label?: string; fullPage?: boolean }) {
  return (
    <div className={['spinner', fullPage && 'spinner--page'].filter(Boolean).join(' ')} role="status">
      <span className="spinner__circle" aria-hidden="true" />
      <span className="spinner__label">{label}…</span>
    </div>
  );
}
