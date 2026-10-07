import { create } from 'zustand'
import type * as THREE from 'three'
import {
  defaultFinishes,
  defaultOptions,
  type GroupId,
} from '../config/product'
import { defaultGroupFinishes, productById } from '../catalog/products'

export type Source = 'demo' | 'importado' | 'catalogo'

export interface PartInfo {
  id: string
  name: string
}

export interface PartOverride {
  finishId?: string
  visible?: boolean
}

export interface ImportedModel {
  fileName: string
  object: THREE.Group
  parts: PartInfo[]
}

export interface CatalogBox {
  center: [number, number, number]
  radius: number
}

export interface StepDef {
  id: 'produto' | 'acabamento' | 'opcionais' | 'pecas' | 'resumo'
  label: string
}

export const DEMO_STEPS: StepDef[] = [
  { id: 'produto', label: 'Produto' },
  { id: 'acabamento', label: 'Acabamento' },
  { id: 'opcionais', label: 'Opcionais' },
  { id: 'resumo', label: 'Resumo' },
]

export const IMPORT_STEPS: StepDef[] = [
  { id: 'produto', label: 'Produto' },
  { id: 'pecas', label: 'Peças e cores' },
  { id: 'resumo', label: 'Resumo' },
]

export const CATALOG_STEPS: StepDef[] = [
  { id: 'produto', label: 'Produto' },
  { id: 'acabamento', label: 'Acabamento' },
  { id: 'resumo', label: 'Resumo' },
]

export const stepsFor = (source: Source): StepDef[] =>
  source === 'demo' ? DEMO_STEPS : source === 'catalogo' ? CATALOG_STEPS : IMPORT_STEPS

export interface SharedConfig {
  /** Acabamentos do produto demonstrativo. */
  f?: Partial<Record<GroupId, string>>
  /** Opcionais ativos do produto demonstrativo. */
  o?: string[]
  /** Linha do produto demonstrativo. */
  l?: string
  /** Produto do catálogo. */
  p?: string
  /** Acabamentos por grupo do produto do catálogo. */
  g?: Record<string, string>
}

interface ConfiguratorState {
  step: number
  source: Source
  line: string
  finishes: Record<GroupId, string>
  options: Record<string, boolean>
  imported: ImportedModel | null
  overrides: Record<string, PartOverride>
  selectedPart: string | null
  /** Produto do catálogo em exibição (fonte 'catalogo'). */
  productId: string | null
  /** Acabamento por grupo do produto do catálogo. */
  groupFinishes: Record<string, string>
  catalogBox: CatalogBox | null
  catalogLoading: boolean
  autoRotate: boolean
  importing: boolean
  importingFile: string | null
  toast: string | null
  /** Incrementado para reposicionar a câmera no preset da etapa atual. */
  cameraNonce: number

  steps: () => StepDef[]
  stepId: () => StepDef['id']
  setStep: (step: number) => void
  next: () => void
  prev: () => void
  setSource: (source: Source) => void
  setLine: (line: string) => void
  setFinish: (group: GroupId, finishId: string) => void
  toggleOption: (id: string) => void
  setImported: (model: ImportedModel | null) => void
  setOverride: (partId: string, override: PartOverride) => void
  clearOverrides: () => void
  selectPart: (id: string | null) => void
  selectProduct: (productId: string) => void
  setGroupFinish: (groupId: string, finishId: string) => void
  resetGroupFinishes: () => void
  setCatalogBox: (box: CatalogBox | null) => void
  setCatalogLoading: (loading: boolean) => void
  setAutoRotate: (value: boolean) => void
  setImporting: (importing: boolean, fileName?: string) => void
  showToast: (message: string, durationMs?: number) => void
  dismissToast: () => void
  recenterCamera: () => void
  applyShared: (shared: SharedConfig) => void
}

export const useConfigurator = create<ConfiguratorState>((set, get) => ({
  step: 0,
  source: 'demo',
  line: 'titanium',
  finishes: defaultFinishes(),
  options: defaultOptions(),
  imported: null,
  overrides: {},
  selectedPart: null,
  productId: null,
  groupFinishes: {},
  catalogBox: null,
  catalogLoading: false,
  autoRotate: true,
  importing: false,
  importingFile: null,
  toast: null,
  cameraNonce: 0,

  steps: () => stepsFor(get().source),
  stepId: () => {
    const steps = get().steps()
    return steps[Math.min(get().step, steps.length - 1)].id
  },
  setStep: (step) => {
    const max = get().steps().length - 1
    set({ step: Math.max(0, Math.min(step, max)), cameraNonce: get().cameraNonce + 1 })
  },
  next: () => get().setStep(get().step + 1),
  prev: () => get().setStep(get().step - 1),
  setSource: (source) => {
    if (source === 'importado' && !get().imported) return
    if (source === 'catalogo' && !get().productId) return
    const max = stepsFor(source).length - 1
    set({
      source,
      step: Math.min(get().step, max),
      selectedPart: null,
      cameraNonce: get().cameraNonce + 1,
    })
  },
  setLine: (line) => set({ line }),
  setFinish: (group, finishId) =>
    set({ finishes: { ...get().finishes, [group]: finishId } }),
  toggleOption: (id) =>
    set({ options: { ...get().options, [id]: !get().options[id] } }),
  setImported: (model) =>
    set({
      imported: model,
      overrides: {},
      selectedPart: null,
      ...(model
        ? { source: 'importado' as Source, step: 1, cameraNonce: get().cameraNonce + 1 }
        : { source: 'demo' as Source, step: 0 }),
    }),
  setOverride: (partId, override) =>
    set({
      overrides: {
        ...get().overrides,
        [partId]: { ...get().overrides[partId], ...override },
      },
    }),
  clearOverrides: () => set({ overrides: {}, selectedPart: null }),
  selectPart: (id) => set({ selectedPart: id }),
  selectProduct: (productId) => {
    const product = productById(productId)
    if (!product) return
    const same = get().productId === productId
    set({
      source: 'catalogo',
      productId,
      groupFinishes: same ? get().groupFinishes : defaultGroupFinishes(product),
      catalogBox: same ? get().catalogBox : null,
      step: Math.min(get().step, CATALOG_STEPS.length - 1),
      selectedPart: null,
      cameraNonce: get().cameraNonce + 1,
    })
  },
  setGroupFinish: (groupId, finishId) =>
    set({ groupFinishes: { ...get().groupFinishes, [groupId]: finishId } }),
  resetGroupFinishes: () => {
    const product = productById(get().productId)
    if (product) set({ groupFinishes: defaultGroupFinishes(product) })
  },
  setCatalogBox: (box) => set({ catalogBox: box, cameraNonce: get().cameraNonce + 1 }),
  setCatalogLoading: (loading) => set({ catalogLoading: loading }),
  setAutoRotate: (value) => set({ autoRotate: value }),
  setImporting: (importing, fileName) =>
    set({ importing, importingFile: importing ? (fileName ?? null) : null }),
  showToast: (message, durationMs = 3600) => {
    set({ toast: message })
    window.setTimeout(() => {
      if (get().toast === message) set({ toast: null })
    }, durationMs)
  },
  dismissToast: () => set({ toast: null }),
  recenterCamera: () => set({ cameraNonce: get().cameraNonce + 1 }),
  applyShared: (shared) => {
    const product = productById(shared.p)
    if (product) {
      const defaults = defaultGroupFinishes(product)
      const finishes = { ...defaults }
      for (const [groupId, finishId] of Object.entries(shared.g ?? {})) {
        if (groupId in defaults && typeof finishId === 'string') finishes[groupId] = finishId
      }
      set({
        source: 'catalogo',
        productId: product.id,
        groupFinishes: finishes,
        catalogBox: null,
        step: 0,
        cameraNonce: get().cameraNonce + 1,
      })
      return
    }
    set({
      source: 'demo',
      ...(shared.l ? { line: shared.l } : {}),
      finishes: { ...defaultFinishes(), ...(shared.f ?? {}) },
      options: Object.fromEntries(
        Object.keys(defaultOptions()).map((id) => [id, (shared.o ?? []).includes(id)]),
      ),
    })
  },
}))
