// Painel do capítulo aberto: claquete ("03 / 09 — Fabricação"), título, linha de status e o corpo por capítulo
// (pedido, etapas com percentual, atualizações em papel). Datas só por formatarData/dataPublica/etapa.rotulo.
import { useState, type CSSProperties, type MouseEvent } from 'react'
import type { Andamento, Foto } from '../andamento'
import { NOMES_CURTOS, TOTAL, capituloDaEtapa, passosDaEtapa, type Capitulo, type CapituloId } from '../capitulos'
import {
  CAMPOS_DE_DATA,
  STATUS,
  ateHoje,
  dataPublica,
  diaDe,
  formatarData,
  textoDoPasso,
  type Cronograma,
  type Etapa,
} from '../cronograma'
import { PROJETO } from '../dados'
import { etapaPorId, useHorizon } from '../estado'
import { Icone } from './Icones'
import { copiarLink, imprimirResumo } from './TopBar'

type EstiloComVars = CSSProperties & Record<`--${string}`, string | number>
type IrPara = (id: CapituloId) => void
type AbrirFoto = (foto: Foto | null) => void

const BASE = import.meta.env.BASE_URL
const dd = (n: number) => String(n).padStart(2, '0')

/** "(049) 3551-9400" → "tel:+554935519400". */
const telHref = (fone: string) => `tel:+55${fone.replace(/\D/g, '').replace(/^0/, '')}`

/** Mais recente primeiro (fotos, histórico). */
const maisRecente = <T extends { data: string }>(lista: T[]): T[] =>
  [...lista].sort((a, b) => diaDe(b.data) - diaDe(a.data))

/** Clique sem modificador: navegação interna (o App grava o #hash); com Ctrl/⌘/Shift o navegador decide. */
const navegar = (irPara: IrPara, id: CapituloId) => (ev: MouseEvent<HTMLAnchorElement>) => {
  if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0) return
  ev.preventDefault()
  irPara(id)
}

export function PainelCapitulo() {
  const capitulo = useHorizon((s) => s.capitulo())
  const leitura = useHorizon((s) => s.leitura)
  const calc = useHorizon((s) => s.calc)
  const andamento = useHorizon((s) => s.andamento)
  const hoje = useHorizon((s) => s.hoje)
  const irPara = useHorizon((s) => s.irPara)
  const proximo = useHorizon((s) => s.proximo)
  const anterior = useHorizon((s) => s.anterior)
  const abrirFoto = useHorizon((s) => s.abrirFoto)

  const etapa = etapaPorId(calc, capitulo.etapa)
  const emAndamento = etapa?.status === STATUS.andamento
  const titulo = emAndamento && capitulo.tituloEmAndamento ? capitulo.tituloEmAndamento : capitulo.titulo
  const papel = !!capitulo.papel
  const ultimo = capitulo.indice >= TOTAL - 1

  return (
    <aside className={`panel hz-painel${papel ? ' hz-painel--papel' : ''}`} aria-labelledby="hz-titulo">
      <header className="panel-head hz-painel-head">
        <p className="hz-claquete">
          <span className="hz-claquete-num">
            {capitulo.numero} / {dd(TOTAL)}
          </span>
          <span className="hz-claquete-sep" aria-hidden="true">
            —
          </span>
          <span className="hz-claquete-nome">{capitulo.nome}</span>
        </p>
        <h1 id="hz-titulo" className="panel-title hz-titulo">
          {titulo}
        </h1>
        {etapa ? (
          <p className={`hz-status hz-status--${etapa.status}`}>
            <span className="hz-status-no" aria-hidden="true" />
            {etapa.rotulo}
          </p>
        ) : null}
      </header>

      <div className="panel-scroll hz-corpo" key={capitulo.id}>
        {leitura === 'lendo' ? (
          <p className="hz-lead">Carregando o andamento…</p>
        ) : leitura !== 'ok' || !andamento || !calc ? (
          <SemDados />
        ) : papel ? (
          <CorpoAtualizacoes capitulo={capitulo} andamento={andamento} calc={calc} hoje={hoje} irPara={irPara} abrirFoto={abrirFoto} />
        ) : capitulo.id === 'pedido' ? (
          <CorpoPedido capitulo={capitulo} andamento={andamento} calc={calc} irPara={irPara} />
        ) : etapa ? (
          <CorpoEtapa capitulo={capitulo} etapa={etapa} andamento={andamento} hoje={hoje} abrirFoto={abrirFoto} />
        ) : (
          <p className="hz-lead">{capitulo.apoio}</p>
        )}
      </div>

      <footer className="panel-foot hz-painel-foot">
        <button type="button" className="btn btn-ghost" onClick={anterior} disabled={capitulo.indice === 0}>
          ← Anterior
        </button>
        {ultimo ? null : (
          <button type="button" className="btn btn-primary" onClick={proximo}>
            Próximo →
          </button>
        )}
      </footer>
    </aside>
  )
}

/* ───────────────────────── corpos ───────────────────────── */

function SemDados() {
  const f = PROJETO.fornecedor
  return (
    <>
      <p className="hz-lead">{PROJETO.semDados}</p>
      <p className="hz-contato-linha">
        Fale com a equipe: <a href={telHref(f.telefone)}>{f.telefone}</a>
        {' · '}
        <a href={f.siteUrl} target="_blank" rel="noreferrer">
          {f.site}
        </a>
      </p>
    </>
  )
}

interface CorpoPedidoProps {
  capitulo: Capitulo
  andamento: Andamento
  calc: Cronograma
  irPara: IrPara
}

function CorpoPedido({ capitulo, andamento, calc, irPara }: CorpoPedidoProps) {
  const p = andamento.projeto
  const equipamento = `${p.equipamento ?? PROJETO.equipamento}${p.modelo ? ` · ${p.modelo}` : ''}`
  const atual = calc.etapaAtual
  return (
    <>
      <p className="hz-lead">{capitulo.apoio}</p>
      <dl className="hz-dados">
        <Dado termo="Confirmado em" valor={formatarData(p.confirmadoEm)} />
        <Dado termo="Equipamento" valor={equipamento} />
        {p.quantidade ? <Dado termo="Quantidade" valor={`${p.quantidade} ${p.quantidade === 1 ? 'unidade' : 'unidades'}`} /> : null}
        {p.ordem ? <Dado termo="Ordem de produção" valor={p.ordem} /> : null}
        {p.proposta ? <Dado termo="Proposta" valor={p.proposta} /> : null}
        {p.cliente ? <Dado termo="Cliente" valor={p.cidade ? `${p.cliente} — ${p.cidade}` : p.cliente} /> : null}
        <Dado termo="Entrega — data-limite" valor={formatarData(p.entregaLimite)} />
        {atual ? <Dado termo="Etapa atual" valor={`${atual.nome} · ${atual.rotulo}`} /> : null}
      </dl>
      <Atualizado andamento={andamento} />
      <ListaDeEtapas calc={calc} irPara={irPara} />
    </>
  )
}

interface CorpoEtapaProps {
  capitulo: Capitulo
  etapa: Etapa
  andamento: Andamento
  hoje: string
  abrirFoto: AbrirFoto
}

function CorpoEtapa({ capitulo, etapa, andamento, hoje, abrirFoto }: CorpoEtapaProps) {
  const passos = passosDaEtapa(etapa)
  const datas = datasDaEtapa(etapa)
  const fotos = maisRecente(ateHoje(andamento.fotos, hoje).filter((f) => f.etapa === etapa.id))
  return (
    <>
      <p className="hz-lead">{capitulo.apoio}</p>
      <Barra percentual={etapa.percentual} texto={etapa.rotulo} rotulo={`Andamento da etapa ${etapa.nome}`} />
      {datas.length || etapa.local ? (
        <dl className="hz-dados">
          {datas.map((d) => (
            <Dado key={d.termo} termo={d.termo} valor={d.valor} />
          ))}
          {etapa.local ? <Dado termo="Local" valor={etapa.local} /> : null}
        </dl>
      ) : null}
      {passos.length ? (
        <ul className="hz-passos" aria-label="Passos da etapa">
          {passos.map(({ passo, estado }) => (
            <li key={passo.id} className={`hz-passo hz-passo--${estado}`}>
              <span className="hz-passo-no" aria-hidden="true" />
              <span className="hz-passo-nome">{passo.nome}</span>
              <span className="sr-only">: {textoDoPasso(estado, passo)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {etapa.mensagem ? <p className="hz-mensagem">{etapa.mensagem}</p> : null}
      <FaixaDeFotos fotos={fotos} abrirFoto={abrirFoto} />
    </>
  )
}

interface CorpoAtualizacoesProps {
  capitulo: Capitulo
  andamento: Andamento
  calc: Cronograma
  hoje: string
  irPara: IrPara
  abrirFoto: AbrirFoto
}

function CorpoAtualizacoes({ capitulo, andamento, calc, hoje, irPara, abrirFoto }: CorpoAtualizacoesProps) {
  const showToast = useHorizon((s) => s.showToast)
  const f = PROJETO.fornecedor
  const atual = calc.etapaAtual
  const historico = maisRecente(ateHoje(andamento.atualizacoes, hoje))
  const fotos = maisRecente(ateHoje(andamento.fotos, hoje))
  return (
    <>
      <p className="hz-lead">{capitulo.apoio}</p>
      <div className="hz-papel-grade">
        <section className="hz-bloco" aria-labelledby="hz-t-resumo">
          <h2 id="hz-t-resumo" className="hz-bloco-titulo">
            Resumo
          </h2>
          <dl className="hz-dados">
            {atual ? <Dado termo="Etapa atual" valor={atual.nome} /> : null}
            {atual ? <Dado termo="Situação" valor={atual.rotulo} /> : null}
            <Dado termo="Andamento geral" valor={`${calc.percentualGeral} %`} />
            <Dado termo="Entrega — data-limite" valor={formatarData(andamento.projeto.entregaLimite)} />
          </dl>
          <Barra
            percentual={calc.percentualGeral}
            texto={`${calc.percentualGeral} % da produção concluída`}
            rotulo="Andamento geral da produção"
          />
        </section>

        <section className="hz-bloco hz-acoes" aria-label="Ações">
          <button type="button" className="btn btn-primary" onClick={imprimirResumo}>
            <Icone nome="imprimir" className="hz-btn-icone" />
            Imprimir resumo
          </button>
          <button type="button" className="btn btn-outline" onClick={() => copiarLink(showToast)}>
            <Icone nome="link" className="hz-btn-icone" />
            Copiar link
          </button>
          <a className="btn btn-outline" href="./index.html">
            Configurador
          </a>
        </section>

        <section className="hz-bloco hz-bloco--largo" aria-labelledby="hz-t-historico">
          <h2 id="hz-t-historico" className="hz-bloco-titulo">
            Histórico
          </h2>
          {historico.length ? (
            <ol className="hz-historico">
              {historico.map((a, i) => (
                <li key={`${a.data}-${a.etapa}-${i}`} className="hz-registro">
                  <p className="hz-registro-meta">
                    <time dateTime={a.data}>{formatarData(a.data)}</time>
                    <span aria-hidden="true">·</span>
                    <span>{NOMES_CURTOS[a.etapa]}</span>
                  </p>
                  <p className="hz-registro-texto">{a.texto}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="hz-vazio">{f.nome} registra aqui cada etapa da produção.</p>
          )}
        </section>

        <FaixaDeFotos fotos={fotos} abrirFoto={abrirFoto} titulo="Fotos" />

        <section className="hz-bloco hz-bloco--largo" aria-labelledby="hz-t-etapas">
          <h2 id="hz-t-etapas" className="hz-bloco-titulo">
            Etapas
          </h2>
          <ListaDeEtapas calc={calc} irPara={irPara} />
        </section>

        <section className="hz-bloco hz-contato hz-bloco--largo" aria-labelledby="hz-t-contato">
          <h2 id="hz-t-contato" className="hz-bloco-titulo">
            Contato
          </h2>
          <img className="hz-contato-selo" src={`${BASE}selo-30-anos.png`} alt="Grupo Idugel — 30 anos" />
          <p className="hz-contato-razao">{f.razao}</p>
          <p>{f.endereco}</p>
          <p>
            <a href={telHref(f.telefone)}>{f.telefone}</a>
            {' · '}
            <a href={f.siteUrl} target="_blank" rel="noreferrer">
              {f.site}
            </a>
          </p>
          <p className="hz-contato-tagline">{f.tagline}</p>
        </section>
      </div>
      <Atualizado andamento={andamento} />
    </>
  )
}

/* ───────────────────────── peças ───────────────────────── */

function Dado({ termo, valor }: { termo: string; valor: string }) {
  if (!valor) return null
  return (
    <div className="hz-dado">
      <dt>{termo}</dt>
      <dd>{valor}</dd>
    </div>
  )
}

function Barra({ percentual, texto, rotulo }: { percentual: number; texto: string; rotulo: string }) {
  const estilo: EstiloComVars = { '--p': percentual / 100 }
  return (
    <div
      className="hz-barra"
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentual}
      aria-valuetext={texto}
      style={estilo}
    >
      <span className="hz-barra-valor" />
    </div>
  )
}

function Atualizado({ andamento }: { andamento: Andamento }) {
  const data = formatarData(andamento.atualizadoEm)
  if (!data) return null
  return (
    <p className="hz-atualizado">
      Atualizado em <time dateTime={andamento.atualizadoEm}>{data}</time>
    </p>
  )
}

/**
 * Datas públicas da etapa com o termo do JSON (etapa.rotulos): só as que dataPublica() libera.
 * Início igual ao fim aparece uma vez (com o rótulo do fim).
 */
function datasDaEtapa(etapa: Etapa): Array<{ termo: string; valor: string }> {
  const inicio = dataPublica(etapa, 'inicio')
  const fim = dataPublica(etapa, 'fim')
  if (inicio && fim && inicio === fim) return [{ termo: etapa.rotulos.fim, valor: formatarData(fim) }]
  return CAMPOS_DE_DATA.flatMap((k) => {
    const d = dataPublica(etapa, k)
    return d ? [{ termo: etapa.rotulos[k], valor: formatarData(d) }] : []
  })
}

function ListaDeEtapas({ calc, irPara }: { calc: Cronograma; irPara: IrPara }) {
  const capituloId = useHorizon((s) => s.capituloId)
  return (
    <ol className="hz-etapas" aria-label="Etapas da produção">
      {calc.etapas.map((e) => {
        const c = capituloDaEtapa(e.id)
        const id = (c?.id ?? e.id) as CapituloId
        const aqui = capituloId === id
        return (
          <li key={e.id} className={`hz-etapa hz-etapa--${e.status}${e.ativa ? ' hz-etapa--atual' : ''}`}>
            <a className="hz-etapa-link" href={`#${id}`} onClick={navegar(irPara, id)} aria-current={aqui ? 'page' : undefined}>
              <span className="hz-etapa-no">
                <Icone nome={c?.icone ?? 'texto'} className="hz-etapa-icone" />
              </span>
              <span className="hz-etapa-texto">
                <span className="hz-etapa-nome">{e.nome}</span>
                <span className="hz-etapa-estado">{e.rotulo}</span>
              </span>
            </a>
          </li>
        )
      })}
    </ol>
  )
}

interface FaixaDeFotosProps {
  fotos: Foto[]
  abrirFoto: AbrirFoto
  /** Com título vira um bloco ("Fotos"); sem ele é a faixa da etapa. */
  titulo?: string
}

function FaixaDeFotos({ fotos, abrirFoto, titulo }: FaixaDeFotosProps) {
  // foto cujo arquivo não carrega sai da faixa
  const [falhas, setFalhas] = useState<string[]>([])
  const visiveis = fotos.filter((f) => !falhas.includes(f.arquivo))
  if (!visiveis.length) return null
  const falhou = (arquivo: string) => setFalhas((x) => (x.includes(arquivo) ? x : [...x, arquivo]))
  const rotulo = titulo ?? 'Fotos da etapa'
  return (
    <section className={`hz-bloco hz-fotos-bloco${titulo ? ' hz-bloco--largo' : ''}`} aria-label={rotulo}>
      {titulo ? <h2 className="hz-bloco-titulo">{titulo}</h2> : null}
      <ul className="hz-fotos">
        {visiveis.map((f) => {
          const data = formatarData(f.data)
          return (
            <li key={`${f.arquivo}-${f.data}`}>
              <button
                type="button"
                className="hz-foto"
                onClick={() => abrirFoto(f)}
                aria-label={`Ampliar foto${data ? ` de ${data}` : ''}${f.legenda ? `: ${f.legenda}` : ` — ${NOMES_CURTOS[f.etapa]}`}`}
              >
                <img src={`${BASE}${f.arquivo}`} alt="" width={80} height={60} loading="lazy" onError={() => falhou(f.arquivo)} />
                {data ? <span className="hz-foto-data">{data}</span> : null}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
