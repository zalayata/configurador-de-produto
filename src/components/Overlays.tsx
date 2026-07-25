import { useEffect, useState } from 'react'
import { useConfigurator } from '../state/store'
import { useImportModel } from '../hooks/useImportModel'

/** Área de soltar arquivos que cobre a tela durante o arraste. */
export function DropOverlay() {
  const [dragging, setDragging] = useState(false)
  const importModel = useImportModel()

  useEffect(() => {
    let depth = 0
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      depth += 1
      setDragging(true)
    }
    const onDragLeave = () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
    }
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.files.length) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      const file = e.dataTransfer.files[0]
      void importModel(file)
    }
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [importModel])

  if (!dragging) return null
  return (
    <div className="drop-overlay">
      <div className="drop-overlay-box">
        <span className="drop-overlay-title">Solte o arquivo para importar</span>
        <span className="drop-overlay-sub">GLB · STEP · IGES · STL · OBJ</span>
      </div>
    </div>
  )
}

export function LoadingOverlay() {
  const importing = useConfigurator((s) => s.importing)
  const importingFile = useConfigurator((s) => s.importingFile)
  if (!importing) return null
  return (
    <div className="loading-overlay" role="status">
      <div className="loading-box">
        <span className="spinner" aria-hidden="true" />
        <span className="loading-title">Convertendo geometria CAD…</span>
        {importingFile && <span className="loading-file">{importingFile}</span>}
        <span className="loading-note">
          Tudo acontece no seu navegador — nada é enviado a servidores.
        </span>
      </div>
    </div>
  )
}

export function Toast() {
  const toast = useConfigurator((s) => s.toast)
  const dismissToast = useConfigurator((s) => s.dismissToast)
  if (!toast) return null
  return (
    <button type="button" className="toast" onClick={dismissToast}>
      {toast}
    </button>
  )
}
