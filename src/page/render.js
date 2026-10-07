// HTML das etapas, da ficha de impressão e do resumo em texto. Só monta marcação: o conteúdo vem
// do catálogo (products.js + manifestos), dos acabamentos e do estado.
import { CATALOGO, gruposConfiguraveis, gruposFixos } from '../catalog/products.js'
import { ACABAMENTOS, acabamentoPorId } from '../config/acabamentos.js'
import { MARCA } from '../config/marca.js'
import { esc, num } from './util.js'

const dim = (m) => `${num(m.dimensoesMm.comprimento)} × ${num(m.dimensoesMm.altura)} × ${num(m.dimensoesMm.profundidade)} mm`

// ------------------------------------------------------------------ etapa 1: produto
export function htmlProduto(estado) {
  const d = estado.dados
  const cartoes = CATALOGO.map((p) => {
    const ativo = d.fonte === 'catalogo' && d.produtoId === p.id
    return `
      <button type="button" class="cartao${ativo ? ' ativo' : ''}" data-produto="${p.id}" aria-pressed="${ativo}">
        <span class="cartao-topo"><span class="cartao-nome">${esc(p.nome)}</span><span class="chip">${esc(p.codigo)}</span></span>
        <span class="cartao-desc">${esc(p.descricao)}</span>
        <span class="cartao-meta">${dim(p.manifesto)} · ${p.manifesto.grupos.length} conjuntos · geometria do projeto</span>
      </button>`
  }).join('')
  const importado = d.importado
    ? `
      <p class="sobre painel-secao">Modelo importado</p>
      <div class="cartao${d.fonte === 'importado' ? ' ativo' : ''} cartao--importado">
        <button type="button" class="cartao-principal" data-acao="ver-importado" aria-pressed="${d.fonte === 'importado'}">
          <span class="cartao-topo"><span class="cartao-nome">${esc(d.importado.nome)}</span><span class="chip">importado</span></span>
          <span class="cartao-desc">${d.importado.pecas.length} peça(s) reconhecida(s). Personalize cores e visibilidade na etapa seguinte.</span>
        </button>
        <button type="button" class="circulo circulo--mini cartao-remover" data-acao="remover-importado" aria-label="Remover modelo importado" title="Remover">
          <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>`
    : ''
  return `
    <p class="sobre painel-secao">Catálogo · Linha IduFlow</p>
    <div class="cartoes">${cartoes}</div>
    ${importado}
    <p class="sobre painel-secao">Seu produto, direto do CAD</p>
    <button type="button" class="soltar-zona" data-acao="importar">
      <span class="soltar-zona-titulo">Arraste um arquivo aqui</span>
      <span class="soltar-zona-sub">ou clique para escolher no computador</span>
      <span class="soltar-zona-formatos"><em>GLB</em><em>STEP</em><em>IGES</em><em>STL</em><em>OBJ</em></span>
    </button>
    <details class="como">
      <summary>Como exportar do Inventor, Fusion ou SolidWorks?</summary>
      <div class="como-corpo">
        <p><strong>Inventor:</strong> Arquivo → Exportar → Formato CAD → STEP (*.stp). Exporte a montagem (.iam) inteira: cada componente vira uma peça configurável.</p>
        <p><strong>Fusion:</strong> Arquivo → Exportar → STEP (*.step), ou botão direito no componente → Exportar.</p>
        <p><strong>SolidWorks:</strong> Salvar como → STEP AP203/AP214.</p>
        <p>A conversão acontece no seu navegador. Nada é enviado a servidores. Para publicar um produto no catálogo, o STEP é convertido uma vez com o conversor do projeto (ver documentação).</p>
      </div>
    </details>`
}

// ------------------------------------------------------------------ etapa 2: acabamento
function htmlAmostras(grupoId, atual) {
  return `<div class="amostras" role="radiogroup" aria-label="Acabamentos disponíveis">${ACABAMENTOS.map((a) => `
    <button type="button" class="amostra" role="radio" aria-checked="${a.id === atual}" data-grupo="${esc(grupoId)}" data-acabamento="${a.id}" title="${esc(a.rotulo)}" style="--amostra:${a.amostra}">
      <span class="sr">${esc(a.rotulo)}</span>
    </button>`).join('')}</div>`
}

export function htmlAcabamento(estado) {
  const d = estado.dados
  if (d.fonte === 'importado') return htmlPecasImportadas(estado)
  const produto = estado.produto
  if (!produto) return ''
  const grupos = gruposConfiguraveis(produto)
  const fixos = gruposFixos(produto)
  return `
    <div class="grupos">${grupos.map((g, i) => {
      const atual = d.acabamentos[g.id]
      const a = acabamentoPorId(atual)
      return `
      <section class="grupo" data-grupo="${g.id}">
        <button type="button" class="grupo-cabecalho" data-acao="focar-grupo" data-grupo="${g.id}" aria-label="Ver ${esc(g.rotulo)} no modelo">
          <span class="grupo-num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
          <span class="grupo-nome">${esc(g.rotulo)}</span>
          <svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6" /><path d="M12 2v5M12 17v5M2 12h5M17 12h5" /></svg>
        </button>
        <p class="grupo-desc">${esc(g.descricao)}</p>
        ${htmlAmostras(g.id, atual)}
        <p class="grupo-atual" data-atual="${g.id}">${esc(a.rotulo)}</p>
      </section>`
    }).join('')}</div>
    ${fixos.length ? `<p class="nota">Acabamento fixo: ${esc(fixos.map((g) => g.rotulo.toLowerCase()).join(', '))}.</p>` : ''}
    <button type="button" class="pilula pilula--fina" data-acao="restaurar-acabamentos">Restaurar acabamentos padrão</button>`
}

function htmlPecasImportadas(estado) {
  const d = estado.dados
  const pecas = d.importado.pecas
  const selecionada = d.pecaSelecionada ? pecas.find((p) => p.id === d.pecaSelecionada) : null
  const personalizadas = Object.keys(d.acabamentosImportado).length + d.ocultas.size
  return `
    <input type="search" class="campo" id="filtro-pecas" placeholder="Buscar entre ${pecas.length} peça(s)…" aria-label="Buscar peça" value="${esc(d.filtroPecas || '')}" />
    <ul class="pecas" id="lista-pecas">${pecas.map((p) => {
      const ac = d.acabamentosImportado[p.id]
      const oculta = d.ocultas.has(p.id)
      return `
      <li class="peca${p.id === d.pecaSelecionada ? ' ativa' : ''}${oculta ? ' oculta' : ''}" data-peca="${p.id}" data-nome="${esc(p.nome.toLowerCase())}">
        <button type="button" class="peca-principal" data-acao="selecionar-peca" data-peca="${p.id}">
          <span class="peca-ponto" style="${ac ? `--amostra:${acabamentoPorId(ac).amostra}` : ''}"></span>
          <span class="peca-nome">${esc(p.nome)}</span>
        </button>
        <button type="button" class="peca-olho" data-acao="alternar-peca" data-peca="${p.id}" aria-pressed="${oculta}" aria-label="${oculta ? 'Mostrar' : 'Ocultar'} ${esc(p.nome)}" title="${oculta ? 'Mostrar peça' : 'Ocultar peça'}">
          <svg class="icone" viewBox="0 0 24 24" aria-hidden="true">${oculta
            ? '<path d="M4 4l16 16M9.9 6a9.4 9.4 0 0 1 2.1-.5c6 0 9.5 6.5 9.5 6.5a17.3 17.3 0 0 1-3 3.6M6.3 6.9A16.4 16.4 0 0 0 2.5 12S6 18.5 12 18.5a8.8 8.8 0 0 0 3.6-.8" />'
            : '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.6" />'}</svg>
        </button>
      </li>`
    }).join('')}</ul>
    ${selecionada ? `
    <section class="grupo grupo--peca">
      <p class="sobre">Acabamento da peça — ${esc(selecionada.nome)}</p>
      ${htmlAmostras(selecionada.id, d.acabamentosImportado[selecionada.id] || '')}
      <button type="button" class="pilula pilula--fina" data-acao="restaurar-peca" data-peca="${selecionada.id}">Restaurar cor original</button>
    </section>` : '<p class="nota">Selecione uma peça para trocar a cor ou ocultá-la.</p>'}
    ${personalizadas ? `<button type="button" class="pilula pilula--fina" data-acao="restaurar-importado">Desfazer personalizações (${personalizadas})</button>` : ''}`
}

// ------------------------------------------------------------------ etapa 3: resumo
export function htmlResumo(estado) {
  const d = estado.dados
  const produto = estado.produto
  const linhas = []
  if (produto) {
    linhas.push(`
      <section class="bloco">
        <p class="sobre painel-secao">Produto</p>
        <div class="linha"><span>${esc(produto.nome)}</span><span class="chip">${esc(produto.codigo)}</span></div>
        <div class="linha"><span>Linha</span><strong>${esc(produto.linha)}</strong></div>
      </section>
      <section class="bloco">
        <p class="sobre painel-secao">Especificações</p>
        ${produto.especificacoes.map((e) => `<div class="linha"><span>${esc(e.rotulo)}</span><strong>${esc(e.valor)}</strong></div>`).join('')}
      </section>
      <section class="bloco">
        <p class="sobre painel-secao">Acabamentos</p>
        ${gruposConfiguraveis(produto).map((g) => {
          const a = acabamentoPorId(d.acabamentos[g.id])
          return `<div class="linha"><span>${esc(g.rotulo)}</span><strong><span class="peca-ponto" style="--amostra:${a.amostra}"></span>${esc(a.rotulo)}</strong></div>`
        }).join('')}
      </section>`)
  } else if (d.importado) {
    const custom = d.importado.pecas.filter((p) => d.acabamentosImportado[p.id] || d.ocultas.has(p.id))
    linhas.push(`
      <section class="bloco">
        <p class="sobre painel-secao">Produto</p>
        <div class="linha"><span>${esc(d.importado.nome)}</span><span class="chip">${d.importado.pecas.length} peças</span></div>
      </section>
      <section class="bloco">
        <p class="sobre painel-secao">Personalizações (${custom.length})</p>
        ${custom.length ? custom.map((p) => {
          const det = []
          if (d.acabamentosImportado[p.id]) det.push(acabamentoPorId(d.acabamentosImportado[p.id]).rotulo)
          if (d.ocultas.has(p.id)) det.push('oculta')
          return `<div class="linha"><span>${esc(p.nome)}</span><strong>${esc(det.join(', '))}</strong></div>`
        }).join('') : '<p class="nota">Nenhuma personalização aplicada.</p>'}
      </section>`)
  }
  return `
    ${linhas.join('')}
    <section class="acoes">
      <a class="pilula pilula--acao" href="${esc(MARCA.contato)}" target="_blank" rel="noreferrer">Solicitar orçamento</a>
      ${produto ? '<button type="button" class="pilula" data-acao="link">Copiar link da configuração</button>' : ''}
      <button type="button" class="pilula" data-acao="copiar-resumo">Copiar resumo em texto</button>
      <button type="button" class="pilula" data-acao="png">Baixar imagem (PNG)</button>
      <button type="button" class="pilula" data-acao="imprimir">Ficha em PDF (imprimir)</button>
    </section>`
}

// ------------------------------------------------------------------ resumo em texto
export function textoResumo(estado, link) {
  const d = estado.dados
  const produto = estado.produto
  const l = [`Configuração — ${MARCA.empresa}`]
  if (produto) {
    l.push(`Produto: ${produto.nome} (${produto.codigo}) · Linha ${produto.linha}`, '', 'Especificações:')
    for (const e of produto.especificacoes) l.push(`  • ${e.rotulo}: ${e.valor}`)
    l.push('', 'Acabamentos:')
    for (const g of gruposConfiguraveis(produto)) l.push(`  • ${g.rotulo}: ${acabamentoPorId(d.acabamentos[g.id]).rotulo}`)
    if (link) l.push('', `Link da configuração: ${link}`)
  } else if (d.importado) {
    l.push(`Produto: modelo importado — ${d.importado.nome}`, `Peças: ${d.importado.pecas.length}`)
    const custom = d.importado.pecas.filter((p) => d.acabamentosImportado[p.id] || d.ocultas.has(p.id))
    if (custom.length) {
      l.push('', 'Personalizações:')
      for (const p of custom) {
        const det = []
        if (d.acabamentosImportado[p.id]) det.push(acabamentoPorId(d.acabamentosImportado[p.id]).rotulo)
        if (d.ocultas.has(p.id)) det.push('oculta')
        l.push(`  • ${p.nome}: ${det.join(', ')}`)
      }
    }
  }
  return l.join('\n')
}

// ------------------------------------------------------------------ ficha de impressão (A4)
export function htmlImpressao(estado, imagem) {
  const d = estado.dados
  const produto = estado.produto
  const hoje = new Date().toLocaleDateString('pt-BR')
  const tabela = (linhas) => `<table class="tabela"><tbody>${linhas.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table>`
  let corpo = ''
  if (produto) {
    corpo = `
      <h2>Especificações</h2>
      ${tabela(produto.especificacoes.map((e) => [e.rotulo, e.valor]))}
      <h2>Acabamentos</h2>
      ${tabela(gruposConfiguraveis(produto).map((g) => [g.rotulo, acabamentoPorId(d.acabamentos[g.id]).rotulo]))}
      <h2>Conjuntos do modelo</h2>
      ${tabela(produto.manifesto.grupos.map((g) => [g.rotulo, g.descricao]))}`
  } else if (d.importado) {
    const custom = d.importado.pecas.filter((p) => d.acabamentosImportado[p.id] || d.ocultas.has(p.id))
    corpo = `
      <h2>Peças personalizadas</h2>
      ${custom.length ? tabela(custom.map((p) => {
        const det = []
        if (d.acabamentosImportado[p.id]) det.push(acabamentoPorId(d.acabamentosImportado[p.id]).rotulo)
        if (d.ocultas.has(p.id)) det.push('oculta')
        return [p.nome, det.join(', ')]
      })) : '<p>Nenhuma personalização aplicada.</p>'}`
  }
  const titulo = produto ? produto.nome : `Modelo importado — ${d.importado?.nome || ''}`
  const sub = produto ? `Linha ${produto.linha} · ${produto.codigo}` : `${d.importado?.pecas.length || 0} peças`
  return `
    <div class="imp-fio"></div>
    <header class="imp-cabecalho">
      <img src="${esc(MARCA.logo)}" alt="Grupo Idugel — 30 anos" />
      <div>
        <p class="imp-titulo">Ficha de configuração</p>
        <p>${esc(titulo)} · ${esc(sub)}</p>
        <p>Gerada em ${hoje} · ${esc(MARCA.slogan)}</p>
      </div>
    </header>
    ${imagem ? `<figure class="imp-figura"><img src="${imagem}" alt="Vista do equipamento configurado" /><figcaption>${esc(titulo)}</figcaption></figure>` : ''}
    ${corpo}
    <footer class="imp-rodape">
      <p>${esc(MARCA.razaoSocial)} · CNPJ ${esc(MARCA.cnpj)}</p>
      <p>${esc(MARCA.endereco)} · ${esc(MARCA.telefone)} · ${esc(MARCA.site.replace('https://', ''))}</p>
      <p>${esc(MARCA.assinatura)}</p>
    </footer>`
}
