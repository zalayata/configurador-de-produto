import { create } from 'zustand'
import type * as THREE from 'three'
import {
  defaultFinishes,
  defaultOptions,
  type GroupId,
} from '../config/product'

export type Source = 'demo' | 'importado'

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

interface ConfiguratorState {
  step: number
  source: Source
  line: string
  finishes: Record<GroupId, string>
  options: Record<string, boolean>
  imported: ImportedModel | null
  overrides: Record<string, PartOverride>
  selectedPart: string | null
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
  setAutoRotate: (value: boolean) => void
  setImporting: (importing: boolean, fileName?: string) => void
  showToast: (message: string, durationMs?: number) => void
  dismissToast: () => void
  recenterCamera: () => void
  applyShared: (
    finishes: Partial<Record<GroupId, string>>,
    enabledOptions: string[],
    line?: string,
  ) => void
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
  autoRotate: true,
  importing: false,
  importingFile: null,
  toast: null,
  cameraNonce: 0,

  steps: () => (get().source === 'demo' ? DEMO_STEPS : IMPORT_STEPS),
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
    const max = (source === 'demo' ? DEMO_STEPS : IMPORT_STEPS).length - 1
    set({ source, step: Math.min(get().step, max), selectedPart: null })
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
  applyShared: (finishes, enabledOptions, line) =>
    set({
      source: 'demo',
      ...(line ? { line } : {}),
      finishes: { ...defaultFinishes(), ...finishes },
      options: Object.fromEntries(
        Object.keys(defaultOptions()).map((id) => [id, enabledOptions.includes(id)]),
      ),
    }),
}))
