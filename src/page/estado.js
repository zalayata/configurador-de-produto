// Estado do configurador e sua serialização na URL (tudo no hash: funciona em hospedagem estática).
//   #p=<produto>&e=<etapa>&a=<grupo>:<acabamento>,...&v=<vista>&c=<eixo>:<pos>[:inv]&x=<explodida>&l=1
import { CATALOGO, acabamentosPadrao, produtoPorId } from '../catalog/products.js'
import { ACABAMENTOS } from '../config/acabamentos.js'

export const ETAPAS = [
  { id: 'produto', rotulo: 'Produto', dica: 'Escolha um soprador do catálogo ou importe o seu modelo CAD.' },
  { id: 'acabamento', rotulo: 'Acabamento', dica: 'Defina o acabamento de cada conjunto. Passe o cursor para ver a peça no modelo.' },
  { id: 'resumo', rotulo: 'Resumo', dica: 'Revise, compartilhe e envie a configuração para a equipe comercial.' },
]

const VISTAS = ['iso', 'frente', 'lateral', 'tras', 'topo', 'produto']
const idsAcabamento = new Set(ACABAMENTOS.map((a) => a.id))

export class Estado {
  constructor() {
    this.dados = {
      etapa: 0,
      fonte: 'catalogo', // 'catalogo' | 'importado'
      produtoId: CATALOGO[0].id,
      acabamentos: acabamentosPadrao(CATALOGO[0]),
      importado: null, // { nome, pecas: [{id, nome}] }
      acabamentosImportado: {}, // id da peça -> acabamento
      ocultas: new Set(), // peças ocultas do modelo importado
      // estado do visualizador que viaja na URL
      vista: null,
      corte: null, // { axis, position, inverted }
      explodida: 0,
      etiquetas: false,
      giro: true,
    }
    this.ouvintes = new Set()
  }

  get produto() { return this.dados.fonte === 'catalogo' ? produtoPorId(this.dados.produtoId) : null }

  assinar(cb) { this.ouvintes.add(cb); return () => this.ouvintes.delete(cb) }

  definir(patch, origem = 'ui') {
    Object.assign(this.dados, patch)
    for (const cb of [...this.ouvintes]) cb(this.dados, patch, origem)
  }

  /** Acabamento vigente de um grupo (catálogo) ou peça (importado). */
  acabamentoDe(grupoId) {
    if (this.dados.fonte === 'catalogo') return this.dados.acabamentos[grupoId] || null
    return this.dados.acabamentosImportado[grupoId] || null
  }

  // ------------------------------------------------------------------ URL
  paraHash() {
    const d = this.dados
    const q = new URLSearchParams()
    if (d.fonte === 'catalogo') {
      q.set('p', d.produtoId)
      const padrao = acabamentosPadrao(this.produto)
      const difs = Object.entries(d.acabamentos).filter(([g, a]) => padrao[g] !== a)
      if (difs.length) q.set('a', difs.map(([g, a]) => `${g}:${a}`).join(','))
    }
    if (d.etapa) q.set('e', String(d.etapa + 1))
    if (d.vista && d.vista !== 'produto') q.set('v', d.vista)
    if (d.corte && d.corte.axis) q.set('c', `${d.corte.axis}:${Math.round(d.corte.position * 100) / 100}${d.corte.inverted ? ':inv' : ''}`)
    if (d.explodida) q.set('x', String(Math.round(d.explodida * 100) / 100))
    if (d.etiquetas) q.set('l', '1')
    if (!d.giro) q.set('g', '0')
    const s = q.toString()
    return s ? `#${s}` : ''
  }

  /** Lê o hash; devolve o patch a aplicar (ou null). Aceita o formato antigo (#c=<base64url>). */
  static lerHash(hash = window.location.hash) {
    const bruto = String(hash || '').replace(/^#/, '')
    if (!bruto) return null
    if (bruto.startsWith('c=')) return Estado.lerAntigo(bruto.slice(2))
    const q = new URLSearchParams(bruto)
    const patch = {}
    const produto = produtoPorId(q.get('p'))
    if (produto) {
      patch.fonte = 'catalogo'
      patch.produtoId = produto.id
      const acabamentos = acabamentosPadrao(produto)
      for (const par of (q.get('a') || '').split(',').filter(Boolean)) {
        const [g, a] = par.split(':')
        if (g in acabamentos && idsAcabamento.has(a)) acabamentos[g] = a
      }
      patch.acabamentos = acabamentos
    }
    const e = Number(q.get('e'))
    if (Number.isInteger(e) && e >= 1 && e <= ETAPAS.length) patch.etapa = e - 1
    if (VISTAS.includes(q.get('v'))) patch.vista = q.get('v')
    if (q.get('c')) {
      const [eixo, pos, inv] = q.get('c').split(':')
      if (['x', 'y', 'z'].includes(eixo)) {
        const p = Number(pos)
        patch.corte = { axis: eixo, position: Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0.5, inverted: inv === 'inv' }
      }
    }
    if (q.get('x')) { const x = Number(q.get('x')); if (Number.isFinite(x)) patch.explodida = Math.min(1, Math.max(0, x)) }
    if (q.get('l') === '1') patch.etiquetas = true
    if (q.get('g') === '0') patch.giro = false
    return Object.keys(patch).length ? patch : null
  }

  /** Links gerados pela versão anterior (payload JSON em base64url: { p, g }). */
  static lerAntigo(b64) {
    try {
      const base64 = b64.replace(/-/g, '+').replace(/_/g, '/')
      const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)), (c) => c.charCodeAt(0))))
      const produto = produtoPorId(json.p)
      if (!produto) return null
      const acabamentos = acabamentosPadrao(produto)
      for (const [g, a] of Object.entries(json.g || {})) if (g in acabamentos && idsAcabamento.has(a)) acabamentos[g] = a
      return { fonte: 'catalogo', produtoId: produto.id, acabamentos }
    } catch (e) {
      return null
    }
  }
}
