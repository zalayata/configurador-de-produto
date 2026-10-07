// Página de controle de produção do Dosador Horizon.
// Liga a leitura do andamento.json ao estado, a URL (#capitulo) ao capítulo aberto, teclado e os componentes.
import { useEffect } from 'react'
import { aoChegarAndamento, hojeDaPagina, lerAndamento } from './andamento'
import { CAPITULOS, lerHash } from './capitulos'
import { validar } from './cronograma'
import { useHorizon } from './estado'
import { viewerHandles } from '../utils/viewerHandles'
import { HorizonStage } from './three/HorizonStage'
import { TopBar } from './components/TopBar'
import { LinhaDoTempo } from './components/LinhaDoTempo'
import { PainelCapitulo } from './components/PainelCapitulo'
import { FerramentasPalco } from './components/FerramentasPalco'
import { Aviso, FotoAmpliada } from './components/Avisos'
import { FolhaImpressao } from './components/FolhaImpressao'

/** Leitura do JSON → estado (uma vez por página); `?hoje=` só em desenvolvimento. */
function useAndamento() {
  const setAndamento = useHorizon((s) => s.setAndamento)
  const setHoje = useHorizon((s) => s.setHoje)
  useEffect(() => {
    setHoje(hojeDaPagina())
    let vivo = true
    void lerAndamento().then((a) => {
      if (!vivo) return
      if (a) {
        if (import.meta.env.DEV) {
          const problemas = validar(a)
          if (problemas.length) console.info('[horizon] andamento.json com avisos:', problemas)
        }
        setAndamento(a, 'ok')
      }
      // sem resposta no limite: a página segue "lendo" e se atualiza quando o JSON chegar (ou marca sem dados)
    })
    const cancelar = aoChegarAndamento(
      (a) => {
        if (vivo) setAndamento(a, 'ok')
      },
      () => {
        if (vivo && !useHorizon.getState().andamento) setAndamento(null, 'sem-dados')
      },
    )
    // a data muda à meia-noite com a página aberta: recalcula a cada minuto se o dia virou
    const relogio = window.setInterval(() => {
      const h = hojeDaPagina()
      if (h !== useHorizon.getState().hoje) setHoje(h)
    }, 60000)
    return () => {
      vivo = false
      cancelar()
      window.clearInterval(relogio)
    }
  }, [setAndamento, setHoje])
}

/** URL (#capitulo) ↔ capítulo aberto, voltar/avançar do navegador e teclado. */
function useNavegacao() {
  const capituloId = useHorizon((s) => s.capituloId)
  const irPara = useHorizon((s) => s.irPara)
  const proximo = useHorizon((s) => s.proximo)
  const anterior = useHorizon((s) => s.anterior)

  useEffect(() => {
    const aplicarHash = () => {
      const c = lerHash()
      if (c && c.id !== useHorizon.getState().capituloId) irPara(c.id)
    }
    aplicarHash()
    window.addEventListener('hashchange', aplicarHash)
    return () => window.removeEventListener('hashchange', aplicarHash)
  }, [irPara])

  useEffect(() => {
    // grava o capítulo aberto na URL só quando ela aponta para outro (ou para nenhum) capítulo
    if (lerHash()?.id !== capituloId) history.replaceState(null, '', `#${capituloId}`)
    document.documentElement.dataset.capitulo = capituloId
  }, [capituloId])

  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null
      if (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return
      if (e.altKey || e.ctrlKey || e.metaKey) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        proximo()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        anterior()
      } else if (e.key === 'Home') {
        e.preventDefault()
        irPara(CAPITULOS[0].id)
      } else if (e.key === 'End') {
        e.preventDefault()
        irPara(CAPITULOS[CAPITULOS.length - 1].id)
      } else if (e.key === 'Escape') {
        useHorizon.getState().abrirFoto(null)
      }
    }
    window.addEventListener('keydown', teclas)
    return () => window.removeEventListener('keydown', teclas)
  }, [irPara, proximo, anterior])
}

function useMovimentoReduzido() {
  const setReduzido = useHorizon((s) => s.setReduzido)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const aplicar = () => setReduzido(mq.matches)
    aplicar()
    mq.addEventListener('change', aplicar)
    return () => mq.removeEventListener('change', aplicar)
  }, [setReduzido])
}

declare global {
  interface Window {
    /** Só em desenvolvimento: estado e renderizador para testes e capturas. */
    __horizon?: { estado: typeof useHorizon; viewer: typeof viewerHandles }
  }
}

export function HorizonApp() {
  useAndamento()
  useNavegacao()
  useMovimentoReduzido()
  useEffect(() => {
    if (import.meta.env.DEV) window.__horizon = { estado: useHorizon, viewer: viewerHandles }
  }, [])
  const papel = useHorizon((s) => !!s.capitulo().papel)

  return (
    <>
      <div className={`app horizon${papel ? ' horizon--papel' : ''}`}>
        <div className="viewer-wrap">
          <HorizonStage />
          <div className="vignette" aria-hidden="true" />
          <div className="grain" aria-hidden="true" />
        </div>
        <TopBar />
        <PainelCapitulo />
        <LinhaDoTempo />
        <FerramentasPalco />
        <Aviso />
        <FotoAmpliada />
      </div>
      <FolhaImpressao />
    </>
  )
}
