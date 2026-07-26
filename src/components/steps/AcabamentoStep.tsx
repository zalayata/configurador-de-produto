import { PART_GROUPS, allowedFinishes, finishById } from '../../config/product'
import { useConfigurator } from '../../state/store'
import { FinishSwatches } from '../FinishSwatches'

export function AcabamentoStep() {
  const finishes = useConfigurator((s) => s.finishes)
  const setFinish = useConfigurator((s) => s.setFinish)

  return (
    <div className="step-body">
      {PART_GROUPS.map((group) => {
        const current = finishById(finishes[group.id])
        return (
          <section key={group.id} className="finish-group">
            <div className="finish-group-head">
              <div>
                <div className="finish-group-name">{group.label}</div>
                <div className="finish-group-desc">{group.description}</div>
              </div>
            </div>
            <FinishSwatches
              finishes={allowedFinishes(group)}
              selectedId={finishes[group.id]}
              onSelect={(id) => setFinish(group.id, id)}
            />
            <div className="finish-current">{current.label}</div>
          </section>
        )
      })}
    </div>
  )
}
