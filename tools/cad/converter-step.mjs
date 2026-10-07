// Conversor STEP → GLB do catálogo Idugel.
//
// Lê um STEP com o OpenCascade em WebAssembly (occt-import-js, a mesma biblioteca usada pela
// importação no navegador), agrupa as malhas conforme o manifesto do produto, normaliza o
// sistema de coordenadas (milímetros → metros, Y para cima, piso em y = 0, centro do produto em
// x = z = 0), solda os vértices e grava:
//
//   public/models/<id>.glb   geometria pública: um nó por grupo, um nó filho por malha, com
//                            `extras = { groupId, label, peca }` em cada malha
//   public/models/<id>.json  manifesto: grupos, contagens, limites, âncoras de etiqueta e o
//                            SHA-256 do STEP de origem e do GLB (proveniência)
//
// Uso (a partir da raiz do projeto):
//   node tools/cad/converter-step.mjs --produto tools/cad/produtos/iduflow-hg80.json --step "<arquivo.STEP>"
//   node tools/cad/converter-step.mjs --produto ... --step ... --listar     (só lista as malhas e sai)
//
// Regras: nomes públicos vêm do manifesto, nunca do CAD (os nomes do CAD podem citar fabricantes
// terceiros ou estar em outro idioma). Toda malha precisa cair em um grupo; o conversor interrompe
// a gravação se sobrar malha sem grupo ou se um grupo do manifesto ficar vazio.
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const raizProjeto = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const require = createRequire(resolve(raizProjeto, 'package.json'))

// ---------------------------------------------------------------------------------- argumentos
const args = process.argv.slice(2)
const opcao = (nome) => {
  const i = args.indexOf(`--${nome}`)
  return i >= 0 ? args[i + 1] : undefined
}
const caminhoProduto = opcao('produto')
const caminhoStep = opcao('step')
const soListar = args.includes('--listar')
if (!caminhoProduto || !caminhoStep) {
  console.error('Uso: node tools/cad/converter-step.mjs --produto <manifesto.json> --step <arquivo.STEP> [--listar]')
  process.exit(2)
}

const produto = JSON.parse(readFileSync(caminhoProduto, 'utf8'))
const bufferStep = readFileSync(caminhoStep)
const shaStep = createHash('sha256').update(bufferStep).digest('hex')

// ---------------------------------------------------------------------------------- leitura
const occt = await require('occt-import-js')()
const qualidade = produto.qualidade ?? {}
const lido = occt.ReadStepFile(new Uint8Array(bufferStep), {
  linearDeflection: qualidade.linearDeflection ?? 0.8,
  angularDeflection: qualidade.angularDeflection ?? 0.35,
})
if (!lido.success) {
  console.error('Falha ao ler o STEP.')
  process.exit(1)
}

// Caminho de nós (nomes do CAD) de cada malha, para as regras de seleção do manifesto.
const malhas = []
const andar = (no, caminho) => {
  const nome = (no.name || '').trim()
  const c = nome ? [...caminho, nome] : caminho
  for (const idx of no.meshes || []) {
    const m = lido.meshes[idx]
    const p = m.attributes.position.array
    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < p.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        if (p[i + k] < min[k]) min[k] = p[i + k]
        if (p[i + k] > max[k]) max[k] = p[i + k]
      }
    }
    malhas.push({ idx, no: c.join(' / '), nome: (m.name || '').trim(), triangulos: m.index.array.length / 3, min, max, malha: m })
  }
  for (const filho of no.children || []) andar(filho, c)
}
andar(lido.root, [])

if (soListar) {
  for (const m of malhas) {
    console.log(
      String(m.idx).padStart(3),
      String(m.triangulos).padStart(6),
      'dim',
      m.max.map((v, k) => Math.round(v - m.min[k])).join('x'),
      'min',
      m.min.map(Math.round).join(','),
      '|',
      m.no,
    )
  }
  process.exit(0)
}

// ---------------------------------------------------------------------------------- agrupamento
// Regra: { "no": "<regex sobre o caminho de nós>" } e/ou { "indices": [..] }. A primeira regra do
// manifesto que casar define o grupo. Índices são os da listagem (--listar) e valem para o mesmo STEP.
const grupos = produto.grupos.map((g) => ({ ...g, malhas: [] }))
const semGrupo = []
for (const m of malhas) {
  const grupo = grupos.find((g) =>
    (g.selecionar || []).some((regra) => {
      if (regra.indices && regra.indices.includes(m.idx)) return true
      if (regra.no && new RegExp(regra.no, 'u').test(m.no)) return true
      return false
    }),
  )
  if (grupo) grupo.malhas.push(m)
  else semGrupo.push(m)
}
if (semGrupo.length) {
  console.error(`${semGrupo.length} malha(s) sem grupo no manifesto:`)
  for (const m of semGrupo) console.error('  ', m.idx, m.no)
  process.exit(1)
}
const vazios = grupos.filter((g) => g.malhas.length === 0)
if (vazios.length) {
  console.error('Grupos sem malha:', vazios.map((g) => g.id).join(', '))
  process.exit(1)
}

// ---------------------------------------------------------------------------------- normalização
const ESCALA = 0.001
const total = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
for (const g of grupos) {
  for (const m of g.malhas) {
    for (let k = 0; k < 3; k++) {
      total.min[k] = Math.min(total.min[k], m.min[k])
      total.max[k] = Math.max(total.max[k], m.max[k])
    }
  }
}
// Deslocamento (mm, antes da escala): centro em X e Z; piso = ponto mais baixo (os amortecedores).
const desloc = [-(total.min[0] + total.max[0]) / 2, -total.min[1], -(total.min[2] + total.max[2]) / 2]
// Rotação opcional em torno de Y (graus), para a frente do produto olhar para +Z.
const rotY = ((produto.rotacaoY ?? 0) * Math.PI) / 180
const cosR = Math.cos(rotY)
const sinR = Math.sin(rotY)
const transformar = (x, y, z) => {
  const px = (x + desloc[0]) * ESCALA
  const py = (y + desloc[1]) * ESCALA
  const pz = (z + desloc[2]) * ESCALA
  return [px * cosR + pz * sinR, py, -px * sinR + pz * cosR]
}
const girarNormal = (x, y, z) => [x * cosR + z * sinR, y, -x * sinR + z * cosR]

// ---------------------------------------------------------------------------------- solda
// Vértices com mesma posição (0,01 mm) e mesma normal (3 casas) viram um só.
function soldar(malha) {
  const p = malha.attributes.position.array
  const n = malha.attributes.normal ? malha.attributes.normal.array : null
  const idx = malha.index.array
  const mapa = new Map()
  const pos = []
  const nor = []
  const remap = new Int32Array(p.length / 3)
  for (let v = 0; v < p.length / 3; v++) {
    const [x, y, z] = transformar(p[v * 3], p[v * 3 + 1], p[v * 3 + 2])
    const nn = n ? girarNormal(n[v * 3], n[v * 3 + 1], n[v * 3 + 2]) : [0, 0, 0]
    const chave = `${Math.round(x * 1e5)},${Math.round(y * 1e5)},${Math.round(z * 1e5)}|${nn.map((c) => Math.round(c * 1e3)).join(',')}`
    let id = mapa.get(chave)
    if (id === undefined) {
      id = pos.length / 3
      mapa.set(chave, id)
      pos.push(x, y, z)
      nor.push(...nn)
    }
    remap[v] = id
  }
  const indices = new Uint32Array(idx.length)
  for (let i = 0; i < idx.length; i++) indices[i] = remap[idx[i]]
  const positions = new Float32Array(pos)
  const normals = new Float32Array(nor)
  if (!n) calcularNormais(positions, indices, normals)
  return { positions, normals, indices }
}

function calcularNormais(pos, idx, out) {
  out.fill(0)
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3
    const b = idx[i + 1] * 3
    const c = idx[i + 2] * 3
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2]
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2]
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    for (const o of [a, b, c]) {
      out[o] += nx
      out[o + 1] += ny
      out[o + 2] += nz
    }
  }
  for (let i = 0; i < out.length; i += 3) {
    const l = Math.hypot(out[i], out[i + 1], out[i + 2]) || 1
    out[i] /= l
    out[i + 1] /= l
    out[i + 2] /= l
  }
}

// ---------------------------------------------------------------------------------- GLB
// Escritor mínimo de glTF 2.0 binário: um buffer, um bufferView por atributo, acessores com
// min/max nas posições, um material por grupo, um nó por grupo e um nó filho por malha.
const partes = []
let tamanhoBuffer = 0
const bufferViews = []
const acessores = []
function adicionarView(arr, target) {
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength)
  const offset = tamanhoBuffer
  partes.push(bytes)
  tamanhoBuffer += bytes.byteLength
  const sobra = (4 - (tamanhoBuffer % 4)) % 4
  if (sobra) {
    partes.push(new Uint8Array(sobra))
    tamanhoBuffer += sobra
  }
  bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.byteLength, target })
  return bufferViews.length - 1
}
function adicionarAcessor(arr, tipo, componente, target, comMinMax = false) {
  const n = tipo === 'VEC3' ? 3 : 1
  const acc = { bufferView: adicionarView(arr, target), componentType: componente, count: arr.length / n, type: tipo }
  if (comMinMax) {
    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < arr.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        if (arr[i + k] < min[k]) min[k] = arr[i + k]
        if (arr[i + k] > max[k]) max[k] = arr[i + k]
      }
    }
    acc.min = min
    acc.max = max
  }
  acessores.push(acc)
  return acessores.length - 1
}

const FLOAT = 5126
const USHORT = 5123
const UINT = 5125
const ARRAY_BUFFER = 34962
const ELEMENT_ARRAY_BUFFER = 34963

const materiais = []
const meshesGltf = []
const nos = []
const nosGrupos = []
const resumoGrupos = []
let triangulosTotal = 0
let verticesTotal = 0
let malhasTotal = 0

for (const g of grupos) {
  const cor = g.cor ?? [0.72, 0.75, 0.78]
  materiais.push({
    name: g.id,
    pbrMetallicRoughness: { baseColorFactor: [...cor, 1], metallicFactor: g.metalico ?? 0.4, roughnessFactor: g.rugoso ?? 0.55 },
  })
  const matIdx = materiais.length - 1
  const filhos = []
  const limites = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
  let tri = 0
  g.malhas.forEach((m, i) => {
    const { positions, normals, indices } = soldar(m.malha)
    const usaShort = positions.length / 3 <= 65535
    const idxArr = usaShort ? Uint16Array.from(indices) : indices
    const accPos = adicionarAcessor(positions, 'VEC3', FLOAT, ARRAY_BUFFER, true)
    const accNor = adicionarAcessor(normals, 'VEC3', FLOAT, ARRAY_BUFFER)
    const accIdx = adicionarAcessor(idxArr, 'SCALAR', usaShort ? USHORT : UINT, ELEMENT_ARRAY_BUFFER)
    const nomePeca = (g.pecas && g.pecas[i]) || `${g.rotulo} ${g.malhas.length > 1 ? i + 1 : ''}`.trim()
    meshesGltf.push({
      name: nomePeca,
      primitives: [{ attributes: { POSITION: accPos, NORMAL: accNor }, indices: accIdx, material: matIdx }],
    })
    nos.push({
      name: nomePeca,
      mesh: meshesGltf.length - 1,
      extras: { groupId: g.id, label: g.rotulo, peca: nomePeca, origem: produto.origem?.id ?? 'cad' },
    })
    filhos.push(nos.length - 1)
    const acc = acessores[accPos]
    for (let k = 0; k < 3; k++) {
      limites.min[k] = Math.min(limites.min[k], acc.min[k])
      limites.max[k] = Math.max(limites.max[k], acc.max[k])
    }
    tri += indices.length / 3
    verticesTotal += positions.length / 3
    malhasTotal++
  })
  triangulosTotal += tri
  nos.push({ name: g.id, children: filhos, extras: { groupId: g.id, label: g.rotulo } })
  nosGrupos.push(nos.length - 1)
  const arred = (v) => Math.round(v * 1000) / 1000
  const centro = limites.min.map((v, k) => arred((v + limites.max[k]) / 2))
  resumoGrupos.push({
    id: g.id,
    rotulo: g.rotulo,
    descricao: g.descricao ?? '',
    malhas: g.malhas.length,
    triangulos: tri,
    min: limites.min.map(arred),
    max: limites.max.map(arred),
    // âncora de etiqueta: topo do grupo, no centro em X e Z
    ancora: [centro[0], arred(limites.max[1]), centro[2]],
  })
}

const limitesTotal = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
for (const r of resumoGrupos) {
  for (let k = 0; k < 3; k++) {
    limitesTotal.min[k] = Math.min(limitesTotal.min[k], r.min[k])
    limitesTotal.max[k] = Math.max(limitesTotal.max[k], r.max[k])
  }
}
const dimensoes = limitesTotal.max.map((v, k) => Math.round((v - limitesTotal.min[k]) * 1000)) // mm

nos.push({ name: produto.id, children: nosGrupos, extras: { produto: produto.id, nome: produto.nome, unidade: 'm', dimensoesMm: dimensoes } })
const raiz = nos.length - 1

const json = {
  asset: { version: '2.0', generator: 'configurador-idugel/converter-step' },
  scene: 0,
  scenes: [{ nodes: [raiz] }],
  nodes: nos,
  meshes: meshesGltf,
  materials: materiais,
  accessors: acessores,
  bufferViews,
  buffers: [{ byteLength: tamanhoBuffer }],
}
let jsonTexto = JSON.stringify(json)
while (jsonTexto.length % 4) jsonTexto += ' '
const jsonBytes = Buffer.from(jsonTexto, 'utf8')
const bin = Buffer.concat(partes.map((p) => Buffer.from(p.buffer, p.byteOffset, p.byteLength)))
const cabecalho = Buffer.alloc(12)
cabecalho.write('glTF', 0)
cabecalho.writeUInt32LE(2, 4)
cabecalho.writeUInt32LE(12 + 8 + jsonBytes.length + 8 + bin.length, 8)
const chunkJson = Buffer.alloc(8)
chunkJson.writeUInt32LE(jsonBytes.length, 0)
chunkJson.write('JSON', 4)
const chunkBin = Buffer.alloc(8)
chunkBin.writeUInt32LE(bin.length, 0)
chunkBin.writeUInt32LE(0x004e4942, 4)
const glb = Buffer.concat([cabecalho, chunkJson, jsonBytes, chunkBin, bin])

// ---------------------------------------------------------------------------------- saída
const pastaSaida = resolve(raizProjeto, produto.saida ?? 'public/models')
const pastaManifesto = resolve(raizProjeto, produto.saidaManifesto ?? 'src/catalog/modelos')
mkdirSync(pastaManifesto, { recursive: true })
mkdirSync(pastaSaida, { recursive: true })
const caminhoGlb = resolve(pastaSaida, `${produto.id}.glb`)
writeFileSync(caminhoGlb, glb)
const shaGlb = createHash('sha256').update(glb).digest('hex')

const manifesto = {
  id: produto.id,
  nome: produto.nome,
  linha: produto.linha ?? null,
  arquivo: `${produto.id}.glb`,
  unidade: 'm',
  eixoVertical: 'y',
  pisoEm: 0,
  dimensoesMm: { comprimento: dimensoes[0], altura: dimensoes[1], profundidade: dimensoes[2] },
  limites: limitesTotal,
  malhas: malhasTotal,
  triangulos: triangulosTotal,
  vertices: verticesTotal,
  bytes: glb.length,
  grupos: resumoGrupos,
  origem: {
    ...(produto.origem ?? {}),
    arquivo: basename(caminhoStep),
    sha256: shaStep,
    bytes: bufferStep.length,
  },
  glbSha256: shaGlb,
  geradoEm: new Date().toISOString().slice(0, 10),
  conversor: 'tools/cad/converter-step.mjs (occt-import-js)',
}
writeFileSync(resolve(pastaManifesto, `${produto.id}.json`), JSON.stringify(manifesto, null, 2) + '\n')

console.log(`${produto.id}: ${malhasTotal} malhas, ${triangulosTotal} triângulos, ${verticesTotal} vértices, ${(glb.length / 1024).toFixed(0)} KB`)
console.log(`  dimensões ${dimensoes.join(' × ')} mm · GLB ${caminhoGlb}`)
for (const r of resumoGrupos) console.log(`  ${r.id.padEnd(20)} ${String(r.malhas).padStart(3)} malhas ${String(r.triangulos).padStart(6)} tri`)
