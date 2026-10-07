// Modelo importado pelo usuário (STEP/IGES/BREP via OpenCascade em WebAssembly, GLB, STL, OBJ)
// no contrato do visualizador: cada peça vira um grupo configurável.
// Nada sai do navegador: a conversão acontece localmente.
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'

export const EXTENSOES = ['glb', 'gltf', 'step', 'stp', 'iges', 'igs', 'brep', 'brp', 'stl', 'obj']
export const extensaoDe = (nome) => (nome.split('.').pop() || '').toLowerCase()

const ACO = new THREE.Color('#b9c1c7')
const materialPadrao = (cor) => new THREE.MeshStandardMaterial({ color: cor || ACO.clone(), metalness: 0.45, roughness: 0.5 })

let occtPromise = null
async function occt() {
  if (!occtPromise) {
    occtPromise = (async () => {
      const [{ default: iniciar }, { default: wasmUrl }] = await Promise.all([
        import('occt-import-js'),
        import('occt-import-js/dist/occt-import-js.wasm?url'),
      ])
      return iniciar({ locateFile: () => wasmUrl })
    })()
    occtPromise.catch(() => { occtPromise = null })
  }
  return occtPromise
}

async function lerCad(formato, buffer) {
  const o = await occt()
  const dados = new Uint8Array(buffer)
  const opcoes = { linearDeflection: 0.8, angularDeflection: 0.35 }
  const r = formato === 'step' ? o.ReadStepFile(dados, opcoes) : formato === 'iges' ? o.ReadIgesFile(dados, opcoes) : o.ReadBrepFile(dados, opcoes)
  if (!r || !r.success) throw new Error('O OpenCascade não conseguiu ler o arquivo.')
  const grupo = new THREE.Group()
  r.meshes.forEach((m, i) => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(m.attributes.position.array, 3))
    if (m.attributes.normal) geo.setAttribute('normal', new THREE.Float32BufferAttribute(m.attributes.normal.array, 3))
    else geo.computeVertexNormals()
    geo.setIndex(m.index.array.length > 65535 ? new THREE.Uint32BufferAttribute(m.index.array, 1) : new THREE.Uint16BufferAttribute(m.index.array, 1))
    const cor = m.color ? new THREE.Color(m.color[0], m.color[1], m.color[2]) : undefined
    const malha = new THREE.Mesh(geo, materialPadrao(cor))
    malha.name = (m.name || '').trim() || `Peça ${i + 1}`
    grupo.add(malha)
  })
  // STEP/IGES costumam vir em milímetros
  grupo.scale.setScalar(0.001)
  return grupo
}

function lerGltf(buffer) {
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(buffer, '', (gltf) => resolve(gltf.scene), (e) => reject(e instanceof Error ? e : new Error('Falha ao ler o glTF.')))
  })
}

function lerStl(buffer) {
  const geo = new STLLoader().parse(buffer)
  geo.computeVertexNormals()
  const malha = new THREE.Mesh(geo, materialPadrao())
  malha.name = 'Peça única'
  const g = new THREE.Group()
  g.add(malha)
  return g
}

function lerObj(buffer) {
  const parsed = new OBJLoader().parse(new TextDecoder().decode(buffer))
  parsed.traverse((o) => { if (o.isMesh) o.material = materialPadrao() })
  return parsed
}

/** Escala para metros quando o arquivo claramente veio em milímetros, centra em XZ e apoia no piso. */
function normalizar(objeto) {
  objeto.updateMatrixWorld(true)
  let caixa = new THREE.Box3().setFromObject(objeto)
  if (caixa.isEmpty()) return
  const maior = caixa.getSize(new THREE.Vector3()).length()
  if (maior > 40) objeto.scale.multiplyScalar(0.001) // milímetros → metros
  else if (maior < 0.05) objeto.scale.multiplyScalar(1000) // um modelo de poucos centímetros em quilômetros é improvável
  objeto.updateMatrixWorld(true)
  caixa = new THREE.Box3().setFromObject(objeto)
  const centro = caixa.getCenter(new THREE.Vector3())
  objeto.position.x -= centro.x
  objeto.position.z -= centro.z
  objeto.position.y -= caixa.min.y
  objeto.updateMatrixWorld(true)
}

/**
 * Lê um arquivo e devolve o modelo no contrato do visualizador. Cada malha vira um grupo `p<n>`.
 * @param {File} arquivo
 */
export async function construirModeloImportado(arquivo) {
  const ext = extensaoDe(arquivo.name)
  const buffer = await arquivo.arrayBuffer()
  let objeto
  switch (ext) {
    case 'glb': case 'gltf': objeto = await lerGltf(buffer); break
    case 'step': case 'stp': objeto = await lerCad('step', buffer); break
    case 'iges': case 'igs': objeto = await lerCad('iges', buffer); break
    case 'brep': case 'brp': objeto = await lerCad('brep', buffer); break
    case 'stl': objeto = lerStl(buffer); break
    case 'obj': objeto = lerObj(buffer); break
    default: throw new Error(`Formato ".${ext}" não suportado. Use GLB, STEP, IGES, STL ou OBJ — no Inventor, Fusion ou SolidWorks, exporte como STEP.`)
  }
  const root = new THREE.Group()
  root.name = 'importado'
  root.add(objeto)
  normalizar(root)

  // cada malha vira um grupo: reempacota a malha num Group próprio (o visualizador move grupos na explodida)
  const groups = {}
  const labels = {}
  const anchors = {}
  const malhas = []
  root.traverse((o) => { if (o.isMesh) malhas.push(o) })
  if (!malhas.length) throw new Error('O arquivo não contém geometria sólida para exibir.')
  malhas.forEach((malha, i) => {
    const id = `p${i + 1}`
    const nome = (malha.name || '').trim() || `Peça ${i + 1}`
    const pai = malha.parent
    const envolucro = new THREE.Group()
    envolucro.name = id
    envolucro.userData.groupId = id
    // preserva a posição da malha dentro do envolucro
    pai.add(envolucro)
    envolucro.add(malha)
    malha.castShadow = true
    malha.receiveShadow = true
    malha.userData = { ...malha.userData, groupId: id, label: nome, peca: nome }
    if (Array.isArray(malha.material)) malha.material = malha.material[0]
    groups[id] = envolucro
    labels[id] = nome
  })
  root.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(root)
  const centro = bounds.getCenter(new THREE.Vector3())
  const tamanho = bounds.getSize(new THREE.Vector3())
  const explode = {}
  for (const [id, g] of Object.entries(groups)) {
    const caixa = new THREE.Box3().setFromObject(g)
    const c = caixa.getCenter(new THREE.Vector3())
    anchors[id] = new THREE.Vector3(c.x, caixa.max.y, c.z)
    const d = new THREE.Vector3(c.x - centro.x, 0, c.z - centro.z)
    if (d.lengthSq() > 1e-6) d.normalize().multiplyScalar(Math.max(tamanho.x, tamanho.z) * 0.5)
    d.y = tamanho.y * (0.1 + 0.5 * ((c.y - bounds.min.y) / (tamanho.y || 1)))
    explode[id] = d
  }
  const pecas = Object.entries(labels).map(([id, nome]) => ({ id, nome }))
  return {
    id: 'importado',
    descricao: `Modelo 3D importado: ${arquivo.name}.`,
    arquivo: arquivo.name,
    root,
    groups,
    anchors,
    explode,
    bounds,
    labels,
    pecas,
    capOrder: [],
    animated: null,
    dispose() {
      root.traverse((o) => {
        if (!o.isMesh) return
        o.geometry.dispose()
        const ms = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of ms) m?.dispose?.()
      })
    },
  }
}
