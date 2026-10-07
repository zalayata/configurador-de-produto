/**
 * Catálogo de produtos reais do configurador.
 *
 * Fonte única por produto: o manifesto gerado pelo conversor (`src/catalog/modelos/<id>.json`,
 * escrito por `tools/cad/converter-step.mjs`) traz os grupos do modelo 3D, seus rótulos públicos,
 * dimensões e proveniência. Este arquivo acrescenta só o que é comercial/visual: nome, código,
 * descrição, especificações e o acabamento padrão de cada grupo configurável.
 *
 * Regras herdadas da linha Chromium: nenhum fabricante terceiro, nenhum preço, nenhum número que
 * não venha do projeto (os valores de potência e polos vêm do nome da montagem CAD).
 */
import type { FinishKind } from '../config/product'
import hg80 from './modelos/iduflow-hg80.json'
import hg125v from './modelos/iduflow-hg125v.json'

export interface ManifestGroup {
  id: string
  rotulo: string
  descricao: string
  malhas: number
  triangulos: number
  min: number[]
  max: number[]
  ancora: number[]
}

export interface ModelManifest {
  id: string
  nome: string
  linha: string | null
  arquivo: string
  dimensoesMm: { comprimento: number; altura: number; profundidade: number }
  limites: { min: number[]; max: number[] }
  malhas: number
  triangulos: number
  bytes: number
  grupos: ManifestGroup[]
  origem: { id?: string; descricao?: string; arquivo: string; sha256: string }
  glbSha256: string
  geradoEm: string
}

export interface GroupConfig {
  /** Acabamento padrão. Grupos sem configuração mantêm o material do modelo (não configuráveis). */
  defaultFinish: string
  allowed?: 'todos' | FinishKind
}

export interface Spec {
  label: string
  value: string
}

export interface CatalogProduct {
  id: string
  line: string
  name: string
  shortName: string
  code: string
  description: string
  specs: Spec[]
  manifest: ModelManifest
  groups: Record<string, GroupConfig>
}

const mm = (v: number) => `${v.toLocaleString('pt-BR')} mm`
const dimensoes = (m: ModelManifest): Spec => ({
  label: 'Dimensões (C × A × P)',
  value: `${mm(m.dimensoesMm.comprimento)} × ${mm(m.dimensoesMm.altura)} × ${mm(m.dimensoesMm.profundidade)}`,
})

export const CATALOG: CatalogProduct[] = [
  {
    id: 'iduflow-hg80',
    line: 'IduFlow',
    name: 'Soprador IduFlow HG80',
    shortName: 'IduFlow HG80',
    code: 'HG80',
    description:
      'Conjunto soprador de lóbulos com motor de 11 kW, transmissão por correias e base com ' +
      'silenciador de descarga integrado, sobre amortecedores de vibração.',
    specs: [
      { label: 'Motor', value: '11 kW · 2 polos · montagem B3' },
      { label: 'Transmissão', value: 'Correias em V, polias SPC 200 × 3' },
      { label: 'Silenciador de descarga', value: 'Integrado à base' },
      { label: 'Apoio', value: '6 amortecedores de vibração' },
      dimensoes(hg80 as ModelManifest),
    ],
    manifest: hg80 as ModelManifest,
    groups: {
      soprador: { defaultFinish: 'ral-7035' },
      descarga: { defaultFinish: 'ral-7035' },
      motor: { defaultFinish: 'ral-7016' },
      'base-motor': { defaultFinish: 'vinho-idugel' },
      base: { defaultFinish: 'vinho-idugel' },
    },
  },
  {
    id: 'iduflow-hg125v',
    line: 'IduFlow',
    name: 'Soprador IduFlow HG125V',
    shortName: 'IduFlow HG125V',
    code: 'HG125V',
    description:
      'Conjunto soprador de lóbulos com motor de 30 kW, base basculante com esticador, proteção ' +
      'das correias, filtro e silenciador de admissão, silenciador de descarga integrado à base, ' +
      'conexão elástica e válvula de retenção na saída.',
    specs: [
      { label: 'Motor', value: '30 kW · 4 polos · montagem B3' },
      { label: 'Transmissão', value: 'Correias em V, polias SPC 250 × 3 e SPC 200 × 3' },
      { label: 'Admissão', value: 'Filtro e silenciador sobre o soprador' },
      { label: 'Descarga', value: 'Silenciador integrado, conexão elástica e válvula de retenção' },
      { label: 'Apoio', value: '6 amortecedores de vibração' },
      dimensoes(hg125v as ModelManifest),
    ],
    manifest: hg125v as ModelManifest,
    groups: {
      soprador: { defaultFinish: 'ral-7035' },
      admissao: { defaultFinish: 'ral-7035' },
      descarga: { defaultFinish: 'ral-7035' },
      valvula: { defaultFinish: 'ral-7035' },
      motor: { defaultFinish: 'ral-7016' },
      'base-motor': { defaultFinish: 'vinho-idugel' },
      protecao: { defaultFinish: 'vinho-idugel' },
      base: { defaultFinish: 'vinho-idugel' },
    },
  },
]

export const productById = (id: string | null | undefined): CatalogProduct | undefined =>
  CATALOG.find((p) => p.id === id)

/** Grupos do manifesto que recebem acabamento (na ordem do manifesto). */
export const configurableGroups = (product: CatalogProduct): ManifestGroup[] =>
  product.manifest.grupos.filter((g) => product.groups[g.id])

export const defaultGroupFinishes = (product: CatalogProduct): Record<string, string> =>
  Object.fromEntries(Object.entries(product.groups).map(([id, cfg]) => [id, cfg.defaultFinish]))

export const modelUrl = (product: CatalogProduct): string =>
  `${import.meta.env.BASE_URL}models/${product.manifest.arquivo}`
