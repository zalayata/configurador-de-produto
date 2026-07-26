import type * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

/**
 * Exporta o modelo atual como GLB — útil para converter STEP/IGES
 * (pesados) em GLB otimizado para web, direto no navegador.
 */
export function exportGlb(object: THREE.Object3D, fileName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(
      object,
      (result) => {
        const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName.endsWith('.glb') ? fileName : `${fileName}.glb`
        link.click()
        URL.revokeObjectURL(url)
        resolve()
      },
      (error) => reject(error instanceof Error ? error : new Error('Falha ao exportar GLB.')),
      { binary: true },
    )
  })
}
