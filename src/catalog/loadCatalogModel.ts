import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { modelUrl, type CatalogProduct } from './products'

export interface CatalogModelData {
  object: THREE.Group
  /** Caixa envolvente em metros (o GLB já vem em metros, com o piso em y = 0). */
  box: THREE.Box3
}

const cache = new Map<string, Promise<CatalogModelData>>()

/**
 * Carrega o GLB de um produto do catálogo uma única vez. Cada malha chega com
 * `userData.groupId` e `userData.label` gravados pelo conversor; o material do GLB
 * fica guardado em `userData.originalMaterial` para os grupos não configuráveis.
 */
export function loadCatalogModel(product: CatalogProduct): Promise<CatalogModelData> {
  let pending = cache.get(product.id)
  if (!pending) {
    pending = new GLTFLoader().loadAsync(modelUrl(product)).then((gltf) => {
      const object = new THREE.Group()
      object.name = product.id
      object.add(gltf.scene)
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        child.castShadow = true
        child.receiveShadow = true
        const material = child.material as THREE.Material
        if (material instanceof THREE.MeshStandardMaterial) {
          material.envMapIntensity = 0.8
        }
        child.userData.originalMaterial = material
      })
      const box = new THREE.Box3().setFromObject(object)
      return { object, box }
    })
    cache.set(product.id, pending)
    pending.catch(() => cache.delete(product.id))
  }
  return pending
}
