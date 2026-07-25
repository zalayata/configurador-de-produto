import { useConfigurator, DEMO_STEPS, IMPORT_STEPS } from '../state/store'

export function StepRail() {
  const source = useConfigurator((s) => s.source)
  const step = useConfigurator((s) => s.step)
  const setStep = useConfigurator((s) => s.setStep)
  const steps = source === 'demo' ? DEMO_STEPS : IMPORT_STEPS

  return (
    <nav className="steprail" aria-label="Etapas da configuração">
      {steps.map((s, i) => (
        <button
          key={s.id}
          type="button"
          className={`steprail-item${i === step ? ' is-active' : ''}${i < step ? ' is-done' : ''}`}
          onClick={() => setStep(i)}
        >
          <span className="steprail-num">{String(i + 1).padStart(2, '0')}</span>
          <span className="steprail-label">{s.label}</span>
        </button>
      ))}
    </nav>
  )
}
