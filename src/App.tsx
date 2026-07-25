import { useEffect } from 'react'
import { Viewer } from './three/Viewer'
import { TopBar } from './components/TopBar'
import { StepRail } from './components/StepRail'
import { Panel } from './components/Panel'
import { ViewportTools } from './components/ViewportTools'
import { DropOverlay, LoadingOverlay, Toast } from './components/Overlays'
import { PrintSheet } from './components/PrintSheet'
import { useConfigurator } from './state/store'
import { readSharedFromUrl } from './utils/share'

export default function App() {
  const applyShared = useConfigurator((s) => s.applyShared)

  useEffect(() => {
    const shared = readSharedFromUrl()
    if (shared) {
      applyShared(shared.f, shared.o, shared.l)
      useConfigurator.getState().showToast('Configuração compartilhada carregada.')
    }
  }, [applyShared])

  return (
    <>
      <div className="app">
        <div className="viewer-wrap">
          <Viewer />
          <div className="vignette" aria-hidden="true" />
          <div className="grain" aria-hidden="true" />
        </div>
        <TopBar />
        <StepRail />
        <Panel />
        <ViewportTools />
        <DropOverlay />
        <LoadingOverlay />
        <Toast />
      </div>
      <PrintSheet />
    </>
  )
}
