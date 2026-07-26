import type * as THREE from 'three'

interface ViewerHandles {
  gl: THREE.WebGLRenderer | null
  scene: THREE.Scene | null
  camera: THREE.Camera | null
}

/**
 * Referências do renderizador mantidas fora do React para
 * captura de imagem (PNG e folha de impressão).
 */
export const viewerHandles: ViewerHandles = {
  gl: null,
  scene: null,
  camera: null,
}

export function captureSnapshot(): string | null {
  const { gl, scene, camera } = viewerHandles
  if (!gl || !scene || !camera) return null
  gl.render(scene, camera)
  return gl.domElement.toDataURL('image/png')
}

export function downloadSnapshot(fileName: string) {
  const dataUrl = captureSnapshot()
  if (!dataUrl) return false
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  link.click()
  return true
}
