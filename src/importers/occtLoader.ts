import occtFactory, { type OcctInstance } from 'occt-import-js'
import wasmUrl from 'occt-import-js/dist/occt-import-js.wasm?url'

let instancePromise: Promise<OcctInstance> | null = null

/**
 * Inicializa (uma única vez) o OpenCascade compilado para WebAssembly.
 * É ele que converte arquivos STEP/IGES/BREP em malhas trianguladas.
 */
export function getOcct(): Promise<OcctInstance> {
  if (!instancePromise) {
    instancePromise = occtFactory({
      locateFile: () => wasmUrl,
    })
  }
  return instancePromise
}

export type CadFormat = 'step' | 'iges' | 'brep'

export async function readCadFile(format: CadFormat, buffer: ArrayBuffer) {
  const occt = await getOcct()
  const content = new Uint8Array(buffer)
  const result =
    format === 'step'
      ? occt.ReadStepFile(content, null)
      : format === 'iges'
        ? occt.ReadIgesFile(content, null)
        : occt.ReadBrepFile(content, null)
  if (!result.success) {
    throw new Error('O arquivo CAD não pôde ser interpretado. Verifique se é um STEP/IGES válido.')
  }
  return result
}
