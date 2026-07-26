import { useCallback } from 'react'
import { useConfigurator } from '../state/store'
import { loadModelFile, extensionOf, SUPPORTED_EXTENSIONS } from '../importers/loadModel'

export function useImportModel() {
  const setImporting = useConfigurator((s) => s.setImporting)
  const setImported = useConfigurator((s) => s.setImported)
  const showToast = useConfigurator((s) => s.showToast)

  return useCallback(
    async (file: File) => {
      const ext = extensionOf(file.name)
      if (!(SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)) {
        showToast(
          `Formato ".${ext}" não suportado. Exporte como STEP no Inventor/Fusion, ou use GLB, STL e OBJ.`,
          7000,
        )
        return
      }
      setImporting(true, file.name)
      // dá tempo do overlay de carregamento aparecer antes do parse pesado
      await new Promise((resolve) => setTimeout(resolve, 60))
      try {
        const started = performance.now()
        const { object, parts } = await loadModelFile(file)
        setImported({ fileName: file.name, object, parts })
        const seconds = ((performance.now() - started) / 1000).toFixed(1)
        showToast(`Modelo importado: ${parts.length} peça(s) em ${seconds}s.`)
      } catch (error) {
        // mantém o modelo anterior (se houver) — só descarta a tentativa que falhou
        showToast(
          error instanceof Error ? error.message : 'Não foi possível importar o arquivo.',
          7000,
        )
      } finally {
        setImporting(false)
      }
    },
    [setImporting, setImported, showToast],
  )
}
