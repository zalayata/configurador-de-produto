// Presets de câmera por capítulo do controle de produção. O painel de texto fica à direita no desktop (~400 px)
// e a linha do tempo embaixo (~100 px): o dosador é enquadrado um pouco à esquerda do centro e acima do terço
// inferior (alvo em y ≈ 0,85–1,0). Cada capítulo olha o lado da história que conta.
import type { CapituloId } from '../capitulos'

export type Vec3 = [number, number, number]

export interface PresetDeCamera {
  pos: Vec3
  tgt: Vec3
}

/** Largura (px) abaixo da qual a página empilha o painel: a câmera afasta para o modelo caber inteiro. */
export const LARGURA_CELULAR = 980

/**
 * Desloca câmera e alvo ao longo da direção "direita da tela" (perpendicular à linha de visada e ao eixo Y):
 * o objeto fica à esquerda do centro, fora da área do painel.
 */
function deslocarParaEsquerda(p: PresetDeCamera, d: number): PresetDeCamera {
  const dir: Vec3 = [p.tgt[0] - p.pos[0], p.tgt[1] - p.pos[1], p.tgt[2] - p.pos[2]]
  // direita = normalize(cross(dir, up)) com up = (0, 1, 0) → (−dir.z, 0, dir.x)
  let rx = -dir[2]
  let rz = dir[0]
  const n = Math.hypot(rx, rz) || 1
  rx /= n
  rz /= n
  return {
    pos: [p.pos[0] + rx * d, p.pos[1], p.pos[2] + rz * d],
    tgt: [p.tgt[0] + rx * d, p.tgt[1], p.tgt[2] + rz * d],
  }
}

const base: Record<CapituloId, PresetDeCamera> = {
  // 3/4 frontal, conjunto inteiro (frente = lado do painel, +z)
  pedido: { pos: [3.7, 2.1, 4.9], tgt: [0, 0.9, 0] },
  // vista isométrica alta: leitura de projeto
  engenharia: { pos: [4.1, 4.2, 4.1], tgt: [0, 0.8, 0] },
  // lado do acionamento (−x): mancais, motoredutor e painel chegando
  suprimentos: { pos: [-4.7, 1.9, 3.2], tgt: [-0.45, 0.9, 0] },
  // vista ampla e mais baixa: as peças descem ao lugar
  fabricacao: { pos: [3.0, 1.25, 5.9], tgt: [0, 0.85, 0] },
  // 3/4 próximo: a cor muda
  pintura: { pos: [2.5, 1.6, 3.5], tgt: [0.1, 0.95, 0] },
  // fechado no lado do motoredutor
  montagem: { pos: [-3.9, 1.9, 3.9], tgt: [-0.55, 0.9, 0] },
  // lado da descarga (+x): rosca girando, painel ligado
  testes: { pos: [4.1, 1.7, 2.9], tgt: [0.5, 0.85, 0] },
  // mais alto e afastado: cabe o engradado
  expedicao: { pos: [4.7, 3.4, 6.7], tgt: [0, 1.0, 0] },
  // pedido mais afastado (capítulo em papel)
  atualizacoes: { pos: [4.7, 2.8, 6.3], tgt: [0, 0.9, 0] },
}

/** Deslocamento lateral (m) para o modelo ficar à esquerda do painel de texto. */
const DESLOCAMENTO = 0.42

export const PRESETS: Record<CapituloId, PresetDeCamera> = Object.fromEntries(
  (Object.keys(base) as CapituloId[]).map((id) => [id, deslocarParaEsquerda(base[id], DESLOCAMENTO)]),
) as Record<CapituloId, PresetDeCamera>

export const PRESET_INICIAL: PresetDeCamera = PRESETS.pedido

/** Preset de um capítulo (o do pedido para id desconhecido). */
export const presetDoCapitulo = (id: string | null | undefined): PresetDeCamera =>
  (id && (PRESETS as Record<string, PresetDeCamera>)[id]) || PRESETS.pedido

/** Fator de afastamento da câmera no celular (o palco visível é baixo e largo: ~390 × 250 px). */
const AFASTAMENTO_CELULAR = 1.12

/**
 * Em larguras ≤ 980 px o painel fica embaixo e o palco é a faixa entre a linha do tempo e a folha: afasta a
 * câmera do alvo e tira o deslocamento lateral (o modelo volta ao centro).
 */
export function ajusteCelular(p: PresetDeCamera): PresetDeCamera {
  const recentrado = deslocarParaEsquerda(p, -DESLOCAMENTO)
  const { pos, tgt } = recentrado
  const f = AFASTAMENTO_CELULAR
  return {
    pos: [tgt[0] + (pos[0] - tgt[0]) * f, tgt[1] + (pos[1] - tgt[1]) * f, tgt[2] + (pos[2] - tgt[2]) * f],
    tgt,
  }
}

/** Preset pronto para a largura atual da janela. */
export function presetParaLargura(id: string | null | undefined, largura: number): PresetDeCamera {
  const p = presetDoCapitulo(id)
  return largura <= LARGURA_CELULAR ? ajusteCelular(p) : p
}
