// Linha do tempo persistente: as 8 etapas do dia (ordem do JSON) + "Atualizações". Cada nó traz o anel de
// progresso (em andamento), o ícone da etapa, o nome curto e o estado em duas linhas (estado / data).
// Cores: trilho cromo, concluída branca, em andamento cromo-claro com pulso — nunca verde/vermelho.
import { useEffect, useRef, type CSSProperties, type MouseEvent } from 'react'
import { CAPITULOS, capituloDaEtapa, type CapituloId } from '../capitulos'
import { partesDoRotulo, type Etapa } from '../cronograma'
import { useHorizon } from '../estado'
import { Icone } from './Icones'
import { nomeCurto } from './TopBar'

/** Estilo com variáveis CSS (--p, --seg). */
type EstiloComVars = CSSProperties & Record<`--${string}`, string | number>

/** Circunferência do anel (r = 18): 2π·18 ≈ 113,1. */
const ANEL = 113.1

const PAPEL = CAPITULOS.find((c) => c.papel) ?? CAPITULOS[CAPITULOS.length - 1]

export function LinhaDoTempo() {
  const leitura = useHorizon((s) => s.leitura)
  const calc = useHorizon((s) => s.calc)
  const capituloId = useHorizon((s) => s.capituloId)
  const irPara = useHorizon((s) => s.irPara)
  const reduzido = useHorizon((s) => s.reduzido)
  const lista = useRef<HTMLOListElement>(null)

  // celular (faixa rolável): o capítulo aberto vem para o centro da faixa
  useEffect(() => {
    const el = lista.current?.querySelector<HTMLElement>('.hz-ldt-item--aqui')
    if (!el || !window.matchMedia('(max-width: 980px)').matches) return
    el.scrollIntoView({ behavior: reduzido ? 'auto' : 'smooth', inline: 'center', block: 'nearest' })
  }, [capituloId, reduzido, leitura])

  if (leitura !== 'ok' || !calc) return null

  const abrir = (id: CapituloId) => (ev: MouseEvent<HTMLAnchorElement>) => {
    // sem modificador: navegação interna (o App grava o #hash); com Ctrl/⌘ o navegador abre em outra aba
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0) return
    ev.preventDefault()
    irPara(id)
  }

  return (
    <nav className="hz-ldt" aria-label="Linha do tempo da produção">
      <ol className="hz-ldt-lista" ref={lista}>
        {calc.etapas.map((e) => (
          <ItemEtapa key={e.id} etapa={e} aqui={capituloId === e.id} aoAbrir={abrir} />
        ))}
        <li className={`hz-ldt-item hz-ldt-item--extra${capituloId === PAPEL.id ? ' hz-ldt-item--aqui' : ''}`}>
          <a
            className="hz-ldt-marco"
            href={`#${PAPEL.id}`}
            onClick={abrir(PAPEL.id)}
            aria-label={`${PAPEL.nome}: ${PAPEL.apoio}`}
            aria-current={capituloId === PAPEL.id ? 'page' : undefined}
          >
            <span className="hz-ldt-no">
              <Icone nome={PAPEL.icone} className="hz-ldt-icone" />
            </span>
            <span className="hz-ldt-texto">
              <span className="hz-ldt-nome">{PAPEL.nome}</span>
              <span className="hz-ldt-estado">
                <span className="hz-ldt-estado-a">Histórico e fotos</span>
              </span>
            </span>
          </a>
        </li>
      </ol>
    </nav>
  )
}

interface ItemEtapaProps {
  etapa: Etapa
  aqui: boolean
  aoAbrir: (id: CapituloId) => (ev: MouseEvent<HTMLAnchorElement>) => void
}

function ItemEtapa({ etapa, aqui, aoAbrir }: ItemEtapaProps) {
  const capitulo = capituloDaEtapa(etapa.id)
  const id = (capitulo?.id ?? etapa.id) as CapituloId
  const partes = partesDoRotulo(etapa)
  const classes = [
    'hz-ldt-item',
    `hz-ldt-item--${etapa.status}`,
    etapa.ativa ? 'hz-ldt-item--atual' : '',
    aqui ? 'hz-ldt-item--aqui' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const estilo: EstiloComVars = { '--p': etapa.percentual / 100 }

  return (
    <li className={classes} style={estilo}>
      <a
        className="hz-ldt-marco"
        href={`#${id}`}
        onClick={aoAbrir(id)}
        aria-label={`${etapa.nome}: ${etapa.rotulo}`}
        aria-current={aqui ? 'page' : undefined}
      >
        <span className="hz-ldt-no">
          <svg className="hz-ldt-anel" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
            <circle className="hz-ldt-anel-fundo" cx="20" cy="20" r="18" />
            <circle className="hz-ldt-anel-valor" cx="20" cy="20" r="18" strokeDasharray={ANEL} />
          </svg>
          <Icone nome={capitulo?.icone ?? 'texto'} className="hz-ldt-icone" />
        </span>
        <span className="hz-ldt-texto">
          <span className="hz-ldt-nome">{nomeCurto(etapa)}</span>
          <span className="hz-ldt-estado">
            <span className="hz-ldt-estado-a">{partes.estado}</span>
            {partes.data ? (
              <>
                <span className="hz-ldt-estado-sep">{partes.sep}</span>
                <span className="hz-ldt-estado-b">{partes.data}</span>
              </>
            ) : null}
          </span>
        </span>
      </a>
    </li>
  )
}
