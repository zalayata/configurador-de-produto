// Palco 3D do controle de produção: Canvas com luzes e piso compartilhados (src/three/stage), o modelo do
// dosador, controles de órbita, câmera animada por capítulo (cameras.ts) e as referências do renderizador para a
// captura PNG e a folha de impressão (viewerHandles). O contêiner leva um texto alternativo com o estado do dia.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useHorizon } from '../estado'
import { Floor, StageLights } from '../../three/stage'
import { viewerHandles } from '../../utils/viewerHandles'
import { DosadorModel, rotuloDoModelo } from './DosadorModel'
import { PRESET_INICIAL, presetParaLargura } from './cameras'

/** Leva a câmera ao preset do capítulo (lerp); o arrasto do usuário cancela; com movimento reduzido vai direto. */
function CameraRig() {
  const capituloId = useHorizon((s) => s.capituloId)
  const cameraNonce = useHorizon((s) => s.cameraNonce)
  const reduzido = useHorizon((s) => s.reduzido)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const anim = useRef<{ pos: THREE.Vector3; tgt: THREE.Vector3 } | null>(null)

  useEffect(() => {
    const preset = presetParaLargura(capituloId, window.innerWidth)
    const pos = new THREE.Vector3(...preset.pos)
    const tgt = new THREE.Vector3(...preset.tgt)
    if (reduzido) {
      camera.position.copy(pos)
      if (controls) {
        controls.target.copy(tgt)
        controls.update()
      } else {
        camera.lookAt(tgt)
      }
      anim.current = null
      return
    }
    anim.current = { pos, tgt }
  }, [capituloId, cameraNonce, reduzido, camera, controls])

  useEffect(() => {
    if (!controls) return
    const cancelar = () => {
      anim.current = null
    }
    controls.addEventListener('start', cancelar)
    return () => controls.removeEventListener('start', cancelar)
  }, [controls])

  useFrame((_, delta) => {
    const alvo = anim.current
    if (!alvo || !controls) return
    const k = 1 - Math.pow(0.002, Math.min(delta, 0.05))
    camera.position.lerp(alvo.pos, k)
    controls.target.lerp(alvo.tgt, k)
    controls.update()
    if (camera.position.distanceTo(alvo.pos) < 0.02 && controls.target.distanceTo(alvo.tgt) < 0.02) {
      camera.position.copy(alvo.pos)
      controls.target.copy(alvo.tgt)
      controls.update()
      anim.current = null
    }
  })

  return null
}

/** Referências do renderizador fora do React (captura PNG, impressão). */
function ViewerBindings() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    viewerHandles.gl = gl
    viewerHandles.scene = scene
    viewerHandles.camera = camera
    return () => {
      viewerHandles.gl = null
      viewerHandles.scene = null
      viewerHandles.camera = null
    }
  }, [gl, scene, camera])
  return null
}

export function HorizonStage() {
  const autoRotate = useHorizon((s) => s.autoRotate)
  const setAutoRotate = useHorizon((s) => s.setAutoRotate)
  const reduzido = useHorizon((s) => s.reduzido)
  const capitulo = useHorizon((s) => s.capitulo())
  const etapa = useHorizon((s) => s.etapaDoCapitulo())
  const rotulo = rotuloDoModelo(capitulo, etapa)

  return (
    <div className="palco-3d" role="img" aria-label={rotulo} style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        className="viewer-canvas"
        shadows
        dpr={[1, 2]}
        camera={{ position: PRESET_INICIAL.pos, fov: 30, near: 0.1, far: 120 }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <color attach="background" args={['#0b0e11']} />
        <fog attach="fog" args={['#0b0e11', 14, 34]} />
        <StageLights />
        <Floor ringRadius={2.4} />
        <DosadorModel />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={1.6}
          maxDistance={14}
          maxPolarAngle={Math.PI / 2 - 0.04}
          target={PRESET_INICIAL.tgt}
          autoRotate={autoRotate && !reduzido}
          autoRotateSpeed={0.5}
          onStart={() => {
            if (useHorizon.getState().autoRotate) setAutoRotate(false)
          }}
        />
        <CameraRig />
        <ViewerBindings />
      </Canvas>
    </div>
  )
}
