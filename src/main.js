// Configurador de produto Idugel — orquestração da página.
// Palco 3D: InstallationViewer (portado do hotsite Chromium), um visualizador por modelo em exibição.
// O 3D entra por import dinâmico (chunk separado) para o carregador mostrar progresso real.
import './style.css'
import folhaDeImpressao from './page/impressao.css?inline'
import { Estado, ETAPAS } from './page/estado.js'
import { CATALOGO, acabamentosPadrao, gruposConfiguraveis, produtoPorId } from './catalog/products.js'
import { acabamentoPorId, aparenciaDe } from './config/acabamentos.js'
import { MARCA } from './config/marca.js'
import { $, $$, copiar, doisDigitos, esc, faixaDeTela, movimentoReduzido } from './page/util.js'
import { Atmosfera } from './page/atmos.js'
import { htmlAcabamento, htmlImpressao, htmlProduto, htmlResumo, textoResumo } from './page/render.js'

const raiz = document.documentElement
const consulta = new URLSearchParams(window.location.search)
// ?movimento=reduzido força o modo sem animações (capturas de referência e testes)
const reduzido = movimentoReduzido() || consulta.get('movimento') === 'reduzido'

// ---------------------------------------------------------------------- folha de impressão
{
  const estilo = document.createElement('style')
  estilo.media = consulta.get('impressao') === '1' ? 'all' : 'print'
  estilo.textContent = folhaDeImpressao
  document.head.appendChild(estilo)
  if (consulta.get('impressao') === '1') raiz.classList.add('simula-impressao')
}

// ---------------------------------------------------------------------- carregador (percentual real)
const PESOS = { fontes: 0.12, modulos: 0.3, modelo: 0.43, quadro: 0.15 }
class Carregador {
  constructor() {
    this.el = $('#carregador')
    this.pct = $('#car-pct')
    this.barra = $('#car-barra')
    this.etapa = $('#car-etapa')
    this.fracoes = { fontes: 0, modulos: 0, modelo: 0, quadro: 0 }
    this.mostrado = 0
    this.inicio = performance.now()
    this.raf = 0
    this.animar = this.animar.bind(this)
    this.raf = requestAnimationFrame(this.animar)
  }

  progresso(etapa, fracao, texto) {
    this.fracoes[etapa] = Math.max(this.fracoes[etapa], Math.min(1, Math.max(0, fracao)))
    if (texto) this.etapa.textContent = texto
    if (!this.raf) this.raf = requestAnimationFrame(this.animar)
  }

  get alvo() {
    return Object.entries(PESOS).reduce((s, [k, p]) => s + p * this.fracoes[k], 0)
  }

  animar() {
    this.raf = 0
    const alvo = this.alvo
    this.mostrado += (alvo - this.mostrado) * (reduzido ? 1 : 0.12)
    if (Math.abs(alvo - this.mostrado) < 0.002) this.mostrado = alvo
    const n = Math.round(this.mostrado * 100)
    this.pct.textContent = String(n).padStart(3, '0')
    this.barra.style.width = `${(this.mostrado * 100).toFixed(1)}%`
    if (this.mostrado !== alvo) this.raf = requestAnimationFrame(this.animar)
  }

  async concluir() {
    for (const k of Object.keys(this.fracoes)) this.fracoes[k] = 1
    this.animar()
    const restante = Math.max(0, 900 - (performance.now() - this.inicio))
    await new Promise((r) => setTimeout(r, reduzido ? 0 : restante + 200))
    this.el.classList.add('saindo')
    raiz.removeAttribute('data-carregando')
    setTimeout(() => { this.el.hidden = true }, 700)
  }

  falhar(mensagem) {
    this.etapa.textContent = mensagem
    this.etapa.classList.add('car-etapa--ambar')
  }
}

// ---------------------------------------------------------------------- palco: um visualizador por modelo
class Palco {
  constructor(host) {
    this.host = host
    this.viewer = null
    this.modelo = null
    this.tela = null
    this.modulos = null
    this.ouvintes = []
  }

  async carregarModulos(aoProgresso) {
    if (this.modulos) return this.modulos
    let prontos = 0
    const contar = (p) => p.then((m) => { prontos += 1; aoProgresso(prontos / 2); return m })
    const [three, viewer] = await Promise.all([contar(import('three')), contar(import('./viewer.js'))])
    this.modulos = { THREE: three, InstallationViewer: viewer.InstallationViewer }
    return this.modulos
  }

  /** Troca o modelo em exibição com fusão (a tela anterior esmaece enquanto a nova entra). */
  async mostrar(modelo, { vista = 'produto', estadoInicial = null } = {}) {
    const { InstallationViewer } = await this.carregarModulos(() => {})
    const anterior = { viewer: this.viewer, tela: this.tela, modelo: this.modelo }
    const tela = document.createElement('div')
    tela.className = 'palco-tela palco-tela--entrando'
    this.host.appendChild(tela)
    const viewer = new InstallationViewer(tela, { model: modelo, reducedMotion: reduzido ? true : 'auto', logoUrl: MARCA.logo, view: vista })
    this.viewer = viewer
    this.tela = tela
    this.modelo = modelo
    viewer.setInteractive(true)
    if (estadoInicial) viewer.applyState(estadoInicial, { immediate: true })
    await viewer.ready
    // a nova tela entra quando já tem imagem; a anterior sai junto
    requestAnimationFrame(() => {
      tela.classList.remove('palco-tela--entrando')
      if (anterior.tela) anterior.tela.classList.add('palco-tela--saindo')
    })
    if (anterior.viewer) {
      setTimeout(() => {
        anterior.viewer.dispose()
        anterior.modelo?.dispose?.()
        anterior.tela.remove()
      }, reduzido ? 0 : 450)
    }
    return viewer
  }
}

// ---------------------------------------------------------------------- aplicação
class App {
  constructor() {
    this.estado = new Estado()
    this.carregador = new Carregador()
    this.palco = new Palco($('#palco-3d'))
    this.atmos = new Atmosfera({ tras: $('#atmos-tras'), frente: $('#atmos-frente'), grao: $('.palco-grao'), reduzido })
    this.painelConteudo = $('#painel-conteudo')
    this.aviso = $('#aviso')
    this.faixa = faixaDeTela()
    this.modelosImportados = new Map()
    this.ligarEventos()
  }

  // ------------------------------------------------------------------ início
  async iniciar() {
    const patch = Estado.lerHash()
    if (patch) this.estado.definir(patch, 'url')
    this.renderizarIndicadores()
    this.renderizarEtapa({ animar: false })
    this.atmos.ligar(true)
    this.atmos.definir({ farinha: 0.7, feixe: 1 }, 0.8)

    try {
      this.carregador.progresso('fontes', 0.2, 'Carregando fontes')
      await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1500))])
      this.carregador.progresso('fontes', 1)
      this.carregador.progresso('modulos', 0.05, 'Preparando o visualizador')
      await this.palco.carregarModulos((f) => this.carregador.progresso('modulos', f))
      this.carregador.progresso('modelo', 0.02, 'Carregando o modelo do projeto')
      await this.mostrarProdutoAtual({ inicial: true })
      this.carregador.progresso('quadro', 1, 'Acendendo as luzes')
      await this.carregador.concluir()
      this.entradaDoTitulo()
    } catch (e) {
      console.error(e)
      this.carregador.falhar('Visualização 3D indisponível neste dispositivo. O painel de configuração continua disponível.')
      setTimeout(() => this.carregador.concluir(), 1800)
    }
    window.__READY = true
    window.__app = this
  }

  // ------------------------------------------------------------------ modelo em exibição
  async mostrarProdutoAtual({ inicial = false } = {}) {
    const d = this.estado.dados
    let modelo
    if (d.fonte === 'importado' && d.importado) {
      modelo = this.modelosImportados.get(d.importado.nome)
      if (!modelo) { this.estado.definir({ fonte: 'catalogo' }, 'app'); return this.mostrarProdutoAtual({ inicial }) }
    } else {
      const produto = this.estado.produto || CATALOGO[0]
      const { construirModeloCatalogo } = await import('./model/catalogo.js')
      modelo = await construirModeloCatalogo(produto, {
        aoProgresso: (f) => { if (inicial) this.carregador.progresso('modelo', 0.05 + 0.9 * f) },
      })
      if (inicial) this.carregador.progresso('modelo', 1)
    }
    const estadoInicial = {
      cut: d.corte, explode: d.explodida, autoRotate: false,
      ...(d.vista ? { view: d.vista } : {}),
    }
    const viewer = await this.palco.mostrar(modelo, { vista: d.vista || 'produto', estadoInicial })
    this.viewer = viewer
    this.aplicarAcabamentos({ animar: false })
    this.aplicarVisibilidade()
    this.atualizarEtiquetas()
    this.atualizarEnquadre()
    this.atualizarInfoExportacao()
    viewer.on('select', (sel) => this.aoSelecionarNoModelo(sel))
    viewer.on('statechange', (s) => this.aoMudarVisualizador(s))
    this.aplicarCameraDaEtapa({ imediato: inicial })
    this.sincronizarFerramentas()
    this.atualizarTitulos()
    return viewer
  }

  aplicarAcabamentos({ animar = true, somente = null } = {}) {
    if (!this.viewer) return
    const d = this.estado.dados
    const pares = d.fonte === 'catalogo' && this.estado.produto
      ? Object.entries(d.acabamentos)
      : Object.entries(d.acabamentosImportado)
    for (const [grupo, id] of pares) {
      if (somente && grupo !== somente) continue
      this.viewer.setGroupAppearance(grupo, aparenciaDe(acabamentoPorId(id)), { animate: animar })
    }
  }

  aplicarVisibilidade() {
    if (!this.viewer || this.estado.dados.fonte !== 'importado') return
    for (const p of this.estado.dados.importado.pecas) this.viewer.setGroupVisible(p.id, !this.estado.dados.ocultas.has(p.id))
  }

  atualizarInfoExportacao() {
    if (!this.viewer) return
    const d = this.estado.dados
    const produto = this.estado.produto
    const hoje = new Date().toLocaleDateString('pt-BR')
    if (produto) {
      this.viewer.setExportInfo({
        titulo: produto.nome,
        subtitulo: `Linha ${produto.linha} · ${produto.codigo} · ${MARCA.empresa}`,
        nota: `Configuração gerada no configurador Idugel em ${hoje}.`,
        cabecalhoLegenda: 'ACABAMENTOS',
        legenda: gruposConfiguraveis(produto).map((g) => {
          const a = acabamentoPorId(d.acabamentos[g.id])
          return { cor: a.cor, rotulo: `${g.rotulo} — ${a.rotulo}` }
        }),
      })
    } else if (d.importado) {
      this.viewer.setExportInfo({
        titulo: d.importado.nome,
        subtitulo: `Modelo importado · ${MARCA.empresa}`,
        nota: `Configuração gerada no configurador Idugel em ${hoje}.`,
        cabecalhoLegenda: 'PEÇAS PERSONALIZADAS',
        legenda: d.importado.pecas.filter((p) => d.acabamentosImportado[p.id]).slice(0, 8).map((p) => {
          const a = acabamentoPorId(d.acabamentosImportado[p.id])
          return { cor: a.cor, rotulo: `${p.nome} — ${a.rotulo}` }
        }),
      })
    }
  }

  // ------------------------------------------------------------------ câmera por etapa
  aplicarCameraDaEtapa({ imediato = false } = {}) {
    if (!this.viewer) return
    const d = this.estado.dados
    const etapa = ETAPAS[d.etapa].id
    if (d.vista && etapa !== 'acabamento') {
      this.viewer.setView(d.vista, { immediate: imediato })
    } else {
      const vista = etapa === 'acabamento' ? 'iso' : 'produto'
      this.viewer.setView(vista, { immediate: imediato, duration: 1.5 })
    }
    this.viewer.setAutoRotate(d.giro && etapa !== 'acabamento')
    this.atmos.definir(etapa === 'acabamento' ? { farinha: 0.25, feixe: 0 } : { farinha: 0.7, feixe: 1 }, etapa === 'resumo' ? 0.5 : 0.8)
    raiz.dataset.cenario = etapa
  }

  atualizarEnquadre() {
    if (!this.viewer) return
    this.faixa = faixaDeTela()
    // painel à direita no desktop: o objeto centra na área livre à esquerda
    const x = this.faixa === 'empilhada' ? 0 : -0.13
    this.viewer.setFraming({ x, y: 0 }, { duration: 0.6 })
    const painel = $('#painel').getBoundingClientRect()
    const area = this.faixa === 'empilhada'
      ? { esq: 12, topo: 64, dir: 12, base: 12 }
      : { esq: 110, topo: 96, dir: Math.max(0, window.innerWidth - painel.left) + 16, base: 84 }
    this.viewer.setLabelLayout({ area, compacto: this.faixa === 'empilhada' })
  }

  atualizarEtiquetas() {
    if (!this.viewer) return
    const d = this.estado.dados
    const etapa = ETAPAS[d.etapa].id
    const ligadas = d.etiquetas || etapa === 'acabamento'
    if (!ligadas) { this.viewer.setLabels(null); return }
    let lista
    if (d.fonte === 'catalogo' && this.estado.produto) {
      lista = gruposConfiguraveis(this.estado.produto).map((g, i) => ({ anchor: g.id, text: g.rotulo, short: doisDigitos(i + 1) }))
    } else if (d.importado) {
      lista = d.importado.pecas.filter((p) => !d.ocultas.has(p.id)).slice(0, 10).map((p, i) => ({ anchor: p.id, text: p.nome, short: doisDigitos(i + 1) }))
    }
    this.viewer.setLabels(lista || null)
  }

  // ------------------------------------------------------------------ títulos atrás do objeto
  atualizarTitulos() {
    const d = this.estado.dados
    const produto = this.estado.produto
    const linha = produto ? produto.linha : 'Importado'
    const modelo = produto ? produto.nomeCurto : (d.importado?.nome || '').replace(/\.[^.]+$/, '')
    this.trocarTexto($('.tras--linha .tras-texto'), linha.toUpperCase())
    this.trocarTexto($('.tras--modelo .tras-texto'), modelo.toUpperCase())
    $('#cena-titulo-texto').textContent = produto ? produto.nome : (d.importado?.nome || 'Modelo importado')
    $('#cena-lead').textContent = produto ? produto.descricao : `${d.importado?.pecas.length || 0} peças reconhecidas no arquivo.`
  }

  trocarTexto(el, texto) {
    if (!el || el.textContent === texto) return
    el.classList.add('saindo')
    setTimeout(() => {
      el.textContent = texto
      el.classList.remove('saindo')
    }, reduzido ? 0 : 260)
  }

  entradaDoTitulo() {
    $('#titulos-tras').classList.add('visivel')
    $('#cena').classList.add('visivel')
  }

  // ------------------------------------------------------------------ etapas
  renderizarIndicadores() {
    const nav = $('#indicadores')
    nav.innerHTML = `<ol class="indicadores-lista">${ETAPAS.map((e, i) => `
      <li><button type="button" class="indicador" data-etapa="${i}" aria-label="Etapa ${i + 1}: ${esc(e.rotulo)}">
        <svg class="indicador-arco" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="20" /></svg>
        <span class="indicador-num" aria-hidden="true">${doisDigitos(i + 1)}</span>
        <span class="indicador-rotulo" aria-hidden="true">${esc(e.rotulo)}</span>
      </button></li>`).join('')}</ol>`
  }

  irParaEtapa(n) {
    const etapa = Math.max(0, Math.min(ETAPAS.length - 1, n))
    if (etapa === this.estado.dados.etapa) return
    this.estado.definir({ etapa }, 'ui')
    this.renderizarEtapa({ animar: true })
    this.aplicarCameraDaEtapa()
    this.atualizarEtiquetas()
    this.viewer?.highlightGroup(null)
  }

  renderizarEtapa({ animar = true } = {}) {
    const d = this.estado.dados
    const etapa = ETAPAS[d.etapa]
    raiz.dataset.etapa = etapa.id
    $$('.indicador').forEach((b, i) => {
      b.classList.toggle('ativo', i === d.etapa)
      b.classList.toggle('feito', i < d.etapa)
      if (i === d.etapa) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current')
    })
    $('#claquete-num').textContent = `${doisDigitos(d.etapa + 1)} / ${doisDigitos(ETAPAS.length)}`
    $('#claquete-nome').textContent = etapa.rotulo
    $('#painel-sobre').textContent = `Etapa ${d.etapa + 1} de ${ETAPAS.length}`
    $('#painel-titulo').textContent = etapa.rotulo
    $('#painel-dica').textContent = etapa.dica
    $('#botao-voltar').disabled = d.etapa === 0
    $('#botao-avancar').hidden = d.etapa === ETAPAS.length - 1
    const html = etapa.id === 'produto' ? htmlProduto(this.estado) : etapa.id === 'acabamento' ? htmlAcabamento(this.estado) : htmlResumo(this.estado)
    const c = this.painelConteudo
    if (animar && !reduzido) {
      c.classList.add('trocando')
      setTimeout(() => { c.innerHTML = html; c.scrollTop = 0; c.classList.remove('trocando') }, 180)
    } else {
      c.innerHTML = html
      c.scrollTop = 0
    }
    this.atualizarHash()
  }

  // ------------------------------------------------------------------ produto e acabamento
  async escolherProduto(id) {
    const produto = produtoPorId(id)
    if (!produto) return
    const d = this.estado.dados
    const mesmo = d.fonte === 'catalogo' && d.produtoId === id
    this.estado.definir({ fonte: 'catalogo', produtoId: id, acabamentos: mesmo ? d.acabamentos : acabamentosPadrao(produto) }, 'ui')
    this.renderizarEtapa({ animar: false })
    if (mesmo) return
    this.mostrarCarregando('Carregando o modelo do projeto…')
    try {
      await this.mostrarProdutoAtual()
      this.avisar(`${produto.nome} em exibição.`)
    } catch (e) {
      console.error(e)
      this.avisar('Não foi possível carregar o modelo do catálogo.')
    } finally {
      this.esconderCarregando()
    }
  }

  definirAcabamento(grupo, acabamentoId) {
    const d = this.estado.dados
    if (d.fonte === 'catalogo') {
      if (!(grupo in d.acabamentos)) return
      this.estado.definir({ acabamentos: { ...d.acabamentos, [grupo]: acabamentoId } }, 'ui')
    } else {
      this.estado.definir({ acabamentosImportado: { ...d.acabamentosImportado, [grupo]: acabamentoId } }, 'ui')
    }
    this.aplicarAcabamentos({ animar: true, somente: grupo })
    this.atualizarInfoExportacao()
    // atualiza só o que mudou no painel (sem redesenhar a lista)
    const a = acabamentoPorId(acabamentoId)
    $$(`.amostra[data-grupo="${CSS.escape(grupo)}"]`).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.acabamento === acabamentoId)))
    const atual = $(`[data-atual="${CSS.escape(grupo)}"]`)
    if (atual) atual.textContent = a.rotulo
    const ponto = $(`.peca[data-peca="${CSS.escape(grupo)}"] .peca-ponto`)
    if (ponto) ponto.style.setProperty('--amostra', a.amostra)
    this.atualizarHash()
  }

  restaurarAcabamentos() {
    const produto = this.estado.produto
    if (!produto) return
    this.estado.definir({ acabamentos: acabamentosPadrao(produto) }, 'ui')
    this.aplicarAcabamentos({ animar: true })
    this.atualizarInfoExportacao()
    this.renderizarEtapa({ animar: false })
  }

  focarGrupo(grupo) {
    if (!this.viewer) return
    this.viewer.focusGroup(grupo, { duration: 1.1 })
    this.viewer.highlightGroup(grupo)
    // o giro automático pausa enquanto se olha a peça; volta na próxima etapa, sem mudar a preferência
    this.viewer.setAutoRotate(false)
    const nome = this.palco.modelo?.labels?.[grupo]
    if (nome) this.avisar(nome, 1600)
  }

  aoSelecionarNoModelo(sel) {
    if (!sel?.groupId) return
    const d = this.estado.dados
    if (ETAPAS[d.etapa].id !== 'acabamento') {
      this.avisar(sel.label, 1800)
      return
    }
    if (d.fonte === 'importado') {
      this.estado.definir({ pecaSelecionada: sel.groupId }, 'ui')
      this.renderizarEtapa({ animar: false })
    }
    const secao = $(`.grupo[data-grupo="${CSS.escape(sel.groupId)}"], .peca[data-peca="${CSS.escape(sel.groupId)}"]`)
    if (secao) {
      secao.scrollIntoView({ behavior: reduzido ? 'auto' : 'smooth', block: 'center' })
      secao.classList.add('piscar')
      setTimeout(() => secao.classList.remove('piscar'), 900)
    }
    this.viewer.highlightGroup(sel.groupId)
  }

  // ------------------------------------------------------------------ importação
  async importar(arquivo) {
    if (!arquivo) return
    const { EXTENSOES, extensaoDe, construirModeloImportado } = await import('./model/importado.js')
    if (!EXTENSOES.includes(extensaoDe(arquivo.name))) {
      this.avisar(`Formato ".${extensaoDe(arquivo.name)}" não suportado. Exporte como STEP, ou use GLB, STL e OBJ.`, 6000)
      return
    }
    this.mostrarCarregando(`Convertendo ${arquivo.name} no seu navegador…`)
    const inicio = performance.now()
    try {
      const modelo = await construirModeloImportado(arquivo)
      this.modelosImportados.set(arquivo.name, modelo)
      this.estado.definir({
        fonte: 'importado',
        importado: { nome: arquivo.name, pecas: modelo.pecas },
        acabamentosImportado: {},
        ocultas: new Set(),
        pecaSelecionada: null,
        filtroPecas: '',
        etapa: 1,
      }, 'ui')
      await this.mostrarProdutoAtual()
      this.renderizarEtapa({ animar: true })
      this.aplicarCameraDaEtapa()
      this.atualizarEtiquetas()
      this.avisar(`Modelo importado: ${modelo.pecas.length} peça(s) em ${((performance.now() - inicio) / 1000).toFixed(1)} s.`, 4000)
    } catch (e) {
      console.error(e)
      this.avisar(e instanceof Error ? e.message : 'Não foi possível importar o arquivo.', 7000)
    } finally {
      this.esconderCarregando()
    }
  }

  async removerImportado() {
    const d = this.estado.dados
    if (!d.importado) return
    const modelo = this.modelosImportados.get(d.importado.nome)
    this.modelosImportados.delete(d.importado.nome)
    const estavaEmExibicao = d.fonte === 'importado'
    this.estado.definir({ importado: null, acabamentosImportado: {}, ocultas: new Set(), pecaSelecionada: null, fonte: 'catalogo' }, 'ui')
    if (estavaEmExibicao) {
      this.mostrarCarregando('Carregando o modelo do projeto…')
      try { await this.mostrarProdutoAtual() } finally { this.esconderCarregando() }
    } else modelo?.dispose?.()
    this.renderizarEtapa({ animar: false })
  }

  alternarPeca(id) {
    const d = this.estado.dados
    const ocultas = new Set(d.ocultas)
    if (ocultas.has(id)) ocultas.delete(id); else ocultas.add(id)
    this.estado.definir({ ocultas }, 'ui')
    this.viewer?.setGroupVisible(id, !ocultas.has(id))
    this.atualizarEtiquetas()
    this.renderizarEtapa({ animar: false })
  }

  // ------------------------------------------------------------------ ferramentas do modelo
  sincronizarFerramentas() {
    const d = this.estado.dados
    const s = this.viewer?.getState() || {}
    $('[data-acao="giro"]').setAttribute('aria-pressed', String(!!d.giro))
    $('[data-acao="etiquetas"]').setAttribute('aria-pressed', String(!!d.etiquetas))
    $$('.ex-vista').forEach((b) => b.setAttribute('aria-checked', String((s.view || (d.vista ?? 'produto')) === b.dataset.vista)))
    const corte = s.cut || null
    $$('[data-corte]').forEach((b) => b.setAttribute('aria-checked', String(corte ? b.dataset.corte === corte.axis : b.dataset.corte === 'nenhum')))
    $('[data-acao="inverter-corte"]').setAttribute('aria-pressed', String(!!corte?.inverted))
    const pos = $('#corte-posicao')
    pos.disabled = !corte
    if (corte) pos.value = String(corte.position)
    $('#corte-leitura').textContent = corte ? `${corte.axis.toUpperCase()} ${Math.round(corte.position * 100)}%` : ''
    $('#explodida').value = String(s.explode ?? d.explodida ?? 0)
    $('#explodida-leitura').textContent = `${Math.round((s.explode ?? d.explodida ?? 0) * 100)}%`
  }

  aoMudarVisualizador(s) {
    const patch = {}
    patch.vista = s.view || null
    patch.corte = s.cut || null
    patch.explodida = s.explode || 0
    this.estado.definir(patch, 'viewer')
    this.sincronizarFerramentas()
    this.atualizarHash()
  }

  alternarExplorar(abrir) {
    const botao = $('[data-acao="explorar"]')
    const painel = $('#explorar')
    const aberto = abrir ?? painel.hidden
    painel.hidden = !aberto
    botao.setAttribute('aria-expanded', String(aberto))
    raiz.classList.toggle('explorando', aberto)
    if (aberto) this.sincronizarFerramentas()
  }

  // ------------------------------------------------------------------ saídas
  async exportarPng() {
    if (!this.viewer) return
    try {
      await this.viewer.exportPNG({ withLegend: true, download: true })
      this.avisar('Imagem gerada.')
    } catch (e) {
      console.error(e)
      this.avisar('Não foi possível gerar a imagem.')
    }
  }

  linkAtual() {
    const { origin, pathname } = window.location
    return `${origin}${pathname}${this.estado.paraHash()}`
  }

  async copiarLink() {
    if (this.estado.dados.fonte !== 'catalogo') { this.avisar('O link compartilhável vale para produtos do catálogo.'); return }
    const ok = await copiar(this.linkAtual())
    this.avisar(ok ? 'Link copiado.' : 'Não foi possível copiar. Copie o endereço da barra do navegador.')
  }

  async copiarResumo() {
    const ok = await copiar(textoResumo(this.estado, this.estado.dados.fonte === 'catalogo' ? this.linkAtual() : null))
    this.avisar(ok ? 'Resumo copiado.' : 'Não foi possível copiar o resumo.')
  }

  async imprimir() {
    let imagem = null
    try {
      if (this.viewer) imagem = (await this.viewer.exportPNG({ withLegend: false, download: false, scale: 2 })).dataURL
    } catch (e) { /* a ficha sai sem imagem */ }
    $('#folha-impressao').innerHTML = htmlImpressao(this.estado, imagem)
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
  }

  atualizarHash() {
    clearTimeout(this._tHash)
    this._tHash = setTimeout(() => {
      const hash = this.estado.dados.fonte === 'catalogo' ? this.estado.paraHash() : ''
      const atual = window.location.hash
      if (hash !== atual) history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`)
    }, 120)
  }

  // ------------------------------------------------------------------ avisos e carregamento
  avisar(texto, ms = 2400) {
    this.aviso.textContent = texto
    this.aviso.classList.add('visivel')
    clearTimeout(this._tAviso)
    this._tAviso = setTimeout(() => this.aviso.classList.remove('visivel'), ms)
  }

  mostrarCarregando(texto) {
    $('#carregando-texto').textContent = texto
    $('#carregando').hidden = false
  }

  esconderCarregando() { $('#carregando').hidden = true }

  // ------------------------------------------------------------------ eventos
  ligarEventos() {
    document.addEventListener('click', (e) => {
      const alvo = e.target.closest('[data-acao], [data-produto], [data-etapa], [data-vista], [data-corte], .amostra')
      if (!alvo) return
      if (alvo.dataset.produto) return this.escolherProduto(alvo.dataset.produto)
      if (alvo.dataset.etapa !== undefined) return this.irParaEtapa(Number(alvo.dataset.etapa))
      if (alvo.dataset.vista) return this.definirVista(alvo.dataset.vista)
      if (alvo.dataset.corte) return this.definirCorte(alvo.dataset.corte)
      if (alvo.classList.contains('amostra')) return this.definirAcabamento(alvo.dataset.grupo, alvo.dataset.acabamento)
      switch (alvo.dataset.acao) {
        case 'voltar': return this.irParaEtapa(this.estado.dados.etapa - 1)
        case 'avancar': return this.irParaEtapa(this.estado.dados.etapa + 1)
        case 'importar': return $('#arquivo').click()
        case 'ver-importado': this.estado.definir({ fonte: 'importado' }, 'ui'); this.renderizarEtapa({ animar: false }); return this.trocarParaImportado()
        case 'remover-importado': return this.removerImportado()
        case 'focar-grupo': return this.focarGrupo(alvo.dataset.grupo)
        case 'restaurar-acabamentos': return this.restaurarAcabamentos()
        case 'selecionar-peca': {
          const id = alvo.dataset.peca
          this.estado.definir({ pecaSelecionada: this.estado.dados.pecaSelecionada === id ? null : id }, 'ui')
          this.renderizarEtapa({ animar: false })
          if (this.estado.dados.pecaSelecionada) this.focarGrupo(id); else this.viewer?.highlightGroup(null)
          return
        }
        case 'alternar-peca': return this.alternarPeca(alvo.dataset.peca)
        case 'restaurar-peca': {
          const ac = { ...this.estado.dados.acabamentosImportado }
          delete ac[alvo.dataset.peca]
          this.estado.definir({ acabamentosImportado: ac }, 'ui')
          return this.trocarParaImportado({ recarregar: true })
        }
        case 'restaurar-importado':
          this.estado.definir({ acabamentosImportado: {}, ocultas: new Set() }, 'ui')
          return this.trocarParaImportado({ recarregar: true })
        case 'explorar': return this.alternarExplorar()
        case 'giro': {
          const giro = !this.estado.dados.giro
          this.estado.definir({ giro }, 'ui')
          this.viewer?.setAutoRotate(giro && ETAPAS[this.estado.dados.etapa].id !== 'acabamento')
          return this.sincronizarFerramentas()
        }
        case 'etiquetas': {
          this.estado.definir({ etiquetas: !this.estado.dados.etiquetas }, 'ui')
          this.atualizarEtiquetas()
          this.sincronizarFerramentas()
          return this.atualizarHash()
        }
        case 'reenquadrar': this.estado.definir({ vista: null }, 'ui'); return this.aplicarCameraDaEtapa()
        case 'inverter-corte': {
          const c = this.viewer?.getState().cut
          if (c) this.viewer.setCut({ ...c, inverted: !c.inverted })
          return
        }
        case 'restaurar-vista':
          this.viewer?.setCut({ axis: null })
          this.viewer?.setExplode(0)
          this.estado.definir({ vista: null, corte: null, explodida: 0 }, 'ui')
          this.aplicarCameraDaEtapa()
          return this.sincronizarFerramentas()
        case 'png': return this.exportarPng()
        case 'link': return this.copiarLink()
        case 'copiar-resumo': return this.copiarResumo()
        case 'imprimir': return this.imprimir()
        default:
      }
    })

    // realce ao passar o cursor pelos grupos do painel
    this.painelConteudo.addEventListener('pointerover', (e) => {
      const g = e.target.closest('.grupo[data-grupo], .peca[data-peca]')
      if (!g || !this.viewer) return
      this.viewer.highlightGroup(g.dataset.grupo || g.dataset.peca)
    })
    this.painelConteudo.addEventListener('pointerleave', () => {
      if (!this.viewer) return
      this.viewer.highlightGroup(this.estado.dados.pecaSelecionada || null)
    })
    this.painelConteudo.addEventListener('input', (e) => {
      if (e.target.id !== 'filtro-pecas') return
      const q = e.target.value.trim().toLowerCase()
      this.estado.dados.filtroPecas = q
      $$('#lista-pecas .peca').forEach((li) => { li.hidden = !!q && !li.dataset.nome.includes(q) })
    })

    $('#corte-posicao').addEventListener('input', (e) => {
      const c = this.viewer?.getState().cut
      if (c) this.viewer.setCut({ ...c, position: Number(e.target.value) }, { animate: false })
    })
    $('#explodida').addEventListener('input', (e) => {
      this.viewer?.setExplode(Number(e.target.value), { animate: false })
    })

    $('#arquivo').addEventListener('change', (e) => {
      const f = e.target.files?.[0]
      if (f) this.importar(f)
      e.target.value = ''
    })

    // arrastar e soltar
    let profundidade = 0
    const soltar = $('#soltar')
    window.addEventListener('dragenter', (e) => { if (!e.dataTransfer?.types.includes('Files')) return; profundidade += 1; soltar.hidden = false })
    window.addEventListener('dragleave', () => { profundidade = Math.max(0, profundidade - 1); if (!profundidade) soltar.hidden = true })
    window.addEventListener('dragover', (e) => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault() })
    window.addEventListener('drop', (e) => {
      if (!e.dataTransfer?.files.length) return
      e.preventDefault()
      profundidade = 0
      soltar.hidden = true
      this.importar(e.dataTransfer.files[0])
    })

    // teclado: setas trocam de etapa, E abre Explorar, Esc fecha
    document.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); this.irParaEtapa(this.estado.dados.etapa + 1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); this.irParaEtapa(this.estado.dados.etapa - 1) }
      else if (e.key === 'e' || e.key === 'E') this.alternarExplorar()
      else if (e.key === 'Escape' && !$('#explorar').hidden) this.alternarExplorar(false)
    })

    window.addEventListener('resize', () => {
      clearTimeout(this._tResize)
      this._tResize = setTimeout(() => { this.atmos.medir(); this.atualizarEnquadre() }, 120)
    })
    window.addEventListener('hashchange', () => {
      const patch = Estado.lerHash()
      if (!patch || patch.produtoId === undefined) return
      if (patch.produtoId !== this.estado.dados.produtoId || this.estado.dados.fonte !== 'catalogo') {
        this.estado.definir(patch, 'url')
        this.renderizarEtapa({ animar: false })
        this.mostrarProdutoAtual()
      }
    })
  }

  async trocarParaImportado({ recarregar = false } = {}) {
    if (this.estado.dados.fonte !== 'importado') return
    if (!recarregar && this.palco.modelo?.id === 'importado') return
    if (recarregar && this.palco.modelo?.id === 'importado') {
      // só reaplica cores e visibilidade no modelo que já está na tela
      const modelo = this.palco.modelo
      for (const p of modelo.pecas) {
        const ac = this.estado.dados.acabamentosImportado[p.id]
        if (ac) this.viewer.setGroupAppearance(p.id, aparenciaDe(acabamentoPorId(ac)))
        else {
          const m = modelo.root.getObjectByName(p.id)?.children?.[0]?.material
          if (m) this.viewer.setGroupAppearance(p.id, { cor: `#${m.color.getHexString()}`, metalico: m.metalness, rugoso: m.roughness, intensidadeAmbiente: 0.8 })
        }
      }
      this.aplicarVisibilidade()
      this.atualizarInfoExportacao()
      this.renderizarEtapa({ animar: false })
      return
    }
    this.mostrarCarregando('Preparando o modelo importado…')
    try { await this.mostrarProdutoAtual() } finally { this.esconderCarregando() }
  }

  definirVista(vista) {
    this.estado.definir({ vista }, 'ui')
    this.viewer?.setView(vista)
    this.sincronizarFerramentas()
  }

  definirCorte(eixo) {
    if (!this.viewer) return
    if (eixo === 'nenhum') this.viewer.setCut({ axis: null })
    else {
      const c = this.viewer.getState().cut
      this.viewer.setCut({ axis: eixo, position: c?.position ?? 0.5, inverted: c?.inverted ?? false })
    }
    this.sincronizarFerramentas()
  }
}

const app = new App()
app.iniciar()
