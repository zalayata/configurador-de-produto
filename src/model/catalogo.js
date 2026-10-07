// Modelo de produto do catálogo no contrato do visualizador (CONTRATOS.md, seção 2):
//   { id, descricao, root, groups, anchors, explode, bounds, labels, animated, dispose }
// A geometria vem do GLB gerado por tools/cad/converter-step.mjs: um nó por grupo, um nó filho por
// malha, `userData.groupId` e `userData.label` em cada malha; metros, Y para cima, piso em y = 0.
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { urlDoModelo } from '../catalog/products.js'

const cache = new Map() // produtoId -> Promise<gltf.scene clonável>

function lerGlb(produto, aoProgresso) {
  if (!cache.has(produto.id)) {
    const carregador = new GLTFLoader()
    const p = new Promise((resolve, reject) => {
      carregador.load(
        urlDoModelo(produto),
        (gltf) => resolve(gltf.scene),
        (e) => { if (aoProgresso && e.lengthComputable) aoProgresso(e.loaded / e.total) },
        reject,
      )
    })
    p.catch(() => cache.delete(produto.id))
    cache.set(produto.id, p)
  }
  return cache.get(produto.id)
}

/**
 * Deslocamentos da vista explodida: cada grupo sai do centro do produto na direção do seu próprio
 * centro (horizontal), e os grupos altos sobem. Nenhum dado além da geometria entra aqui.
 */
function calcularExplodida(grupos, limites) {
  const centro = limites.getCenter(new THREE.Vector3())
  const tamanho = limites.getSize(new THREE.Vector3())
  const alcance = Math.max(tamanho.x, tamanho.z) * 0.55
  const explode = {}
  for (const [id, no] of Object.entries(grupos)) {
    const caixa = new THREE.Box3().setFromObject(no)
    if (caixa.isEmpty()) { explode[id] = new THREE.Vector3(); continue }
    const c = caixa.getCenter(new THREE.Vector3())
    const d = new THREE.Vector3(c.x - centro.x, 0, c.z - centro.z)
    if (d.lengthSq() < 1e-4) d.set(0, 0, 0)
    else d.normalize().multiplyScalar(alcance)
    // altura relativa (0 na base, 1 no topo) decide o quanto o grupo sobe
    const h = tamanho.y > 0 ? (c.y - limites.min.y) / tamanho.y : 0
    d.y = tamanho.y * (0.15 + 0.55 * h)
    explode[id] = d
  }
  return explode
}

/**
 * Monta o modelo de um produto do catálogo.
 * @param {object} produto  item de CATALOGO
 * @param {{ aoProgresso?: (fracao: number) => void }} opcoes
 */
export async function construirModeloCatalogo(produto, { aoProgresso } = {}) {
  const cena = await lerGlb(produto, aoProgresso)
  // cada instância do modelo clona a cena (geometrias compartilhadas, materiais próprios por grupo)
  const root = cena.clone(true)
  root.name = produto.id
  const materiaisPorGrupo = new Map()
  const groups = {}
  const labels = {}
  root.traverse((o) => {
    const gid = o.userData?.groupId
    if (!gid) return
    if (!o.isMesh) {
      // nó do grupo (filho direto da raiz do produto)
      if (o.children.length && !groups[gid]) groups[gid] = o
      if (o.userData.label) labels[gid] = o.userData.label
      return
    }
    o.castShadow = true
    o.receiveShadow = true
    // um material próprio por grupo nesta instância (o visualizador recolore por grupo)
    let m = materiaisPorGrupo.get(gid)
    if (!m) {
      const base = Array.isArray(o.material) ? o.material[0] : o.material
      m = base.clone()
      m.envMapIntensity = 0.8
      materiaisPorGrupo.set(gid, m)
    }
    o.material = m
    if (!labels[gid] && o.userData.label) labels[gid] = o.userData.label
  })
  // rótulos e âncoras do manifesto prevalecem (são a fonte pública)
  const anchors = {}
  for (const g of produto.manifesto.grupos) {
    labels[g.id] = g.rotulo
    anchors[g.id] = new THREE.Vector3(...g.ancora)
    if (!groups[g.id]) {
      const no = root.getObjectByName(g.id)
      if (no) groups[g.id] = no
    }
  }
  root.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(root)
  const explode = calcularExplodida(groups, bounds)
  // tampas de corte: grupos grandes primeiro (envoltórios), miúdos por último
  const capOrder = [...produto.manifesto.grupos]
    .sort((a, b) => volume(b) - volume(a))
    .map((g) => g.id)

  return {
    id: produto.id,
    descricao: `Modelo 3D do ${produto.nome}, gerado a partir do projeto Idugel.`,
    root,
    groups,
    anchors,
    explode,
    bounds,
    labels,
    capOrder,
    animated: null,
    dispose() {
      for (const m of materiaisPorGrupo.values()) m.dispose()
      materiaisPorGrupo.clear()
    },
  }
}

const volume = (g) => (g.max[0] - g.min[0]) * (g.max[1] - g.min[1]) * (g.max[2] - g.min[2])
