import { useRef } from 'react'
import { DEMO_PRODUCT, PRODUCT_LINES } from '../../config/product'
import { useConfigurator } from '../../state/store'
import { useImportModel } from '../../hooks/useImportModel'

export function ProdutoStep() {
  const source = useConfigurator((s) => s.source)
  const line = useConfigurator((s) => s.line)
  const setLine = useConfigurator((s) => s.setLine)
  const setSource = useConfigurator((s) => s.setSource)
  const imported = useConfigurator((s) => s.imported)
  const setImported = useConfigurator((s) => s.setImported)
  const importModel = useImportModel()
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="step-body">
      <div className="field-label">Modelo em exibição</div>

      <button
        type="button"
        className={`product-card${source === 'demo' ? ' is-selected' : ''}`}
        onClick={() => setSource('demo')}
      >
        <div className="product-card-head">
          <span className="product-card-name">{DEMO_PRODUCT.shortName}</span>
          <span className="tag">{DEMO_PRODUCT.code}</span>
        </div>
        <p className="product-card-desc">{DEMO_PRODUCT.description}</p>
      </button>

      {imported && (
        <div className={`product-card${source === 'importado' ? ' is-selected' : ''}`}>
          <button
            type="button"
            className="product-card-main"
            onClick={() => setSource('importado')}
          >
            <div className="product-card-head">
              <span className="product-card-name">{imported.fileName}</span>
              <span className="tag">importado</span>
            </div>
            <p className="product-card-desc">
              {imported.parts.length} peça(s) reconhecida(s). Personalize cores e visibilidade na
              etapa seguinte.
            </p>
          </button>
          <button
            type="button"
            className="product-card-remove"
            title="Remover modelo importado"
            onClick={() => setImported(null)}
          >
            ×
          </button>
        </div>
      )}

      {source === 'demo' && (
        <>
          <div className="field-label">Linha do equipamento</div>
          <div className="line-list">
            {PRODUCT_LINES.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`line-card${line === l.id ? ' is-selected' : ''}`}
                onClick={() => setLine(l.id)}
              >
                <span className="line-card-name">{l.label}</span>
                <span className="line-card-desc">{l.description}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="field-label">Seu produto, direto do CAD</div>
      <button type="button" className="dropzone" onClick={() => fileRef.current?.click()}>
        <span className="dropzone-title">Arraste um arquivo aqui</span>
        <span className="dropzone-sub">ou clique para escolher no computador</span>
        <span className="dropzone-formats">
          <em>GLB</em>
          <em>STEP</em>
          <em>IGES</em>
          <em>STL</em>
          <em>OBJ</em>
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".glb,.gltf,.step,.stp,.iges,.igs,.brep,.brp,.stl,.obj"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void importModel(file)
          e.target.value = ''
        }}
      />

      <details className="howto">
        <summary>Como exportar do Autodesk Inventor ou Fusion?</summary>
        <div className="howto-body">
          <p>
            <strong>Inventor:</strong> Arquivo → Exportar → Formato CAD → <em>STEP (*.stp)</em>. Para
            conjuntos, exporte a montagem (.iam) inteira — cada componente vira uma peça
            configurável aqui.
          </p>
          <p>
            <strong>Fusion:</strong> Arquivo → Exportar → <em>STEP (*.step)</em>. Ou clique com o
            botão direito no componente na árvore → Exportar.
          </p>
          <p>
            O STEP é convertido em malha 3D direto no seu navegador — nada é enviado a servidores.
            Para modelos grandes, importe o STEP uma vez e use <strong>Exportar GLB</strong> (na
            etapa Resumo) para gerar um arquivo leve e rápido de recarregar.
          </p>
        </div>
      </details>
    </div>
  )
}
