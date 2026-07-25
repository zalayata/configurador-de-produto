import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import type { CadFormat } from './occtLoader'
import type { PartInfo } from '../state/store'

export const SUPPORTED_EXTENSIONS = [
  'glb',
  'gltf',
  'step',
  'stp',
  'iges',
  'igs',
  'brep',
  'brp',
  'stl',
  'obj',
] as const

export interface LoadResult {
  object: THREE.Group
  parts: PartInfo[]
}

const CAD_STEEL = new THREE.Color('#b9c1c7')

function defaultMaterial(color?: THREE.Color) {
  return new THREE.MeshStandardMaterial({
    color: color ?? CAD_STEEL.clone(),
    metalness: 0.55,
    roughness: 0.45,
  })
}

/**
 * Converte o resultado do occt-import-js (STEP/IGES/BREP) em um grupo Three.js,
 * preservando nomes e cores definidos no CAD.
 */
async function loadCad(format: CadFormat, buffer: ArrayBuffer): Promise<THREE.Group> {
  // Carregado sob demanda: o conversor OpenCascade (WASM) só é baixado
  // quando o usuário importa um arquivo CAD de fato.
  const { readCadFile } = await import('./occtLoader')
  const result = await readCadFile(format, buffer)
  const group = new THREE.Group()
  group.name = 'cad-root'

  result.meshes.forEach((mesh, i) => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(mesh.attributes.position.array, 3),
    )
    if (mesh.attributes.normal) {
      geometry.setAttribute(
        'normal',
        new THREE.Float32BufferAttribute(mesh.attributes.normal.array, 3),
      )
    } else {
      geometry.computeVertexNormals()
    }
    geometry.setIndex(mesh.index.array.length > 65_535
      ? new THREE.Uint32BufferAttribute(mesh.index.array, 1)
      : new THREE.Uint16BufferAttribute(mesh.index.array, 1))

    const color = mesh.color
      ? new THREE.Color(mesh.color[0], mesh.color[1], mesh.color[2])
      : undefined
    const object = new THREE.Mesh(geometry, defaultMaterial(color))
    object.name = mesh.name?.trim() || `Peça ${i + 1}`
    group.add(object)
  })

  if (group.children.length === 0) {
    throw new Error('O arquivo não contém geometria sólida para exibir.')
  }
  return group
}

function loadGltf(buffer: ArrayBuffer): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(
      buffer,
      '',
      (gltf) => {
        const group = new THREE.Group()
        group.add(gltf.scene)
        resolve(group)
      },
      (error) =>
        reject(
          error instanceof Error
            ? error
            : new Error('Falha ao ler o glTF. Prefira arquivos .glb com texturas embutidas.'),
        ),
    )
  })
}

function loadStl(buffer: ArrayBuffer): THREE.Group {
  const geometry = new STLLoader().parse(buffer)
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, defaultMaterial())
  mesh.name = 'Peça única'
  const group = new THREE.Group()
  group.add(mesh)
  return group
}

function loadObj(buffer: ArrayBuffer): THREE.Group {
  const text = new TextDecoder().decode(buffer)
  const parsed = new OBJLoader().parse(text)
  const group = new THREE.Group()
  parsed.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material = defaultMaterial()
    }
  })
  group.add(parsed)
  return group
}

/**
 * Normaliza escala e posição: centraliza o modelo na origem,
 * apoia no piso (y = 0) e ajusta para ~4 unidades de tamanho.
 */
function normalize(object: THREE.Group) {
  const box = new THREE.Box3().setFromObject(object)
  if (box.isEmpty()) return
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)
  const scale = maxDim > 0 ? 3.0 / maxDim : 1
  object.scale.setScalar(scale)
  const scaled = new THREE.Box3().setFromObject(object)
  const center = scaled.getCenter(new THREE.Vector3())
  object.position.x -= center.x
  object.position.z -= center.z
  object.position.y -= scaled.min.y
}

/** Marca cada malha com um id estável e coleta a lista de peças para a interface. */
function collectParts(object: THREE.Group): PartInfo[] {
  const parts: PartInfo[] = []
  let i = 0
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const id = `p${i++}`
      child.userData.partId = id
      child.userData.originalMaterial = child.material
      child.castShadow = true
      child.receiveShadow = true
      parts.push({ id, name: child.name?.trim() || `Peça ${i}` })
    }
  })
  return parts
}

export function extensionOf(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

export async function loadModelFile(file: File): Promise<LoadResult> {
  const ext = extensionOf(file.name)
  const buffer = await file.arrayBuffer()

  let object: THREE.Group
  switch (ext) {
    case 'glb':
    case 'gltf':
      object = await loadGltf(buffer)
      break
    case 'step':
    case 'stp':
      object = await loadCad('step', buffer)
      break
    case 'iges':
    case 'igs':
      object = await loadCad('iges', buffer)
      break
    case 'brep':
    case 'brp':
      object = await loadCad('brep', buffer)
      break
    case 'stl':
      object = loadStl(buffer)
      break
    case 'obj':
      object = loadObj(buffer)
      break
    default:
      throw new Error(
        `Formato ".${ext}" não suportado. Use GLB, STEP, IGES, STL ou OBJ — no Inventor/Fusion, exporte como STEP.`,
      )
  }

  const parts = collectParts(object)
  if (parts.length === 0) {
    throw new Error('Nenhuma malha encontrada no arquivo.')
  }
  normalize(object)
  return { object, parts }
}
