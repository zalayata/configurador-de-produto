import type { Finish } from '../config/product'

interface Props {
  finishes: Finish[]
  selectedId?: string
  onSelect: (id: string) => void
}

export function FinishSwatches({ finishes, selectedId, onSelect }: Props) {
  return (
    <div className="swatch-row" role="listbox" aria-label="Acabamentos disponíveis">
      {finishes.map((finish) => (
        <button
          key={finish.id}
          type="button"
          role="option"
          aria-selected={finish.id === selectedId}
          className={`swatch${finish.id === selectedId ? ' is-selected' : ''}`}
          style={{ background: finish.swatch }}
          title={finish.label}
          onClick={() => onSelect(finish.id)}
        >
          <span className="sr-only">{finish.label}</span>
        </button>
      ))}
    </div>
  )
}
