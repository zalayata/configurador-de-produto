// Ferramentas do palco 3D (girar, centralizar, capturar, tela cheia) lendo o estado da página de produção.
// Mesmos ícones do configurador (ViewportTools). Some no capítulo em papel (Atualizações).
import { useHorizon } from '../estado'
import { downloadSnapshot } from '../../utils/viewerHandles'

export function FerramentasPalco() {
  const autoRotate = useHorizon((s) => s.autoRotate)
  const setAutoRotate = useHorizon((s) => s.setAutoRotate)
  const recentrarCamera = useHorizon((s) => s.recentrarCamera)
  const showToast = useHorizon((s) => s.showToast)
  const capituloId = useHorizon((s) => s.capituloId)
  const papel = useHorizon((s) => !!s.capitulo().papel)

  if (papel) return null

  const telaCheia = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
      return
    }
    const pedido = document.documentElement.requestFullscreen?.()
    if (!pedido) {
      showToast('Use a tela cheia do navegador (F11).')
      return
    }
    pedido.catch(() => showToast('Use a tela cheia do navegador (F11).'))
  }

  const capturar = () => {
    if (!downloadSnapshot(`dosador-horizon-${capituloId}.png`)) {
      showToast('A imagem fica pronta assim que o modelo 3D carregar.')
    }
  }

  return (
    <div className="viewport-tools hz-ferramentas" role="toolbar" aria-label="Ferramentas do palco 3D">
      <button
        type="button"
        className={`tool-chip hz-tool${autoRotate ? ' is-active' : ''}`}
        onClick={() => setAutoRotate(!autoRotate)}
        aria-pressed={autoRotate}
        title="Rotação automática"
      >
        <OrbitIcon />
        <span className="tool-chip-label">Girar</span>
      </button>
      <button type="button" className="tool-chip hz-tool" onClick={recentrarCamera} title="Reenquadrar câmera">
        <TargetIcon />
        <span className="tool-chip-label">Centralizar</span>
      </button>
      <button type="button" className="tool-chip hz-tool" onClick={capturar} title="Capturar imagem PNG">
        <CameraIcon />
        <span className="tool-chip-label">Capturar</span>
      </button>
      <button type="button" className="tool-chip hz-tool" onClick={telaCheia} title="Alternar tela cheia">
        <ExpandIcon />
        <span className="tool-chip-label">Tela cheia</span>
      </button>
    </div>
  )
}

function OrbitIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M19.4 7.3c1.6 1 2.6 2.2 2.6 3.4 0 2.9-4.5 5.3-10 5.3S2 13.6 2 10.7c0-1.2 1-2.4 2.6-3.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function TargetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 2v4m0 12v4M2 12h4m12 0h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.6l1.5-2.2h6.8L16.9 7h2.6A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

function ExpandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 3H3v6m12-6h6v6M9 21H3v-6m12 6h6v-6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
