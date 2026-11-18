interface QuantityStepperProps {
  value: number;
  min?: number;
  max: number;
  onChange(next: number): void;
  label?: string;
  disabled?: boolean;
}

/** − / + stepper that never leaves [min, max]. */
export function QuantityStepper({ value, min = 1, max, onChange, label = 'Quantity', disabled }: QuantityStepperProps) {
  const clamp = (n: number) => Math.min(Math.max(n, min), Math.max(max, min));
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="stepper__btn"
        aria-label="Decrease quantity"
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - 1))}
      >
        −
      </button>
      <output className="stepper__value" aria-live="polite" aria-label={`${label}: ${value}`}>
        {value}
      </output>
      <button
        type="button"
        className="stepper__btn"
        aria-label="Increase quantity"
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + 1))}
      >
        +
      </button>
    </div>
  );
}
