export type FinishKind = 'inox' | 'pintura'

export interface Finish {
  id: string
  label: string
  /** Cor exibida no seletor (CSS). */
  swatch: string
  /** Cor aplicada ao material 3D. */
  color: string
  metalness: number
  roughness: number
  kind: FinishKind
  ral?: string
}

export const FINISHES: Finish[] = [
  {
    id: 'inox-304',
    label: 'Inox 304 escovado',
    swatch: 'linear-gradient(135deg, #d9dee1 0%, #aeb6bb 45%, #ced4d8 55%, #9aa3a9 100%)',
    color: '#c9cfd3',
    metalness: 0.92,
    roughness: 0.38,
    kind: 'inox',
  },
  {
    id: 'inox-polido',
    label: 'Inox polido',
    swatch: 'linear-gradient(135deg, #f2f5f7 0%, #b9c2c8 40%, #eef1f3 60%, #a7b1b8 100%)',
    color: '#d7dcdf',
    metalness: 1,
    roughness: 0.14,
    kind: 'inox',
  },
  {
    id: 'vinho-idugel',
    label: 'Vinho Idugel',
    swatch: 'linear-gradient(135deg, #a32026, #7b1f1f)',
    color: '#8b1a1a',
    metalness: 0.22,
    roughness: 0.42,
    kind: 'pintura',
  },
  {
    id: 'ral-5015',
    label: 'Azul céu · RAL 5015',
    swatch: '#2271b3',
    color: '#2271b3',
    metalness: 0.2,
    roughness: 0.42,
    kind: 'pintura',
    ral: 'RAL 5015',
  },
  {
    id: 'ral-5005',
    label: 'Azul sinal · RAL 5005',
    swatch: '#154889',
    color: '#154889',
    metalness: 0.2,
    roughness: 0.42,
    kind: 'pintura',
    ral: 'RAL 5005',
  },
  {
    id: 'ral-9003',
    label: 'Branco sinal · RAL 9003',
    swatch: '#f2f3f2',
    color: '#f2f3f2',
    metalness: 0.15,
    roughness: 0.5,
    kind: 'pintura',
    ral: 'RAL 9003',
  },
  {
    id: 'ral-7035',
    label: 'Cinza claro · RAL 7035',
    swatch: '#d7d9d6',
    color: '#d7d9d6',
    metalness: 0.15,
    roughness: 0.5,
    kind: 'pintura',
    ral: 'RAL 7035',
  },
  {
    id: 'ral-7016',
    label: 'Grafite · RAL 7016',
    swatch: '#383e42',
    color: '#383e42',
    metalness: 0.25,
    roughness: 0.46,
    kind: 'pintura',
    ral: 'RAL 7016',
  },
  {
    id: 'ral-3020',
    label: 'Vermelho tráfego · RAL 3020',
    swatch: '#c1121c',
    color: '#c1121c',
    metalness: 0.2,
    roughness: 0.44,
    kind: 'pintura',
    ral: 'RAL 3020',
  },
  {
    id: 'ral-6024',
    label: 'Verde tráfego · RAL 6024',
    swatch: '#2e8b57',
    color: '#2e8b57',
    metalness: 0.2,
    roughness: 0.44,
    kind: 'pintura',
    ral: 'RAL 6024',
  },
]

export const finishById = (id: string): Finish =>
  FINISHES.find((f) => f.id === id) ?? FINISHES[0]

export type GroupId = 'estrutura' | 'corpo' | 'motor' | 'painel'

export interface PartGroup {
  id: GroupId
  label: string
  description: string
  /** Restringe os acabamentos disponíveis para o grupo. */
  allowed: 'todos' | FinishKind
  defaultFinish: string
}

export const PART_GROUPS: PartGroup[] = [
  {
    id: 'corpo',
    label: 'Corpo de moagem',
    description: 'Câmara de moagem, moega de alimentação e chute de descarga.',
    allowed: 'todos',
    defaultFinish: 'inox-304',
  },
  {
    id: 'estrutura',
    label: 'Estrutura e base',
    description: 'Base, pés e suportes de sustentação do conjunto.',
    allowed: 'todos',
    defaultFinish: 'vinho-idugel',
  },
  {
    id: 'motor',
    label: 'Motor e transmissão',
    description: 'Motor elétrico, polias e proteção da transmissão.',
    allowed: 'todos',
    defaultFinish: 'ral-7016',
  },
  {
    id: 'painel',
    label: 'Painel de comando',
    description: 'Gabinete elétrico e interface de operação.',
    allowed: 'todos',
    defaultFinish: 'ral-7035',
  },
]

export interface ProductOption {
  id: string
  code: string
  label: string
  description: string
  default: boolean
}

export const OPTIONS: ProductOption[] = [
  {
    id: 'moega',
    code: 'OPC-01',
    label: 'Moega de alimentação ampliada',
    description: 'Moega superior de maior volume para alimentação contínua por gravidade.',
    default: true,
  },
  {
    id: 'ima',
    code: 'OPC-02',
    label: 'Separador magnético',
    description: 'Ímã de proteção no bocal de entrada contra materiais ferrosos.',
    default: false,
  },
  {
    id: 'ciclone',
    code: 'OPC-03',
    label: 'Ciclone de descarga',
    description: 'Ciclone com tubulação pneumática para coleta e despoeiramento do produto moído.',
    default: false,
  },
  {
    id: 'plataforma',
    code: 'OPC-04',
    label: 'Plataforma de operação',
    description: 'Plataforma com escada e guarda-corpo para acesso à moega e manutenção.',
    default: false,
  },
  {
    id: 'ihm',
    code: 'OPC-05',
    label: 'IHM com tela colorida',
    description: 'Interface de operação com tela colorida de 7" no painel de comando.',
    default: false,
  },
  {
    id: 'sinalizador',
    code: 'OPC-06',
    label: 'Sinalizador de status',
    description: 'Coluna luminosa indicando operação, alerta e parada.',
    default: true,
  },
]

export interface ProductLine {
  id: string
  label: string
  description: string
}

export const PRODUCT_LINES: ProductLine[] = [
  {
    id: 'titanium',
    label: 'Titanium',
    description: 'Excelente custo-benefício, com a robustez de 30 anos de moagem.',
  },
  {
    id: 'chromium',
    label: 'Chromium',
    description: 'Alta robustez e recursos de Indústria 4.0 para operação contínua.',
  },
]

export const DEMO_PRODUCT = {
  name: 'Moinho de martelos — modelo demonstrativo',
  shortName: 'Moinho de martelos',
  code: 'MMD-600',
  description:
    'Equipamento demonstrativo gerado proceduralmente para apresentar o configurador. ' +
    'Importe um modelo real exportado do Autodesk Inventor ou Fusion para configurar o seu produto.',
}

export const allowedFinishes = (group: PartGroup): Finish[] =>
  group.allowed === 'todos' ? FINISHES : FINISHES.filter((f) => f.kind === group.allowed)

export const defaultFinishes = (): Record<GroupId, string> =>
  Object.fromEntries(PART_GROUPS.map((g) => [g.id, g.defaultFinish])) as Record<GroupId, string>

export const defaultOptions = (): Record<string, boolean> =>
  Object.fromEntries(OPTIONS.map((o) => [o.id, o.default]))
