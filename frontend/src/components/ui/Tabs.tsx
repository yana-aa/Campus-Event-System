import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem<K extends string> {
  key: K;
  label: ReactNode;
  count?: number;
}

interface TabsProps<K extends string> {
  items: TabItem<K>[];
  active: K;
  onChange(key: K): void;
  label: string;
  variant?: 'underline' | 'pill';
}

export function Tabs<K extends string>({ items, active, onChange, label, variant = 'underline' }: TabsProps<K>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + items.length) % items.length;
    refs.current[next]?.focus();
    onChange(items[next].key);
  };

  return (
    <div role="tablist" aria-label={label} className={`tabs tabs--${variant}`}>
      {items.map((item, index) => {
        const selected = item.key === active;
        return (
          <button
            key={item.key}
            ref={(el) => {
              refs.current[index] = el;
            }}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={['tabs__tab', selected && 'tabs__tab--active'].filter(Boolean).join(' ')}
            onClick={() => onChange(item.key)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            {item.label}
            {item.count !== undefined && <span className="tabs__count">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
