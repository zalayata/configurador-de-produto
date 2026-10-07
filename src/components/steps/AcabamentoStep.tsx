import { FINISHES, PART_GROUPS, allowedFinishes, finishById } from '../../config/product'
import { configurableGroups, productById } from '../../catalog/products'
import { useConfigurator } from '../../state/store'
import { FinishSwatches } from '../FinishSwatches'

function CatalogFinishes({ productId }: { productId: string }) {
  const groupFinishes = useConfigurator((s) => s.groupFinishes)
  const setGroupFinish = useConfigurator((s) => s.setGroupFinish)
  const resetGroupFinishes = useConfigurator((s) => s.resetGroupFinishes)
  const product = productById(productId)
  if (!product) return null

  const groups = configurableGroups(product)
  const fixed = product.manifest.grupos.filter((g) => !product.groups[g.id])

  return (
    <div className="step-body">
      {groups.map((group) => {
        const cfg = product.groups[group.id]
        const finishes =
          !cfg.allowed || cfg.allowed === 'todos'
            ? FINISHES
            : FINISHES.filter((f) => f.kind === cfg.allowed)
        const currentId = groupFinishes[group.id] ?? cfg.defaultFinish
        return (
          <section key={group.id} className="finish-group">
            <div className="finish-group-head">
              <div>
                <div className="finish-group-name">{group.rotulo}</div>
                <div className="finish-group-desc">{group.descricao}</div>
              </div>
            </div>
            <FinishSwatches
              finishes={finishes}
              selectedId={currentId}
              onSelect={(id) => setGroupFinish(group.id, id)}
            />
            <div className="finish-current">{finishById(currentId).label}</div>
          </section>
        )
      })}
      {fixed.length > 0 && (
        <p className="empty-note">
          Acabamento fixo: {fixed.map((g) => g.rotulo.toLowerCase()).join(', ')}.
        </p>
      )}
      <button type="button" className="btn btn-ghost btn-small" onClick={resetGroupFinishes}>
        Restaurar acabamentos padrão
      </button>
    </div>
  )
}

export function AcabamentoStep() {
  const source = useConfigurator((s) => s.source)
  const productId = useConfigurator((s) => s.productId)
  const finishes = useConfigurator((s) => s.finishes)
  const setFinish = useConfigurator((s) => s.setFinish)

  if (source === 'catalogo' && productId) return <CatalogFinishes productId={productId} />

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
