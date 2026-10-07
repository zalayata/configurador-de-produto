// Leitura do andamento da produção: public/horizon/andamento.json, em tempo de execução.
// Trocar o arquivo muda a página sem novo build: toda requisição confere com o servidor (cache: 'no-cache').
// O pedido sai já na leitura do HTML (script no <head> de horizon.html → window.__andamentoInicial) e a primeira
// tentativa reaproveita essa resposta. A requisição em curso nunca é abortada por tempo curto: nova tentativa só
// depois de erro de rede, HTTP ≥ 500 ou LIMITE_DA_TENTATIVA sem resposta. Quem chama lerAndamento() espera no
// máximo LIMITE_DA_LEITURA e segue sem dados; o resultado de quem chega depois sai por aoChegarAndamento().
// Só passa adiante um andamento aprovado por validarAndamento(). (Herdado do acompanhamento Koene.)
import { ETAPAS_DA_PRODUCAO, ehEtapaId, type EtapaId } from './capitulos'
import { CAMINHO_ANDAMENTO } from './dados'
import { ajusteValido, isoLocal, isoValida, type Ajuste, type CampoDeData, type EtapaBruta } from './cronograma'

/** Espera máxima de quem chama lerAndamento() antes de seguir sem dados (ms): a página nunca trava pelo JSON. */
export const LIMITE_DA_LEITURA = 6000
/** Tempo sem resposta até uma nova tentativa em paralelo (ms); a requisição em curso segue e vale a que chegar antes. */
export const LIMITE_DA_TENTATIVA = 20000
// esperas antes de repetir depois de erro de rede ou HTTP ≥ 500 (~1,5 min no total)
const ESPERAS = [400, 1200, 3000, 6000, 12000, 20000, 30000]

export interface Projeto {
  /** Nome do equipamento como aparece na página (padrão: PROJETO.equipamento). */
  equipamento?: string
  /** Modelo/variante (opcional). */
  modelo?: string
  /** Número da ordem de produção ou do pedido (opcional). */
  ordem?: string
  /** Número da proposta (opcional). */
  proposta?: string
  quantidade?: number
  /** Cliente e cidade (opcionais: sem eles a página não cita cliente). */
  cliente?: string
  cidade?: string
  confirmadoEm: string
  /** Data-limite de entrega (igual ao fim da última etapa, por regra). */
  entregaLimite: string
}

export interface Foto {
  arquivo: string
  data: string
  etapa: EtapaId
  legenda?: string
}

export interface Atualizacao {
  data: string
  etapa: EtapaId
  texto: string
}

export interface EtapaDoJson extends EtapaBruta {
  id: EtapaId
}

/** Andamento validado e saneado (o que a página usa). */
export interface Andamento {
  atualizadoEm: string
  projeto: Projeto
  etapas: EtapaDoJson[]
  ajustes: Partial<Record<EtapaId, Ajuste>>
  fotos: Foto[]
  atualizacoes: Atualizacao[]
}

const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const textoOpcional = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

export interface ResultadoDaValidacao {
  valido: boolean
  problemas: string[]
  andamento: Andamento | null
}

/**
 * Validação única do andamento.json (função pura). Inválido — mesmo caminho do arquivo ausente: texto de contato
 * na página e linha do tempo oculta — quando falta `projeto`, as 8 etapas com os ids esperados (na ordem), ou
 * quando qualquer data (fora de `ajustes`) não é 'aaaa-mm-dd' real. Em `ajustes` cada campo fora da regra é
 * ignorado (ajusteValido). Fotos e atualizações incompletas saem da lista; o resto do arquivo vale.
 */
export function validarAndamento(dados: unknown): ResultadoDaValidacao {
  const p: string[] = []
  if (!ehObjeto(dados)) return { valido: false, problemas: ['andamento ausente'], andamento: null }
  const { projeto, etapas } = dados
  const data = (v: unknown, onde: string) => {
    if (!isoValida(v)) p.push(`${onde}: data fora de aaaa-mm-dd`)
  }
  if (!ehObjeto(projeto)) p.push('projeto ausente')
  else {
    data(projeto.confirmadoEm, 'projeto.confirmadoEm')
    data(projeto.entregaLimite, 'projeto.entregaLimite')
  }
  data(dados.atualizadoEm, 'atualizadoEm')
  const ids = ETAPAS_DA_PRODUCAO.join()
  if (!Array.isArray(etapas) || etapas.map((e) => (ehObjeto(e) ? e.id : '')).join() !== ids) {
    p.push(`etapas: as ${ETAPAS_DA_PRODUCAO.length}, nesta ordem: ${ETAPAS_DA_PRODUCAO.join(', ')}`)
  } else {
    for (const e of etapas as Array<Record<string, unknown>>) {
      if (typeof e.nome !== 'string' || !e.nome.trim()) p.push(`etapa ${e.id} sem nome`)
      data(e.inicio, `etapa ${e.id}.inicio`)
      data(e.fim, `etapa ${e.id}.fim`)
      const dp = e.datasPublicas
      if (dp !== undefined && (!Array.isArray(dp) || dp.some((k) => k !== 'inicio' && k !== 'fim'))) {
        p.push(`etapa ${e.id}: datasPublicas fora de ["inicio", "fim"]`)
      }
      if (e.rotulos !== undefined && !ehObjeto(e.rotulos)) p.push(`etapa ${e.id}: rotulos fora de objeto`)
    }
  }
  for (const [chave, campo] of [
    ['fotos', 'arquivo'],
    ['atualizacoes', 'texto'],
  ] as const) {
    if (dados[chave] === undefined) continue
    if (!Array.isArray(dados[chave])) {
      p.push(`${chave} fora de lista`)
      continue
    }
    for (const f of dados[chave] as unknown[]) {
      if (!ehObjeto(f)) {
        p.push(`${chave}: item vazio`)
        continue
      }
      data(f.data, `${chave} ${String(f[campo] ?? '')}`.trim())
    }
  }
  if (p.length) return { valido: false, problemas: p, andamento: null }

  // cópia saneada
  const proj = projeto as Record<string, unknown>
  const ajustes: Partial<Record<EtapaId, Ajuste>> = {}
  if (ehObjeto(dados.ajustes)) {
    for (const id of ETAPAS_DA_PRODUCAO) {
      const a = ajusteValido(dados.ajustes[id])
      if (Object.keys(a).length) ajustes[id] = a
    }
  }
  const quantidade = Number(proj.quantidade)
  const andamento: Andamento = {
    atualizadoEm: String(dados.atualizadoEm),
    ajustes,
    projeto: {
      equipamento: textoOpcional(proj.equipamento),
      modelo: textoOpcional(proj.modelo),
      ordem: textoOpcional(proj.ordem),
      proposta: textoOpcional(proj.proposta),
      quantidade: Number.isInteger(quantidade) && quantidade > 0 ? quantidade : undefined,
      cliente: textoOpcional(proj.cliente),
      cidade: textoOpcional(proj.cidade),
      confirmadoEm: String(proj.confirmadoEm),
      entregaLimite: String(proj.entregaLimite),
    },
    etapas: (etapas as Array<Record<string, unknown>>).map((e) => {
      const saida: EtapaDoJson = {
        id: e.id as EtapaId,
        nome: String(e.nome).trim(),
        inicio: String(e.inicio),
        fim: String(e.fim),
      }
      if (textoOpcional(e.local)) saida.local = textoOpcional(e.local)
      if (ehObjeto(e.rotulos)) {
        const r: Partial<Record<CampoDeData, string>> = {}
        for (const k of ['inicio', 'fim'] as const) if (textoOpcional(e.rotulos[k])) r[k] = textoOpcional(e.rotulos[k])
        if (Object.keys(r).length) saida.rotulos = r
      }
      if (Array.isArray(e.datasPublicas)) saida.datasPublicas = e.datasPublicas as CampoDeData[]
      return saida
    }),
    fotos: ((dados.fotos as unknown[]) || [])
      .filter((f): f is Record<string, unknown> => ehObjeto(f) && typeof f.arquivo === 'string' && !!f.arquivo && ehEtapaId(f.etapa))
      .map((f) => ({
        arquivo: String(f.arquivo),
        data: String(f.data),
        etapa: f.etapa as EtapaId,
        legenda: textoOpcional(f.legenda),
      })),
    atualizacoes: ((dados.atualizacoes as unknown[]) || [])
      .filter((a): a is Record<string, unknown> => ehObjeto(a) && typeof a.texto === 'string' && !!a.texto.trim() && ehEtapaId(a.etapa))
      .map((a) => ({ data: String(a.data), etapa: a.etapa as EtapaId, texto: String(a.texto).trim() })),
  }
  return { valido: true, problemas: [], andamento }
}

const BASE: string = (import.meta.env && import.meta.env.BASE_URL) || './'
const EM_DEV: boolean = !!(import.meta.env && import.meta.env.DEV)

/** Endereço do JSON resolvido contra o documento (funciona em qualquer subpasta de hospedagem). */
export function enderecoDoAndamento(): string {
  return new URL(`${BASE}${CAMINHO_ANDAMENTO}`, document.baseURI).toString()
}

declare global {
  interface Window {
    __andamentoInicial?: { url: string; resposta: Promise<Response | null> } | null
  }
}

type Resultado = { dados: Andamento } | { fim: true } | { repetir: true }

let leitura: { rapida: Promise<Andamento | null>; final: Promise<Andamento | null> } | null = null

/** A resposta pedida pelo <head> (window.__andamentoInicial), uma vez só e só se for do mesmo endereço. */
function respostaInicial(url: string): Promise<Response | null> | null {
  const ini = typeof window !== 'undefined' ? window.__andamentoInicial : null
  if (!ini || ini.url !== url || !ini.resposta || typeof ini.resposta.then !== 'function') return null
  window.__andamentoInicial = null
  return ini.resposta
}

/** Uma tentativa (sem tempo-limite próprio). */
async function tentar(url: string, sinal: AbortSignal | undefined, pronta: Promise<Response | null> | null): Promise<Resultado> {
  try {
    const r = (pronta && (await pronta)) || (await fetch(url, { cache: 'no-cache', credentials: 'same-origin', signal: sinal }))
    if (r.status >= 500) return { repetir: true }
    if (!r.ok) return { fim: true }
    let bruto: unknown
    try {
      bruto = await r.json()
    } catch {
      return sinal && sinal.aborted ? { repetir: true } : { fim: true }
    }
    const v = validarAndamento(bruto)
    if (!v.valido && EM_DEV) console.info('[horizon] andamento.json fora da regra:', v.problemas)
    return v.valido && v.andamento ? { dados: v.andamento } : { fim: true }
  } catch {
    return { repetir: true }
  }
}

/** A leitura completa: o andamento validado ou null. Vale a primeira resposta que chegar. */
function lerAteChegar(url: string): Promise<Andamento | null> {
  return new Promise((entregar) => {
    const emCurso = new Set<AbortController>()
    let feitas = 0
    let abertas = 0
    let terminou = false
    const acabar = (v: Andamento | null) => {
      if (terminou) return
      terminou = true
      emCurso.forEach((c) => c.abort())
      emCurso.clear()
      entregar(v)
    }
    const repetir = (espera: number) => {
      if (terminou) return
      if (feitas > ESPERAS.length) {
        if (!abertas) acabar(null)
        return
      }
      setTimeout(disparar, espera)
    }
    function disparar() {
      if (terminou) return
      const espera = ESPERAS[Math.min(feitas, ESPERAS.length - 1)]
      const pronta = feitas === 0 ? respostaInicial(url) : null
      const ctrl = typeof AbortController === 'function' ? new AbortController() : null
      if (ctrl) emCurso.add(ctrl)
      feitas += 1
      abertas += 1
      let respondeu = false
      // sem resposta no limite longo: outra tentativa em paralelo, sem cancelar esta
      const longo = setTimeout(() => {
        if (!respondeu) repetir(0)
      }, LIMITE_DA_TENTATIVA)
      void tentar(url, ctrl ? ctrl.signal : undefined, pronta).then((r) => {
        respondeu = true
        clearTimeout(longo)
        if (ctrl) emCurso.delete(ctrl)
        abertas -= 1
        if ('dados' in r) acabar(r.dados)
        else if ('fim' in r) acabar(null)
        else if (!abertas) repetir(espera)
      })
    }
    disparar()
  })
}

/**
 * Lê o andamento. Devolve, em até LIMITE_DA_LEITURA, o andamento validado ou null (sem rede, arquivo ausente,
 * resposta depois do limite ou JSON fora da regra): quem chama segue sem ele, e a leitura continua
 * (aoChegarAndamento). A leitura é única por página; `{ novo: true }` força outra.
 */
export function lerAndamento({ novo = false } = {}): Promise<Andamento | null> {
  if (leitura && !novo) return leitura.rapida
  const final = lerAteChegar(enderecoDoAndamento())
  const rapida = Promise.race([final, new Promise<null>((ok) => setTimeout(() => ok(null), LIMITE_DA_LEITURA))])
  leitura = { rapida, final }
  return rapida
}

/** O andamento quando a leitura terminar, mesmo depois do limite (segundo plano). */
export function esperarAndamento(): Promise<Andamento | null> {
  if (!leitura) void lerAndamento()
  return leitura!.final
}

/**
 * Assinante "quando chegar": chama `fn(andamento)` uma vez, com o andamento validado, assim que a leitura
 * terminar. Arquivo ausente ou fora da regra: chama `semDados()`. Devolve a função que cancela.
 */
export function aoChegarAndamento(fn: (a: Andamento) => void, semDados?: () => void): () => void {
  let ativo = true
  esperarAndamento()
    .then((a) => {
      if (!ativo) return
      if (a) fn(a)
      else semDados?.()
    })
    .catch(() => {
      if (ativo) semDados?.()
    })
  return () => {
    ativo = false
  }
}

/**
 * Data de hoje da página ('aaaa-mm-dd'): a data local do navegador.
 * Em desenvolvimento aceita ?hoje=aaaa-mm-dd para simular outras datas.
 */
export function hojeDaPagina(): string {
  if (EM_DEV && typeof window !== 'undefined') {
    const q = new URLSearchParams(window.location.search).get('hoje')
    if (q && isoValida(q)) return q
  }
  return isoLocal(new Date())
}
