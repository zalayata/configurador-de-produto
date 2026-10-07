// Modelo 3D procedural do Dosador Horizon (dosador de rosca horizontal) e o seu comportamento por capítulo:
// cada grupo (GRUPOS de capitulos.ts) tem um alvo { opacidade, fase, deslocamento } resolvido com o andamento do
// dia (alvosDosGrupos) e um estado animado que o segue a cada quadro (constante ≈ 0,12 s; com movimento reduzido
// vai direto). Sistema de coordenadas: piso y = 0, comprimento ao longo de X (acionamento em −X, descarga em +X),
// centrado na origem, caixa ≈ x ∈ [−1,6; 1,6], y ∈ [0; 1,95], z ∈ [−0,55; 0,55].
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Edges } from '@react-three/drei'
import { useHorizon } from '../estado'
import {
  GRUPO_IDS,
  GRUPOS_COMPRADOS,
  GRUPOS_FABRICADOS,
  GRUPOS_INOX,
  GRUPOS_MONTAGEM,
  GRUPOS_PINTADOS,
  entradaDosGrupos,
  passosDaEtapa,
  type Capitulo,
  type GrupoId,
  type ModoDoModelo,
} from '../capitulos'
import { STATUS, type Etapa } from '../cronograma'
import { fixed } from '../../three/materials'
import {
  APARENCIA,
  OPACIDADE_FANTASMA,
  aparenciaDoAcabamento,
  aparenciaInoxDetalhe,
  aplicarAparencia,
  caixa,
  cilindro,
  criarMaterialAnimado,
  type Aparencia,
  type Estagios,
} from './materiais'
import { ALTURA_DO_ESTRADO, Engradado } from './Engradado'
import type { Vec3 } from './cameras'

// ─── Medidas principais ──────────────────────────────────────────────────────

/** Altura do eixo da rosca. */
const EIXO_Y = 0.95
/** Raio interno do fundo da calha (Ø 0,42 m). */
const R_CALHA = 0.21
/** Comprimento da calha. */
const L_CALHA = 2.2
/** Topo das paredes da calha (flange). */
const TOPO_CALHA = 1.2
/** Posição do centro da moega e do bocal de descarga (x). */
const X_MOEGA = -0.6
const X_DESCARGA = 0.85
/** O conjunto, nas coordenadas locais, vai de x ≈ −1,95 (ventilador do motor) a x ≈ 1,27 (mancal da descarga). */
const X_MIN = -1.95
const X_MAX = 1.27
/** Deslocamento do conjunto em x para centrar o todo no palco (o motoredutor estende o lado −x). */
const DESLOC_X = -(X_MIN + X_MAX) / 2

const NOME_DO_EQUIPAMENTO = 'Dosador Horizon'
const COR_ARESTA = '#b9c6cf'
/** Constante de tempo das transições (s). */
const TAU = 0.12

// ─── Alvos por modo ──────────────────────────────────────────────────────────

export interface AlvoDoGrupo {
  /** 0 oculto · OPACIDADE_FANTASMA fantasma · 1 sólido. */
  opacidade: number
  /** 0 aço bruto · 1 superfície preparada · 2 fundo · 3 acabamento final. */
  fase: number
  /** Deslocamento do grupo em relação ao lugar final (m). */
  desloc: Vec3
}
export type AlvosDosGrupos = Record<GrupoId, AlvoDoGrupo>

const alvo = (opacidade: number, fase: number, desloc: Vec3 = [0, 0, 0]): AlvoDoGrupo => ({ opacidade, fase, desloc })
const SOLIDO = (): AlvoDoGrupo => alvo(1, 3)
const FANTASMA = (fase = 3): AlvoDoGrupo => alvo(OPACIDADE_FANTASMA, fase)
const OCULTO = (): AlvoDoGrupo => alvo(0, 3)

const todos = (f: () => AlvoDoGrupo): AlvosDosGrupos =>
  Object.fromEntries(GRUPO_IDS.map((id) => [id, f()])) as AlvosDosGrupos

/** Opacidade entre fantasma e sólido para a fração t de chegada. */
const opacidadeDe = (t: number) => OPACIDADE_FANTASMA + (1 - OPACIDADE_FANTASMA) * Math.min(1, Math.max(0, t))
const suave = (t: number) => t * t * (3 - 2 * t)

/** Vetor de afastamento de cada grupo na montagem (vem de fora para o lugar). */
const EXPLOSAO: Partial<Record<GrupoId, Vec3>> = {
  mancais: [0, 0.6, 0],
  motoredutor: [-0.8, 0.1, 0],
  descarga: [0.5, 0, 0.6],
  tampas: [0, 0.7, 0],
  painel: [0, 0, 0.8],
}

const entradaPorGrupo = (etapa: Etapa | null, reduzido: boolean): Map<GrupoId, number> => {
  const m = new Map<GrupoId, number>()
  for (const { id, t } of entradaDosGrupos(etapa, { reduzido })) m.set(id, t)
  return m
}

/** Fase da pintura pelos passos da etapa (preparação, fundo, acabamento): 0..3. */
function faseDaPintura(etapa: Etapa | null): number {
  const passos = passosDaEtapa(etapa)
  if (!passos.length) return 0
  return passos.reduce((s, p) => s + Math.min(1, Math.max(0, p.fracao)), 0)
}

/** Modo efetivo do modelo: sem cronograma (calc null, sem dados) o modelo é o conjunto completo. */
export function modoDoModelo(capitulo: Capitulo, etapa: Etapa | null): ModoDoModelo {
  if (!etapa && capitulo.etapa) return 'completo'
  return capitulo.modelo
}

/** Alvo de cada grupo do modelo para o modo e a etapa do dia. */
export function alvosDosGrupos(modo: ModoDoModelo, etapa: Etapa | null, reduzido = false): AlvosDosGrupos {
  switch (modo) {
    case 'projeto':
      return todos(FANTASMA)
    case 'suprimentos': {
      const a = todos(FANTASMA)
      const entrada = entradaPorGrupo(etapa, reduzido)
      for (const id of GRUPOS_COMPRADOS) {
        const t = entrada.get(id) ?? 0
        a[id] = alvo(opacidadeDe(t), 3, [0, 0.25 * (1 - t), 0])
      }
      return a
    }
    case 'fabricacao': {
      const a = todos(OCULTO)
      const entrada = entradaPorGrupo(etapa, reduzido)
      for (const id of GRUPOS_FABRICADOS) {
        const t = entrada.get(id) ?? 0
        a[id] = alvo(opacidadeDe(t), 0, [0, 0.25 * (1 - t), 0])
      }
      return a
    }
    case 'pintura': {
      const a = todos(OCULTO)
      const fase = faseDaPintura(etapa)
      for (const id of GRUPOS_FABRICADOS) a[id] = alvo(1, fase)
      return a
    }
    case 'montagem': {
      const a = todos(SOLIDO)
      const entrada = entradaPorGrupo(etapa, reduzido)
      for (const id of GRUPOS_MONTAGEM) {
        const t = entrada.get(id) ?? 0
        if (t <= 0) a[id] = FANTASMA()
        else if (t >= 1) a[id] = SOLIDO()
        else {
          const e = EXPLOSAO[id] ?? [0, 0.5, 0]
          const f = 1 - suave(t)
          a[id] = alvo(opacidadeDe(t), 3, [e[0] * f, e[1] * f, e[2] * f])
        }
      }
      return a
    }
    case 'nenhum':
      return todos(OCULTO)
    case 'completo':
    case 'testes':
    case 'expedicao':
    default:
      return todos(SOLIDO)
  }
}

/** Estado do engradado na expedição: fechamento = fração do passo Embalagem; cintas depois do Carregamento. */
export function estadoDoEngradado(etapa: Etapa | null): { fechamento: number; cintas: boolean } {
  const passos = passosDaEtapa(etapa)
  const embalagem = passos.find((p) => p.passo.id === 'embalagem')
  const carregamento = passos.find((p) => p.passo.id === 'carregamento')
  return {
    fechamento: embalagem ? embalagem.fracao : 0,
    cintas: carregamento ? carregamento.estado === STATUS.concluida : false,
  }
}

/** "n de total <coisa>" + ", e m chegando" quando há grupo a meio caminho. */
function contagem(ids: GrupoId[], a: AlvosDosGrupos, coisa: string): string {
  const prontos = ids.filter((id) => a[id].opacidade >= 0.999).length
  const chegando = ids.filter((id) => a[id].opacidade > OPACIDADE_FANTASMA + 0.001 && a[id].opacidade < 0.999).length
  const texto = `${prontos} de ${ids.length} ${coisa}`
  return chegando ? `${texto} e ${chegando} chegando` : texto
}

/** Texto alternativo do palco: descreve o estado do modelo no dia (afirmativo, sem datas). */
export function rotuloDoModelo(capitulo: Capitulo, etapa: Etapa | null): string {
  const modo = modoDoModelo(capitulo, etapa)
  const base = `Modelo 3D do ${NOME_DO_EQUIPAMENTO}`
  const a = alvosDosGrupos(modo, etapa, false)
  switch (modo) {
    case 'projeto':
      return `${base} em projeto de engenharia: conjunto em transparência, com as arestas realçadas.`
    case 'suprimentos':
      return `${base} em suprimentos: ${contagem(GRUPOS_COMPRADOS, a, 'itens comprados na fábrica')}.`
    case 'fabricacao':
      return `${base} em fabricação: ${contagem(GRUPOS_FABRICADOS, a, 'conjuntos no lugar')}.`
    case 'pintura': {
      if (etapa?.status === STATUS.concluida) {
        return `${base} pintado: estrutura em vinho Idugel, calha e moega em inox escovado.`
      }
      const passos = passosDaEtapa(etapa)
      const atual = [...passos].reverse().find((p) => p.estado === STATUS.andamento)
      if (atual) return `${base} em pintura: ${atual.passo.nome.toLowerCase()} em andamento.`
      return `${base} em aço bruto, pronto para a pintura.`
    }
    case 'montagem':
      return `${base} em montagem: ${contagem(GRUPOS_MONTAGEM, a, 'itens montados')}.`
    case 'testes':
      return `${base} em testes: rosca girando e painel de comando ligado.`
    case 'expedicao': {
      const { fechamento, cintas } = estadoDoEngradado(etapa)
      const engradado = fechamento >= 1 ? ', engradado fechado' : fechamento > 0 ? ', engradado em fechamento' : ''
      return `${base} pronto, sobre o estrado de expedição${engradado}${cintas ? ' e cintado' : ''}.`
    }
    case 'nenhum':
      return `Palco 3D do ${NOME_DO_EQUIPAMENTO}.`
    default:
      return `${base} completo, com acabamento final.`
  }
}

// ─── Materiais por grupo ─────────────────────────────────────────────────────

/** Acabamento final de cada grupo. */
const ACABAMENTO: Record<GrupoId, string> = {
  estrutura: 'vinho-idugel',
  calha: 'inox-304',
  moega: 'inox-304',
  rosca: 'inox-detalhe',
  descarga: 'vinho-idugel',
  tampas: 'inox-304',
  mancais: 'ral-7016',
  motoredutor: 'ral-7016',
  painel: 'ral-7035',
}

const aparenciaFinal = (id: GrupoId): Aparencia =>
  ACABAMENTO[id] === 'inox-detalhe' ? aparenciaInoxDetalhe() : aparenciaDoAcabamento(ACABAMENTO[id])

/** Estágios de cor de um grupo: pintados passam pelo fundo; inox e rosca vão da superfície preparada ao final. */
function estagiosDe(id: GrupoId): Estagios {
  const final = aparenciaFinal(id)
  if (GRUPOS_PINTADOS.includes(id)) return [APARENCIA.acoBruto, APARENCIA.preparada, APARENCIA.primer, final]
  if (GRUPOS_INOX.includes(id) || id === 'rosca') return [APARENCIA.acoBruto, APARENCIA.preparada, APARENCIA.preparada, final]
  return [final, final, final, final]
}

const ESTAGIOS_DETALHE: Estagios = [APARENCIA.acoBruto, APARENCIA.preparada, aparenciaInoxDetalhe(), aparenciaInoxDetalhe()]

interface MateriaisDoGrupo {
  principal: THREE.MeshStandardMaterial
  detalhe: THREE.MeshStandardMaterial
  estagios: Estagios
}

function criarMateriais(): Record<GrupoId, MateriaisDoGrupo> {
  return Object.fromEntries(
    GRUPO_IDS.map((id) => [
      id,
      {
        principal: criarMaterialAnimado(aparenciaFinal(id), { side: id === 'rosca' ? THREE.DoubleSide : THREE.FrontSide }),
        detalhe: criarMaterialAnimado(aparenciaInoxDetalhe()),
        estagios: estagiosDe(id),
      },
    ]),
  ) as Record<GrupoId, MateriaisDoGrupo>
}

// ─── Geometrias especiais ────────────────────────────────────────────────────

/** Calha em U com parede: perfil extrudado ao longo de X, centrado. */
function geoCalha(): THREE.BufferGeometry {
  const R = R_CALHA
  const t = 0.015
  const yA = EIXO_Y
  const yT = TOPO_CALHA
  const s = new THREE.Shape()
  s.moveTo(-R, yT)
  s.lineTo(-R, yA)
  s.absarc(0, yA, R, Math.PI, 2 * Math.PI, false)
  s.lineTo(R, yT)
  s.lineTo(R - t, yT)
  s.lineTo(R - t, yA)
  s.absarc(0, yA, R - t, 2 * Math.PI, Math.PI, true)
  s.lineTo(-(R - t), yT)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: L_CALHA, bevelEnabled: false, curveSegments: 20 })
  // extrusão (z local) → X; perfil no plano YZ
  g.rotateY(Math.PI / 2)
  g.translate(-L_CALHA / 2, 0, 0)
  return g
}

/** Tronco de pirâmide invertido oco (lathe de 4 lados) com parede. */
function geoMoega(yBase: number, yTopo: number, ladoBase: number, ladoTopo: number, parede = 0.012): THREE.BufferGeometry {
  const k = Math.SQRT2 / 2
  const rb = ladoBase * k
  const rt = ladoTopo * k
  const e = parede * Math.SQRT2
  const pts = [
    new THREE.Vector2(rb - e, yBase),
    new THREE.Vector2(rb, yBase),
    new THREE.Vector2(rt, yTopo),
    new THREE.Vector2(rt - e, yTopo),
    new THREE.Vector2(rb - e, yBase),
  ]
  const g = new THREE.LatheGeometry(pts, 4, Math.PI / 4).toNonIndexed()
  g.computeVertexNormals()
  return g
}

/** Flange quadrada (moldura) de 4 lados no topo da moega. */
function geoFlangeQuadrada(y: number, ladoInterno: number, ladoExterno: number, espessura = 0.025): THREE.BufferGeometry {
  const k = Math.SQRT2 / 2
  const ri = ladoInterno * k
  const re = ladoExterno * k
  const pts = [
    new THREE.Vector2(ri, y),
    new THREE.Vector2(re, y),
    new THREE.Vector2(re, y + espessura),
    new THREE.Vector2(ri, y + espessura),
    new THREE.Vector2(ri, y),
  ]
  const g = new THREE.LatheGeometry(pts, 4, Math.PI / 4).toNonIndexed()
  g.computeVertexNormals()
  return g
}

/** Fita helicoidal ao longo de X (centrada em x), do raio r0 ao r1, com o passo e as voltas dados. */
function geoHelicoide(r0: number, r1: number, passo: number, voltas: number, segPorVolta = 48): THREE.BufferGeometry {
  const n = Math.round(voltas * segPorVolta)
  const L = voltas * passo
  const pos = new Float32Array((n + 1) * 6)
  const idx: number[] = []
  for (let i = 0; i <= n; i++) {
    const u = i / n
    const ang = u * voltas * Math.PI * 2
    const x = -L / 2 + u * L
    const c = Math.cos(ang)
    const s = Math.sin(ang)
    pos[i * 6] = x
    pos[i * 6 + 1] = r0 * c
    pos[i * 6 + 2] = r0 * s
    pos[i * 6 + 3] = x
    pos[i * 6 + 4] = r1 * c
    pos[i * 6 + 5] = r1 * s
    if (i < n) {
      const a = i * 2
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Geometrias construídas por código (calha, moega, flange da moega, helicoide); quem cria descarta (dispose). */
export function criarGeometriasEspeciais() {
  return {
    calha: geoCalha(),
    moega: geoMoega(TOPO_CALHA + 0.012, 1.9, 0.36, 0.75),
    flangeMoega: geoFlangeQuadrada(1.9, 0.72, 0.84),
    helice: geoHelicoide(0.032, 0.19, 0.2, 10),
  }
}

// ─── Peças ───────────────────────────────────────────────────────────────────

interface ContextoDoGrupo {
  /** Arestas realçadas (modo projeto). */
  arestas: boolean
  /** O grupo está sólido (projeta sombra). */
  sombra: boolean
}
const GrupoCtx = createContext<ContextoDoGrupo>({ arestas: false, sombra: true })

interface PecaProps {
  geo: THREE.BufferGeometry
  material: THREE.Material
  position?: Vec3
  rotation?: Vec3
  /** Recebe arestas realçadas no modo projeto (só nas peças principais: não pesar). */
  arestas?: boolean
  sombra?: boolean
}

function Peca({ geo, material, position, rotation, arestas = false, sombra = true }: PecaProps) {
  const ctx = useContext(GrupoCtx)
  return (
    <mesh
      geometry={geo}
      material={material}
      position={position}
      rotation={rotation}
      castShadow={sombra && ctx.sombra}
      receiveShadow={sombra}
    >
      {arestas && <Edges threshold={28} color={COR_ARESTA} visible={ctx.arestas} />}
    </mesh>
  )
}

const ROT_X: Vec3 = [0, 0, Math.PI / 2] // cilindro (eixo Y) deitado ao longo de X
const ROT_Z: Vec3 = [Math.PI / 2, 0, 0] // cilindro ao longo de Z

interface GrupoProps {
  id: GrupoId
  arestas: boolean
  sombra: boolean
  registrar: (id: GrupoId, el: THREE.Group | null) => void
  children: ReactNode
}

function Grupo({ id, arestas, sombra, registrar, children }: GrupoProps) {
  const ctx = useMemo(() => ({ arestas, sombra }), [arestas, sombra])
  const ref = useCallback(
    (el: THREE.Group | null) => {
      registrar(id, el)
    },
    [id, registrar],
  )
  return (
    <group name={id} ref={ref}>
      <GrupoCtx.Provider value={ctx}>{children}</GrupoCtx.Provider>
    </group>
  )
}

// ─── Estado animado ──────────────────────────────────────────────────────────

interface EstadoDoGrupo {
  opacidade: number
  fase: number
  desloc: THREE.Vector3
  /** Há diferença para o alvo: aplica a cada quadro até assentar. */
  ativo: boolean
}

const EPS = 0.0015

// ─── Modelo ──────────────────────────────────────────────────────────────────

export function DosadorModel() {
  const capitulo = useHorizon((s) => s.capitulo())
  const etapa = useHorizon((s) => s.etapaDoCapitulo())
  const reduzido = useHorizon((s) => s.reduzido)
  const modo = modoDoModelo(capitulo, etapa)
  const alvos = useMemo(() => alvosDosGrupos(modo, etapa, reduzido), [modo, etapa, reduzido])
  const engradado = modo === 'expedicao' ? estadoDoEngradado(etapa) : null

  const mats = useMemo(criarMateriais, [])
  useEffect(
    () => () => {
      for (const id of GRUPO_IDS) {
        mats[id].principal.dispose()
        mats[id].detalhe.dispose()
      }
    },
    [mats],
  )

  const geos = useMemo(criarGeometriasEspeciais, [])
  useEffect(
    () => () => {
      for (const g of Object.values(geos)) g.dispose()
    },
    [geos],
  )

  const grupos = useRef<Partial<Record<GrupoId, THREE.Group | null>>>({})
  const registrar = useMemo(
    () => (id: GrupoId, el: THREE.Group | null) => {
      grupos.current[id] = el
    },
    [],
  )
  const raiz = useRef<THREE.Group>(null)
  const rosca = useRef<THREE.Group>(null)
  const tmpCor = useMemo(() => new THREE.Color(), [])

  const estado = useRef<Record<GrupoId, EstadoDoGrupo> | null>(null)
  if (!estado.current) {
    estado.current = Object.fromEntries(
      GRUPO_IDS.map((id) => [
        id,
        { opacidade: alvos[id].opacidade, fase: alvos[id].fase, desloc: new THREE.Vector3(...alvos[id].desloc), ativo: true },
      ]),
    ) as Record<GrupoId, EstadoDoGrupo>
  }
  const alvosRef = useRef(alvos)
  useEffect(() => {
    alvosRef.current = alvos
    const est = estado.current
    if (est) for (const id of GRUPO_IDS) est[id].ativo = true
  }, [alvos])
  const modoRef = useRef(modo)
  modoRef.current = modo
  const reduzidoRef = useRef(reduzido)
  reduzidoRef.current = reduzido

  useFrame((_, delta) => {
    const est = estado.current
    if (!est) return
    const dt = Math.min(delta, 0.05)
    const k = reduzidoRef.current ? 1 : 1 - Math.exp(-dt / TAU)
    for (const id of GRUPO_IDS) {
      const e = est[id]
      if (!e.ativo) continue
      const a = alvosRef.current[id]
      e.opacidade += (a.opacidade - e.opacidade) * k
      e.fase += (a.fase - e.fase) * k
      e.desloc.x += (a.desloc[0] - e.desloc.x) * k
      e.desloc.y += (a.desloc[1] - e.desloc.y) * k
      e.desloc.z += (a.desloc[2] - e.desloc.z) * k
      const assentou =
        Math.abs(a.opacidade - e.opacidade) < EPS &&
        Math.abs(a.fase - e.fase) < EPS &&
        Math.abs(a.desloc[0] - e.desloc.x) < EPS &&
        Math.abs(a.desloc[1] - e.desloc.y) < EPS &&
        Math.abs(a.desloc[2] - e.desloc.z) < EPS
      if (assentou) {
        e.opacidade = a.opacidade
        e.fase = a.fase
        e.desloc.set(a.desloc[0], a.desloc[1], a.desloc[2])
        e.ativo = false
      }
      const m = mats[id]
      aplicarAparencia(m.principal, m.estagios, e.fase, e.opacidade, tmpCor)
      aplicarAparencia(m.detalhe, ESTAGIOS_DETALHE, e.fase, e.opacidade, tmpCor)
      const g = grupos.current[id]
      if (g) {
        g.position.copy(e.desloc)
        g.visible = e.opacidade > 0.01 || a.opacidade > 0.01
      }
    }
    // elevação sobre o estrado na expedição
    const r = raiz.current
    if (r) {
      const alvoY = modoRef.current === 'expedicao' ? ALTURA_DO_ESTRADO : 0
      if (Math.abs(r.position.y - alvoY) > 0.0005) r.position.y += (alvoY - r.position.y) * k
      else r.position.y = alvoY
    }
    // rosca gira nos testes
    if (modoRef.current === 'testes' && !reduzidoRef.current && rosca.current) {
      rosca.current.rotation.x -= dt * 1.2
    }
  })

  const projeto = modo === 'projeto'
  const solido = (id: GrupoId) => alvos[id].opacidade >= 0.999
  const telaLigada = modo === 'testes'
  const mPainelTela = solido('painel') ? (telaLigada ? fixed.telaLigada : fixed.telaDesligada) : mats.painel.detalhe
  const mBotao = solido('painel') ? fixed.botao : mats.painel.detalhe
  const mBotaoVermelho = solido('painel') ? fixed.luzVermelha : mats.painel.detalhe
  const mBorracha = solido('estrutura') ? fixed.borracha : mats.estrutura.detalhe

  const grupo = (id: GrupoId) => ({ id, arestas: projeto, sombra: alvos[id].opacidade > 0.5, registrar })

  return (
    <group position={[DESLOC_X, 0, 0]}>
      <group ref={raiz} name="dosador">
        {/* ─── Estrutura e pés ─── */}
        <Grupo {...grupo('estrutura')}>
          {(
            [
              [-1.0, 0.3],
              [-1.0, -0.3],
              [1.0, 0.3],
              [1.0, -0.3],
            ] as Array<[number, number]>
          ).map(([x, z]) => (
            <group key={`pe${x}${z}`}>
              <Peca geo={caixa(0.07, 0.72, 0.07)} material={mats.estrutura.principal} position={[x, 0.36, z]} arestas />
              <Peca geo={caixa(0.16, 0.02, 0.16)} material={mats.estrutura.principal} position={[x, 0.01, z]} />
              <Peca geo={cilindro(0.05, 0.06, 0.02, 16)} material={mBorracha} position={[x, 0.03, z]} sombra={false} />
            </group>
          ))}
          {/* longarinas e travessas */}
          <Peca geo={caixa(2.3, 0.08, 0.08)} material={mats.estrutura.principal} position={[0, 0.76, 0.3]} arestas />
          <Peca geo={caixa(2.3, 0.08, 0.08)} material={mats.estrutura.principal} position={[0, 0.76, -0.3]} arestas />
          <Peca geo={caixa(0.06, 0.06, 0.6)} material={mats.estrutura.principal} position={[-1.0, 0.76, 0]} />
          <Peca geo={caixa(0.06, 0.06, 0.6)} material={mats.estrutura.principal} position={[1.0, 0.76, 0]} />
          <Peca geo={caixa(0.06, 0.06, 0.6)} material={mats.estrutura.principal} position={[-1.0, 0.25, 0]} />
          <Peca geo={caixa(0.06, 0.06, 0.6)} material={mats.estrutura.principal} position={[1.0, 0.25, 0]} />
          {/* berços da calha */}
          {[-0.75, 0.75].map((x) => (
            <group key={`berco${x}`}>
              <Peca geo={caixa(0.06, 0.03, 0.56)} material={mats.estrutura.principal} position={[x, 0.725, 0]} />
              <Peca geo={caixa(0.06, 0.26, 0.03)} material={mats.estrutura.principal} position={[x, 0.93, 0.245]} />
              <Peca geo={caixa(0.06, 0.26, 0.03)} material={mats.estrutura.principal} position={[x, 0.93, -0.245]} />
            </group>
          ))}
          {/* apoio do motoredutor */}
          <Peca geo={caixa(0.55, 0.06, 0.45)} material={mats.estrutura.principal} position={[-1.42, 0.73, 0]} arestas />
          <Peca geo={caixa(0.06, 0.7, 0.06)} material={mats.estrutura.principal} position={[-1.65, 0.35, 0.18]} />
          <Peca geo={caixa(0.06, 0.7, 0.06)} material={mats.estrutura.principal} position={[-1.65, 0.35, -0.18]} />
          <Peca geo={caixa(0.14, 0.02, 0.14)} material={mats.estrutura.principal} position={[-1.65, 0.01, 0.18]} />
          <Peca geo={caixa(0.14, 0.02, 0.14)} material={mats.estrutura.principal} position={[-1.65, 0.01, -0.18]} />
          {/* braço de torque do redutor */}
          <Peca geo={caixa(0.06, 0.2, 0.06)} material={mats.estrutura.principal} position={[-1.42, 0.86, 0.2]} />
        </Grupo>

        {/* ─── Calha e tampas de extremidade ─── */}
        <Grupo {...grupo('calha')}>
          <Peca geo={geos.calha} material={mats.calha.principal} arestas />
          {/* flanges superiores */}
          <Peca geo={caixa(L_CALHA, 0.012, 0.06)} material={mats.calha.principal} position={[0, TOPO_CALHA + 0.006, 0.24]} />
          <Peca geo={caixa(L_CALHA, 0.012, 0.06)} material={mats.calha.principal} position={[0, TOPO_CALHA + 0.006, -0.24]} />
          {/* tampas de extremidade com flange do eixo */}
          {[-1, 1].map((s) => (
            <group key={`ext${s}`}>
              <Peca geo={caixa(0.025, 0.6, 0.6)} material={mats.calha.principal} position={[s * (L_CALHA / 2 + 0.0125), 0.93, 0]} arestas />
              <Peca
                geo={cilindro(0.11, 0.11, 0.03, 24)}
                material={mats.calha.detalhe}
                position={[s * (L_CALHA / 2 + 0.035), EIXO_Y, 0]}
                rotation={ROT_X}
              />
            </group>
          ))}
          {/* trechos fixos da tampa superior (sobre a descarga e na extremidade do acionamento) */}
          <Peca geo={caixa(0.5, 0.012, 0.54)} material={mats.calha.principal} position={[X_DESCARGA, TOPO_CALHA + 0.018, 0]} />
          <Peca geo={caixa(0.2, 0.012, 0.54)} material={mats.calha.principal} position={[-1.0, TOPO_CALHA + 0.018, 0]} />
        </Grupo>

        {/* ─── Moega de alimentação ─── */}
        <Grupo {...grupo('moega')}>
          <group position={[X_MOEGA, 0, 0]}>
            <Peca geo={geos.moega} material={mats.moega.principal} arestas />
            <Peca geo={geos.flangeMoega} material={mats.moega.principal} />
            {/* reforços */}
            <Peca geo={caixa(0.02, 0.5, 0.02)} material={mats.moega.detalhe} position={[0.33, 1.56, 0.33]} sombra={false} />
            <Peca geo={caixa(0.02, 0.5, 0.02)} material={mats.moega.detalhe} position={[-0.33, 1.56, 0.33]} sombra={false} />
            <Peca geo={caixa(0.02, 0.5, 0.02)} material={mats.moega.detalhe} position={[0.33, 1.56, -0.33]} sombra={false} />
            <Peca geo={caixa(0.02, 0.5, 0.02)} material={mats.moega.detalhe} position={[-0.33, 1.56, -0.33]} sombra={false} />
          </group>
        </Grupo>

        {/* ─── Rosca helicoidal e eixo (gira em torno de X nos testes) ─── */}
        <Grupo {...grupo('rosca')}>
          <group ref={rosca} position={[0, EIXO_Y, 0]}>
            <Peca geo={cilindro(0.03, 0.03, 2.56, 20)} material={mats.rosca.principal} position={[-0.1, 0, 0]} rotation={ROT_X} />
            <Peca geo={geos.helice} material={mats.rosca.principal} />
            {/* ponta do eixo no acoplamento */}
            <Peca geo={cilindro(0.045, 0.045, 0.1, 20)} material={mats.rosca.detalhe} position={[-1.3, 0, 0]} rotation={ROT_X} />
          </group>
        </Grupo>

        {/* ─── Mancais (flangeados nas tampas de extremidade) ─── */}
        <Grupo {...grupo('mancais')}>
          {[-1, 1].map((s) => {
            const x = s * (L_CALHA / 2 + 0.04)
            return (
              <group key={`mancal${s}`}>
                <Peca geo={caixa(0.03, 0.24, 0.24)} material={mats.mancais.principal} position={[x, EIXO_Y, 0]} arestas />
                <Peca
                  geo={cilindro(0.085, 0.085, 0.1, 24)}
                  material={mats.mancais.principal}
                  position={[x + s * 0.065, EIXO_Y, 0]}
                  rotation={ROT_X}
                />
                {s > 0 && (
                  <Peca
                    geo={cilindro(0.05, 0.05, 0.04, 20)}
                    material={mats.mancais.detalhe}
                    position={[x + 0.135, EIXO_Y, 0]}
                    rotation={ROT_X}
                  />
                )}
                {/* parafusos da flange */}
                {(
                  [
                    [0.085, 0.085],
                    [0.085, -0.085],
                    [-0.085, 0.085],
                    [-0.085, -0.085],
                  ] as Array<[number, number]>
                ).map(([dy, dz]) => (
                  <Peca
                    key={`p${dy}${dz}`}
                    geo={cilindro(0.012, 0.012, 0.02, 8)}
                    material={mats.mancais.detalhe}
                    position={[x + s * 0.025, EIXO_Y + dy, dz]}
                    rotation={ROT_X}
                    sombra={false}
                  />
                ))}
              </group>
            )
          })}
        </Grupo>

        {/* ─── Motoredutor (lado −X) ─── */}
        <Grupo {...grupo('motoredutor')}>
          {/* redutor */}
          <Peca geo={caixa(0.22, 0.32, 0.3)} material={mats.motoredutor.principal} position={[-1.42, EIXO_Y, 0]} arestas />
          <Peca geo={cilindro(0.12, 0.12, 0.02, 24)} material={mats.motoredutor.principal} position={[-1.3, EIXO_Y, 0]} rotation={ROT_X} />
          <Peca geo={caixa(0.2, 0.02, 0.26)} material={mats.motoredutor.detalhe} position={[-1.42, EIXO_Y + 0.17, 0]} sombra={false} />
          {/* motor */}
          <group position={[-1.72, EIXO_Y, 0]}>
            <Peca geo={cilindro(0.14, 0.14, 0.34, 28)} material={mats.motoredutor.principal} rotation={ROT_X} arestas />
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2 + Math.PI / 8
              return (
                <Peca
                  key={i}
                  geo={caixa(0.3, 0.026, 0.012)}
                  material={mats.motoredutor.principal}
                  position={[0, 0.15 * Math.cos(a), 0.15 * Math.sin(a)]}
                  rotation={[a, 0, 0]}
                  sombra={false}
                />
              )
            })}
            {/* tampa do ventilador */}
            <Peca geo={cilindro(0.13, 0.15, 0.06, 28)} material={mats.motoredutor.principal} position={[-0.2, 0, 0]} rotation={ROT_X} />
            <Peca geo={cilindro(0.06, 0.06, 0.01, 16)} material={mats.motoredutor.detalhe} position={[-0.235, 0, 0]} rotation={ROT_X} sombra={false} />
            {/* caixa de ligação */}
            <Peca geo={caixa(0.12, 0.08, 0.1)} material={mats.motoredutor.principal} position={[0.02, 0.17, 0]} />
            {/* flange motor–redutor */}
            <Peca geo={cilindro(0.15, 0.15, 0.04, 28)} material={mats.motoredutor.principal} position={[0.19, 0, 0]} rotation={ROT_X} />
          </group>
        </Grupo>

        {/* ─── Bocal de descarga (+X, sob a calha) ─── */}
        <Grupo {...grupo('descarga')}>
          <Peca geo={caixa(0.3, 0.3, 0.3)} material={mats.descarga.principal} position={[X_DESCARGA, 0.6, 0]} arestas />
          <Peca geo={caixa(0.4, 0.02, 0.4)} material={mats.descarga.principal} position={[X_DESCARGA, 0.45, 0]} />
          <Peca geo={caixa(0.34, 0.02, 0.34)} material={mats.descarga.principal} position={[X_DESCARGA, 0.75, 0]} />
        </Grupo>

        {/* ─── Tampas de inspeção e proteções ─── */}
        <Grupo {...grupo('tampas')}>
          {/* tampa de inspeção entre a moega e a descarga */}
          <Peca geo={caixa(0.78, 0.014, 0.54)} material={mats.tampas.principal} position={[0.2, TOPO_CALHA + 0.019, 0]} arestas />
          <Peca geo={caixa(0.14, 0.03, 0.02)} material={mats.tampas.detalhe} position={[0.2, TOPO_CALHA + 0.04, 0.16]} sombra={false} />
          {/* dobradiças (lado −z) e fechos (lado +z) */}
          <Peca geo={caixa(0.07, 0.02, 0.05)} material={mats.tampas.detalhe} position={[-0.05, TOPO_CALHA + 0.03, -0.27]} sombra={false} />
          <Peca geo={caixa(0.07, 0.02, 0.05)} material={mats.tampas.detalhe} position={[0.45, TOPO_CALHA + 0.03, -0.27]} sombra={false} />
          <Peca geo={caixa(0.04, 0.035, 0.03)} material={mats.tampas.detalhe} position={[-0.05, TOPO_CALHA + 0.01, 0.28]} sombra={false} />
          <Peca geo={caixa(0.04, 0.035, 0.03)} material={mats.tampas.detalhe} position={[0.45, TOPO_CALHA + 0.01, 0.28]} sombra={false} />
          {/* proteção do acoplamento entre o mancal e o redutor */}
          <Peca geo={caixa(0.08, 0.24, 0.24)} material={mats.tampas.principal} position={[-1.275, EIXO_Y, 0]} arestas />
        </Grupo>

        {/* ─── Painel de comando (fixo no pé +X, lado +z) ─── */}
        <Grupo {...grupo('painel')}>
          <group position={[1.0, 0.52, 0.4]}>
            <Peca geo={caixa(0.26, 0.36, 0.12)} material={mats.painel.principal} arestas />
            <Peca geo={caixa(0.22, 0.32, 0.01)} material={mats.painel.principal} position={[0, 0, 0.065]} sombra={false} />
            {/* tela */}
            <Peca geo={caixa(0.12, 0.08, 0.01)} material={mPainelTela} position={[0, 0.08, 0.072]} sombra={false} />
            {/* botões */}
            {[-0.05, 0, 0.05].map((x, i) => (
              <Peca
                key={i}
                geo={cilindro(0.016, 0.016, 0.016, 14)}
                material={i === 2 ? mBotaoVermelho : mBotao}
                position={[x, -0.04, 0.074]}
                rotation={ROT_Z}
                sombra={false}
              />
            ))}
            {/* chave geral */}
            <Peca geo={caixa(0.04, 0.05, 0.02)} material={mats.painel.detalhe} position={[0.08, -0.12, 0.075]} sombra={false} />
            {/* suportes no pé */}
            <Peca geo={caixa(0.04, 0.03, 0.05)} material={mats.painel.detalhe} position={[0, 0.14, -0.08]} sombra={false} />
            <Peca geo={caixa(0.04, 0.03, 0.05)} material={mats.painel.detalhe} position={[0, -0.14, -0.08]} sombra={false} />
          </group>
        </Grupo>
      </group>

      {/* engradado da expedição (fecha conforme a embalagem), centrado no conjunto */}
      {engradado && (
        <group position={[-DESLOC_X, 0, 0]}>
          <Engradado fechamento={engradado.fechamento} cintas={engradado.cintas} />
        </group>
      )}
    </group>
  )
}
