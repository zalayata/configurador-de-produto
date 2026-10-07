// Capítulos do controle de produção do Dosador Horizon — estrutura fixa (ids das etapas, passos e grupos do 3D).
// Datas, percentuais, mensagens, fotos e histórico NÃO ficam aqui: vêm de public/horizon/andamento.json em
// tempo de execução. Textos de interface no tom afirmativo (sem "previsto", "a confirmar", "ilustrativo").
import { STATUS, estadoDoPasso, fracaoDoPasso, type Etapa, type Passo, type Status } from './cronograma'

/** As 8 etapas da produção, na ordem dos capítulos (ids fixos: o JSON precisa ter exatamente estas). */
export const ETAPAS_DA_PRODUCAO = [
  'pedido',
  'engenharia',
  'suprimentos',
  'fabricacao',
  'pintura',
  'montagem',
  'testes',
  'expedicao',
] as const
export type EtapaId = (typeof ETAPAS_DA_PRODUCAO)[number]
export const ehEtapaId = (v: unknown): v is EtapaId => typeof v === 'string' && (ETAPAS_DA_PRODUCAO as readonly string[]).includes(v)

/** Grupos do modelo 3D do dosador (nomes para etiquetas, checklist e texto alternativo). */
export const GRUPOS = [
  { id: 'estrutura', rotulo: 'Estrutura e pés', origem: 'fabricado' },
  { id: 'calha', rotulo: 'Calha e tampas de extremidade', origem: 'fabricado' },
  { id: 'moega', rotulo: 'Moega de alimentação', origem: 'fabricado' },
  { id: 'rosca', rotulo: 'Rosca helicoidal e eixo', origem: 'fabricado' },
  { id: 'descarga', rotulo: 'Bocal de descarga', origem: 'fabricado' },
  { id: 'tampas', rotulo: 'Tampas de inspeção e proteções', origem: 'fabricado' },
  { id: 'mancais', rotulo: 'Mancais', origem: 'comprado' },
  { id: 'motoredutor', rotulo: 'Motoredutor', origem: 'comprado' },
  { id: 'painel', rotulo: 'Painel de comando', origem: 'comprado' },
] as const
export type GrupoId = (typeof GRUPOS)[number]['id']
export const GRUPO_IDS: GrupoId[] = GRUPOS.map((g) => g.id)
export const rotuloDoGrupo = (id: GrupoId): string => GRUPOS.find((g) => g.id === id)?.rotulo ?? id

/** Grupos que saem da fabricação própria (caldeiraria e usinagem), na ordem em que ficam prontos. */
export const GRUPOS_FABRICADOS: GrupoId[] = ['estrutura', 'calha', 'moega', 'rosca']
/** Itens comprados que chegam em Suprimentos, na ordem de chegada. */
export const GRUPOS_COMPRADOS: GrupoId[] = ['mancais', 'motoredutor', 'painel']
/** Grupos que entram na montagem, na ordem de montagem. */
export const GRUPOS_MONTAGEM: GrupoId[] = ['mancais', 'motoredutor', 'descarga', 'tampas', 'painel']
/** Grupos pintados (vinho Idugel): a pintura muda a cor destes; calha e moega recebem o acabamento inox escovado. */
export const GRUPOS_PINTADOS: GrupoId[] = ['estrutura', 'descarga']
export const GRUPOS_INOX: GrupoId[] = ['calha', 'moega', 'tampas']

/**
 * Passos (checklist) de cada etapa, com a faixa do percentual da etapa em que cada um está em andamento.
 * As faixas se sobrepõem de propósito: na fábrica há sempre mais de uma frente aberta. O 3D traz o grupo do
 * passo (`grupo`) do fantasma ao lugar dentro da faixa — passo concluído ⇒ grupo no lugar (teste).
 */
export const PASSOS: Record<EtapaId, Passo[]> = {
  pedido: [],
  engenharia: [
    { id: 'conjunto', nome: 'Desenho de conjunto', faixa: [0, 40], fim: 'o' },
    { id: 'detalhamento', nome: 'Detalhamento das peças', faixa: [30, 75], fim: 'o' },
    { id: 'lista', nome: 'Lista de materiais', faixa: [60, 90], fim: 'a' },
    { id: 'liberacao', nome: 'Liberação para produção', faixa: [90, 100], fim: 'a' },
  ],
  suprimentos: [
    { id: 'chapas', nome: 'Chapas, perfis e tubos', faixa: [0, 40], fim: 'os' },
    { id: 'mancais', nome: 'Mancais e rolamentos', faixa: [20, 55], fim: 'os', grupo: 'mancais' },
    { id: 'motoredutor', nome: 'Motoredutor', faixa: [35, 80], fim: 'o', grupo: 'motoredutor' },
    { id: 'eletrica', nome: 'Componentes elétricos e painel', faixa: [60, 100], fim: 'os', grupo: 'painel' },
  ],
  fabricacao: [
    { id: 'estrutura', nome: 'Corte, dobra e solda da estrutura', faixa: [0, 35], fim: 'a', grupo: 'estrutura' },
    { id: 'calha', nome: 'Caldeiraria da calha', faixa: [20, 60], fim: 'a', grupo: 'calha' },
    { id: 'moega', nome: 'Caldeiraria da moega', faixa: [45, 80], fim: 'a', grupo: 'moega' },
    { id: 'rosca', nome: 'Usinagem do eixo e da rosca', faixa: [60, 100], fim: 'a', grupo: 'rosca' },
  ],
  pintura: [
    { id: 'preparacao', nome: 'Preparação de superfície', faixa: [0, 30], fim: 'a' },
    { id: 'fundo', nome: 'Fundo', faixa: [30, 60], fim: 'o' },
    { id: 'acabamento', nome: 'Acabamento e escovamento do inox', faixa: [60, 100], fim: 'o' },
  ],
  montagem: [
    { id: 'mancais', nome: 'Mancais e rosca', faixa: [0, 25], fim: 'os', grupo: 'mancais' },
    { id: 'motoredutor', nome: 'Motoredutor e acoplamento', faixa: [20, 50], fim: 'o', grupo: 'motoredutor' },
    { id: 'descarga', nome: 'Bocal de descarga', faixa: [45, 65], fim: 'o', grupo: 'descarga' },
    { id: 'tampas', nome: 'Tampas e proteções', faixa: [60, 80], fim: 'as', grupo: 'tampas' },
    { id: 'painel', nome: 'Painel e instalação elétrica', faixa: [75, 100], fim: 'o', grupo: 'painel' },
  ],
  testes: [
    { id: 'giro', nome: 'Teste de giro em vazio', faixa: [0, 40], fim: 'o' },
    { id: 'eletrica', nome: 'Verificação elétrica e de segurança', faixa: [35, 75], fim: 'a' },
    { id: 'inspecao', nome: 'Inspeção final e liberação', faixa: [70, 100], fim: 'a' },
  ],
  expedicao: [
    { id: 'embalagem', nome: 'Embalagem', faixa: [0, 40], fim: 'a' },
    { id: 'carregamento', nome: 'Carregamento', faixa: [40, 55], fim: 'o' },
    { id: 'transporte', nome: 'Transporte', faixa: [55, 95], fim: 'o' },
    { id: 'entrega', nome: 'Entrega', faixa: [95, 100], fim: 'a' },
  ],
}

/** Nome curto de cada etapa (linha do tempo, pílula). */
export const NOMES_CURTOS: Record<EtapaId, string> = {
  pedido: 'Pedido',
  engenharia: 'Engenharia',
  suprimentos: 'Suprimentos',
  fabricacao: 'Fabricação',
  pintura: 'Pintura',
  montagem: 'Montagem',
  testes: 'Testes',
  expedicao: 'Expedição',
}

/** Como o modelo 3D se comporta em cada capítulo (HorizonStage/DosadorModel leem este descritor). */
export type ModoDoModelo =
  | 'completo' // dosador pronto, acabamento final
  | 'projeto' // fantasma de todo o conjunto (engenharia)
  | 'suprimentos' // fantasma; itens comprados ficam sólidos conforme chegam
  | 'fabricacao' // só os grupos fabricados, em aço bruto, chegando ao lugar; comprados ausentes
  | 'pintura' // grupos fabricados; cor do aço bruto ao acabamento final
  | 'montagem' // fabricados pintados; itens de montagem vêm do afastamento ao lugar
  | 'testes' // completo, rosca girando, painel ligado
  | 'expedicao' // completo sobre o estrado, engradado fechando conforme o percentual
  | 'nenhum'

export interface Capitulo {
  id: EtapaId | 'atualizacoes'
  etapa: EtapaId | null
  indice: number
  numero: string
  nome: string
  titulo: string
  /** Título enquanto a etapa está em andamento (opcional). */
  tituloEmAndamento?: string
  /** Frase de apoio (afirmativa, curta). */
  apoio: string
  icone: string
  modelo: ModoDoModelo
  /** Capítulo em "papel" (histórico), sem 3D em destaque. */
  papel?: boolean
}

const dd = (n: number) => String(n).padStart(2, '0')

const LISTA: Omit<Capitulo, 'indice' | 'numero'>[] = [
  {
    id: 'pedido',
    etapa: 'pedido',
    nome: 'Pedido',
    titulo: 'Pedido confirmado',
    apoio: 'Dosador Horizon em produção no Grupo Idugel. Cada etapa aparece aqui com data e andamento.',
    icone: 'pedido',
    modelo: 'completo',
  },
  {
    id: 'engenharia',
    etapa: 'engenharia',
    nome: 'Engenharia',
    titulo: 'Engenharia e detalhamento',
    tituloEmAndamento: 'Em engenharia',
    apoio: 'Desenho de conjunto, detalhamento das peças e lista de materiais liberados para a produção.',
    icone: 'projeto',
    modelo: 'projeto',
  },
  {
    id: 'suprimentos',
    etapa: 'suprimentos',
    nome: 'Suprimentos',
    titulo: 'Suprimentos',
    tituloEmAndamento: 'Suprimentos em andamento',
    apoio: 'Chapas, perfis, mancais, motoredutor e componentes elétricos chegam à fábrica.',
    icone: 'compras',
    modelo: 'suprimentos',
  },
  {
    id: 'fabricacao',
    etapa: 'fabricacao',
    nome: 'Fabricação',
    titulo: 'Fabricação — Fábrica Idugel, Joaçaba',
    tituloEmAndamento: 'Em fabricação — Fábrica Idugel, Joaçaba',
    apoio: 'Corte, dobra, solda, caldeiraria e usinagem. No modelo, cada conjunto chega ao seu lugar conforme fica pronto.',
    icone: 'fabrica',
    modelo: 'fabricacao',
  },
  {
    id: 'pintura',
    etapa: 'pintura',
    nome: 'Pintura',
    titulo: 'Pintura e acabamento',
    tituloEmAndamento: 'Em pintura e acabamento',
    apoio: 'Preparação de superfície, fundo e acabamento. Estrutura em vinho Idugel; calha e moega em inox escovado.',
    icone: 'pintura',
    modelo: 'pintura',
  },
  {
    id: 'montagem',
    etapa: 'montagem',
    nome: 'Montagem',
    titulo: 'Montagem mecânica e elétrica',
    tituloEmAndamento: 'Em montagem',
    apoio: 'Mancais, rosca, motoredutor, bocal de descarga, tampas e painel entram no conjunto.',
    icone: 'montagem',
    modelo: 'montagem',
  },
  {
    id: 'testes',
    etapa: 'testes',
    nome: 'Testes',
    titulo: 'Testes e inspeção final',
    tituloEmAndamento: 'Em testes',
    apoio: 'Giro em vazio, verificação elétrica e de segurança, inspeção final e liberação para expedição.',
    icone: 'teste',
    modelo: 'testes',
  },
  {
    id: 'expedicao',
    etapa: 'expedicao',
    nome: 'Expedição',
    titulo: 'Expedição e entrega',
    tituloEmAndamento: 'Em expedição',
    apoio: 'Embalagem sobre estrado, carregamento, transporte e entrega.',
    icone: 'carreta',
    modelo: 'expedicao',
  },
  {
    id: 'atualizacoes',
    etapa: null,
    nome: 'Atualizações',
    titulo: 'Atualizações',
    apoio: 'Histórico da produção, fotos, resumo para imprimir e contato.',
    icone: 'texto',
    modelo: 'completo',
    papel: true,
  },
]

export const CAPITULOS: Capitulo[] = LISTA.map((c, i) => ({ ...c, indice: i, numero: dd(i + 1) }))
export const TOTAL = CAPITULOS.length
export type CapituloId = Capitulo['id']

export const porId = (id: string | null | undefined): Capitulo | null =>
  CAPITULOS.find((c) => c.id === id) ?? null
export const capituloDaEtapa = (etapaId: string | null | undefined): Capitulo | null =>
  CAPITULOS.find((c) => c.etapa === etapaId) ?? null
export const ehCapituloId = (v: unknown): v is CapituloId => typeof v === 'string' && !!porId(v)

/** Passos de uma etapa com o estado do dia. */
export function passosDaEtapa(e: Etapa | null | undefined): Array<{ passo: Passo; estado: Status; fracao: number }> {
  if (!e || !ehEtapaId(e.id)) return []
  return PASSOS[e.id].map((passo) => ({ passo, estado: estadoDoPasso(e, passo), fracao: fracaoDoPasso(e, passo) }))
}

/**
 * Entrada dos grupos do 3D numa etapa: { id, t } por grupo ligado a um passo da etapa — t = 0 ainda não chegou,
 * 0 < t < 1 chegando, 1 no lugar. Com movimento reduzido não há peça a meio caminho: dentro da faixa vale 1.
 */
export function entradaDosGrupos(e: Etapa | null | undefined, { reduzido = false } = {}): Array<{ id: GrupoId; t: number }> {
  return passosDaEtapa(e)
    .filter((x) => x.passo.grupo)
    .map((x) => {
      let t = x.fracao
      if (x.estado === STATUS.concluida) t = 1
      if (reduzido && t > 0) t = 1
      return { id: x.passo.grupo as GrupoId, t }
    })
}

/** Estado da URL: "#fabricacao". Devolve o capítulo ou null. */
export function lerHash(hash: string = typeof window !== 'undefined' ? window.location.hash : ''): Capitulo | null {
  const bruto = String(hash || '').replace(/^#/, '').split('?')[0]
  let nome = ''
  try {
    nome = decodeURIComponent(bruto)
  } catch {
    nome = ''
  }
  return porId(nome)
}

/** Termos que não entram em nenhum texto da página (tom afirmativo; testes varrem textos e JSON). */
export const TERMOS_RESERVADOS = [
  'previs',
  'a confirmar',
  'ilustrativ',
  'aproximad',
  'estimad',
  'indisponível',
  'sem representação',
  'talvez',
  'possivelmente',
]
