// Materiais do modelo 3D do dosador e do engradado. Os materiais de acabamento do configurador
// (materialForFinish) são compartilhados em cache e NUNCA são mutados: cada grupo do dosador recebe um
// material próprio (criarMaterialAnimado) cuja aparência é interpolada a cada quadro entre os estágios
// aço bruto → superfície preparada → fundo → acabamento final, e entre fantasma e sólido.
import * as THREE from 'three'
import { materialForFinish, fixed } from '../../three/materials'

/** Aparência de um estágio do material (cor, metalness, roughness e intensidade do ambiente). */
export interface Aparencia {
  cor: THREE.Color
  metalness: number
  roughness: number
  envMapIntensity: number
}

const ap = (cor: string, metalness: number, roughness: number, envMapIntensity: number): Aparencia => ({
  cor: new THREE.Color(cor),
  metalness,
  roughness,
  envMapIntensity,
})

/** Opacidade do fantasma (projeto 3D, peça que ainda não chegou). */
export const OPACIDADE_FANTASMA = 0.16
/** Cor do fantasma (cromo claro, como o trilho da linha do tempo). */
export const COR_FANTASMA = '#c9d3da'

/** Estágios comuns a todas as peças fabricadas. */
export const APARENCIA = {
  /** Aço bruto saído da caldeiraria. */
  acoBruto: ap('#6f767c', 0.7, 0.62, 0.8),
  /** Superfície preparada (jateada): mais clara e fosca. */
  preparada: ap('#9ca3a8', 0.45, 0.88, 0.55),
  /** Fundo (primer). */
  primer: ap('#8d6b62', 0.15, 0.7, 0.5),
  /** Fantasma. */
  fantasma: ap(COR_FANTASMA, 0, 1, 0.3),
}

/** Aparência lida de um material compartilhado (sem alterá-lo). */
export function aparenciaDe(m: THREE.MeshStandardMaterial): Aparencia {
  return {
    cor: m.color.clone(),
    metalness: m.metalness,
    roughness: m.roughness,
    envMapIntensity: m.envMapIntensity,
  }
}

/** Aparência final de um acabamento do configurador ('inox-304', 'vinho-idugel', 'ral-7016', 'ral-7035'…). */
export const aparenciaDoAcabamento = (id: string): Aparencia => aparenciaDe(materialForFinish(id))

/** Aparência dos detalhes em inox (parafusos, tampas de mancal, eixo). */
export const aparenciaInoxDetalhe = (): Aparencia => aparenciaDe(fixed.inoxDetalhe)

/**
 * Material próprio de um grupo, pronto para ser interpolado (aplicarAparencia). Começa no acabamento final,
 * sólido.
 */
export function criarMaterialAnimado(base: Aparencia, { side = THREE.FrontSide }: { side?: THREE.Side } = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color: base.cor.clone(),
    metalness: base.metalness,
    roughness: base.roughness,
    envMapIntensity: base.envMapIntensity,
    side,
  })
  m.transparent = false
  m.depthWrite = true
  m.opacity = 1
  return m
}

/** Quatro estágios: [aço bruto, preparada, fundo, acabamento final] — a fase 0..3 interpola entre eles. */
export type Estagios = [Aparencia, Aparencia, Aparencia, Aparencia]

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * Aplica a um material a aparência da fase (0..3 entre os estágios) com a opacidade dada (OPACIDADE_FANTASMA..1).
 * Quanto mais fantasma, mais a cor vai ao cromo claro, sem metalness e fosca. Material translúcido nunca
 * escreve no depth buffer. `tmp` é uma cor de trabalho reutilizada (sem alocação por quadro).
 */
export function aplicarAparencia(
  m: THREE.MeshStandardMaterial,
  estagios: Estagios,
  fase: number,
  opacidade: number,
  tmp: THREE.Color,
): void {
  const f = Math.min(3, Math.max(0, fase))
  const i = Math.min(2, Math.floor(f))
  const k = f - i
  const a = estagios[i]
  const b = estagios[i + 1]
  tmp.copy(a.cor).lerp(b.cor, k)
  let metalness = a.metalness + (b.metalness - a.metalness) * k
  let roughness = a.roughness + (b.roughness - a.roughness) * k
  let env = a.envMapIntensity + (b.envMapIntensity - a.envMapIntensity) * k

  const op = clamp01(opacidade)
  // grau de fantasma: 0 sólido … 1 totalmente fantasma
  const g = clamp01((1 - op) / (1 - OPACIDADE_FANTASMA))
  if (g > 0) {
    const ft = APARENCIA.fantasma
    tmp.lerp(ft.cor, g)
    metalness += (ft.metalness - metalness) * g
    roughness += (ft.roughness - roughness) * g
    env += (ft.envMapIntensity - env) * g
  }
  m.color.copy(tmp)
  m.metalness = metalness
  m.roughness = roughness
  m.envMapIntensity = env

  if (op < 0.995) {
    m.transparent = true
    m.depthWrite = false
    m.opacity = op
  } else {
    m.transparent = false
    m.depthWrite = true
    m.opacity = 1
  }
}

// ─── Engradado ───────────────────────────────────────────────────────────────

/** Madeira do estrado e das tábuas. */
export const madeira = new THREE.MeshStandardMaterial({ color: '#b08a5a', metalness: 0.02, roughness: 0.85 })
/** Madeira um pouco mais escura (longarinas do estrado) para separar visualmente as peças. */
export const madeiraEscura = new THREE.MeshStandardMaterial({ color: '#8f6c43', metalness: 0.02, roughness: 0.88 })
/** Cintas de arqueação (fita escura). */
export const cinta = new THREE.MeshStandardMaterial({ color: '#14171a', metalness: 0.1, roughness: 0.7 })
/** Cantoneiras do quadro do engradado. */
export const cantoneira = new THREE.MeshStandardMaterial({ color: '#4c5358', metalness: 0.6, roughness: 0.55 })

// ─── Geometrias compartilhadas (cache por medidas: nenhuma alocação por quadro ou por render) ───

const cacheGeo = new Map<string, THREE.BufferGeometry>()

function lembrar<T extends THREE.BufferGeometry>(chave: string, criar: () => T): T {
  let g = cacheGeo.get(chave) as T | undefined
  if (!g) {
    g = criar()
    cacheGeo.set(chave, g)
  }
  return g
}

/** Caixa [largura (x), altura (y), profundidade (z)]. */
export const caixa = (w: number, h: number, d: number): THREE.BoxGeometry =>
  lembrar(`caixa:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d))

/** Cilindro (eixo Y) [raioTopo, raioBase, altura, segmentos radiais]. */
export const cilindro = (rt: number, rb: number, h: number, seg = 24, aberto = false): THREE.CylinderGeometry =>
  lembrar(`cil:${rt}:${rb}:${h}:${seg}:${aberto ? 1 : 0}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, aberto))
