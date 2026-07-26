import * as THREE from 'three'
import { finishById } from '../config/product'

const cache = new Map<string, THREE.MeshStandardMaterial>()

/** Materiais compartilhados por acabamento (cache global). */
export function materialForFinish(finishId: string): THREE.MeshStandardMaterial {
  let material = cache.get(finishId)
  if (!material) {
    const finish = finishById(finishId)
    material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(finish.color),
      metalness: finish.metalness,
      roughness: finish.roughness,
      envMapIntensity: finish.kind === 'inox' ? 1.15 : 0.65,
    })
    material.name = `finish:${finishId}`
    cache.set(finishId, material)
  }
  return material
}

/** Materiais fixos de detalhes que não mudam com o acabamento. */
export const fixed = {
  borracha: new THREE.MeshStandardMaterial({
    color: '#17191c',
    metalness: 0.05,
    roughness: 0.92,
  }),
  inoxDetalhe: new THREE.MeshStandardMaterial({
    color: '#c2c8cd',
    metalness: 0.9,
    roughness: 0.3,
  }),
  telaDesligada: new THREE.MeshStandardMaterial({
    color: '#101418',
    metalness: 0.4,
    roughness: 0.25,
  }),
  telaLigada: new THREE.MeshStandardMaterial({
    color: '#0a2436',
    emissive: new THREE.Color('#2f9bff'),
    emissiveIntensity: 1.6,
    metalness: 0.2,
    roughness: 0.3,
  }),
  luzVerde: new THREE.MeshStandardMaterial({
    color: '#1d3324',
    emissive: new THREE.Color('#38d87a'),
    emissiveIntensity: 1.4,
    roughness: 0.4,
  }),
  luzAmbar: new THREE.MeshStandardMaterial({
    color: '#3a2c14',
    emissive: new THREE.Color('#f5a623'),
    emissiveIntensity: 0.25,
    roughness: 0.4,
  }),
  luzVermelha: new THREE.MeshStandardMaterial({
    color: '#3a1414',
    emissive: new THREE.Color('#e04040'),
    emissiveIntensity: 0.2,
    roughness: 0.4,
  }),
  botao: new THREE.MeshStandardMaterial({
    color: '#22282d',
    metalness: 0.5,
    roughness: 0.4,
  }),
}
