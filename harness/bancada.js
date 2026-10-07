// Bancada neutra dos modelos do catálogo. Servida pelo Vite em desenvolvimento:
//   http://127.0.0.1:5173/harness/index.html?modelo=iduflow-hg80&vista=iso
// Parâmetros: modelo (id em public/models) · vista (iso | frente | lateral | tras | topo | motor)
//             cores (grupo | natural) · etiquetas (1 | 0) · fundo (escuro | claro) · grupo (id a isolar)
// Define window.__READY = true depois do primeiro quadro e window.__modelInfo com as contagens.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const q = new URLSearchParams(location.search)
const modeloId = q.get('modelo') || 'iduflow-hg80'
const vista = q.get('vista') || 'iso'
const cores = q.get('cores') || 'grupo'
const etiquetas = q.get('etiquetas') !== '0'
const claro = q.get('fundo') === 'claro'
const isolar = q.get('grupo')
if (claro) document.body.classList.add('claro')

const PALETA = ['#7FC4E8', '#E2A84B', '#8FD694', '#E88FB5', '#C9A4F2', '#F2E28A', '#8AE0D6', '#F2A68A', '#A6B8F2', '#D6E88F', '#F28AE0', '#B0B8C0']

const palco = document.getElementById('palco')
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
renderer.shadowMap.enabled = true
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
palco.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(claro ? '#e9ecef' : '#0e1d26')
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture

const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.05, 100)
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

const principal = new THREE.DirectionalLight('#fff1dc', 2.6)
principal.position.set(-3, 5, 4)
principal.castShadow = true
principal.shadow.mapSize.set(2048, 2048)
scene.add(principal)
const recorte = new THREE.DirectionalLight('#9fc4da', 1.8)
recorte.position.set(4, 3, -4)
scene.add(recorte)
scene.add(new THREE.HemisphereLight('#26404f', '#05090c', 0.35))

// piso neutro para a sombra de contato
const piso = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.ShadowMaterial({ opacity: 0.35 }))
piso.rotation.x = -Math.PI / 2
piso.receiveShadow = true
scene.add(piso)
const grade = new THREE.GridHelper(6, 12, claro ? '#9aa3aa' : '#2a343b', claro ? '#c5ccd1' : '#1b2329')
grade.position.y = 0.001
scene.add(grade)
scene.add(new THREE.AxesHelper(0.5))

const base = import.meta.env.BASE_URL || './'
// o manifesto vive em src/catalog/modelos (fonte do catálogo); a bancada roda só no servidor de desenvolvimento
const [gltf, manifesto] = await Promise.all([
  new GLTFLoader().loadAsync(`${base}models/${modeloId}.glb`),
  import(/* @vite-ignore */ `/src/catalog/modelos/${modeloId}.json`).then((m) => m.default),
])
const raiz = gltf.scene
scene.add(raiz)

const grupos = manifesto.grupos
const corDoGrupo = Object.fromEntries(grupos.map((g, i) => [g.id, PALETA[i % PALETA.length]]))
let malhas = 0
let triangulos = 0
const semUserData = []
raiz.traverse((o) => {
  if (!o.isMesh) return
  malhas++
  triangulos += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3
  o.castShadow = true
  o.receiveShadow = true
  const gid = o.userData.groupId
  if (!gid) semUserData.push(o.name)
  if (cores === 'grupo') {
    o.material = new THREE.MeshStandardMaterial({ color: corDoGrupo[gid] || '#ffffff', metalness: 0.25, roughness: 0.55 })
  }
  if (isolar && gid !== isolar) {
    o.material = o.material.clone()
    o.material.transparent = true
    o.material.opacity = 0.12
    o.castShadow = false
  }
})

// legenda
const legenda = document.getElementById('legenda')
for (const g of grupos) {
  const el = document.createElement('div')
  el.className = 'item'
  el.innerHTML = `<span class="cor" style="background:${cores === 'grupo' ? corDoGrupo[g.id] : '#8e9aa3'}"></span><span>${g.rotulo} · ${g.malhas} malhas</span>`
  legenda.appendChild(el)
}
const d = manifesto.dimensoesMm
document.getElementById('info').textContent = `${manifesto.nome}\n${d.comprimento} × ${d.altura} × ${d.profundidade} mm · ${malhas} malhas · ${triangulos} triângulos`

// etiquetas nas âncoras
const marcadores = []
if (etiquetas) {
  for (const g of grupos) {
    const el = document.createElement('div')
    el.className = 'etiqueta'
    el.textContent = g.rotulo
    document.body.appendChild(el)
    marcadores.push({ el, pos: new THREE.Vector3(...g.ancora) })
  }
}

// câmera
const caixa = new THREE.Box3().setFromObject(raiz)
const centro = caixa.getCenter(new THREE.Vector3())
const tamanho = caixa.getSize(new THREE.Vector3())
const dist = Math.max(tamanho.x, tamanho.y, tamanho.z) * 1.9
const VISTAS = {
  iso: [1, 0.65, 1],
  frente: [0, 0.25, 1],
  tras: [0, 0.25, -1],
  lateral: [1, 0.25, 0],
  topo: [0.001, 1, 0.001],
  motor: [0.7, 0.3, -1],
}
const dir = new THREE.Vector3(...(VISTAS[vista] || VISTAS.iso)).normalize()
camera.position.copy(centro).addScaledVector(dir, dist)
controls.target.copy(centro)
controls.update()

const v = new THREE.Vector3()
function quadro() {
  controls.update()
  renderer.render(scene, camera)
  for (const m of marcadores) {
    v.copy(m.pos).project(camera)
    m.el.style.left = `${((v.x + 1) / 2) * innerWidth}px`
    m.el.style.top = `${((1 - v.y) / 2) * innerHeight - 8}px`
    m.el.style.display = v.z < 1 ? 'block' : 'none'
  }
  requestAnimationFrame(quadro)
}
quadro()
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})

window.__modelInfo = { modelo: modeloId, malhas, triangulos, semUserData, grupos: grupos.length }
window.__READY = true
