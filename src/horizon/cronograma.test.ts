/// <reference types="node" />
// Testes do cronograma (funções puras) e da entrada dos grupos do 3D (capitulos.ts), com o andamento.json público.
import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  STATUS,
  ajusteValido,
  ateHoje,
  calcular,
  dataPublica,
  datasPublicasDe,
  diaDe,
  estadoDoPasso,
  formatarData,
  formatarDataCurta,
  fracaoDoPasso,
  isoDe,
  isoLocal,
  isoValida,
  partesDoRotulo,
  rotuloDaEtapa,
  textoDoPasso,
  validar,
  type AndamentoCalculavel,
  type Cronograma,
  type Etapa,
  type EtapaBruta,
  type Passo,
  type Status,
} from './cronograma'
import { ETAPAS_DA_PRODUCAO, GRUPO_IDS, PASSOS, entradaDosGrupos, passosDaEtapa, type EtapaId } from './capitulos'

interface AndamentoJson extends AndamentoCalculavel {
  atualizadoEm: string
  projeto: { confirmadoEm: string; entregaLimite: string; [k: string]: unknown }
  etapas: EtapaBruta[]
  ajustes: Record<string, unknown>
  fotos: unknown[]
  atualizacoes: unknown[]
}

const CAMINHO_JSON = fileURLToPath(new URL('../../public/horizon/andamento.json', import.meta.url))
const ANDAMENTO = JSON.parse(readFileSync(CAMINHO_JSON, 'utf8')) as AndamentoJson
const IDS = [...ETAPAS_DA_PRODUCAO]

const NB = ' ' // espaço inseparável entre o percentual e o "%"
const copia = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const somar = (iso: string, dias: number) => isoDe(diaDe(iso) + dias)
const meio = (a: string, b: string) => isoDe(Math.floor((diaDe(a) + diaDe(b)) / 2))
const bruta = (id: string): EtapaBruta => {
  const e = ANDAMENTO.etapas.find((x) => x.id === id)
  if (!e) throw new Error(`etapa ${id} ausente no JSON`)
  return e
}
const fimDe = (id: string) => formatarData(bruta(id).fim)
const etapa = (c: Cronograma, id: string): Etapa => {
  const e = c.etapas.find((x) => x.id === id)
  if (!e) throw new Error(`etapa ${id} ausente no cálculo`)
  return e
}
const com = (ajustes: Record<string, unknown>, base: AndamentoJson = ANDAMENTO): AndamentoJson => ({ ...copia(base), ajustes })
const primeira = ANDAMENTO.etapas[0]
const ultima = ANDAMENTO.etapas[ANDAMENTO.etapas.length - 1]

/** Etapa calculada "de mentira" para testar passos e entrada dos grupos sem depender de datas. */
function etapaFake(id: EtapaId, status: Status, percentual: number, passosForcados: Record<string, Status> = {}): Etapa {
  return {
    id,
    nome: id,
    inicio: '2026-01-01',
    fim: '2026-02-01',
    status,
    percentual,
    publicas: ['inicio', 'fim'],
    rotulos: { inicio: 'Início', fim: 'Término' },
    concluidaEm: status === STATUS.concluida ? '2026-02-01' : null,
    mensagem: null,
    local: null,
    passosForcados,
    duracao: 31,
    ativa: false,
    rotulo: '',
  }
}

// ------------------------------------------------------------------ andamento.json público
describe('andamento.json público', () => {
  test('é válido e tem as 8 etapas na ordem dos capítulos', () => {
    expect(validar(ANDAMENTO, IDS)).toEqual([])
    expect(ANDAMENTO.etapas.map((e) => e.id)).toEqual(IDS)
  })

  test('datas coerentes: fim ≥ início, inícios não decrescentes, etapas encadeadas', () => {
    for (const e of ANDAMENTO.etapas) expect(diaDe(e.fim), `${e.id}: fim ≥ início`).toBeGreaterThanOrEqual(diaDe(e.inicio))
    for (let i = 1; i < ANDAMENTO.etapas.length; i += 1) {
      const atual = ANDAMENTO.etapas[i]
      const anterior = ANDAMENTO.etapas[i - 1]
      expect(diaDe(atual.inicio), `${atual.id}: início não antecede o da anterior`).toBeGreaterThanOrEqual(diaDe(anterior.inicio))
      expect(atual.inicio, `${atual.id} começa quando ${anterior.id} termina`).toBe(anterior.fim)
    }
  })

  test('projeto: entregaLimite = fim da última etapa; confirmadoEm = início da primeira', () => {
    expect(ANDAMENTO.projeto.entregaLimite).toBe(ultima.fim)
    expect(ANDAMENTO.projeto.confirmadoEm).toBe(primeira.inicio)
  })

  test('validar() aponta dados incoerentes', () => {
    const ruim = copia(ANDAMENTO)
    ruim.etapas[3].fim = '2020-01-01'
    ruim.ajustes = { inexistente: { status: 'qualquer' }, fabricacao: { status: 'concluida' } }
    ruim.fotos = [{ arquivo: 'horizon/fotos/x.webp', data: '2026-13-40', etapa: 'fabricacao' }]
    ruim.atualizacoes = [{ data: '2026-11-10', etapa: 'nada', texto: 'x' }]
    const p = validar(ruim, IDS)
    expect(p.some((t) => /fim antes do início/.test(t))).toBe(true)
    expect(p.some((t) => /etapa inexistente: inexistente/.test(t))).toBe(true)
    expect(p.some((t) => /status desconhecido/.test(t))).toBe(true)
    expect(p.some((t) => /sem realizadoEm/.test(t))).toBe(true)
    expect(p.some((t) => /foto com campos inválidos/.test(t))).toBe(true)
    expect(p.some((t) => /atualização com campos inválidos/.test(t))).toBe(true)
    expect(validar(null)).toEqual(['andamento ausente'])
    expect(validar({ ...copia(ANDAMENTO), etapas: ANDAMENTO.etapas.slice(0, 3) }, IDS).some((t) => /nesta ordem/.test(t))).toBe(true)
  })
})

// ------------------------------------------------------------------ cálculo em datas fixas tiradas do próprio JSON
describe('cálculo em datas do plano', () => {
  test('10 dias antes do início: tudo programado, 0 %, etapa atual = pedido', () => {
    const c = calcular(ANDAMENTO, somar(primeira.inicio, -10))
    for (const e of c.etapas) {
      expect(e.status, e.id).toBe(STATUS.programada)
      expect(e.percentual, e.id).toBe(0)
      expect(e.rotulo, e.id).toBe(
        dataPublica(e, 'fim') ? `Programada · até ${formatarData(e.fim)}` : `Programada · a partir de ${formatarData(e.inicio)}`,
      )
    }
    expect(c.percentualGeral).toBe(0)
    expect(c.etapaAtual?.id).toBe('pedido')
    expect(etapa(c, 'pedido').ativa).toBe(true)
  })

  test('meio da fabricação: 3 concluídas, fabricação em andamento perto de 50 %, demais programadas', () => {
    const f = bruta('fabricacao')
    const c = calcular(ANDAMENTO, meio(f.inicio, f.fim))
    for (const id of ['pedido', 'engenharia', 'suprimentos']) {
      expect(etapa(c, id).status, id).toBe(STATUS.concluida)
      expect(etapa(c, id).rotulo, id).toBe(`Concluída em ${fimDe(id)}`)
    }
    const fab = etapa(c, 'fabricacao')
    expect(fab.status).toBe(STATUS.andamento)
    expect(fab.percentual).toBeGreaterThanOrEqual(49)
    expect(fab.percentual).toBeLessThanOrEqual(51)
    expect(fab.rotulo).toBe(`Em andamento · ${fab.percentual}${NB}% · até ${fimDe('fabricacao')}`)
    expect(fab.ativa).toBe(true)
    expect(c.etapaAtual?.id).toBe('fabricacao')
    for (const id of ['pintura', 'montagem', 'testes', 'expedicao']) expect(etapa(c, id).status, id).toBe(STATUS.programada)
    expect(c.etapas.filter((e) => e.status === STATUS.andamento)).toHaveLength(1)
    expect(c.percentualGeral).toBeGreaterThan(0)
    expect(c.percentualGeral).toBeLessThan(100)
  })

  test('5 dias depois da última etapa: tudo concluído, 100 %', () => {
    const c = calcular(ANDAMENTO, somar(ultima.fim, 5))
    for (const e of c.etapas) {
      expect(e.status, e.id).toBe(STATUS.concluida)
      expect(e.percentual, e.id).toBe(100)
      expect(e.rotulo, e.id).toBe(dataPublica(e, 'fim') ? `Concluída em ${formatarData(e.fim)}` : 'Concluída')
    }
    expect(c.percentualGeral).toBe(100)
    expect(c.etapaAtual?.id).toBe(ultima.id)
  })

  test('todo dia do pedido (−3 a +3): no máximo uma em andamento e nenhuma concluída depois de uma programada', () => {
    const ini = diaDe(primeira.inicio)
    const fim = diaDe(ultima.fim)
    for (let d = ini - 3; d <= fim + 3; d += 1) {
      const hoje = isoDe(d)
      const c = calcular(ANDAMENTO, hoje)
      expect(c.etapas.filter((e) => e.status === STATUS.andamento).length, hoje).toBeLessThanOrEqual(1)
      let viuProgramada = false
      for (const e of c.etapas) {
        if (e.status === STATUS.programada) viuProgramada = true
        else expect(viuProgramada, `${hoje}: ${e.id} ${e.status} depois de uma programada`).toBe(false)
      }
      expect(Number.isFinite(c.percentualGeral), hoje).toBe(true)
      expect(c.percentualGeral).toBeGreaterThanOrEqual(0)
      expect(c.percentualGeral).toBeLessThanOrEqual(100)
      expect(c.etapaAtual, hoje).not.toBeNull()
      expect(c.etapas.filter((e) => e.ativa), hoje).toHaveLength(1)
      for (const e of c.etapas) expect(/NaN|undefined|null/.test(e.rotulo), `${hoje} ${e.id}: ${e.rotulo}`).toBe(false)
    }
  })

  test('percentual geral é não decrescente dia a dia', () => {
    let anterior = -1
    for (let d = diaDe(primeira.inicio) - 1; d <= diaDe(ultima.fim) + 1; d += 1) {
      const c = calcular(ANDAMENTO, isoDe(d))
      expect(c.percentualGeral, isoDe(d)).toBeGreaterThanOrEqual(anterior)
      anterior = c.percentualGeral
    }
  })
})

// ------------------------------------------------------------------ regra exata, com dados de teste próprios
const FIXO: AndamentoJson = {
  atualizadoEm: '2026-01-01',
  projeto: { confirmadoEm: '2026-01-01', entregaLimite: '2026-05-21' },
  etapas: [
    { id: 'x', nome: 'X', inicio: '2026-01-01', fim: '2026-01-01' },
    { id: 'y', nome: 'Y', inicio: '2026-01-01', fim: '2026-04-11' }, // 100 dias
    { id: 'z', nome: 'Z', inicio: '2026-04-11', fim: '2026-05-21' }, // 40 dias
  ],
  ajustes: {},
  fotos: [],
  atualizacoes: [],
}

describe('regra por data (FIXO de 3 etapas)', () => {
  test('FIXO é válido e as durações batem', () => {
    expect(validar(FIXO)).toEqual([])
    expect(diaDe('2026-04-11') - diaDe('2026-01-01')).toBe(100)
    expect(diaDe('2026-05-21') - diaDe('2026-04-11')).toBe(40)
  })

  test('início = fim: concluída no próprio dia; percentual 1..99 com arredondamento', () => {
    let c = calcular(FIXO, '2026-01-01')
    expect(etapa(c, 'x').status).toBe(STATUS.concluida)
    expect(etapa(c, 'x').rotulo).toBe('Concluída em 01/01/2026')
    expect(etapa(c, 'x').duracao).toBe(0)
    expect(etapa(c, 'y').status).toBe(STATUS.andamento)
    expect(etapa(c, 'y').percentual, 'no primeiro dia o mínimo é 1').toBe(1)
    c = calcular(FIXO, '2026-04-10')
    expect(etapa(c, 'y').percentual, 'na véspera do fim o máximo é 99').toBe(99)
    c = calcular(FIXO, '2026-04-11')
    expect(etapa(c, 'y').status).toBe(STATUS.concluida)
    expect(etapa(c, 'z').status).toBe(STATUS.andamento)
    expect(etapa(c, 'z').percentual).toBe(1)
    c = calcular(FIXO, '2026-02-20') // 50 de 100 dias
    expect(etapa(c, 'y').percentual).toBe(50)
    c = calcular(FIXO, '2026-01-02') // 1 de 100
    expect(etapa(c, 'y').percentual).toBe(1)
    c = calcular(FIXO, '2026-04-25') // 14 de 40 = 35
    expect(etapa(c, 'z').percentual).toBe(35)
    c = calcular(FIXO, '2026-04-18') // 7 de 40 = 17,5 → 18
    expect(etapa(c, 'z').percentual).toBe(18)
    c = calcular(FIXO, '2025-12-31')
    expect(c.etapas.every((e) => e.status === STATUS.programada)).toBe(true)
    expect(etapa(c, 'x').rotulo).toBe('Programada · até 01/01/2026')
  })

  test('percentual geral: média ponderada pela duração', () => {
    let c = calcular(FIXO, '2026-02-20')
    expect(c.percentualGeral).toBe(Math.round((50 * 100) / 140))
    c = calcular(FIXO, '2026-05-01') // y concluída; z com 20 de 40 dias
    expect(etapa(c, 'z').percentual).toBe(50)
    expect(c.percentualGeral).toBe(Math.round((100 * 100 + 50 * 40) / 140))
    expect(c.etapaAtual?.id).toBe('z')
    c = calcular(FIXO, '2026-06-01')
    expect(c.percentualGeral).toBe(100)
    // sem duração em nenhuma etapa: média simples
    const semDuracao: AndamentoJson = {
      ...FIXO,
      etapas: [
        { id: 'a', nome: 'A', inicio: '2026-01-01', fim: '2026-01-01' },
        { id: 'b', nome: 'B', inicio: '2026-01-05', fim: '2026-01-05' },
      ],
    }
    expect(calcular(semDuracao, '2026-01-03').percentualGeral).toBe(50)
    expect(calcular(null, '2026-01-03')).toEqual({ hoje: '2026-01-03', etapas: [], etapaAtual: null, percentualGeral: 0 })
  })
})

describe('ajustes prevalecem campo a campo', () => {
  const aj = (ajustes: Record<string, unknown>) => com(ajustes, FIXO)

  test('status explícito', () => {
    let c = calcular(aj({ z: { status: 'programada' } }), '2026-05-01')
    expect(etapa(c, 'z').status).toBe(STATUS.programada)
    expect(etapa(c, 'z').percentual).toBe(0)
    expect(etapa(c, 'z').rotulo).toBe('Programada · até 21/05/2026')
    expect(c.etapaAtual?.id, 'sem etapa em andamento, a atual é a última concluída').toBe('y')
    // concluída por ajuste sem realizadoEm: data fixa = fim da etapa (nunca a data de hoje)
    c = calcular(aj({ z: { status: 'concluida' } }), '2026-05-01')
    expect(etapa(c, 'z').status).toBe(STATUS.concluida)
    expect(etapa(c, 'z').percentual).toBe(100)
    expect(etapa(c, 'z').rotulo).toBe('Concluída em 21/05/2026')
    expect(etapa(c, 'z').concluidaEm).toBe('2026-05-21')
    // em andamento forçado depois do fim: percentual segurado em 99
    c = calcular(aj({ y: { status: 'em-andamento' } }), '2026-05-01')
    expect(etapa(c, 'y').status).toBe(STATUS.andamento)
    expect(etapa(c, 'y').percentual).toBe(99)
    // em andamento forçado antes do início (na 1ª etapa, que não depende de anterior): percentual mínimo 1
    c = calcular(aj({ x: { status: 'em-andamento' } }), '2025-12-31')
    expect(etapa(c, 'x').status).toBe(STATUS.andamento)
    expect(etapa(c, 'x').percentual).toBe(1)
    expect(etapa(c, 'x').rotulo).toBe(`Em andamento · 1${NB}% · até 01/01/2026`)
    expect(etapa(c, 'y').status, 'a seguinte espera a 1ª concluir').toBe(STATUS.programada)
    expect(c.etapaAtual?.id).toBe('x')
    // em andamento forçado numa etapa seguinte com a anterior ainda em andamento: a sequência vence
    c = calcular(aj({ z: { status: 'em-andamento' } }), '2026-02-20')
    expect(etapa(c, 'z').status).toBe(STATUS.programada)
    expect(etapa(c, 'z').percentual).toBe(0)
  })

  test('percentual sem status define o status', () => {
    let c = calcular(aj({ y: { percentual: 60 } }), '2026-04-10') // pela data seria 99
    expect(etapa(c, 'y').status).toBe(STATUS.andamento)
    expect(etapa(c, 'y').percentual).toBe(60)
    expect(etapa(c, 'y').rotulo).toBe(`Em andamento · 60${NB}% · até 11/04/2026`)
    c = calcular(aj({ y: { percentual: 100 } }), '2026-02-20')
    expect(etapa(c, 'y').status).toBe(STATUS.concluida)
    expect(etapa(c, 'y').rotulo).toBe('Concluída em 11/04/2026')
    c = calcular(aj({ y: { percentual: 0 } }), '2026-02-20')
    expect(etapa(c, 'y').status).toBe(STATUS.programada)
    // percentual em texto numérico e com decimais: arredondado
    c = calcular(aj({ y: { percentual: '42' } }), '2026-02-20')
    expect(etapa(c, 'y').percentual).toBe(42)
    c = calcular(aj({ y: { percentual: 42.6 } }), '2026-02-20')
    expect(etapa(c, 'y').percentual).toBe(43)
    // status e percentual juntos: os dois valem
    c = calcular(aj({ y: { status: 'em-andamento', percentual: 95 } }), '2026-05-01')
    expect(etapa(c, 'y').status).toBe(STATUS.andamento)
    expect(etapa(c, 'y').percentual).toBe(95)
  })

  test('realizadoEm é o fim efetivo e fixa a data de "Concluída em"', () => {
    let c = calcular(aj({ y: { realizadoEm: '2026-03-01' } }), '2026-03-05')
    expect(etapa(c, 'y').status).toBe(STATUS.concluida)
    expect(etapa(c, 'y').fim).toBe('2026-03-01')
    expect(etapa(c, 'y').concluidaEm).toBe('2026-03-01')
    expect(etapa(c, 'y').rotulo).toBe('Concluída em 01/03/2026')
    expect(etapa(c, 'z').status, 'z ainda não começou pelo plano').toBe(STATUS.programada)
    // realizadoEm futuro: continua em andamento até lá, com o novo fim
    c = calcular(aj({ y: { realizadoEm: '2026-05-11' } }), '2026-03-12') // 70 de 130 dias
    expect(etapa(c, 'y').status).toBe(STATUS.andamento)
    expect(etapa(c, 'y').percentual).toBe(Math.round((70 / 130) * 100))
    expect(etapa(c, 'y').rotulo).toBe(`Em andamento · ${Math.round((70 / 130) * 100)}${NB}% · até 11/05/2026`)
    // concluída com realizadoEm: a data informada, não o fim do plano
    c = calcular(aj({ z: { status: 'concluida', realizadoEm: '2026-05-10' } }), '2026-05-12')
    expect(etapa(c, 'z').rotulo).toBe('Concluída em 10/05/2026')
    c = calcular(aj({ z: { percentual: 100, realizadoEm: '2026-05-10' } }), '2026-05-12')
    expect(etapa(c, 'z').rotulo).toBe('Concluída em 10/05/2026')
    expect(etapa(c, 'z').fim).toBe('2026-05-10')
  })

  test('inicio/fim remarcam a etapa: rótulo e cálculo mudam', () => {
    const remarcado = aj({ y: { fim: '2026-05-01' }, z: { inicio: '2026-05-01' } })
    let c = calcular(remarcado, '2026-04-20') // pelo plano z já teria começado
    expect(etapa(c, 'y').status).toBe(STATUS.andamento)
    expect(etapa(c, 'y').fim).toBe('2026-05-01')
    expect(etapa(c, 'y').percentual).toBe(Math.round((109 / 120) * 100))
    expect(etapa(c, 'y').rotulo).toBe(`Em andamento · ${etapa(c, 'y').percentual}${NB}% · até 01/05/2026`)
    expect(etapa(c, 'z').status).toBe(STATUS.programada)
    expect(etapa(c, 'z').inicio).toBe('2026-05-01')
    expect(etapa(c, 'z').rotulo).toBe('Programada · até 21/05/2026')
    expect(etapa(c, 'z').duracao).toBe(20)
    c = calcular(remarcado, '2026-05-02')
    expect(etapa(c, 'y').rotulo).toBe('Concluída em 01/05/2026')
    expect(etapa(c, 'z').status).toBe(STATUS.andamento)
    expect(etapa(c, 'z').percentual).toBe(Math.round((1 / 20) * 100))
    // início remarcado para depois: programada em data que pelo plano estaria em andamento
    c = calcular(aj({ y: { inicio: '2026-03-01' } }), '2026-02-20')
    expect(etapa(c, 'y').status).toBe(STATUS.programada)
    expect(etapa(c, 'y').inicio).toBe('2026-03-01')
    c = calcular(aj({ y: { inicio: '2026-03-01' } }), '2026-03-21') // 20 de 41 dias
    expect(etapa(c, 'y').percentual).toBe(Math.round((20 / 41) * 100))
  })

  test('mensagem', () => {
    let c = calcular(aj({ y: { mensagem: '  Caldeiraria em curso.  ' } }), '2026-02-20')
    expect(etapa(c, 'y').mensagem).toBe('Caldeiraria em curso.')
    expect(etapa(c, 'y').percentual, 'a mensagem não muda o cálculo').toBe(50)
    c = calcular(aj({ y: { mensagem: '' } }), '2026-02-20')
    expect(etapa(c, 'y').mensagem).toBeNull()
    expect(etapa(c, 'z').mensagem).toBeNull()
  })

  test('campos fora da regra são ignorados (os demais valem)', () => {
    expect(ajusteValido({ status: 'atrasada', percentual: 150, realizadoEm: '10/02/2027', mensagem: '' })).toEqual({})
    expect(ajusteValido({ status: 'concluida', percentual: 'abc', inicio: '2027-01-05', fim: 'x', mensagem: ' Pintura. ' })).toEqual({
      status: 'concluida',
      inicio: '2027-01-05',
      mensagem: 'Pintura.',
    })
    expect(ajusteValido({ percentual: '40' })).toEqual({ percentual: 40 })
    expect(ajusteValido({ percentual: true })).toEqual({})
    expect(ajusteValido({ percentual: -1 })).toEqual({})
    expect(ajusteValido({ percentual: 100 })).toEqual({ percentual: 100 })
    expect(ajusteValido({ percentual: 0 })).toEqual({ percentual: 0 })
    expect(ajusteValido({ realizadoEm: '2027-02-30' })).toEqual({})
    expect(ajusteValido({ passos: { a: 'concluida', b: 'qualquer', c: 'em-andamento' } })).toEqual({
      passos: { a: 'concluida', c: 'em-andamento' },
    })
    expect(ajusteValido({ passos: { b: 'qualquer' } })).toEqual({})
    expect(ajusteValido({ passos: 'x' })).toEqual({})
    expect(ajusteValido(null)).toEqual({})
    expect(ajusteValido([])).toEqual({})
    expect(ajusteValido('abc')).toEqual({})
    // no cálculo: igual a sem ajustes
    const sem = calcular(FIXO, '2026-02-20')
    const c = calcular(aj({ y: { status: 'atrasada', percentual: 150, realizadoEm: '10/02/2027', fim: '2026-02-30', mensagem: '' } }), '2026-02-20')
    expect(etapa(c, 'y').status).toBe(STATUS.andamento)
    expect(etapa(c, 'y').percentual).toBe(50)
    expect(etapa(c, 'y').rotulo).toBe(etapa(sem, 'y').rotulo)
    expect(etapa(c, 'y').fim).toBe('2026-04-11')
    expect(etapa(c, 'y').mensagem).toBeNull()
    // nulos não mudam nada
    const n = calcular(aj({ y: { status: null, percentual: null, realizadoEm: null, mensagem: null } }), '2026-02-20')
    expect(etapa(n, 'y').percentual).toBe(50)
  })

  test('sequência obrigatória: status forçado na 2ª sem a 1ª concluída não vale', () => {
    let c = calcular(aj({ y: { status: 'em-andamento' }, z: { status: 'concluida' } }), '2026-05-01')
    expect(etapa(c, 'y').status).toBe(STATUS.andamento)
    expect(etapa(c, 'z').status).toBe(STATUS.programada)
    expect(etapa(c, 'z').percentual).toBe(0)
    expect(c.etapas.filter((e) => e.status === STATUS.andamento)).toHaveLength(1)
    expect(c.etapaAtual?.id).toBe('y')
    // a 1ª segurada em programada: nada depois dela anda
    c = calcular(aj({ x: { status: 'programada' } }), '2026-02-20')
    expect(c.etapas.map((e) => e.status)).toEqual([STATUS.programada, STATUS.programada, STATUS.programada])
    expect(c.etapaAtual?.id, 'sem concluída nem em andamento, a atual é a primeira').toBe('x')
    expect(c.percentualGeral).toBe(0)
    // y segurada em 95 % depois do plano: z fica programada com o rótulo do plano
    c = calcular(aj({ y: { status: 'em-andamento', percentual: 95 } }), '2026-05-15')
    expect(etapa(c, 'y').rotulo).toBe(`Em andamento · 95${NB}% · até 11/04/2026`)
    expect(etapa(c, 'z').rotulo).toBe('Programada · até 21/05/2026')
    // no JSON público: fabricação segurada → tudo depois programado, nunca duas em andamento
    const pub = calcular(com({ fabricacao: { status: 'em-andamento', percentual: 95 } }), somar(ultima.fim, 5))
    expect(etapa(pub, 'fabricacao').rotulo).toBe(`Em andamento · 95${NB}% · até ${fimDe('fabricacao')}`)
    for (const id of ['pintura', 'montagem', 'testes', 'expedicao']) expect(etapa(pub, id).status, id).toBe(STATUS.programada)
    expect(pub.etapaAtual?.id).toBe('fabricacao')
  })
})

describe('datasPublicas', () => {
  const comPublicas = (datasPublicas: EtapaBruta['datasPublicas']): AndamentoJson => ({
    ...copia(FIXO),
    etapas: FIXO.etapas.map((e) => (e.id === 'y' ? { ...e, datasPublicas } : e)),
  })

  test('datasPublicasDe aceita lista ou texto; padrão as duas', () => {
    expect(datasPublicasDe({ datasPublicas: ['inicio'] })).toEqual(['inicio'])
    expect(datasPublicasDe({ datasPublicas: 'fim' })).toEqual(['fim'])
    expect(datasPublicasDe({ datasPublicas: ['fim', 'inicio'] })).toEqual(['inicio', 'fim'])
    expect(datasPublicasDe({ datasPublicas: [] })).toEqual([])
    expect(datasPublicasDe({})).toEqual(['inicio', 'fim'])
    expect(datasPublicasDe(null)).toEqual(['inicio', 'fim'])
    expect(ANDAMENTO.etapas.every((e) => datasPublicasDe(e).join('+') === 'inicio+fim'), 'no JSON público todas as datas são públicas').toBe(true)
  })

  test('data não pública nunca aparece em rotulo nem em dataPublica, e segue valendo no cálculo', () => {
    const soInicio = comPublicas(['inicio'])
    const internaIso = '2026-04-11'
    const internaBr = '11/04/2026'
    // antes: "a partir de <início>"
    let c = calcular(soInicio, '2025-12-01')
    expect(etapa(c, 'y').rotulo).toBe('Programada · a partir de 01/01/2026')
    // durante: percentual pelo fim interno, sem a data no rótulo
    c = calcular(soInicio, '2026-02-20')
    expect(etapa(c, 'y').percentual).toBe(50)
    expect(etapa(c, 'y').rotulo).toBe(`Em andamento · 50${NB}%`)
    expect(etapa(c, 'y').fim, 'a data interna segue no cálculo').toBe(internaIso)
    expect(dataPublica(etapa(c, 'y'), 'fim')).toBeNull()
    expect(dataPublica(etapa(c, 'y'), 'inicio')).toBe('2026-01-01')
    expect(etapa(c, 'y').publicas).toEqual(['inicio'])
    // depois: só "Concluída" (sem realizadoEm e fim interno)
    c = calcular(soInicio, '2026-05-01')
    expect(etapa(c, 'y').status).toBe(STATUS.concluida)
    expect(etapa(c, 'y').concluidaEm).toBeNull()
    expect(etapa(c, 'y').rotulo).toBe('Concluída')
    // com realizadoEm a data informada aparece (é pública por definição)
    c = calcular(com({ y: { realizadoEm: '2026-04-01' } }, soInicio), '2026-05-01')
    expect(etapa(c, 'y').rotulo).toBe('Concluída em 01/04/2026')
    for (const hoje of ['2025-12-01', '2026-02-20', '2026-04-10', '2026-04-11', '2026-05-01']) {
      const y = etapa(calcular(soInicio, hoje), 'y')
      expect(y.rotulo.includes(internaBr), `${hoje}: ${y.rotulo}`).toBe(false)
      expect(y.rotulo.includes(internaIso), `${hoje}: ${y.rotulo}`).toBe(false)
    }
    // só o fim público
    const soFim = comPublicas('fim')
    c = calcular(soFim, '2025-12-01')
    expect(etapa(c, 'y').rotulo).toBe('Programada · até 11/04/2026')
    expect(dataPublica(etapa(c, 'y'), 'inicio')).toBeNull()
    // nenhuma pública
    const nenhuma = comPublicas([])
    c = calcular(nenhuma, '2025-12-01')
    expect(etapa(c, 'y').rotulo).toBe('Programada')
    c = calcular(nenhuma, '2026-02-20')
    expect(etapa(c, 'y').rotulo).toBe(`Em andamento · 50${NB}%`)
    c = calcular(nenhuma, '2026-05-01')
    expect(etapa(c, 'y').rotulo).toBe('Concluída')
  })

  test('dataPublica: só campo público e real', () => {
    expect(dataPublica({ inicio: '2026-01-01', fim: '2026-02-30' }, 'fim')).toBeNull()
    expect(dataPublica({ inicio: '2026-01-01', fim: '2026-02-01', publicas: ['fim'] }, 'inicio')).toBeNull()
    expect(dataPublica({ inicio: '2026-01-01', fim: '2026-02-01', publicas: ['fim'] }, 'fim')).toBe('2026-02-01')
    expect(dataPublica({ inicio: '2026-01-01', fim: '2026-02-01', datasPublicas: 'inicio' }, 'fim')).toBeNull()
    expect(dataPublica(null, 'fim')).toBeNull()
    expect(dataPublica({ inicio: '2026-01-01' }, 'outro' as 'fim')).toBeNull()
  })
})

// ------------------------------------------------------------------ rótulos e formatação
describe('rótulos no vocabulário afirmativo', () => {
  test('rotuloDaEtapa e partesDoRotulo', () => {
    expect(rotuloDaEtapa({ status: 'concluida', percentual: 100, concluidaEm: '2027-02-10' })).toBe('Concluída em 10/02/2027')
    expect(rotuloDaEtapa({ status: 'em-andamento', percentual: 40 })).toBe(`Em andamento · 40${NB}%`)
    expect(rotuloDaEtapa({ status: 'em-andamento', percentual: 40, fim: '2027-02-10' })).toBe(`Em andamento · 40${NB}% · até 10/02/2027`)
    expect(rotuloDaEtapa({ status: 'programada', percentual: 0, inicio: '2027-04-11' })).toBe('Programada · a partir de 11/04/2027')
    expect(rotuloDaEtapa({ status: 'programada', percentual: 0, inicio: '2027-04-11', fim: '2027-04-25' })).toBe('Programada · até 25/04/2027')
    expect(rotuloDaEtapa({ status: 'programada', percentual: 0, inicio: '2027-04-11', fim: '2027-04-25', publicas: ['inicio'] })).toBe(
      'Programada · a partir de 11/04/2027',
    )
    expect(rotuloDaEtapa({ status: 'programada', percentual: 0, inicio: '2027-04-25', fim: '2027-05-10', publicas: ['fim'] })).toBe('Programada · até 10/05/2027')
    expect(rotuloDaEtapa({ status: 'programada', percentual: 0, inicio: '2027-04-25', fim: '2027-05-10', publicas: [] })).toBe('Programada')
    expect(rotuloDaEtapa({ status: 'em-andamento', percentual: 30, fim: '2027-04-25', publicas: ['inicio'] })).toBe(`Em andamento · 30${NB}%`)
    expect(partesDoRotulo({ status: 'em-andamento', percentual: 24, fim: '2027-02-10' })).toEqual({
      estado: `Em andamento · 24${NB}%`,
      data: 'até 10/02/2027',
      sep: ' · ',
    })
    expect(partesDoRotulo({ status: 'concluida', percentual: 100, concluidaEm: '2027-02-10' })).toEqual({ estado: 'Concluída', data: 'em 10/02/2027', sep: ' ' })
    expect(partesDoRotulo({ status: 'concluida', percentual: 100, concluidaEm: null })).toEqual({ estado: 'Concluída', data: '', sep: '' })
    expect(partesDoRotulo({ status: 'programada', percentual: 0 })).toEqual({ estado: 'Programada', data: '', sep: '' })
  })

  test('data impossível ou fora do formato: o rótulo omite a data, nunca "NaN"', () => {
    expect(rotuloDaEtapa({ status: 'programada', percentual: 0, inicio: '10/02/2027' })).toBe('Programada')
    expect(rotuloDaEtapa({ status: 'concluida', percentual: 100, concluidaEm: '2027-02-30' })).toBe('Concluída')
    expect(rotuloDaEtapa({ status: 'em-andamento', percentual: NaN })).toBe('Em andamento')
    const quebrado: AndamentoJson = { ...FIXO, etapas: FIXO.etapas.map((e) => (e.id === 'y' ? { ...e, fim: '2026-02-30' } : e)) }
    for (const hoje of ['2025-12-01', '2026-02-01', '2026-06-01']) {
      const c = calcular(quebrado, hoje)
      expect(c.etapas.every((e) => Number.isFinite(e.percentual) && !/NaN|undefined/.test(e.rotulo)), hoje).toBe(true)
      expect(Number.isFinite(c.percentualGeral)).toBe(true)
    }
    // hoje fora do formato: nada em andamento, nada quebra
    const c = calcular(FIXO, 'ontem')
    expect(c.hoje).toBe('ontem')
    expect(c.etapas.every((e) => e.status === STATUS.programada)).toBe(true)
  })

  test('formatarData / formatarDataCurta / diaDe / isoDe / isoLocal / isoValida', () => {
    expect(formatarData('2026-08-21')).toBe('21/08/2026')
    expect(formatarDataCurta('2026-08-21')).toBe('21/08')
    expect(formatarData('2027-02-30')).toBe('')
    expect(formatarDataCurta('2027-02-30')).toBe('')
    expect(formatarData('10/02/2027')).toBe('')
    expect(formatarDataCurta('10/02/2027')).toBe('')
    expect(formatarData(null)).toBe('')
    expect(formatarData(undefined)).toBe('')
    expect(formatarData('')).toBe('')
    expect(Number.isNaN(diaDe('2027-02-30'))).toBe(true)
    expect(Number.isNaN(diaDe('2026-13-01'))).toBe(true)
    expect(Number.isNaN(diaDe('2026-1-5'))).toBe(true)
    expect(Number.isNaN(diaDe(null))).toBe(true)
    expect(Number.isNaN(diaDe(''))).toBe(true)
    expect(diaDe('2024-02-29') - diaDe('2024-02-28'), 'ano bissexto').toBe(1)
    expect(Number.isNaN(diaDe('2026-02-29')), 'não bissexto').toBe(true)
    expect(diaDe('1970-01-01')).toBe(0)
    expect(diaDe('1970-01-02')).toBe(1)
    expect(diaDe('2026-01-02') - diaDe('2026-01-01')).toBe(1)
    expect(isoDe(diaDe('2026-08-21'))).toBe('2026-08-21')
    expect(isoDe(diaDe('2026-12-31') + 1)).toBe('2027-01-01')
    expect(isoLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(isoLocal(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31')
    expect(isoValida('2026-08-21')).toBe(true)
    expect(isoValida('2026-08-32')).toBe(false)
    expect(isoValida(20260821)).toBe(false)
    expect(isoValida(undefined)).toBe(false)
    // calcular aceita Date e usa a data local
    const c = calcular(FIXO, new Date(2026, 1, 20, 12))
    expect(c.hoje).toBe('2026-02-20')
    expect(etapa(c, 'y').percentual).toBe(50)
  })

  test('ateHoje filtra datas futuras', () => {
    const lista = [{ data: '2027-03-15' }, { data: '2027-04-02' }, { data: '2026-08-21' }, { data: 'x' }, {}]
    expect(ateHoje(lista, '2027-03-15').map((x) => x.data)).toEqual(['2027-03-15', '2026-08-21', 'x', undefined])
    expect(ateHoje(lista, '2027-04-02')).toHaveLength(5)
    expect(ateHoje(lista, '2026-01-01').map((x) => x.data)).toEqual(['x', undefined])
    expect(ateHoje(undefined, '2027-04-02')).toEqual([])
    expect(ateHoje(null, '2027-04-02')).toEqual([])
  })
})

// ------------------------------------------------------------------ passos (checklist)
describe('passos', () => {
  const F = PASSOS.fabricacao // estrutura [0,35] · calha [20,60] · moega [45,80] · rosca [60,100]
  const P = STATUS.programada
  const A = STATUS.andamento
  const C = STATUS.concluida
  const estados = (status: Status, percentual: number, forcados: Record<string, Status> = {}) =>
    F.map((p) => estadoDoPasso(etapaFake('fabricacao', status, percentual, forcados), p))
  const fracoes = (status: Status, percentual: number, forcados: Record<string, Status> = {}) =>
    F.map((p) => fracaoDoPasso(etapaFake('fabricacao', status, percentual, forcados), p))

  test('estadoDoPasso por etapa programada / em andamento / concluída e pelas faixas', () => {
    expect(estados(P, 0)).toEqual([P, P, P, P])
    expect(estados(P, 50), 'programada: nada começa mesmo com percentual').toEqual([P, P, P, P])
    expect(estados(C, 100)).toEqual([C, C, C, C])
    expect(estados(C, 10), 'concluída: tudo concluído mesmo com percentual baixo').toEqual([C, C, C, C])
    expect(estados(A, 1)).toEqual([A, P, P, P]) // antes de a (20) a calha fica programada
    expect(estados(A, 19)).toEqual([A, P, P, P])
    expect(estados(A, 20), 'a partir de a: em andamento').toEqual([A, A, P, P])
    expect(estados(A, 34)).toEqual([A, A, P, P])
    expect(estados(A, 35), 'a partir de b: concluído').toEqual([C, A, P, P])
    expect(estados(A, 45)).toEqual([C, A, A, P])
    expect(estados(A, 60)).toEqual([C, C, A, A])
    expect(estados(A, 80)).toEqual([C, C, C, A])
    expect(estados(A, 99)).toEqual([C, C, C, A])
    expect(estadoDoPasso(null, F[0])).toBe(P)
    expect(estadoDoPasso(undefined, F[0])).toBe(P)
  })

  test('fracaoDoPasso: 0 programado, 1 concluído, posição na faixa (0,02..0,98) em andamento', () => {
    expect(fracoes(P, 50)).toEqual([0, 0, 0, 0])
    expect(fracoes(C, 10)).toEqual([1, 1, 1, 1])
    expect(fracoes(A, 10)).toEqual([10 / 35, 0, 0, 0])
    expect(fracoes(A, 35)[0]).toBe(1)
    expect(fracoes(A, 35)[1]).toBeCloseTo(15 / 40, 10)
    expect(fracoes(A, 20)[1], 'no começo da faixa a fração mínima é 0,02').toBe(0.02)
    expect(fracoes(A, 99)[3]).toBeCloseTo(39 / 40, 10)
    const estreito: Passo = { id: 'p', nome: 'P', faixa: [40, 41], fim: 'o' }
    expect(fracaoDoPasso(etapaFake('expedicao', A, 40), estreito)).toBe(0.02)
    expect(fracaoDoPasso(etapaFake('expedicao', A, 41), estreito)).toBe(1)
    for (let pct = 1; pct <= 99; pct += 1) {
      for (const p of F) {
        const e = etapaFake('fabricacao', A, pct)
        const f = fracaoDoPasso(e, p)
        const st = estadoDoPasso(e, p)
        if (st === A) {
          expect(f, `${p.id} ${pct}`).toBeGreaterThanOrEqual(0.02)
          expect(f, `${p.id} ${pct}`).toBeLessThanOrEqual(0.98)
        } else expect(f, `${p.id} ${pct}`).toBe(st === C ? 1 : 0)
      }
    }
    expect(fracaoDoPasso(null, F[0])).toBe(0)
  })

  test('passosForcados prevalecem, exceto com etapa programada ou concluída', () => {
    const forcados: Record<string, Status> = { rosca: C, estrutura: P, calha: A }
    expect(estados(A, 10, forcados)).toEqual([P, A, P, C])
    expect(fracoes(A, 10, forcados)).toEqual([0, 0.02, 0, 1]) // calha forçada em andamento com 10 % (abaixo de a=20): fração mínima
    expect(fracoes(A, 50, { calha: A })[1]).toBeCloseTo(30 / 40, 10)
    expect(estados(A, 99, { rosca: A, moega: P })).toEqual([C, C, P, A])
    expect(estados(P, 50, forcados), 'etapa programada: forçados não valem').toEqual([P, P, P, P])
    expect(estados(C, 50, forcados), 'etapa concluída: forçados não valem').toEqual([C, C, C, C])
    expect(fracoes(C, 50, forcados)).toEqual([1, 1, 1, 1])
    // ajuste chega ao cálculo via ajustes[etapa].passos
    const c = calcular(com({ fabricacao: { passos: { rosca: 'concluida', ruim: 'x' } } }), meio(bruta('fabricacao').inicio, bruta('fabricacao').fim))
    expect(etapa(c, 'fabricacao').passosForcados).toEqual({ rosca: 'concluida' })
    expect(estadoDoPasso(etapa(c, 'fabricacao'), F[3])).toBe(C)
    expect(etapa(c, 'engenharia').passosForcados).toEqual({})
  })

  test('textoDoPasso concorda com o nome do passo', () => {
    const p = (fim: Passo['fim']): Passo => ({ id: 'p', nome: 'P', faixa: [0, 100], fim })
    expect(textoDoPasso(C, p('a'))).toBe('concluída')
    expect(textoDoPasso(C, p('o'))).toBe('concluído')
    expect(textoDoPasso(C, p('os'))).toBe('concluídos')
    expect(textoDoPasso(C, p('as'))).toBe('concluídas')
    expect(textoDoPasso(A, p('as'))).toBe('em andamento')
    expect(textoDoPasso(P, p('a'))).toBe('programada')
    expect(textoDoPasso(P, p('os'))).toBe('programados')
  })

  test('passosDaEtapa devolve os passos da etapa com estado e fração; etapa desconhecida → []', () => {
    const lista = passosDaEtapa(etapaFake('fabricacao', A, 35))
    expect(lista.map((x) => x.passo.id)).toEqual(F.map((p) => p.id))
    expect(lista.map((x) => x.estado)).toEqual([C, A, P, P])
    expect(lista[0].fracao).toBe(1)
    expect(passosDaEtapa(null)).toEqual([])
    expect(passosDaEtapa({ ...etapaFake('fabricacao', A, 35), id: 'inexistente' })).toEqual([])
    expect(passosDaEtapa(etapaFake('pedido', C, 100))).toEqual([])
  })
})

// ------------------------------------------------------------------ entrada dos grupos do 3D (capitulos.ts)
describe('entradaDosGrupos', () => {
  const ETAPAS_COM_GRUPOS = (['fabricacao', 'montagem', 'suprimentos'] as const).filter((id) => PASSOS[id].some((p) => p.grupo))

  test('monotônico não decrescente por grupo ao longo de 0..100 % (fabricação e montagem)', () => {
    for (const id of ['fabricacao', 'montagem'] as const) {
      const anterior = new Map<string, number>()
      for (let pct = 0; pct <= 100; pct += 1) {
        const status: Status = pct <= 0 ? STATUS.programada : pct >= 100 ? STATUS.concluida : STATUS.andamento
        const entrada = entradaDosGrupos(etapaFake(id, status, pct))
        for (const { id: g, t } of entrada) {
          expect(GRUPO_IDS, `${id}: grupo ${g} existe`).toContain(g)
          expect(t, `${id} ${pct} % ${g}`).toBeGreaterThanOrEqual(anterior.get(g) ?? 0)
          expect(t).toBeGreaterThanOrEqual(0)
          expect(t).toBeLessThanOrEqual(1)
          anterior.set(g, t)
        }
      }
    }
  })

  test('passo concluído ⇒ t = 1; etapa concluída ⇒ todos 1; programada ⇒ todos 0', () => {
    for (const id of ETAPAS_COM_GRUPOS) {
      const passos = PASSOS[id].filter((p) => p.grupo)
      for (let pct = 1; pct <= 99; pct += 1) {
        const e = etapaFake(id, STATUS.andamento, pct)
        const entrada = entradaDosGrupos(e)
        expect(entrada.map((x) => x.id)).toEqual(passos.map((p) => p.grupo))
        passos.forEach((p, i) => {
          const st = estadoDoPasso(e, p)
          if (st === STATUS.concluida) expect(entrada[i].t, `${id} ${pct} % ${p.id}`).toBe(1)
          if (st === STATUS.programada) expect(entrada[i].t, `${id} ${pct} % ${p.id}`).toBe(0)
          if (st === STATUS.andamento) {
            expect(entrada[i].t).toBeGreaterThan(0)
            expect(entrada[i].t).toBeLessThan(1)
          }
        })
      }
      expect(entradaDosGrupos(etapaFake(id, STATUS.concluida, 100)).every((x) => x.t === 1), `${id} concluída`).toBe(true)
      expect(entradaDosGrupos(etapaFake(id, STATUS.concluida, 0)).every((x) => x.t === 1), `${id} concluída`).toBe(true)
      expect(entradaDosGrupos(etapaFake(id, STATUS.programada, 0)).every((x) => x.t === 0), `${id} programada`).toBe(true)
      expect(entradaDosGrupos(etapaFake(id, STATUS.programada, 80)).every((x) => x.t === 0), `${id} programada`).toBe(true)
    }
    expect(entradaDosGrupos(etapaFake('pedido', STATUS.andamento, 50))).toEqual([])
    expect(entradaDosGrupos(etapaFake('pintura', STATUS.andamento, 50)), 'pintura não tem grupos ligados a passos').toEqual([])
    expect(entradaDosGrupos(null)).toEqual([])
  })

  test('com movimento reduzido, t ∈ {0, 1} e nunca abaixo do valor normal', () => {
    for (const id of ETAPAS_COM_GRUPOS) {
      for (let pct = 0; pct <= 100; pct += 1) {
        const status: Status = pct <= 0 ? STATUS.programada : pct >= 100 ? STATUS.concluida : STATUS.andamento
        const e = etapaFake(id, status, pct)
        const normal = entradaDosGrupos(e)
        const reduzido = entradaDosGrupos(e, { reduzido: true })
        reduzido.forEach((x, i) => {
          expect([0, 1], `${id} ${pct} % ${x.id}`).toContain(x.t)
          expect(x.t).toBeGreaterThanOrEqual(normal[i].t)
          expect(x.t === 0).toBe(normal[i].t === 0)
        })
      }
    }
  })

  test('passos forçados chegam ao 3D', () => {
    const e = etapaFake('fabricacao', STATUS.andamento, 5, { rosca: STATUS.concluida })
    const entrada = Object.fromEntries(entradaDosGrupos(e).map((x) => [x.id, x.t]))
    expect(entrada.rosca).toBe(1)
    expect(entrada.estrutura).toBeGreaterThan(0)
    expect(entrada.calha).toBe(0)
  })
})
