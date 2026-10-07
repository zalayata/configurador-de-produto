// Barra superior do controle de produção: selo oficial, nome do equipamento, situação da etapa atual e ações
// (imprimir resumo, copiar link, configurador, site). Também exporta as ações para o painel de atualizações.
import { NOMES_CURTOS, ehEtapaId } from '../capitulos'
import { STATUS, partesDoRotulo, type Etapa } from '../cronograma'
import { PROJETO } from '../dados'
import { useHorizon } from '../estado'
import { captureSnapshot } from '../../utils/viewerHandles'
import { Icone } from './Icones'

/** Evento ouvido pela folha de impressão (FolhaImpressao.tsx): detail = imagem do palco (dataURL) ou null. */
export const EVENTO_IMPRIMIR = 'horizon:print'

/** Dispara a impressão do resumo com a imagem atual do palco 3D. */
export function imprimirResumo() {
  window.dispatchEvent(new CustomEvent<string | null>(EVENTO_IMPRIMIR, { detail: captureSnapshot() }))
}

/** Copia o endereço da página (com o capítulo aberto) e avisa pelo toast. */
export function copiarLink(showToast: (mensagem: string) => void) {
  const endereco = window.location.href
  const avisar = () => showToast('Link copiado.')
  if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(endereco)
      .then(avisar)
      .catch(() => showToast('Copie o endereço na barra do navegador.'))
    return
  }
  showToast('Copie o endereço na barra do navegador.')
}

/** Nome curto da etapa (linha do tempo, pílula): NOMES_CURTOS pelo id, senão o nome do JSON. */
export function nomeCurto(e: Pick<Etapa, 'id' | 'nome'>): string {
  return ehEtapaId(e.id) ? NOMES_CURTOS[e.id] : e.nome
}

/** Texto da pílula de situação: "Engenharia · 18 %" em andamento; "Pedido · Concluída" nas demais. */
function textoDaSituacao(e: Etapa): string {
  if (e.status === STATUS.andamento) return `${nomeCurto(e)} · ${e.percentual} %`
  return `${nomeCurto(e)} · ${partesDoRotulo(e).estado}`
}

export function TopBar() {
  const andamento = useHorizon((s) => s.andamento)
  const calc = useHorizon((s) => s.calc)
  const showToast = useHorizon((s) => s.showToast)

  const equipamento = andamento?.projeto.equipamento ?? PROJETO.equipamento
  const ordem = andamento?.projeto.ordem
  const proposta = andamento?.projeto.proposta
  const atual = calc?.etapaAtual ?? null
  const base = import.meta.env.BASE_URL

  return (
    <header className="topbar hz-topbar">
      <div className="topbar-brand hz-topbar-brand">
        <a className="hz-marca" href="#pedido" aria-label="Grupo Idugel — 30 anos. Início do controle de produção">
          <img className="brand-seal" src={`${base}selo-30-anos.png`} alt="Grupo Idugel — 30 anos" />
        </a>
        <span className="brand-divider" aria-hidden="true" />
        <span className="brand-app">{PROJETO.paginaTitulo}</span>
        <span className="hz-pilula hz-pilula--equipamento" title={equipamento}>
          <span className="hz-pilula-texto">{equipamento}</span>
          {ordem ? <span className="hz-pilula-extra">OP {ordem}</span> : null}
          {!ordem && proposta ? <span className="hz-pilula-extra">Proposta {proposta}</span> : null}
        </span>
      </div>

      <div className="topbar-actions hz-topbar-actions">
        {atual ? (
          <span
            className={`hz-pilula hz-pilula--situacao hz-pilula--${atual.status}`}
            aria-label={`Etapa atual: ${atual.nome}, ${atual.rotulo}`}
          >
            <span className="hz-pilula-no" aria-hidden="true" />
            <span className="hz-pilula-texto">{textoDaSituacao(atual)}</span>
          </span>
        ) : null}

        <button type="button" className="btn btn-outline hz-btn" onClick={imprimirResumo} title="Imprimir resumo">
          <Icone nome="imprimir" className="hz-btn-icone" />
          <span className="hz-btn-rotulo">Imprimir resumo</span>
        </button>

        <button type="button" className="btn btn-outline hz-btn" onClick={() => copiarLink(showToast)} title="Copiar link">
          <Icone nome="link" className="hz-btn-icone" />
          <span className="hz-btn-rotulo">Copiar link</span>
        </button>

        <a className="btn btn-ghost hz-btn" href="./index.html" title="Abrir o configurador 3D">
          Configurador
        </a>

        <a
          className="btn btn-ghost hz-btn"
          href={PROJETO.fornecedor.siteUrl}
          target="_blank"
          rel="noreferrer"
          title="Site do Grupo Idugel"
        >
          {PROJETO.fornecedor.site}
          <Icone nome="abrir" className="hz-btn-icone hz-btn-icone--fim" />
        </a>
      </div>
    </header>
  )
}
