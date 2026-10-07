import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { useConfigurator } from '../state/store'
import { productById } from '../catalog/products'
import { loadCatalogModel } from '../catalog/loadCatalogModel'
import { materialForFinish } from './materials'

/**
 * Produto do catálogo: GLB gerado pelo conversor, com um grupo por conjunto.
 * Os grupos configuráveis recebem o material do acabamento escolhido; os demais
 * mantêm o material do modelo.
 */
export function CatalogModel() {
  const productId = useConfigurator((s) => s.productId)
  const groupFinishes = useConfigurator((s) => s.groupFinishes)
  const setCatalogBox = useConfigurator((s) => s.setCatalogBox)
  const setCatalogLoading = useConfigurator((s) => s.setCatalogLoading)
  const showToast = useConfigurator((s) => s.showToast)
  const [object, setObject] = useState<THREE.Group | null>(null)

  useEffect(() => {
    const product = productById(productId)
    if (!product) {
      setObject(null)
      return
    }
    let cancelled = false
    setCatalogLoading(true)
    loadCatalogModel(product)
      .then(({ object, box }) => {
        if (cancelled) return
        const center = box.getCenter(new THREE.Vector3())
        const radius = box.getSize(new THREE.Vector3()).length() / 2
        setObject(object)
        setCatalogBox({ center: [center.x, center.y, center.z], radius })
      })
      .catch(() => {
        if (!cancelled) showToast('Não foi possível carregar o modelo do catálogo.', 7000)
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [productId, setCatalogBox, setCatalogLoading, showToast])

  useEffect(() => {
    if (!object) return
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      const groupId = child.userData.groupId as string | undefined
      const finishId = groupId ? groupFinishes[groupId] : undefined
      child.material = finishId
        ? materialForFinish(finishId)
        : (child.userData.originalMaterial as THREE.Material)
    })
  }, [object, groupFinishes])

  if (!object) return null
  return <primitive object={object} />
}
