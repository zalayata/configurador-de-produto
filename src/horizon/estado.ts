// Estado da página de controle de produção (zustand): andamento lido, cronograma do dia, capítulo aberto,
// câmera e avisos. Componentes leem daqui; App.tsx liga URL (hash) ↔ capítulo e a leitura do JSON.
import { create } from 'zustand'
import type { Andamento, Foto } from './andamento'
import { CAPITULOS, lerHash, porId, type Capitulo, type CapituloId } from './capitulos'
import { calcular, type Cronograma, type Etapa } from './cronograma'

export type Leitura = 'lendo' | 'ok' | 'sem-dados'

interface HorizonState {
  andamento: Andamento | null
  /** 'lendo' até a primeira resposta (ou o limite); 'ok' com andamento válido; 'sem-dados' sem arquivo válido. */
  leitura: Leitura
  hoje: string
  calc: Cronograma | null
  capituloId: CapituloId
  autoRotate: boolean
  /** Incrementado para reposicionar a câmera no preset do capítulo atual. */
  cameraNonce: number
  toast: string | null
  fotoAberta: Foto | null
  /** Movimento reduzido (prefers-reduced-motion). */
  reduzido: boolean

  capitulo: () => Capitulo
  etapaDoCapitulo: () => Etapa | null
  setAndamento: (andamento: Andamento | null, leitura: Leitura) => void
  setHoje: (hoje: string) => void
  irPara: (id: CapituloId) => void
  proximo: () => void
  anterior: () => void
  setAutoRotate: (v: boolean) => void
  recentrarCamera: () => void
  showToast: (mensagem: string, duracaoMs?: number) => void
  dismissToast: () => void
  abrirFoto: (foto: Foto | null) => void
  setReduzido: (v: boolean) => void
}

export const useHorizon = create<HorizonState>((set, get) => ({
  andamento: null,
  leitura: 'lendo',
  hoje: '',
  calc: null,
  // o capítulo da URL (#fabricacao) já na criação do estado: a primeira renderização abre nele
  capituloId: lerHash()?.id ?? 'pedido',
  autoRotate: true,
  cameraNonce: 0,
  toast: null,
  fotoAberta: null,
  reduzido: false,

  capitulo: () => porId(get().capituloId) ?? CAPITULOS[0],
  etapaDoCapitulo: () => {
    const c = get().capitulo()
    const calc = get().calc
    return c.etapa && calc ? (calc.etapas.find((e) => e.id === c.etapa) ?? null) : null
  },
  setAndamento: (andamento, leitura) =>
    set({ andamento, leitura, calc: andamento ? calcular(andamento, get().hoje || new Date()) : null }),
  setHoje: (hoje) => set({ hoje, calc: get().andamento ? calcular(get().andamento, hoje) : null }),
  irPara: (id) => {
    if (!porId(id)) return
    set({ capituloId: id, cameraNonce: get().cameraNonce + 1 })
  },
  proximo: () => {
    const i = get().capitulo().indice
    if (i < CAPITULOS.length - 1) get().irPara(CAPITULOS[i + 1].id)
  },
  anterior: () => {
    const i = get().capitulo().indice
    if (i > 0) get().irPara(CAPITULOS[i - 1].id)
  },
  setAutoRotate: (v) => set({ autoRotate: v }),
  recentrarCamera: () => set({ cameraNonce: get().cameraNonce + 1 }),
  showToast: (mensagem, duracaoMs = 3600) => {
    set({ toast: mensagem })
    window.setTimeout(() => {
      if (get().toast === mensagem) set({ toast: null })
    }, duracaoMs)
  },
  dismissToast: () => set({ toast: null }),
  abrirFoto: (foto) => set({ fotoAberta: foto }),
  setReduzido: (v) => set({ reduzido: v }),
}))

/** Seletor: etapa (calculada) de um id. */
export const etapaPorId = (calc: Cronograma | null, id: string | null | undefined): Etapa | null =>
  id && calc ? (calc.etapas.find((e) => e.id === id) ?? null) : null
