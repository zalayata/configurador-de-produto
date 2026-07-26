import {
  DEMO_PRODUCT,
  OPTIONS,
  PART_GROUPS,
  PRODUCT_LINES,
  finishById,
} from '../../config/product'
import { branding } from '../../config/branding'
import { useConfigurator } from '../../state/store'
import { shareUrl } from '../../utils/share'
import { captureSnapshot, downloadSnapshot } from '../../utils/viewerHandles'
import { exportGlb } from '../../utils/exportGlb'

export function buildSummaryText(): string {
  const { source, line, finishes, options, imported, overrides } = useConfigurator.getState()
  const lines: string[] = []
  lines.push(`Configuração — ${branding.companyName}`)
  if (source === 'demo') {
    const productLine = PRODUCT_LINES.find((l) => l.id === line)
    lines.push(`Produto: ${DEMO_PRODUCT.name} (${DEMO_PRODUCT.code})`)
    if (productLine) lines.push(`Linha: ${productLine.label}`)
    lines.push('')
    lines.push('Acabamentos:')
    for (const group of PART_GROUPS) {
      lines.push(`  • ${group.label}: ${finishById(finishes[group.id]).label}`)
    }
    lines.push('')
    lines.push('Opcionais:')
    const enabled = OPTIONS.filter((o) => options[o.id])
    if (enabled.length === 0) lines.push('  • Nenhum opcional selecionado')
    for (const option of enabled) {
      lines.push(`  • [${option.code}] ${option.label}`)
    }
    lines.push('')
    lines.push(`Link da configuração: ${shareUrl(finishes, options, line)}`)
  } else if (imported) {
    lines.push(`Produto: modelo importado — ${imported.fileName}`)
    lines.push(`Peças: ${imported.parts.length}`)
    const custom = imported.parts.filter((p) => {
      const o = overrides[p.id]
      return o && (o.finishId || o.visible === false)
    })
    if (custom.length > 0) {
      lines.push('')
      lines.push('Personalizações:')
      for (const part of custom) {
        const o = overrides[part.id]
        const details: string[] = []
        if (o.finishId) details.push(finishById(o.finishId).label)
        if (o.visible === false) details.push('oculta')
        lines.push(`  • ${part.name}: ${details.join(', ')}`)
      }
    }
  }
  return lines.join('\n')
}

export function ResumoStep() {
  const source = useConfigurator((s) => s.source)
  const line = useConfigurator((s) => s.line)
  const finishes = useConfigurator((s) => s.finishes)
  const options = useConfigurator((s) => s.options)
  const imported = useConfigurator((s) => s.imported)
  const overrides = useConfigurator((s) => s.overrides)
  const showToast = useConfigurator((s) => s.showToast)

  const productLine = PRODUCT_LINES.find((l) => l.id === line)
  const enabledOptions = OPTIONS.filter((o) => options[o.id])
  const customized = imported
    ? imported.parts.filter((p) => {
        const o = overrides[p.id]
        return o && (o.finishId || o.visible === false)
      }).length
    : 0

  const copy = async (text: string, doneMessage: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast(doneMessage)
    } catch {
      showToast('Não foi possível copiar. Copie manualmente da barra de endereço.')
    }
  }

  const printSheet = () => {
    window.dispatchEvent(
      new CustomEvent('configurator:print', { detail: captureSnapshot() }),
    )
  }

  return (
    <div className="step-body">
      <section className="summary-block">
        <div className="field-label">Produto</div>
        <div className="summary-row">
          <span>{source === 'demo' ? DEMO_PRODUCT.name : (imported?.fileName ?? '—')}</span>
          <span className="tag">
            {source === 'demo' ? DEMO_PRODUCT.code : `${imported?.parts.length ?? 0} peças`}
          </span>
        </div>
        {source === 'demo' && productLine && (
          <div className="summary-row">
            <span>Linha</span>
            <span className="summary-value">{productLine.label}</span>
          </div>
        )}
      </section>

      {source === 'demo' ? (
        <>
          <section className="summary-block">
            <div className="field-label">Acabamentos</div>
            {PART_GROUPS.map((group) => (
              <div key={group.id} className="summary-row">
                <span>{group.label}</span>
                <span className="summary-value">
                  <span
                    className="part-dot"
                    style={{ background: finishById(finishes[group.id]).swatch }}
                  />
                  {finishById(finishes[group.id]).label}
                </span>
              </div>
            ))}
          </section>
          <section className="summary-block">
            <div className="field-label">Opcionais ({enabledOptions.length})</div>
            {enabledOptions.length === 0 && (
              <div className="summary-row">
                <span className="empty-note">Nenhum opcional selecionado.</span>
              </div>
            )}
            {enabledOptions.map((option) => (
              <div key={option.id} className="summary-row">
                <span>{option.label}</span>
                <span className="tag">{option.code}</span>
              </div>
            ))}
          </section>
        </>
      ) : (
        <section className="summary-block">
          <div className="field-label">Personalizações</div>
          <div className="summary-row">
            <span>Peças personalizadas</span>
            <span className="summary-value">{customized}</span>
          </div>
        </section>
      )}

      <section className="summary-actions">
        <a
          className="btn btn-primary"
          href={branding.contactUrl}
          target="_blank"
          rel="noreferrer"
        >
          Solicitar orçamento
        </a>
        {source === 'demo' && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => void copy(shareUrl(finishes, options, line), 'Link copiado!')}
          >
            Copiar link da configuração
          </button>
        )}
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => void copy(buildSummaryText(), 'Resumo copiado!')}
        >
          Copiar resumo em texto
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            if (!downloadSnapshot('configuracao-idugel.png')) {
              showToast('Não foi possível capturar a imagem.')
            }
          }}
        >
          Baixar imagem (PNG)
        </button>
        <button type="button" className="btn btn-outline" onClick={printSheet}>
          Ficha em PDF (imprimir)
        </button>
        {source === 'importado' && imported && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              exportGlb(imported.object, imported.fileName.replace(/\.[^.]+$/, ''))
                .then(() => showToast('GLB exportado — use este arquivo para carregar mais rápido.'))
                .catch(() => showToast('Falha ao exportar o GLB.'))
            }}
          >
            Exportar GLB otimizado
          </button>
        )}
      </section>
    </div>
  )
}
