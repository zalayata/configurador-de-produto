// Cronograma da produção — funções PURAS (sem DOM), testadas em cronograma.test.ts.
// Regra: o status e o percentual de cada etapa saem só da data de hoje e das datas do andamento.json;
// `ajustes` prevalecem campo a campo (os fora da regra são ignorados); uma etapa só começa depois que a
// anterior concluiu. Nenhum valor do JSON é repetido aqui.
// Herdado do acompanhamento Koene (cronograma.js), portado para TypeScript.

export const STATUS = {
  concluida: 'concluida',
  andamento: 'em-andamento',
  programada: 'programada',
} as const
export type Status = (typeof STATUS)[keyof typeof STATUS]

export type CampoDeData = 'inicio' | 'fim'
export const CAMPOS_DE_DATA: CampoDeData[] = ['inicio', 'fim']
/** Rótulos padrão dos campos de data no capítulo (o JSON troca por etapa em `etapas[].rotulos`). */
export const ROTULOS_PADRAO: Record<CampoDeData, string> = { inicio: 'Início', fim: 'Término' }

/** Etapa como vem do andamento.json. */
export interface EtapaBruta {
  id: string
  nome: string
  inicio: string
  fim: string
  local?: string
  rotulos?: Partial<Record<CampoDeData, string>>
  datasPublicas?: CampoDeData[] | CampoDeData
}

/** Ajuste de uma etapa (`ajustes[etapaId]`) já saneado por `ajusteValido`. */
export interface Ajuste {
  status?: Status
  percentual?: number
  realizadoEm?: string
  inicio?: string
  fim?: string
  mensagem?: string
  /** Estado forçado de passos (checklist) pelo id do passo. */
  passos?: Record<string, Status>
}

export interface AndamentoCalculavel {
  etapas?: EtapaBruta[]
  ajustes?: Record<string, unknown>
}

/** Etapa calculada para o dia. */
export interface Etapa {
  id: string
  nome: string
  /** Datas efetivas DE CÁLCULO (podem ser internas): para exibir, só `dataPublica()`. */
  inicio: string
  fim: string
  status: Status
  percentual: number
  publicas: CampoDeData[]
  rotulos: Record<CampoDeData, string>
  /** Data fixa de conclusão (realizadoEm, senão o fim público) — nunca a data de hoje. */
  concluidaEm: string | null
  mensagem: string | null
  local: string | null
  passosForcados: Record<string, Status>
  duracao: number
  ativa: boolean
  /** Rótulo afirmativo numa linha ("Em andamento · 18 % · até 16/10/2026"). */
  rotulo: string
}

export interface Cronograma {
  hoje: string
  etapas: Etapa[]
  etapaAtual: Etapa | null
  percentualGeral: number
}

const DIA = 86400000
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

/** 'aaaa-mm-dd' → número do dia (UTC), sem fuso: a mesma data vale em qualquer navegador. */
export function diaDe(iso: unknown): number {
  const m = ISO.exec(String(iso ?? ''))
  if (!m) return NaN
  const a = Number(m[1])
  const me = Number(m[2])
  const d = Number(m[3])
  const t = Date.UTC(a, me - 1, d)
  const data = new Date(t)
  // rejeita datas impossíveis (31/02 etc.)
  if (data.getUTCFullYear() !== a || data.getUTCMonth() !== me - 1 || data.getUTCDate() !== d) return NaN
  return Math.round(t / DIA)
}

export const isoValida = (iso: unknown): iso is string => Number.isFinite(diaDe(iso))

/** Número do dia → 'aaaa-mm-dd'. */
export function isoDe(dia: number): string {
  const d = new Date(dia * DIA)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/** Data local do navegador (ou de um Date) em 'aaaa-mm-dd'. */
export function isoLocal(data: Date = new Date()): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

/** 'aaaa-mm-dd' → 'dd/mm/aaaa'; data fora do formato ou impossível → '' (quem exibe omite o trecho). */
export function formatarData(iso: unknown): string {
  const m = ISO.exec(String(iso ?? ''))
  return m && isoValida(iso) ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

/** 'aaaa-mm-dd' → 'dd/mm' (linha do tempo compacta); '' se fora do formato. */
export function formatarDataCurta(iso: unknown): string {
  const m = ISO.exec(String(iso ?? ''))
  return m && isoValida(iso) ? `${m[3]}/${m[2]}` : ''
}

const limitar = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const definido = <T>(v: T | null | undefined): v is T => v !== null && v !== undefined
const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

const STATUS_VALIDOS: string[] = Object.values(STATUS)
const ehStatus = (v: unknown): v is Status => typeof v === 'string' && STATUS_VALIDOS.includes(v)

/**
 * Ajuste de uma etapa só com os campos dentro da regra; cada campo fora dela é ignorado (os demais valem):
 * status ∈ STATUS · percentual 0..100 · realizadoEm/inicio/fim em 'aaaa-mm-dd' real · mensagem com texto ·
 * passos: { idDoPasso: status }.
 */
export function ajusteValido(a: unknown): Ajuste {
  const s: Ajuste = {}
  if (!ehObjeto(a)) return s
  if (ehStatus(a.status)) s.status = a.status
  const bruto = a.percentual
  const n =
    typeof bruto === 'number' || (typeof bruto === 'string' && bruto.trim() !== '') ? Number(bruto) : NaN
  if (Number.isFinite(n) && n >= 0 && n <= 100) s.percentual = Math.round(n)
  for (const k of ['realizadoEm', 'inicio', 'fim'] as const) if (isoValida(a[k])) s[k] = a[k] as string
  if (typeof a.mensagem === 'string' && a.mensagem.trim()) s.mensagem = a.mensagem.trim()
  if (ehObjeto(a.passos)) {
    const passos: Record<string, Status> = {}
    for (const [id, st] of Object.entries(a.passos)) if (ehStatus(st)) passos[id] = st
    if (Object.keys(passos).length) s.passos = passos
  }
  return s
}

/**
 * Datas que a página mostra de uma etapa: `datasPublicas` do JSON (lista com 'inicio' e/ou 'fim'; padrão as duas).
 * Uma data fora dela só entra no cálculo (percentual, sequência): nunca aparece na tela nem na impressão.
 */
export function datasPublicasDe(e: Pick<EtapaBruta, 'datasPublicas'> | null | undefined): CampoDeData[] {
  const d = typeof e?.datasPublicas === 'string' ? [e.datasPublicas] : e?.datasPublicas
  return Array.isArray(d) ? CAMPOS_DE_DATA.filter((k) => d.includes(k)) : [...CAMPOS_DE_DATA]
}

/** Rótulos dos campos de data da etapa: `etapas[].rotulos` sobre ROTULOS_PADRAO. */
export function rotulosDe(e: Pick<EtapaBruta, 'rotulos'> | null | undefined): Record<CampoDeData, string> {
  const r = { ...ROTULOS_PADRAO }
  for (const k of CAMPOS_DE_DATA) {
    const v = e?.rotulos?.[k]
    if (typeof v === 'string' && v.trim()) r[k] = v.trim()
  }
  return r
}

/** Data ('aaaa-mm-dd') de um campo da etapa, só se for pública e real; senão null. */
export function dataPublica(
  e: { inicio?: string; fim?: string; publicas?: CampoDeData[]; datasPublicas?: EtapaBruta['datasPublicas'] } | null | undefined,
  campo: CampoDeData,
): string | null {
  if (!e || !CAMPOS_DE_DATA.includes(campo)) return null
  const publicas = Array.isArray(e.publicas) ? e.publicas : datasPublicasDe(e)
  const v = e[campo]
  return publicas.includes(campo) && isoValida(v) ? v : null
}

export interface PartesDoRotulo {
  estado: string
  data: string
  sep: string
}

/**
 * Partes do rótulo da etapa: { estado, data, sep } — a linha do tempo pode pôr a data na segunda linha.
 * Concluída: "Concluída em dd/mm/aaaa". Em andamento: "Em andamento · n %" + " · até <fim>" se o fim é público.
 * Programada: "Programada · até <fim>" se o fim é público, senão "Programada · a partir de <início>".
 * Data ausente, impossível ou não pública: só o estado (nunca "Concluída em " vazio nem "NaN %").
 */
export function partesDoRotulo(e: {
  status: Status
  percentual: number
  inicio?: string
  fim?: string
  concluidaEm?: string | null
  publicas?: CampoDeData[]
}): PartesDoRotulo {
  const pub = Array.isArray(e.publicas) ? e.publicas : CAMPOS_DE_DATA
  const fimPublico = pub.includes('fim') ? formatarData(e.fim) : ''
  const inicioPublico = pub.includes('inicio') ? formatarData(e.inicio) : ''
  if (e.status === STATUS.concluida) {
    return formatarData(e.concluidaEm)
      ? { estado: 'Concluída', data: `em ${formatarData(e.concluidaEm)}`, sep: ' ' }
      : { estado: 'Concluída', data: '', sep: '' }
  }
  if (e.status === STATUS.andamento) {
    // espaço inseparável entre o número e o "%": o percentual nunca quebra sozinho para a linha seguinte
    const estado = Number.isFinite(e.percentual) ? `Em andamento · ${e.percentual} %` : 'Em andamento'
    return { estado, data: fimPublico ? `até ${fimPublico}` : '', sep: ' · ' }
  }
  if (fimPublico) return { estado: 'Programada', data: `até ${fimPublico}`, sep: ' · ' }
  if (inicioPublico) return { estado: 'Programada', data: `a partir de ${inicioPublico}`, sep: ' · ' }
  return { estado: 'Programada', data: '', sep: '' }
}

/** Rótulo afirmativo da etapa numa linha. */
export function rotuloDaEtapa(e: Parameters<typeof partesDoRotulo>[0]): string {
  const p = partesDoRotulo(e)
  return p.data ? `${p.estado}${p.sep}${p.data}` : p.estado
}

/** Status e percentual de uma etapa só pelas datas. */
function porData(hoje: number, ini: number, fim: number): { status: Status; percentual: number } {
  // data ausente ou impossível: nada a calcular (programada, 0 %), nunca NaN
  if (![hoje, ini, fim].every(Number.isFinite)) return { status: STATUS.programada, percentual: 0 }
  if (hoje < ini) return { status: STATUS.programada, percentual: 0 }
  if (hoje >= fim) return { status: STATUS.concluida, percentual: 100 }
  return {
    status: STATUS.andamento,
    percentual: limitar(Math.round(((hoje - ini) / (fim - ini)) * 100), 1, 99),
  }
}

/**
 * Calcula o cronograma do dia.
 * @param andamento conteúdo (saneado) de public/horizon/andamento.json
 * @param hoje 'aaaa-mm-dd' ou Date (data local)
 */
export function calcular(andamento: AndamentoCalculavel | null | undefined, hoje: string | Date = new Date()): Cronograma {
  const isoHoje = hoje instanceof Date ? isoLocal(hoje) : String(hoje)
  const dHoje = diaDe(isoHoje)
  const ajustes = (andamento && ehObjeto(andamento.ajustes) ? andamento.ajustes : {}) as Record<string, unknown>
  const lista = andamento && Array.isArray(andamento.etapas) ? andamento.etapas : []

  // sequência: uma etapa só fica em andamento ou concluída depois que a anterior concluiu
  let anteriorConcluida = true
  const etapas: Etapa[] = lista.map((e) => {
    const aj = ajusteValido(ajustes[e.id])
    // datas efetivas: ajustes.inicio/fim remarcam a etapa; realizadoEm fecha a etapa nessa data (é o fim efetivo)
    const inicio = aj.inicio || e.inicio
    const fimRemarcado = aj.fim || e.fim
    const fimEfetivo = aj.realizadoEm || fimRemarcado
    const ini = diaDe(inicio)
    const fim = diaDe(fimEfetivo)
    let { status, percentual } = porData(dHoje, ini, Number.isFinite(fim) ? Math.max(ini, fim) : fim)

    if (definido(aj.percentual)) {
      percentual = aj.percentual
      // sem status explícito, o percentual informado define o status
      if (!definido(aj.status)) {
        status = percentual >= 100 ? STATUS.concluida : percentual <= 0 ? STATUS.programada : STATUS.andamento
      }
    }
    if (definido(aj.status)) {
      status = aj.status
      if (!definido(aj.percentual)) {
        if (status === STATUS.concluida) percentual = 100
        else if (status === STATUS.programada) percentual = 0
        else percentual = limitar(percentual, 1, 99)
      }
    }
    if (!anteriorConcluida) status = STATUS.programada
    if (status === STATUS.andamento) percentual = limitar(percentual, 1, 99)
    if (status === STATUS.concluida) percentual = 100
    if (status === STATUS.programada) percentual = 0
    anteriorConcluida = status === STATUS.concluida

    const publicas = datasPublicasDe(e)
    const saida: Etapa = {
      id: e.id,
      nome: e.nome,
      inicio,
      fim: fimEfetivo,
      status,
      percentual,
      publicas,
      rotulos: rotulosDe(e),
      // data fixa: a informada em realizadoEm, senão o fim da etapa se for público — nunca a data de hoje
      concluidaEm:
        status === STATUS.concluida ? aj.realizadoEm || (publicas.includes('fim') ? fimEfetivo : null) : null,
      mensagem: definido(aj.mensagem) ? aj.mensagem : null,
      local: e.local || null,
      passosForcados: aj.passos || {},
      duracao: Number.isFinite(fim - ini) ? Math.max(0, fim - ini) : 0,
      ativa: false,
      rotulo: '',
    }
    saida.rotulo = rotuloDaEtapa(saida)
    return saida
  })

  // etapa atual: a (última) em andamento; sem nenhuma, a última concluída; sem nenhuma concluída, a primeira
  let atual: Etapa | null = null
  for (const e of etapas) if (e.status === STATUS.andamento) atual = e
  if (!atual) for (const e of etapas) if (e.status === STATUS.concluida) atual = e
  if (!atual) atual = etapas[0] || null
  if (atual) atual.ativa = true

  const peso = etapas.reduce((s, e) => s + e.duracao, 0)
  const percentualGeral = etapas.length
    ? Math.round(
        peso > 0
          ? etapas.reduce((s, e) => s + e.percentual * e.duracao, 0) / peso
          : etapas.reduce((s, e) => s + e.percentual, 0) / etapas.length,
      )
    : 0

  return { hoje: isoHoje, etapas, etapaAtual: atual, percentualGeral }
}

/** Passo de uma etapa (checklist), com a faixa do percentual da etapa em que ele está em andamento. */
export interface Passo {
  id: string
  nome: string
  /** [a, b] em % da etapa: programado antes de a, em andamento de a até b, concluído a partir de b. */
  faixa: [number, number]
  /** Concordância do particípio ("concluíd" + fim): 'o' | 'a' | 'os' | 'as'. */
  fim: 'o' | 'a' | 'os' | 'as'
  /** Grupo do modelo 3D que entra em cena com este passo (quando há). */
  grupo?: string
}

/**
 * Estado de um passo pelo estado e percentual da etapa: concluído a partir do fim da faixa, em andamento dentro
 * dela, programado antes. A etapa concluída conclui todos; a programada deixa todos programados.
 * `ajustes[etapa].passos[idDoPasso]` prevalece (controle manual da produção) — exceto quando a etapa está programada.
 */
export function estadoDoPasso(e: Pick<Etapa, 'status' | 'percentual' | 'passosForcados'> | null | undefined, p: Passo): Status {
  if (!e || e.status === STATUS.programada) return STATUS.programada
  if (e.status === STATUS.concluida) return STATUS.concluida
  const forcado = e.passosForcados?.[p.id]
  if (forcado) return forcado
  const [a, b] = p.faixa
  if (e.percentual >= b) return STATUS.concluida
  return e.percentual >= a ? STATUS.andamento : STATUS.programada
}

/**
 * Fração (0..1) de chegada do passo: 0 = programado, 1 = concluído, entre eles a posição dentro da faixa.
 * O 3D usa para trazer o grupo do passo do fantasma ao lugar.
 */
export function fracaoDoPasso(e: Pick<Etapa, 'status' | 'percentual' | 'passosForcados'> | null | undefined, p: Passo): number {
  const estado = estadoDoPasso(e, p)
  if (estado === STATUS.programada) return 0
  if (estado === STATUS.concluida) return 1
  const [a, b] = p.faixa
  return limitar((e!.percentual - a) / Math.max(1, b - a), 0.02, 0.98)
}

/** Texto do estado do passo para leitor de tela e impressão ("concluída", "em andamento", "programada"). */
export function textoDoPasso(estado: Status, p: Passo): string {
  if (estado === STATUS.concluida) return `concluíd${p.fim}`
  if (estado === STATUS.andamento) return 'em andamento'
  return `programad${p.fim}`
}

/** Itens com data até hoje (fotos, atualizações): um registro com data futura só aparece a partir dela. */
export const ateHoje = <T extends { data?: string }>(lista: T[] | null | undefined, hoje: string): T[] =>
  (Array.isArray(lista) ? lista : []).filter((x) => !(diaDe(x?.data) > diaDe(hoje)))

/**
 * Confere a coerência do andamento (uso nos testes e no console de desenvolvimento).
 * Devolve a lista de problemas (vazia = válido).
 */
export function validar(andamento: unknown, idsEsperados: string[] | null = null): string[] {
  const p: string[] = []
  if (!ehObjeto(andamento)) return ['andamento ausente']
  const ets = andamento.etapas
  if (!Array.isArray(ets) || !ets.length) p.push('etapas ausentes')
  const lista = (Array.isArray(ets) ? ets : []) as EtapaBruta[]
  if (idsEsperados && lista.map((e) => e?.id).join() !== idsEsperados.join()) {
    p.push(`etapas: as ${idsEsperados.length}, nesta ordem: ${idsEsperados.join(', ')}`)
  }
  const ids = new Set<string>()
  let anterior = -Infinity
  for (const e of lista) {
    if (!e?.id || ids.has(e.id)) p.push(`etapa com id repetido ou vazio: ${e?.id}`)
    ids.add(e?.id)
    if (!e?.nome) p.push(`etapa ${e?.id} sem nome`)
    if (!isoValida(e?.inicio) || !isoValida(e?.fim)) {
      p.push(`etapa ${e?.id} com data fora do formato aaaa-mm-dd`)
      continue
    }
    if (diaDe(e.fim) < diaDe(e.inicio)) p.push(`etapa ${e.id}: fim antes do início`)
    if (diaDe(e.inicio) < anterior) p.push(`etapa ${e.id}: início antes do início da etapa anterior`)
    anterior = diaDe(e.inicio)
    const dp = e.datasPublicas
    if (dp !== undefined && (!Array.isArray(dp) || dp.some((k) => !CAMPOS_DE_DATA.includes(k)))) {
      p.push(`etapa ${e.id}: datasPublicas fora de ["inicio", "fim"]`)
    }
  }
  const proj = ehObjeto(andamento.projeto) ? andamento.projeto : {}
  if (!isoValida(proj.confirmadoEm)) p.push('projeto.confirmadoEm fora do formato')
  if (!isoValida(proj.entregaLimite)) p.push('projeto.entregaLimite fora do formato')
  if (!isoValida(andamento.atualizadoEm)) p.push('atualizadoEm fora do formato')
  if (ehObjeto(andamento.ajustes)) {
    for (const [id, a] of Object.entries(andamento.ajustes)) {
      if (!ids.has(id)) p.push(`ajuste para etapa inexistente: ${id}`)
      if (!ehObjeto(a)) continue
      if (definido(a.status) && !ehStatus(a.status)) p.push(`ajuste ${id}: status desconhecido`)
      if (definido(a.percentual) && !(Number(a.percentual) >= 0 && Number(a.percentual) <= 100)) {
        p.push(`ajuste ${id}: percentual fora de 0..100`)
      }
      for (const k of ['realizadoEm', 'inicio', 'fim'] as const) {
        if (definido(a[k]) && !isoValida(a[k])) p.push(`ajuste ${id}: ${k} fora do formato`)
      }
      const fecha = a.status === STATUS.concluida || Number(a.percentual) === 100
      if (fecha && !isoValida(a.realizadoEm)) {
        p.push(`ajuste ${id}: etapa concluída sem realizadoEm (a página mostra o fim da etapa)`)
      }
    }
  }
  for (const f of (Array.isArray(andamento.fotos) ? andamento.fotos : []) as Array<Record<string, unknown>>) {
    if (!f?.arquivo || !isoValida(f?.data) || !ids.has(String(f?.etapa))) p.push(`foto com campos inválidos: ${f?.arquivo}`)
  }
  for (const a of (Array.isArray(andamento.atualizacoes) ? andamento.atualizacoes : []) as Array<Record<string, unknown>>) {
    if (!isoValida(a?.data) || !ids.has(String(a?.etapa)) || !a?.texto) p.push(`atualização com campos inválidos: ${a?.data}`)
  }
  return p
}
