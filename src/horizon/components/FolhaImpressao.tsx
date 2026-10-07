// Folha de impressão (A4) do controle de produção do Dosador Horizon.
// Só aparece na impressão (.print-sheet de global.css: display:none na tela, visível em @media print; .app some).
// Recebe a captura PNG do 3D pelo evento "horizon:print" (TopBar) e chama window.print() dois quadros depois,
// para o React já ter desenhado a captura. Toda data sai por formatarData/dataPublica/rotulo (nunca montada à mão);
// uma data não pública (datasPublicas) nunca chega ao papel. Herdado da folha do acompanhamento Koene.
import { useEffect, useState } from 'react'
import { CAPITULOS, NOMES_CURTOS, ehEtapaId, passosDaEtapa, porId } from '../capitulos'
import {
  CAMPOS_DE_DATA,
  STATUS,
  ateHoje,
  dataPublica,
  formatarData,
  partesDoRotulo,
  textoDoPasso,
  type Etapa,
} from '../cronograma'
import { PROJETO } from '../dados'
import { useHorizon } from '../estado'
import { EVENTO_IMPRIMIR } from './TopBar'
import '../impressao.css'

/** Nome do evento que pede a impressão (a TopBar dispara com a captura do 3D em `detail`; fonte única em TopBar.tsx). */
export const EVENTO_IMPRESSAO: typeof EVENTO_IMPRIMIR = EVENTO_IMPRIMIR

/**
 * Datas públicas da etapa com rótulo ("Início 06/11/2026 · Conjuntos prontos 04/12/2026").
 * Início igual ao fim aparece uma vez (etapa de um dia, como a confirmação do pedido).
 */
export function datasDaEtapa(e: Etapa | null | undefined): Array<{ rotulo: string; data: string }> {
  if (!e) return []
  const campos = CAMPOS_DE_DATA.map((k) => ({ campo: k, iso: dataPublica(e, k) })).filter(
    (x): x is { campo: (typeof CAMPOS_DE_DATA)[number]; iso: string } => !!x.iso,
  )
  return campos
    .filter((x, i) => !(x.campo === 'fim' && i > 0 && campos[0].iso === x.iso))
    .map((x) => ({ rotulo: e.rotulos[x.campo], data: formatarData(x.iso) }))
    .filter((x) => x.data)
}

const datasEmTexto = (e: Etapa): string => datasDaEtapa(e).map((x) => `${x.rotulo} ${x.data}`).join(' · ')

const unidades = (n: number): string => (n === 1 ? '1 unidade' : `${n} unidades`)

export function FolhaImpressao() {
  const [captura, setCaptura] = useState<string | null>(null)
  const andamento = useHorizon((s) => s.andamento)
  const calc = useHorizon((s) => s.calc)
  const hoje = useHorizon((s) => s.hoje)
  const capituloId = useHorizon((s) => s.capituloId)
  const capitulo = porId(capituloId) ?? CAPITULOS[0]

  useEffect(() => {
    const aoPedirImpressao = (e: Event) => {
      const detail = (e as CustomEvent<string | null>).detail
      setCaptura(detail ?? null)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => window.print())
      })
    }
    window.addEventListener(EVENTO_IMPRESSAO, aoPedirImpressao)
    return () => window.removeEventListener(EVENTO_IMPRESSAO, aoPedirImpressao)
  }, [])

  const f = PROJETO.fornecedor
  const projeto = andamento?.projeto
  const equipamento = projeto?.equipamento ?? PROJETO.equipamento
  const situacao = calc ? formatarData(calc.hoje) : ''
  const atualizadoEm = andamento ? formatarData(andamento.atualizadoEm) : ''

  const cabecalho = (
    <header className="hz-imp-cabecalho">
      <div className="hz-imp-marca">
        <img
          className="print-selo hz-imp-selo"
          src={`${import.meta.env.BASE_URL}selo-30-anos.png`}
          alt="Grupo Idugel — 30 anos"
          width={500}
          height={129}
        />
        <div>
          <p className="hz-imp-tipo">CONTROLE DE PRODUÇÃO</p>
          <p className="hz-imp-tagline">{f.tagline}</p>
        </div>
      </div>
      {(situacao || atualizadoEm) && (
        <p className="hz-imp-situacao">
          {situacao && <span>Situação em {situacao}</span>}
          {situacao && atualizadoEm && <span className="hz-imp-sep"> · </span>}
          {atualizadoEm && <span>atualizado em {atualizadoEm}</span>}
        </p>
      )}
    </header>
  )

  const rodape = (
    <footer className="hz-imp-rodape">
      <p>
        {f.razao} · CNPJ {f.cnpj}
      </p>
      <p>
        {f.endereco} · {f.telefone} · {f.site}
      </p>
      <p className="hz-imp-assinatura">{f.assinatura}</p>
    </footer>
  )

  const contato = (
    <p className="hz-imp-contato">
      <strong>Contato:</strong> {f.nome} · {f.cidade} · {f.telefone} · {f.site}
    </p>
  )

  // sem andamento válido (arquivo ausente, fora da regra ou ainda em leitura): cabeçalho, texto afirmativo e contato
  if (!calc || !andamento || !projeto) {
    return (
      <div className="print-sheet hz-imp hz-imp--sem-dados">
        {cabecalho}
        <section className="hz-imp-titulo">
          <h1>{equipamento}</h1>
        </section>
        <p className="hz-imp-semdados">{PROJETO.semDados}</p>
        <div className="hz-imp-fim">
          {contato}
          {rodape}
        </div>
      </div>
    )
  }

  const identificacao: string[] = []
  if (projeto.ordem) identificacao.push(`Ordem de produção ${projeto.ordem}`)
  if (projeto.proposta) identificacao.push(`Proposta ${projeto.proposta}`)
  if (projeto.quantidade) identificacao.push(unidades(projeto.quantidade))
  if (projeto.cliente) identificacao.push(projeto.cidade ? `${projeto.cliente} — ${projeto.cidade}` : projeto.cliente)

  const confirmadoEm = formatarData(projeto.confirmadoEm)
  const entregaLimite = formatarData(projeto.entregaLimite)
  const datasDoPedido: string[] = []
  if (confirmadoEm) datasDoPedido.push(`Pedido confirmado em ${confirmadoEm}`)
  if (entregaLimite) datasDoPedido.push(`Entrega — data-limite ${entregaLimite}`)

  const etapaAtual = calc.etapaAtual
  const passos = passosDaEtapa(etapaAtual)
  const etapaDoCapitulo = capitulo.etapa ? (calc.etapas.find((e) => e.id === capitulo.etapa) ?? null) : null
  const legendaDaCaptura = capitulo.etapa
    ? etapaDoCapitulo?.status === STATUS.andamento && capitulo.tituloEmAndamento
      ? capitulo.tituloEmAndamento
      : capitulo.titulo
    : equipamento

  const nomeDaEtapa = (id: string): string =>
    calc.etapas.find((e) => e.id === id)?.nome ?? (ehEtapaId(id) ? NOMES_CURTOS[id] : '')
  const atualizacoes = ateHoje(andamento.atualizacoes, hoje || calc.hoje).sort((a, b) => (a.data < b.data ? 1 : -1))
  // as duas últimas atualizações seguem com o contato e o rodapé num bloco que não se parte (sem rodapé órfão)
  const corte = Math.max(0, atualizacoes.length - 2)
  const itemDeAtualizacao = (a: (typeof atualizacoes)[number], i: number) => (
    <li key={`${a.data}-${a.etapa}-${i}`}>
      <strong>{formatarData(a.data)}</strong> · {nomeDaEtapa(a.etapa)} — {a.texto}
    </li>
  )

  return (
    <div className="print-sheet hz-imp">
      {cabecalho}

      <section className="hz-imp-titulo">
        <h1>
          {equipamento}
          {projeto.modelo && <span className="hz-imp-modelo"> · {projeto.modelo}</span>}
        </h1>
        {identificacao.length > 0 && <p className="hz-imp-identificacao">{identificacao.join(' · ')}</p>}
        {datasDoPedido.length > 0 && <p className="hz-imp-datas-pedido">{datasDoPedido.join(' · ')}</p>}
      </section>

      {captura && (
        <figure className="hz-imp-figura">
          <img className="print-snapshot hz-imp-captura" src={captura} alt={`Modelo 3D — ${legendaDaCaptura}`} />
          <figcaption>Modelo 3D — {legendaDaCaptura}</figcaption>
        </figure>
      )}

      <h2>Linha do tempo</h2>
      <ol className="hz-imp-ldt">
        {calc.etapas.map((e) => {
          const partes = partesDoRotulo(e)
          return (
            <li key={e.id} className={`hz-imp-ldt-item hz-imp-ldt-item--${e.status}`}>
              <span className="hz-imp-ldt-no" aria-hidden="true" />
              <span className="hz-imp-ldt-nome">{ehEtapaId(e.id) ? NOMES_CURTOS[e.id] : e.nome}</span>
              <span className="hz-imp-ldt-estado">{partes.estado}</span>
              {partes.data && <span className="hz-imp-ldt-data">{partes.data}</span>}
            </li>
          )
        })}
      </ol>

      <h2>Etapas e datas</h2>
      <table className="hz-imp-tabela">
        <thead>
          <tr>
            <th scope="col">Etapa</th>
            <th scope="col">Datas</th>
            <th scope="col">Situação</th>
          </tr>
        </thead>
        <tbody>
          {calc.etapas.map((e) => (
            <tr key={e.id} className={`hz-imp-linha--${e.status}${e.ativa ? ' hz-imp-linha--ativa' : ''}`}>
              <th scope="row">
                {e.nome}
                {e.local && <span className="hz-imp-local">{e.local}</span>}
              </th>
              <td>{datasEmTexto(e)}</td>
              <td>
                {e.rotulo}
                {e.mensagem && <span className="hz-imp-mensagem">{e.mensagem}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {etapaAtual && passos.length > 0 && (
        <section className="hz-imp-passos-bloco">
          <h2>Passos da etapa atual — {etapaAtual.nome}</h2>
          <ul className="hz-imp-passos">
            {passos.map(({ passo, estado }) => (
              <li key={passo.id} className={`hz-imp-passo hz-imp-passo--${estado}`}>
                <span className="hz-imp-passo-no" aria-hidden="true" />
                <span className="hz-imp-passo-nome">{passo.nome}</span>
                <span className="hz-imp-passo-estado">{textoDoPasso(estado, passo)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2>Atualizações</h2>
      {corte > 0 && <ul className="hz-imp-lista">{atualizacoes.slice(0, corte).map(itemDeAtualizacao)}</ul>}
      <div className="hz-imp-fim">
        {atualizacoes.length > 0 && (
          <ul className={`hz-imp-lista${corte ? ' hz-imp-lista--cont' : ''}`}>
            {atualizacoes.slice(corte).map((a, i) => itemDeAtualizacao(a, corte + i))}
          </ul>
        )}
        {contato}
        {rodape}
      </div>
    </div>
  )
}
