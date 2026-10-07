import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useConfigurator, DEMO_STEPS, IMPORT_STEPS } from '../state/store'
import { DemoModel } from './DemoModel'
import { ImportedModel } from './ImportedModel'
import { StageLights, Floor } from './stage'
import { viewerHandles } from '../utils/viewerHandles'

const PRESETS: Record<string, { pos: [number, number, number]; tgt: [number, number, number] }> = {
  produto: { pos: [8.2, 3.4, 9.0], tgt: [0, 1.2, 0] },
  acabamento: { pos: [4.4, 2.4, 6.6], tgt: [-0.4, 1.3, 0] },
  opcionais: { pos: [-7.4, 3.6, 7.2], tgt: [-0.7, 1.5, 0] },
  pecas: { pos: [6.6, 3.3, 8.6], tgt: [0, 1.3, 0] },
  resumo: { pos: [9.2, 4.6, 10.2], tgt: [0, 1.3, 0] },
}

function CameraRig() {
  const source = useConfigurator((s) => s.source)
  const step = useConfigurator((s) => s.step)
  const cameraNonce = useConfigurator((s) => s.cameraNonce)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const anim = useRef<{ pos: THREE.Vector3; tgt: THREE.Vector3 } | null>(null)

  useEffect(() => {
    const steps = source === 'demo' ? DEMO_STEPS : IMPORT_STEPS
    const stepId = steps[Math.min(step, steps.length - 1)].id
    const preset = PRESETS[stepId] ?? PRESETS.produto
    anim.current = {
      pos: new THREE.Vector3(...preset.pos),
      tgt: new THREE.Vector3(...preset.tgt),
    }
  }, [source, step, cameraNonce])

  useEffect(() => {
    if (!controls) return
    const cancel = () => {
      anim.current = null
    }
    controls.addEventListener('start', cancel)
    return () => controls.removeEventListener('start', cancel)
  }, [controls])

  useFrame((_, delta) => {
    const target = anim.current
    if (!target || !controls) return
    const k = 1 - Math.pow(0.002, Math.min(delta, 0.05))
    camera.position.lerp(target.pos, k)
    controls.target.lerp(target.tgt, k)
    controls.update()
    if (
      camera.position.distanceTo(target.pos) < 0.02 &&
      controls.target.distanceTo(target.tgt) < 0.02
    ) {
      anim.current = null
    }
  })

  return null
}

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

export function Viewer() {
  const source = useConfigurator((s) => s.source)
  const autoRotate = useConfigurator((s) => s.autoRotate)
  const setAutoRotate = useConfigurator((s) => s.setAutoRotate)

  return (
    <Canvas
      className="viewer-canvas"
      shadows
      dpr={[1, 2]}
      camera={{ position: [15, 8, 17], fov: 30, near: 0.1, far: 120 }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
    >
      <color attach="background" args={['#0b0e11']} />
      <fog attach="fog" args={['#0b0e11', 20, 46]} />
      <StageLights />
      <Floor />
      {source === 'demo' ? <DemoModel /> : <ImportedModel />}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={2.5}
        maxDistance={26}
        maxPolarAngle={Math.PI / 2 - 0.04}
        target={[0, 1.2, 0]}
        autoRotate={autoRotate}
        autoRotateSpeed={0.55}
        onStart={() => {
          if (useConfigurator.getState().autoRotate) setAutoRotate(false)
        }}
      />
      <CameraRig />
      <ViewerBindings />
    </Canvas>
  )
}
