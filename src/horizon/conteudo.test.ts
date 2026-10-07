/// <reference types="node" />
// Regras de conteúdo do controle de produção: tom afirmativo (TERMOS_RESERVADOS), estrutura fixa dos capítulos,
// passos e grupos do 3D, e coerência do andamento.json público com os arquivos em public/.
import { describe, expect, test } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CAPITULOS,
  ETAPAS_DA_PRODUCAO,
  GRUPOS,
  GRUPOS_COMPRADOS,
  GRUPOS_FABRICADOS,
  GRUPOS_INOX,
  GRUPOS_MONTAGEM,
  GRUPOS_PINTADOS,
  GRUPO_IDS,
  NOMES_CURTOS,
  PASSOS,
  TERMOS_RESERVADOS,
  TOTAL,
  capituloDaEtapa,
  ehCapituloId,
  ehEtapaId,
  lerHash,
  porId,
  rotuloDoGrupo,
  type EtapaId,
} from './capitulos'
import { PROJETO } from './dados'
import { ROTULOS_PADRAO, STATUS, calcular, diaDe, isoDe, textoDoPasso, type Status } from './cronograma'
import { validarAndamento } from './andamento'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CAMINHO_JSON = join(RAIZ, 'public', 'horizon', 'andamento.json')
const TEXTO_JSON = readFileSync(CAMINHO_JSON, 'utf8')
const ANDAMENTO = JSON.parse(TEXTO_JSON) as {
  atualizadoEm: string
  projeto: Record<string, unknown>
  etapas: Array<{ id: string; nome: string; inicio: string; fim: string; local?: string; rotulos?: Record<string, string> }>
  ajustes: Record<string, { mensagem?: unknown } | undefined>
  fotos: Array<{ arquivo: string; data: string; etapa: string; legenda?: string }>
  atualizacoes: Array<{ data: string; etapa: string; texto: string }>
}

/** Sem acento, em minúsculas: comparação de termos independente de caixa e acentuação. */
const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
const TERMOS = TERMOS_RESERVADOS.map(normalizar)

/** O termo reservado presente no texto, ou null. */
function termoReservadoEm(texto: string): string | null {
  const n = normalizar(texto)
  return TERMOS.find((t) => n.includes(t)) ?? null
}

/** Todos os textos (strings) de um valor, em profundidade. */
function textosDe(v: unknown, saida: string[] = []): string[] {
  if (typeof v === 'string') saida.push(v)
  else if (Array.isArray(v)) v.forEach((x) => textosDe(x, saida))
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => textosDe(x, saida))
  return saida
}

const semReservados = (textos: string[], onde: string) => {
  for (const t of textos) expect(termoReservadoEm(t), `${onde}: "${t}"`).toBeNull()
}

const inicioDoPlano = ANDAMENTO.etapas[0].inicio
const fimDoPlano = ANDAMENTO.etapas[ANDAMENTO.etapas.length - 1].fim
/** 6 datas ao longo do plano: antes, no início, em dois pontos do meio, no fim e depois. */
const DATAS = [
  isoDe(diaDe(inicioDoPlano) - 10),
  inicioDoPlano,
  isoDe(Math.floor((2 * diaDe(inicioDoPlano) + diaDe(fimDoPlano)) / 3)),
  isoDe(Math.floor((diaDe(inicioDoPlano) + 2 * diaDe(fimDoPlano)) / 3)),
  fimDoPlano,
  isoDe(diaDe(fimDoPlano) + 10),
]

// ------------------------------------------------------------------ tom afirmativo
describe('tom afirmativo: nenhum termo reservado', () => {
  test('a lista de termos reservados existe e a comparação ignora acento e caixa', () => {
    expect(TERMOS_RESERVADOS.length).toBeGreaterThanOrEqual(7)
    expect(termoReservadoEm('Entrega PREVISTA para março')).toBe('previs')
    expect(termoReservadoEm('Data a Confirmar')).toBe('a confirmar')
    expect(termoReservadoEm('Imagem ilustrativa')).toBe('ilustrativ')
    expect(termoReservadoEm('Aproximadamente 20 dias')).toBe('aproximad')
    expect(termoReservadoEm('Prazo estimado')).toBe('estimad')
    expect(termoReservadoEm('INDISPONIVEL')).toBe('indisponivel')
    expect(termoReservadoEm('Sem representacao no modelo')).toBe('sem representacao')
    expect(termoReservadoEm('Talvez amanhã')).toBe('talvez')
    expect(termoReservadoEm('Concluída em 10/02/2027')).toBeNull()
    expect(termoReservadoEm('Programada · até 10/02/2027')).toBeNull()
  })

  test('textos dos capítulos (nome, título, título em andamento, apoio)', () => {
    for (const c of CAPITULOS) {
      semReservados([c.nome, c.titulo, c.apoio, c.tituloEmAndamento ?? ''], `capítulo ${c.id}`)
      expect(c.nome.trim().length, `${c.id}: nome`).toBeGreaterThan(0)
      expect(c.titulo.trim().length, `${c.id}: título`).toBeGreaterThan(0)
      expect(c.apoio.trim().length, `${c.id}: apoio`).toBeGreaterThan(0)
    }
  })

  test('nomes curtos, rótulos dos grupos, nomes dos passos e rótulos padrão de datas', () => {
    semReservados(Object.values(NOMES_CURTOS), 'NOMES_CURTOS')
    semReservados(GRUPOS.map((g) => g.rotulo), 'GRUPOS.rotulo')
    semReservados(Object.values(PASSOS).flat().map((p) => p.nome), 'PASSOS.nome')
    semReservados(Object.values(ROTULOS_PADRAO), 'ROTULOS_PADRAO')
    const passo = { id: 'p', nome: 'P', faixa: [0, 100] as [number, number], fim: 'a' as const }
    semReservados(Object.values(STATUS).map((s) => textoDoPasso(s, passo)), 'textoDoPasso')
  })

  test('PROJETO (dados.ts): equipamento, fornecedor, texto sem dados', () => {
    semReservados(textosDe(PROJETO), 'PROJETO')
    expect(PROJETO.equipamento).toBe('Dosador Horizon')
    expect(PROJETO.fornecedor.nome.length).toBeGreaterThan(0)
    expect(PROJETO.semDados.length).toBeGreaterThan(0)
  })

  test('JSON público: nomes, rótulos, local, mensagens de ajustes, atualizações e legendas', () => {
    semReservados(textosDe(ANDAMENTO.projeto), 'projeto')
    for (const e of ANDAMENTO.etapas) semReservados([e.nome, e.local ?? '', ...Object.values(e.rotulos ?? {})], `etapa ${e.id}`)
    for (const [id, a] of Object.entries(ANDAMENTO.ajustes)) semReservados(textosDe(a?.mensagem), `ajuste ${id}`)
    semReservados(ANDAMENTO.atualizacoes.map((a) => a.texto), 'atualizações')
    semReservados(ANDAMENTO.fotos.map((f) => f.legenda ?? ''), 'fotos')
    // e no arquivo inteiro (inclui chaves e qualquer campo novo)
    expect(termoReservadoEm(TEXTO_JSON), 'andamento.json').toBeNull()
  })

  test('sem preços nem moedas no JSON nem nos textos fixos', () => {
    const valores = /R\$|US\$|USD|BRL|EUR|€|pre[çc]o|or[çc]amento|desconto|fatura|boleto/i
    for (const t of [TEXTO_JSON, ...textosDe(CAPITULOS), ...textosDe(PASSOS), ...textosDe(GRUPOS), ...textosDe(NOMES_CURTOS), ...textosDe(PROJETO.fornecedor)]) {
      expect(valores.test(t), t).toBe(false)
    }
  })

  test('rótulos gerados em 6 datas ao longo do plano, com e sem ajustes', () => {
    const { andamento } = validarAndamento(ANDAMENTO)
    expect(andamento).not.toBeNull()
    const variantes = [
      andamento!,
      { ...andamento!, ajustes: { fabricacao: { status: STATUS.andamento, percentual: 95, mensagem: 'Caldeiraria em curso.' } } },
      { ...andamento!, ajustes: { engenharia: { realizadoEm: '2026-10-14' }, suprimentos: { inicio: '2026-10-14' } } },
    ]
    for (const v of variantes) {
      for (const hoje of DATAS) {
        const c = calcular(v, hoje)
        for (const e of c.etapas) {
          semReservados([e.rotulo, e.mensagem ?? '', e.nome], `${hoje} ${e.id}`)
          expect(/^(Concluída( em \d\d\/\d\d\/\d{4})?|Em andamento · \d+ %( · até \d\d\/\d\d\/\d{4})?|Programada( · (até|a partir de) \d\d\/\d\d\/\d{4})?)$/.test(e.rotulo), `${hoje} ${e.id}: ${e.rotulo}`).toBe(true)
          expect(/\d{4}-\d{2}-\d{2}/.test(e.rotulo), `${hoje} ${e.id}: data ISO no rótulo`).toBe(false)
          const capitulo = capituloDaEtapa(e.id)
          expect(capitulo, `${e.id} tem capítulo`).not.toBeNull()
          const titulo = e.status === STATUS.andamento ? (capitulo!.tituloEmAndamento ?? capitulo!.titulo) : capitulo!.titulo
          semReservados([titulo], `${hoje} ${e.id} título`)
        }
      }
    }
  })
})

// ------------------------------------------------------------------ estrutura fixa
describe('estrutura: etapas, passos e grupos', () => {
  test('ETAPAS_DA_PRODUCAO: 8 ids únicos; ehEtapaId', () => {
    expect(ETAPAS_DA_PRODUCAO).toEqual(['pedido', 'engenharia', 'suprimentos', 'fabricacao', 'pintura', 'montagem', 'testes', 'expedicao'])
    expect(new Set(ETAPAS_DA_PRODUCAO).size).toBe(8)
    expect(ehEtapaId('fabricacao')).toBe(true)
    expect(ehEtapaId('atualizacoes')).toBe(false)
    expect(ehEtapaId(null)).toBe(false)
  })

  test('PASSOS tem as 8 etapas; faixas 0 ≤ a < b ≤ 100, inícios não decrescentes, última termina em 100', () => {
    expect(Object.keys(PASSOS).sort()).toEqual([...ETAPAS_DA_PRODUCAO].sort())
    for (const id of ETAPAS_DA_PRODUCAO) {
      const passos = PASSOS[id]
      if (id === 'pedido') {
        expect(passos).toEqual([])
        continue
      }
      expect(passos.length, id).toBeGreaterThan(0)
      let anterior = -1
      for (const p of passos) {
        const [a, b] = p.faixa
        expect(a, `${id}/${p.id}: a ≥ 0`).toBeGreaterThanOrEqual(0)
        expect(a, `${id}/${p.id}: a < b`).toBeLessThan(b)
        expect(b, `${id}/${p.id}: b ≤ 100`).toBeLessThanOrEqual(100)
        expect(a, `${id}/${p.id}: faixas em ordem`).toBeGreaterThanOrEqual(anterior)
        anterior = a
        expect(['o', 'a', 'os', 'as'], `${id}/${p.id}: fim`).toContain(p.fim)
        expect(p.nome.trim().length, `${id}/${p.id}: nome`).toBeGreaterThan(0)
      }
      expect(passos[0].faixa[0], `${id}: o primeiro passo começa em 0`).toBe(0)
      expect(passos[passos.length - 1].faixa[1], `${id}: o último passo termina em 100`).toBe(100)
      expect(new Set(passos.map((p) => p.id)).size, `${id}: ids de passos únicos`).toBe(passos.length)
      // faixas cobrem a etapa inteira: em todo percentual 0..99 pelo menos um passo está em andamento
      for (let pct = 0; pct < 100; pct += 1) {
        expect(passos.some((p) => pct >= p.faixa[0] && pct < p.faixa[1]), `${id}: ${pct} % sem passo em andamento`).toBe(true)
      }
    }
  })

  test('grupos: ids únicos, todo passo.grupo existe, listas de grupos coerentes com os passos', () => {
    expect(new Set(GRUPO_IDS).size).toBe(GRUPOS.length)
    expect(GRUPOS.length).toBe(9)
    for (const g of GRUPOS) {
      expect(['fabricado', 'comprado']).toContain(g.origem)
      expect(rotuloDoGrupo(g.id)).toBe(g.rotulo)
    }
    const grupos = Object.values(PASSOS).flat().flatMap((p) => (p.grupo ? [p.grupo] : []))
    for (const g of grupos) expect(GRUPO_IDS, `grupo ${g} nos passos`).toContain(g)
    const gruposDe = (id: EtapaId) => PASSOS[id].flatMap((p) => (p.grupo ? [p.grupo] : []))
    for (const g of GRUPOS_FABRICADOS) expect(gruposDe('fabricacao'), `fabricado ${g}`).toContain(g)
    for (const g of GRUPOS_MONTAGEM) expect(gruposDe('montagem'), `montagem ${g}`).toContain(g)
    for (const g of GRUPOS_COMPRADOS) expect(gruposDe('suprimentos'), `comprado ${g}`).toContain(g)
    for (const lista of [GRUPOS_FABRICADOS, GRUPOS_COMPRADOS, GRUPOS_MONTAGEM, GRUPOS_PINTADOS, GRUPOS_INOX]) {
      for (const g of lista) expect(GRUPO_IDS).toContain(g)
      expect(new Set(lista).size).toBe(lista.length)
    }
    // origem declarada no grupo bate com as listas
    expect(GRUPOS.filter((g) => g.origem === 'comprado').map((g) => g.id).sort()).toEqual([...GRUPOS_COMPRADOS].sort())
    for (const g of GRUPOS_FABRICADOS) expect(GRUPOS.find((x) => x.id === g)?.origem, g).toBe('fabricado')
    // pintados e inox não se misturam
    expect(GRUPOS_PINTADOS.filter((g) => GRUPOS_INOX.includes(g))).toEqual([])
    // todo grupo do 3D entra em cena em alguma etapa (fabricação, suprimentos ou montagem)
    for (const g of GRUPO_IDS) expect(grupos, `grupo ${g} ligado a algum passo`).toContain(g)
  })

  test('CAPITULOS: 9, numerados 01..09, um só em papel, etapas na ordem', () => {
    expect(CAPITULOS).toHaveLength(9)
    expect(TOTAL).toBe(9)
    expect(CAPITULOS.map((c) => c.numero)).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09'])
    expect(CAPITULOS.map((c) => c.indice)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    const papel = CAPITULOS.filter((c) => c.papel)
    expect(papel).toHaveLength(1)
    expect(papel[0].id).toBe('atualizacoes')
    expect(papel[0].etapa).toBeNull()
    expect(CAPITULOS.filter((c) => c.etapa === null)).toEqual(papel)
    expect(CAPITULOS.filter((c) => c.etapa).map((c) => c.etapa)).toEqual([...ETAPAS_DA_PRODUCAO])
    expect(CAPITULOS.filter((c) => c.etapa).map((c) => c.id)).toEqual([...ETAPAS_DA_PRODUCAO])
    expect(new Set(CAPITULOS.map((c) => c.id)).size).toBe(9)
    for (const c of CAPITULOS) {
      expect(c.icone.length, c.id).toBeGreaterThan(0)
      expect(c.modelo.length, c.id).toBeGreaterThan(0)
      if (c.etapa) expect(capituloDaEtapa(c.etapa)).toBe(c)
      expect(porId(c.id)).toBe(c)
      expect(ehCapituloId(c.id)).toBe(true)
    }
    expect(porId('x')).toBeNull()
    expect(capituloDaEtapa('atualizacoes')).toBeNull()
    expect(ehCapituloId('x')).toBe(false)
  })

  test('lerHash', () => {
    expect(lerHash('#fabricacao')?.id).toBe('fabricacao')
    expect(lerHash('fabricacao')?.id).toBe('fabricacao')
    expect(lerHash('#fabricacao?x=1')?.id).toBe('fabricacao')
    expect(lerHash('#atualizacoes')?.id).toBe('atualizacoes')
    expect(lerHash('#x')).toBeNull()
    expect(lerHash('#')).toBeNull()
    expect(lerHash('')).toBeNull()
    expect(lerHash('#%E2%82')).toBeNull() // percent-encoding quebrado não lança
    expect(lerHash('#Fabricacao')).toBeNull() // ids em minúsculas
  })
})

// ------------------------------------------------------------------ JSON público × arquivos
describe('andamento.json e os arquivos publicados', () => {
  test('fotos citadas existem em public/', () => {
    expect(Array.isArray(ANDAMENTO.fotos)).toBe(true)
    for (const f of ANDAMENTO.fotos) {
      expect(existsSync(join(RAIZ, 'public', f.arquivo)), `foto ausente: ${f.arquivo}`).toBe(true)
      expect(ehEtapaId(f.etapa), `foto ${f.arquivo}: etapa`).toBe(true)
    }
  })

  test('atualizações apontam para etapas existentes e têm texto', () => {
    expect(ANDAMENTO.atualizacoes.length).toBeGreaterThan(0)
    for (const a of ANDAMENTO.atualizacoes) {
      expect(ehEtapaId(a.etapa), `atualização ${a.data}: etapa ${a.etapa}`).toBe(true)
      expect(a.texto.trim().length).toBeGreaterThan(0)
    }
  })

  test("'cliente' e 'ordem' podem ser vazios sem invalidar o arquivo", () => {
    expect(typeof ANDAMENTO.projeto.cliente).toBe('string')
    expect(typeof ANDAMENTO.projeto.ordem).toBe('string')
    const v = validarAndamento(ANDAMENTO)
    expect(v.valido).toBe(true)
    const vazio = validarAndamento({ ...ANDAMENTO, projeto: { ...ANDAMENTO.projeto, cliente: '', ordem: '' } })
    expect(vazio.valido).toBe(true)
    expect(vazio.andamento?.projeto.cliente).toBeUndefined()
    expect(vazio.andamento?.projeto.ordem).toBeUndefined()
  })

  test('logo oficial e JSON estão em public/', () => {
    expect(existsSync(join(RAIZ, 'public', 'selo-30-anos.png'))).toBe(true)
    expect(existsSync(CAMINHO_JSON)).toBe(true)
  })

  test('nomes das etapas do JSON concordam com os nomes curtos dos capítulos', () => {
    for (const e of ANDAMENTO.etapas) {
      const curto = NOMES_CURTOS[e.id as EtapaId]
      expect(curto, e.id).toBeDefined()
      expect(normalizar(e.nome).includes(normalizar(curto).slice(0, 5)), `${e.id}: "${e.nome}" × "${curto}"`).toBe(true)
    }
  })

  test('estados possíveis são só os três do vocabulário', () => {
    const estados: Status[] = Object.values(STATUS)
    expect(estados.sort()).toEqual(['concluida', 'em-andamento', 'programada'])
  })
})
