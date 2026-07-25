import { useConfigurator } from '../state/store'
import { downloadSnapshot } from '../utils/viewerHandles'

export function ViewportTools() {
  const autoRotate = useConfigurator((s) => s.autoRotate)
  const setAutoRotate = useConfigurator((s) => s.setAutoRotate)
  const recenterCamera = useConfigurator((s) => s.recenterCamera)
  const showToast = useConfigurator((s) => s.showToast)

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void document.documentElement.requestFullscreen().catch(() => {
        showToast('Tela cheia não disponível neste navegador.')
      })
    }
  }

  return (
    <div className="viewport-tools">
      <button
        type="button"
        className={`tool-chip${autoRotate ? ' is-active' : ''}`}
        onClick={() => setAutoRotate(!autoRotate)}
        title="Rotação automática"
      >
        <OrbitIcon />
        <span className="tool-chip-label">Girar</span>
      </button>
      <button
        type="button"
        className="tool-chip"
        onClick={recenterCamera}
        title="Reenquadrar câmera"
      >
        <TargetIcon />
        <span className="tool-chip-label">Centralizar</span>
      </button>
      <button
        type="button"
        className="tool-chip"
        onClick={() => {
          if (!downloadSnapshot('configuracao-idugel.png')) {
            showToast('Não foi possível capturar a imagem.')
          }
        }}
        title="Capturar imagem PNG"
      >
        <CameraIcon />
        <span className="tool-chip-label">Capturar</span>
      </button>
      <button
        type="button"
        className="tool-chip"
        onClick={toggleFullscreen}
        title="Alternar tela cheia"
      >
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
