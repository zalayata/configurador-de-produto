import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useConfigurator } from '../state/store'
import { materialForFinish } from './materials'

/**
 * Renderiza o modelo importado aplicando as personalizações por peça
 * (cor, visibilidade) e o destaque pulsante da peça selecionada.
 */
export function ImportedModel() {
  const imported = useConfigurator((s) => s.imported)
  const overrides = useConfigurator((s) => s.overrides)
  const selectedPart = useConfigurator((s) => s.selectedPart)
  const highlightMaterial = useRef<THREE.MeshStandardMaterial | null>(null)

  useEffect(() => {
    if (!imported) return
    highlightMaterial.current?.dispose()
    highlightMaterial.current = null

    imported.object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      const id = child.userData.partId as string | undefined
      if (!id) return
      const override = overrides[id]
      child.visible = override?.visible !== false
      const base = override?.finishId
        ? materialForFinish(override.finishId)
        : (child.userData.originalMaterial as THREE.Material)
      if (id === selectedPart) {
        const single = Array.isArray(base) ? base[0] : base
        const clone =
          single instanceof THREE.MeshStandardMaterial
            ? single.clone()
            : new THREE.MeshStandardMaterial({ color: '#8899aa' })
        clone.emissive = new THREE.Color('#d3262c')
        clone.emissiveIntensity = 0.14
        highlightMaterial.current = clone
        child.material = clone
      } else {
        child.material = base
      }
    })
  }, [imported, overrides, selectedPart])

  useFrame(({ clock }) => {
    if (highlightMaterial.current) {
      highlightMaterial.current.emissiveIntensity = 0.12 + 0.07 * Math.sin(clock.elapsedTime * 5)
    }
  })

  useEffect(
    () => () => {
      highlightMaterial.current?.dispose()
      highlightMaterial.current = null
    },
    [],
  )

  if (!imported) return null
  return <primitive object={imported.object} />
}
