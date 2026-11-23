interface WizardStepsProps {
  steps: string[];
  current: number;
  onSelect?(index: number): void;
}

export function WizardSteps({ steps, current, onSelect }: WizardStepsProps) {
  return (
    <ol className="wizard-steps" aria-label="Progress">
      {steps.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'todo';
        return (
          <li key={step} className={`wizard-steps__item wizard-steps__item--${state}`}>
            <button
              type="button"
              className="wizard-steps__button"
              aria-current={state === 'current' ? 'step' : undefined}
              disabled={!onSelect || index > current}
              onClick={() => onSelect?.(index)}
            >
              <span className="wizard-steps__index">{state === 'done' ? '✓' : index + 1}</span>
              <span className="wizard-steps__label">{step}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
