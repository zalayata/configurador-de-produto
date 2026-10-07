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
import hg80 from './modelos/iduflow-hg80.json'
import hg125v from './modelos/iduflow-hg125v.json'

const mm = (v) => `${v.toLocaleString('pt-BR')} mm`
const dimensoes = (m) => ({
  rotulo: 'Dimensões (C × A × P)',
  valor: `${mm(m.dimensoesMm.comprimento)} × ${mm(m.dimensoesMm.altura)} × ${mm(m.dimensoesMm.profundidade)}`,
})

/**
 * @typedef {object} Produto
 * @property {string} id
 * @property {string} linha
 * @property {string} nome
 * @property {string} nomeCurto
 * @property {string} codigo
 * @property {string} descricao
 * @property {{rotulo: string, valor: string}[]} especificacoes
 * @property {object} manifesto           manifesto do modelo (src/catalog/modelos)
 * @property {Record<string, {acabamento: string}>} grupos  grupos configuráveis e seu acabamento padrão
 */

/** @type {Produto[]} */
export const CATALOGO = [
  {
    id: 'iduflow-hg80',
    linha: 'IduFlow',
    nome: 'Soprador IduFlow HG80',
    nomeCurto: 'HG80',
    codigo: 'HG80',
    descricao:
      'Conjunto soprador de lóbulos com motor de 11 kW, transmissão por correias e base com '
      + 'silenciador de descarga integrado, sobre amortecedores de vibração.',
    especificacoes: [
      { rotulo: 'Motor', valor: '11 kW · 2 polos · montagem B3' },
      { rotulo: 'Transmissão', valor: 'Correias em V, polias SPC 200 × 3' },
      { rotulo: 'Silenciador de descarga', valor: 'Integrado à base' },
      { rotulo: 'Apoio', valor: '6 amortecedores de vibração' },
      dimensoes(hg80),
    ],
    manifesto: hg80,
    grupos: {
      soprador: { acabamento: 'ral-7035' },
      descarga: { acabamento: 'ral-7035' },
      motor: { acabamento: 'ral-7016' },
      'base-motor': { acabamento: 'vinho-idugel' },
      base: { acabamento: 'vinho-idugel' },
    },
  },
  {
    id: 'iduflow-hg125v',
    linha: 'IduFlow',
    nome: 'Soprador IduFlow HG125V',
    nomeCurto: 'HG125V',
    codigo: 'HG125V',
    descricao:
      'Conjunto soprador de lóbulos com motor de 30 kW, base basculante com esticador, proteção '
      + 'das correias, filtro e silenciador de admissão, silenciador de descarga integrado à base, '
      + 'conexão elástica e válvula de retenção na saída.',
    especificacoes: [
      { rotulo: 'Motor', valor: '30 kW · 4 polos · montagem B3' },
      { rotulo: 'Transmissão', valor: 'Correias em V, polias SPC 250 × 3 e SPC 200 × 3' },
      { rotulo: 'Admissão', valor: 'Filtro e silenciador sobre o soprador' },
      { rotulo: 'Descarga', valor: 'Silenciador integrado, conexão elástica e válvula de retenção' },
      { rotulo: 'Apoio', valor: '6 amortecedores de vibração' },
      dimensoes(hg125v),
    ],
    manifesto: hg125v,
    grupos: {
      soprador: { acabamento: 'ral-7035' },
      admissao: { acabamento: 'ral-7035' },
      descarga: { acabamento: 'ral-7035' },
      valvula: { acabamento: 'ral-7035' },
      motor: { acabamento: 'ral-7016' },
      'base-motor': { acabamento: 'vinho-idugel' },
      protecao: { acabamento: 'vinho-idugel' },
      base: { acabamento: 'vinho-idugel' },
    },
  },
]

export const produtoPorId = (id) => CATALOGO.find((p) => p.id === id) || null

/** Grupos do manifesto que recebem acabamento (na ordem do manifesto). */
export const gruposConfiguraveis = (produto) => produto.manifesto.grupos.filter((g) => produto.grupos[g.id])

/** Grupos de acabamento fixo (mantêm o material do modelo). */
export const gruposFixos = (produto) => produto.manifesto.grupos.filter((g) => !produto.grupos[g.id])

export const acabamentosPadrao = (produto) =>
  Object.fromEntries(Object.entries(produto.grupos).map(([id, cfg]) => [id, cfg.acabamento]))

export const urlDoModelo = (produto) => `${import.meta.env.BASE_URL}models/${produto.manifesto.arquivo}`
