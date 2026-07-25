import { useEffect, useState } from 'react'
import {
  DEMO_PRODUCT,
  OPTIONS,
  PART_GROUPS,
  PRODUCT_LINES,
  finishById,
} from '../config/product'
import { branding } from '../config/branding'
import { useConfigurator } from '../state/store'

/**
 * Ficha técnica exibida apenas na impressão (Ctrl+P / botão "Ficha em PDF").
 * Recebe a captura da cena pelo evento "configurator:print".
 */
export function PrintSheet() {
  const [snapshot, setSnapshot] = useState<string | null>(null)
  const source = useConfigurator((s) => s.source)
  const line = useConfigurator((s) => s.line)
  const finishes = useConfigurator((s) => s.finishes)
  const options = useConfigurator((s) => s.options)
  const imported = useConfigurator((s) => s.imported)
  const overrides = useConfigurator((s) => s.overrides)

  useEffect(() => {
    const onPrintRequest = (e: Event) => {
      const detail = (e as CustomEvent<string | null>).detail
      setSnapshot(detail ?? null)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => window.print())
      })
    }
    window.addEventListener('configurator:print', onPrintRequest)
    return () => window.removeEventListener('configurator:print', onPrintRequest)
  }, [])

  const productLine = PRODUCT_LINES.find((l) => l.id === line)
  const enabledOptions = OPTIONS.filter((o) => options[o.id])
  const customParts = imported
    ? imported.parts.filter((p) => {
        const o = overrides[p.id]
        return o && (o.finishId || o.visible === false)
      })
    : []
  const today = new Date().toLocaleDateString('pt-BR')

  return (
    <div className="print-sheet">
      <header className="print-head">
        <div className="print-brand">
          <img src={`${import.meta.env.BASE_URL}logo-idugel.svg`} alt="" />
          <div>
            <strong>{branding.companyName}</strong> · Configurador de produto
            <div className="print-tagline">{branding.tagline}</div>
          </div>
        </div>
        <div className="print-date">Gerado em {today}</div>
      </header>

      {snapshot && <img className="print-snapshot" src={snapshot} alt="Visão do equipamento" />}

      <h2 className="print-product">
        {source === 'demo' ? DEMO_PRODUCT.name : `Modelo importado — ${imported?.fileName ?? ''}`}
      </h2>
      {source === 'demo' && productLine && (
        <p className="print-line">Linha {productLine.label}</p>
      )}

      {source === 'demo' ? (
        <>
          <h3>Acabamentos</h3>
          <table>
            <tbody>
              {PART_GROUPS.map((group) => (
                <tr key={group.id}>
                  <td>{group.label}</td>
                  <td>{finishById(finishes[group.id]).label}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Opcionais</h3>
          <table>
            <tbody>
              {enabledOptions.length === 0 && (
                <tr>
                  <td colSpan={2}>Nenhum opcional selecionado</td>
                </tr>
              )}
              {enabledOptions.map((option) => (
                <tr key={option.id}>
                  <td>{option.code}</td>
                  <td>{option.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <>
          <h3>Peças personalizadas</h3>
          <table>
            <tbody>
              {customParts.length === 0 && (
                <tr>
                  <td colSpan={2}>Nenhuma personalização aplicada</td>
                </tr>
              )}
              {customParts.map((part) => {
                const o = overrides[part.id]
                const details: string[] = []
                if (o?.finishId) details.push(finishById(o.finishId).label)
                if (o?.visible === false) details.push('oculta')
                return (
                  <tr key={part.id}>
                    <td>{part.name}</td>
                    <td>{details.join(', ')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}

      <footer className="print-foot">
        <p>Documento gerado pelo configurador — sujeito a análise técnica e proposta comercial.</p>
        <p>
          {branding.legalName} · CNPJ {branding.cnpj}
          <br />
          {branding.address} · {branding.phone} · {branding.siteUrl.replace('https://', '')}
        </p>
        <p className="print-signature">{branding.signature}</p>
      </footer>
    </div>
  )
}
