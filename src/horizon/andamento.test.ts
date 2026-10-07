/// <reference types="node" />
// Testes da validação única do andamento.json (validarAndamento) e da leitura em tempo de execução (andamento.ts).
import { afterEach, describe, expect, test, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  LIMITE_DA_LEITURA,
  LIMITE_DA_TENTATIVA,
  aoChegarAndamento,
  enderecoDoAndamento,
  hojeDaPagina,
  lerAndamento,
  validarAndamento,
  type Andamento,
} from './andamento'
import { ETAPAS_DA_PRODUCAO } from './capitulos'
import { calcular, isoValida } from './cronograma'
import { CAMINHO_ANDAMENTO } from './dados'

type Json = Record<string, unknown>

const CAMINHO_JSON = fileURLToPath(new URL('../../public/horizon/andamento.json', import.meta.url))
const TEXTO_JSON = readFileSync(CAMINHO_JSON, 'utf8')
const ANDAMENTO = JSON.parse(TEXTO_JSON) as Json
const copia = (): Json => JSON.parse(TEXTO_JSON) as Json
const etapas = (d: Json) => d.etapas as Json[]
const projeto = (d: Json) => d.projeto as Json

/** Valida uma cópia alterada e devolve o resultado; `mudar` pode devolver outro valor para substituir a cópia. */
function alterado(mudar: (d: Json) => unknown) {
  const d = copia()
  const r = mudar(d)
  return validarAndamento(r === undefined ? d : r)
}

const valido = (d: Json): Andamento => {
  const v = validarAndamento(d)
  expect(v.valido, v.problemas.join('; ')).toBe(true)
  expect(v.problemas).toEqual([])
  if (!v.andamento) throw new Error('andamento nulo')
  return v.andamento
}

describe('módulo sob vitest', () => {
  test('importa (import.meta.env existe no Vite) e expõe as funções e limites', () => {
    expect(typeof validarAndamento).toBe('function')
    expect(typeof lerAndamento).toBe('function')
    expect(typeof aoChegarAndamento).toBe('function')
    expect(LIMITE_DA_LEITURA).toBe(6000)
    expect(LIMITE_DA_TENTATIVA).toBe(20000)
    expect(import.meta.env).toBeDefined()
  })

  test('hojeDaPagina devolve a data local em aaaa-mm-dd', () => {
    expect(isoValida(hojeDaPagina())).toBe(true)
  })
})

describe('validarAndamento aceita o JSON público', () => {
  test('válido, sem problemas, com as 8 etapas na ordem', () => {
    const a = valido(ANDAMENTO)
    expect(a.etapas.map((e) => e.id)).toEqual([...ETAPAS_DA_PRODUCAO])
    expect(a.atualizadoEm).toBe(ANDAMENTO.atualizadoEm)
    expect(a.projeto.confirmadoEm).toBe(projeto(ANDAMENTO).confirmadoEm)
    expect(a.projeto.entregaLimite).toBe(projeto(ANDAMENTO).entregaLimite)
    expect(a.projeto.equipamento).toBe('Dosador Horizon')
    expect(a.projeto.quantidade).toBe(1)
    expect(a.ajustes).toEqual({})
    expect(a.fotos).toEqual([])
    expect(a.atualizacoes).toHaveLength((ANDAMENTO.atualizacoes as unknown[]).length)
    for (const at of a.atualizacoes) expect(ETAPAS_DA_PRODUCAO).toContain(at.etapa)
  })

  test('textos vazios do projeto viram undefined (cliente e ordem podem ficar em branco)', () => {
    const a = valido(ANDAMENTO)
    expect(projeto(ANDAMENTO).cliente).toBe('')
    expect(projeto(ANDAMENTO).ordem).toBe('')
    expect(a.projeto.cliente).toBeUndefined()
    expect(a.projeto.ordem).toBeUndefined()
    expect(a.projeto.proposta).toBeUndefined()
    expect(a.projeto.cidade).toBeUndefined()
    expect(a.projeto.modelo).toBeUndefined()
    const b = alterado((d) => {
      projeto(d).cliente = '  Cliente Exemplo  '
      projeto(d).ordem = ' OP-1234 '
      projeto(d).cidade = '   '
    })
    expect(b.valido).toBe(true)
    expect(b.andamento?.projeto.cliente).toBe('Cliente Exemplo')
    expect(b.andamento?.projeto.ordem).toBe('OP-1234')
    expect(b.andamento?.projeto.cidade).toBeUndefined()
  })

  test('quantidade inválida → undefined; inteiro positivo vale (também em texto)', () => {
    // (`true` fica de fora: Number(true) é 1, e o saneamento aceita como 1 — valor que nenhum JSON real traz)
    for (const q of [0, -1, 2.5, 'abc', '', null, {}, [], '1,5', NaN, Infinity]) {
      const v = alterado((d) => {
        projeto(d).quantidade = q
      })
      expect(v.valido, String(q)).toBe(true)
      expect(v.andamento?.projeto.quantidade, String(q)).toBeUndefined()
    }
    expect(alterado((d) => { projeto(d).quantidade = 3 }).andamento?.projeto.quantidade).toBe(3)
    expect(alterado((d) => { projeto(d).quantidade = '3' }).andamento?.projeto.quantidade).toBe(3)
    expect(alterado((d) => { delete projeto(d).quantidade }).andamento?.projeto.quantidade).toBeUndefined()
  })

  test('etapas saneadas: nome aparado, local e rotulos só com texto, datasPublicas em lista', () => {
    const v = alterado((d) => {
      etapas(d)[3].nome = '  Fabricação  '
      etapas(d)[3].local = '   '
      etapas(d)[3].rotulos = { inicio: '  Começo  ', fim: '' }
      etapas(d)[3].datasPublicas = ['fim']
      etapas(d)[4].rotulos = {}
      delete etapas(d)[4].local
    })
    expect(v.valido).toBe(true)
    const fab = v.andamento!.etapas[3]
    expect(fab.nome).toBe('Fabricação')
    expect(fab.local).toBeUndefined()
    expect(fab.rotulos).toEqual({ inicio: 'Começo' })
    expect(fab.datasPublicas).toEqual(['fim'])
    const pin = v.andamento!.etapas[4]
    expect(pin.rotulos).toBeUndefined()
    expect(pin.local).toBeUndefined()
    expect(pin.datasPublicas).toBeUndefined()
    const a = valido(ANDAMENTO)
    expect(a.etapas[3].local).toBe((etapas(ANDAMENTO)[3] as Json).local)
    expect(a.etapas[0].rotulos).toEqual((etapas(ANDAMENTO)[0] as Json).rotulos)
  })

  test('ajustes: só os campos válidos; etapa inexistente sai; percentual "abc" é ignorado sem invalidar', () => {
    const v = alterado((d) => {
      d.ajustes = {
        fabricacao: { status: 'atrasada', percentual: 150, realizadoEm: '2027-02-30', mensagem: '', inicio: '2026-11-10', passos: { rosca: 'concluida', x: 'y' } },
        engenharia: { percentual: 'abc', mensagem: '  Detalhamento liberado.  ' },
        suprimentos: { status: 'atrasada', percentual: 'abc' },
        inexistente: { status: 'concluida' },
        pintura: null,
        montagem: 'texto',
      }
    })
    expect(v.valido).toBe(true)
    expect(v.problemas).toEqual([])
    expect(v.andamento?.ajustes).toEqual({
      fabricacao: { inicio: '2026-11-10', passos: { rosca: 'concluida' } },
      engenharia: { mensagem: 'Detalhamento liberado.' },
    })
    // ajustes fora de objeto: ignorados por inteiro
    expect(alterado((d) => { d.ajustes = 'x' }).andamento?.ajustes).toEqual({})
    expect(alterado((d) => { d.ajustes = [] }).andamento?.ajustes).toEqual({})
    expect(alterado((d) => { delete d.ajustes }).andamento?.ajustes).toEqual({})
    // o cálculo com os ajustes saneados é igual ao cálculo com o JSON bruto na mesma data
    const bruto = alterado((d) => { d.ajustes = { fabricacao: { status: 'atrasada', percentual: 150 } } })
    const fab = (a: unknown) => calcular(a as Andamento, '2026-11-20').etapas.find((e) => e.id === 'fabricacao')!
    expect(fab(bruto.andamento).rotulo).toBe(fab(ANDAMENTO).rotulo)
  })

  test('fotos e atualizações incompletas ou de etapa inexistente saem; o resto vale', () => {
    const v = alterado((d) => {
      d.fotos = [
        { arquivo: 'horizon/fotos/a.webp', data: '2026-11-10', etapa: 'fabricacao', legenda: '  Corte das chapas.  ' },
        { arquivo: 'horizon/fotos/b.webp', data: '2026-11-10', etapa: 'fabricacao', legenda: '' },
        { arquivo: '', data: '2026-11-10', etapa: 'fabricacao' },
        { data: '2026-11-10', etapa: 'fabricacao' },
        { arquivo: 'horizon/fotos/c.webp', data: '2026-11-10', etapa: 'inexistente' },
        { arquivo: 'horizon/fotos/d.webp', data: '2026-11-10' },
      ]
      d.atualizacoes = [
        { data: '2026-11-10', etapa: 'fabricacao', texto: '  Corte iniciado.  ' },
        { data: '2026-11-11', etapa: 'inexistente', texto: 'x' },
        { data: '2026-11-12', etapa: 'fabricacao', texto: '   ' },
        { data: '2026-11-13', etapa: 'fabricacao' },
        { data: '2026-11-14', texto: 'sem etapa' },
      ]
    })
    expect(v.valido).toBe(true)
    expect(v.andamento?.fotos).toEqual([
      { arquivo: 'horizon/fotos/a.webp', data: '2026-11-10', etapa: 'fabricacao', legenda: 'Corte das chapas.' },
      { arquivo: 'horizon/fotos/b.webp', data: '2026-11-10', etapa: 'fabricacao', legenda: undefined },
    ])
    expect(v.andamento?.atualizacoes).toEqual([{ data: '2026-11-10', etapa: 'fabricacao', texto: 'Corte iniciado.' }])
    // listas ausentes: vazias
    const sem = alterado((d) => {
      delete d.fotos
      delete d.atualizacoes
    })
    expect(sem.valido).toBe(true)
    expect(sem.andamento?.fotos).toEqual([])
    expect(sem.andamento?.atualizacoes).toEqual([])
  })

  test('devolve uma cópia: alterar o resultado não muda a entrada', () => {
    const d = copia()
    const a = valido(d)
    a.etapas[0].nome = 'outro'
    a.projeto.cliente = 'x'
    expect(etapas(d)[0].nome).toBe(etapas(ANDAMENTO)[0].nome)
    expect(projeto(d).cliente).toBe('')
    expect(a.etapas[0]).not.toBe(etapas(d)[0])
  })
})

describe('validarAndamento rejeita', () => {
  const invalido = (nome: string, mudar: (d: Json) => unknown, trecho?: RegExp) => {
    const v = alterado(mudar)
    expect(v.valido, nome).toBe(false)
    expect(v.andamento, nome).toBeNull()
    expect(v.problemas.length, nome).toBeGreaterThan(0)
    if (trecho) expect(v.problemas.some((p) => trecho.test(p)), `${nome}: ${v.problemas.join('; ')}`).toBe(true)
    return v
  }

  test('estrutura: nulo, lista, sem projeto, sem etapas', () => {
    expect(validarAndamento(null)).toEqual({ valido: false, problemas: ['andamento ausente'], andamento: null })
    expect(validarAndamento(undefined).valido).toBe(false)
    expect(validarAndamento('texto').valido).toBe(false)
    expect(validarAndamento([]).valido).toBe(false)
    invalido('sem projeto', (d) => { delete d.projeto }, /projeto ausente/)
    invalido('projeto fora de objeto', (d) => { d.projeto = 'x' }, /projeto ausente/)
    invalido('projeto sem confirmadoEm', (d) => { delete projeto(d).confirmadoEm }, /confirmadoEm/)
    invalido('projeto sem entregaLimite', (d) => { delete projeto(d).entregaLimite }, /entregaLimite/)
    invalido('sem etapas', (d) => { delete d.etapas }, /nesta ordem/)
    invalido('etapas vazias', (d) => { d.etapas = [] }, /nesta ordem/)
    invalido('etapas fora de lista', (d) => { d.etapas = {} }, /nesta ordem/)
  })

  test('etapas fora de ordem, faltando ou com ids trocados', () => {
    invalido('fora de ordem', (d) => { d.etapas = etapas(d).reverse() }, /nesta ordem/)
    invalido('duas trocadas', (d) => {
      const e = etapas(d)
      ;[e[3], e[4]] = [e[4], e[3]]
    }, /nesta ordem/)
    invalido('7 etapas', (d) => { etapas(d).pop() }, /nesta ordem/)
    invalido('9 etapas', (d) => { etapas(d).push({ ...etapas(d)[7], id: 'extra' }) }, /nesta ordem/)
    invalido('id trocado', (d) => { etapas(d)[3].id = 'fab' }, /nesta ordem/)
    invalido('id repetido', (d) => { etapas(d)[3].id = 'pintura' }, /nesta ordem/)
    invalido('item fora de objeto', (d) => { etapas(d)[3] = 'x' as unknown as Json }, /nesta ordem/)
    invalido('etapa sem nome', (d) => { etapas(d)[2].nome = '  ' }, /sem nome/)
    invalido('datasPublicas fora da regra', (d) => { etapas(d)[2].datasPublicas = ['meio'] }, /datasPublicas/)
    invalido('datasPublicas em texto', (d) => { etapas(d)[2].datasPublicas = 'fim' }, /datasPublicas/)
    invalido('rotulos fora de objeto', (d) => { etapas(d)[2].rotulos = 'x' }, /rotulos/)
  })

  test('datas fora de aaaa-mm-dd ou impossíveis', () => {
    invalido("fim '10/02/2027' em etapa", (d) => { etapas(d)[3].fim = '10/02/2027' }, /etapa fabricacao\.fim/)
    invalido("início '2027-02-30'", (d) => { etapas(d)[3].inicio = '2027-02-30' }, /etapa fabricacao\.inicio/)
    invalido('início ausente', (d) => { delete etapas(d)[1].inicio }, /etapa engenharia\.inicio/)
    invalido('atualizadoEm inválido', (d) => { d.atualizadoEm = '05/10/2026' }, /atualizadoEm/)
    invalido('atualizadoEm ausente', (d) => { delete d.atualizadoEm }, /atualizadoEm/)
    invalido('confirmadoEm inválido', (d) => { projeto(d).confirmadoEm = '2026-10-5' }, /confirmadoEm/)
    invalido('entregaLimite impossível', (d) => { projeto(d).entregaLimite = '2027-02-29' }, /entregaLimite/)
    // acumula todos os problemas, não para no primeiro
    const v = invalido('vários', (d) => {
      d.atualizadoEm = 'x'
      etapas(d)[0].fim = 'y'
      delete d.projeto
    })
    expect(v.problemas.length).toBeGreaterThanOrEqual(3)
  })

  test('fotos e atualizações fora de lista ou com data inválida invalidam o arquivo', () => {
    invalido('fotos fora de lista', (d) => { d.fotos = {} }, /fotos fora de lista/)
    invalido('fotos em texto', (d) => { d.fotos = 'x' }, /fotos fora de lista/)
    invalido('atualizações fora de lista', (d) => { d.atualizacoes = { a: 1 } }, /atualizacoes fora de lista/)
    invalido('foto com data inválida', (d) => { d.fotos = [{ arquivo: 'horizon/fotos/x.webp', data: '30/09/2026', etapa: 'fabricacao' }] }, /fotos horizon\/fotos\/x\.webp/)
    invalido('foto sem data', (d) => { d.fotos = [{ arquivo: 'horizon/fotos/x.webp', etapa: 'fabricacao' }] }, /fotos/)
    invalido('foto vazia', (d) => { d.fotos = [null] }, /fotos: item vazio/)
    invalido('atualização com data inválida', (d) => { (d.atualizacoes as unknown[]).push({ data: '2026-9-30', etapa: 'fabricacao', texto: 'x' }) }, /atualizacoes x/)
    invalido('atualização impossível', (d) => { (d.atualizacoes as unknown[]).push({ data: '2026-11-31', etapa: 'fabricacao', texto: 'x' }) }, /atualizacoes/)
    invalido('atualização vazia', (d) => { d.atualizacoes = ['x'] }, /atualizacoes: item vazio/)
  })

  test('ajustes nunca invalidam: campos fora da regra são só ignorados', () => {
    for (const aj of [
      { fabricacao: { percentual: 'abc' } },
      { fabricacao: { status: 'atrasada' } },
      { fabricacao: { realizadoEm: '10/02/2027' } },
      { fabricacao: { fim: '2027-02-30' } },
      { inexistente: { status: 'concluida' } },
      { fabricacao: 42 },
    ]) {
      const v = alterado((d) => { d.ajustes = aj })
      expect(v.valido, JSON.stringify(aj)).toBe(true)
      expect(v.andamento?.ajustes, JSON.stringify(aj)).toEqual({})
    }
  })
})

describe('leitura em tempo de execução', () => {
  const resposta = (status: number, corpo: string): Response =>
    ({ ok: status >= 200 && status < 300, status, json: async () => JSON.parse(corpo) as unknown }) as unknown as Response

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  test('enderecoDoAndamento resolve o caminho do JSON contra o documento', () => {
    vi.stubGlobal('document', { baseURI: 'http://teste/sub/pagina/horizon.html' })
    const url = new URL(enderecoDoAndamento())
    expect(url.pathname.endsWith(`/${CAMINHO_ANDAMENTO}`)).toBe(true)
    expect(url.origin).toBe('http://teste')
  })

  test('JSON válido: lerAndamento entrega o andamento saneado e avisa quem assina, com cache: no-cache', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('document', { baseURI: 'http://teste/sub/' })
    vi.stubGlobal('window', {})
    const chamadas: Array<{ url: string; init?: RequestInit }> = []
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      chamadas.push({ url, init })
      return resposta(200, TEXTO_JSON)
    })
    let tardio: Andamento | null = null
    // a leitura nova primeiro: o assinante se liga a ela (antes dela, ligaria uma leitura própria)
    const p = lerAndamento({ novo: true })
    const cancelar = aoChegarAndamento((a) => { tardio = a })
    const a = await p
    expect(a?.etapas.map((e) => e.id)).toEqual([...ETAPAS_DA_PRODUCAO])
    expect(a?.projeto.cliente).toBeUndefined()
    await Promise.resolve()
    await Promise.resolve()
    expect(chamadas).toHaveLength(1)
    expect(chamadas[0].init?.cache).toBe('no-cache')
    expect(new URL(chamadas[0].url).pathname.endsWith(`/${CAMINHO_ANDAMENTO}`)).toBe(true)
    expect(tardio).not.toBeNull()
    cancelar()
  })

  test('404 ou JSON fora da regra: null, uma requisição só, semDados chamado', async () => {
    for (const r of [resposta(404, 'nao encontrado'), resposta(200, JSON.stringify({ atualizadoEm: '05/10/2026', etapas: [] }))]) {
      vi.useFakeTimers()
      vi.stubGlobal('document', { baseURI: 'http://teste/sub/' })
      vi.stubGlobal('window', {})
      let vezes = 0
      vi.stubGlobal('fetch', async () => {
        vezes += 1
        return r
      })
      let semDados = 0
      let comDados = 0
      const p = lerAndamento({ novo: true })
      const cancelar = aoChegarAndamento(() => { comDados += 1 }, () => { semDados += 1 })
      expect(await p).toBeNull()
      await Promise.resolve()
      await Promise.resolve()
      expect(vezes).toBe(1)
      expect(comDados).toBe(0)
      expect(semDados).toBe(1)
      cancelar()
      vi.unstubAllGlobals()
      vi.useRealTimers()
    }
  })

  test('erro de rede: nova tentativa depois de 400 ms e o resultado chega', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('document', { baseURI: 'http://teste/sub/' })
    vi.stubGlobal('window', {})
    let vezes = 0
    vi.stubGlobal('fetch', async () => {
      vezes += 1
      if (vezes === 1) throw new TypeError('sem rede')
      return resposta(200, TEXTO_JSON)
    })
    const p = lerAndamento({ novo: true })
    await vi.advanceTimersByTimeAsync(300)
    expect(vezes).toBe(1)
    await vi.advanceTimersByTimeAsync(200)
    expect(vezes).toBe(2)
    const a = await p
    expect(a?.etapas).toHaveLength(ETAPAS_DA_PRODUCAO.length)
  })

  test('primeira tentativa reaproveita a resposta pedida no <head> (mesmo endereço)', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('document', { baseURI: 'http://teste/sub/' })
    let vezes = 0
    vi.stubGlobal('fetch', async () => {
      vezes += 1
      return resposta(200, TEXTO_JSON)
    })
    const janela: { __andamentoInicial?: { url: string; resposta: Promise<Response | null> } | null } = {
      __andamentoInicial: { url: enderecoDoAndamento(), resposta: Promise.resolve(resposta(200, TEXTO_JSON)) },
    }
    vi.stubGlobal('window', janela)
    const a = await lerAndamento({ novo: true })
    expect(a?.projeto.equipamento).toBe('Dosador Horizon')
    expect(vezes, 'nenhuma requisição nova').toBe(0)
    expect(janela.__andamentoInicial, 'usada uma vez só').toBeNull()
    // outro endereço: ignorada
    janela.__andamentoInicial = { url: 'http://outro/horizon/andamento.json', resposta: Promise.resolve(resposta(404, '')) }
    const b = await lerAndamento({ novo: true })
    expect(b?.projeto.equipamento).toBe('Dosador Horizon')
    expect(vezes).toBe(1)
  })
})
