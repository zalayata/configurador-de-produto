import { useMemo, useState } from 'react'
import { FINISHES, finishById } from '../../config/product'
import { useConfigurator } from '../../state/store'
import { FinishSwatches } from '../FinishSwatches'

export function PecasStep() {
  const imported = useConfigurator((s) => s.imported)
  const overrides = useConfigurator((s) => s.overrides)
  const setOverride = useConfigurator((s) => s.setOverride)
  const clearOverrides = useConfigurator((s) => s.clearOverrides)
  const selectedPart = useConfigurator((s) => s.selectedPart)
  const selectPart = useConfigurator((s) => s.selectPart)
  const [filter, setFilter] = useState('')

  const parts = useMemo(() => {
    if (!imported) return []
    const query = filter.trim().toLowerCase()
    if (!query) return imported.parts
    return imported.parts.filter((p) => p.name.toLowerCase().includes(query))
  }, [imported, filter])

  if (!imported) {
    return (
      <div className="step-body">
        <p className="empty-note">
          Nenhum modelo importado. Volte à etapa Produto e importe um arquivo do Inventor ou Fusion
          (exportado como STEP) para personalizar as peças.
        </p>
      </div>
    )
  }

  const selected = selectedPart ? imported.parts.find((p) => p.id === selectedPart) : null
  const selectedOverride = selectedPart ? overrides[selectedPart] : undefined
  const customized = Object.values(overrides).filter(
    (o) => o.finishId || o.visible === false,
  ).length

  return (
    <div className="step-body">
      <input
        type="search"
        className="part-filter"
        placeholder={`Buscar entre ${imported.parts.length} peça(s)…`}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <div className="part-list">
        {parts.map((part) => {
          const override = overrides[part.id]
          const hidden = override?.visible === false
          return (
            <div
              key={part.id}
              className={`part-row${part.id === selectedPart ? ' is-selected' : ''}${hidden ? ' is-hidden' : ''}`}
            >
              <button
                type="button"
                className="part-row-main"
                onClick={() => selectPart(part.id === selectedPart ? null : part.id)}
              >
                <span
                  className="part-dot"
                  style={
                    override?.finishId
                      ? { background: finishById(override.finishId).swatch }
                      : undefined
                  }
                />
                <span className="part-name">{part.name}</span>
              </button>
              <button
                type="button"
                className="part-eye"
                title={hidden ? 'Mostrar peça' : 'Ocultar peça'}
                onClick={() => setOverride(part.id, { visible: hidden })}
              >
                {hidden ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          )
        })}
        {parts.length === 0 && <p className="empty-note">Nenhuma peça encontrada para o filtro.</p>}
      </div>

      {selected && (
        <section className="part-editor">
          <div className="field-label">Cor da peça — {selected.name}</div>
          <FinishSwatches
            finishes={FINISHES}
            selectedId={selectedOverride?.finishId}
            onSelect={(id) => setOverride(selected.id, { finishId: id })}
          />
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => setOverride(selected.id, { finishId: undefined })}
          >
            Restaurar cor original
          </button>
        </section>
      )}

      {customized > 0 && (
        <button type="button" className="btn btn-ghost btn-small" onClick={clearOverrides}>
          Desfazer personalizações ({customized})
        </button>
      )}
    </div>
  )
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 4l16 16M9.9 6a9.4 9.4 0 0 1 2.1-.5c6 0 9.5 6.5 9.5 6.5a17.3 17.3 0 0 1-3 3.6M6.3 6.9A16.4 16.4 0 0 0 2.5 12S6 18.5 12 18.5a8.8 8.8 0 0 0 3.6-.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}
