import {
  DEMO_PRODUCT,
  OPTIONS,
  PART_GROUPS,
  PRODUCT_LINES,
  finishById,
} from '../../config/product'
import { configurableGroups, productById } from '../../catalog/products'
import { branding } from '../../config/branding'
import { useConfigurator } from '../../state/store'
import { currentShareUrl } from '../../utils/share'
import { captureSnapshot, downloadSnapshot } from '../../utils/viewerHandles'
import { exportGlb } from '../../utils/exportGlb'

export function buildSummaryText(): string {
  const { source, line, finishes, options, imported, overrides, productId, groupFinishes } =
    useConfigurator.getState()
  const lines: string[] = []
  lines.push(`Configuração — ${branding.companyName}`)
  const product = source === 'catalogo' ? productById(productId) : undefined
  if (product) {
    lines.push(`Produto: ${product.name} (${product.code}) · Linha ${product.line}`)
    lines.push('')
    lines.push('Especificações:')
    for (const spec of product.specs) lines.push(`  • ${spec.label}: ${spec.value}`)
    lines.push('')
    lines.push('Acabamentos:')
    for (const group of configurableGroups(product)) {
      const finishId = groupFinishes[group.id] ?? product.groups[group.id].defaultFinish
      lines.push(`  • ${group.rotulo}: ${finishById(finishId).label}`)
    }
    const url = currentShareUrl()
    if (url) {
      lines.push('')
      lines.push(`Link da configuração: ${url}`)
    }
  } else if (source === 'demo') {
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
    const url = currentShareUrl()
    if (url) {
      lines.push('')
      lines.push(`Link da configuração: ${url}`)
    }
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
  const productId = useConfigurator((s) => s.productId)
  const groupFinishes = useConfigurator((s) => s.groupFinishes)
  const showToast = useConfigurator((s) => s.showToast)

  const product = source === 'catalogo' ? productById(productId) : undefined
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

  const productName = product
    ? product.name
    : source === 'demo'
      ? DEMO_PRODUCT.name
      : (imported?.fileName ?? '—')
  const productTag = product
    ? product.code
    : source === 'demo'
      ? DEMO_PRODUCT.code
      : `${imported?.parts.length ?? 0} peças`

  return (
    <div className="step-body">
      <section className="summary-block">
        <div className="field-label">Produto</div>
        <div className="summary-row">
          <span>{productName}</span>
          <span className="tag">{productTag}</span>
        </div>
        {product && (
          <div className="summary-row">
            <span>Linha</span>
            <span className="summary-value">{product.line}</span>
          </div>
        )}
        {source === 'demo' && productLine && (
          <div className="summary-row">
            <span>Linha</span>
            <span className="summary-value">{productLine.label}</span>
          </div>
        )}
      </section>

      {product && (
        <>
          <section className="summary-block">
            <div className="field-label">Especificações</div>
            {product.specs.map((spec) => (
              <div key={spec.label} className="summary-row">
                <span>{spec.label}</span>
                <span className="summary-value">{spec.value}</span>
              </div>
            ))}
          </section>
          <section className="summary-block">
            <div className="field-label">Acabamentos</div>
            {configurableGroups(product).map((group) => {
              const finish = finishById(
                groupFinishes[group.id] ?? product.groups[group.id].defaultFinish,
              )
              return (
                <div key={group.id} className="summary-row">
                  <span>{group.rotulo}</span>
                  <span className="summary-value">
                    <span className="part-dot" style={{ background: finish.swatch }} />
                    {finish.label}
                  </span>
                </div>
              )
            })}
          </section>
        </>
      )}

      {source === 'demo' && (
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
      )}

      {source === 'importado' && (
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
        {source !== 'importado' && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              const url = currentShareUrl()
              if (url) void copy(url, 'Link copiado!')
            }}
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
