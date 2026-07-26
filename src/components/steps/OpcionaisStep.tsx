import { OPTIONS } from '../../config/product'
import { useConfigurator } from '../../state/store'

export function OpcionaisStep() {
  const options = useConfigurator((s) => s.options)
  const toggleOption = useConfigurator((s) => s.toggleOption)

  return (
    <div className="step-body">
      {OPTIONS.map((option) => {
        const enabled = options[option.id]
        return (
          <button
            key={option.id}
            type="button"
            className={`option-card${enabled ? ' is-enabled' : ''}`}
            onClick={() => toggleOption(option.id)}
            aria-pressed={enabled}
          >
            <div className="option-card-info">
              <div className="option-card-head">
                <span className="option-card-name">{option.label}</span>
                <span className="tag">{option.code}</span>
              </div>
              <p className="option-card-desc">{option.description}</p>
            </div>
            <span className="switch" aria-hidden="true">
              <span className="switch-thumb" />
            </span>
          </button>
        )
      })}
    </div>
  )
}
