import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  OrbitControls,
  Environment,
  Lightformer,
  MeshReflectorMaterial,
} from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useConfigurator, DEMO_STEPS, IMPORT_STEPS } from '../state/store'
import { DemoModel } from './DemoModel'
import { ImportedModel } from './ImportedModel'
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

function StageLights() {
  return (
    <>
      <ambientLight intensity={0.22} />
      <directionalLight
        position={[6, 9, 5]}
        intensity={2.1}
        color="#fdf7ec"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[-7, 5, -3]} intensity={0.5} color="#a8c4e0" />
      <pointLight position={[0, 3.4, -7]} intensity={26} color="#3b8de0" distance={16} />
      {/* Ambiente procedural: estúdio industrial com claraboias — dá vida ao inox */}
      <Environment resolution={512} frames={1}>
        {/* domo base suave para o metal nunca ler como preto */}
        <Lightformer
          form="rect"
          intensity={0.55}
          color="#3c444c"
          position={[0, 10, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[40, 40, 1]}
        />
        {/* claraboias em faixa */}
        <Lightformer
          form="rect"
          intensity={3.2}
          position={[0, 7, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[2.2, 14, 1]}
        />
        <Lightformer
          form="rect"
          intensity={2.6}
          position={[-4, 7, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[1.6, 14, 1]}
        />
        <Lightformer
          form="rect"
          intensity={2.6}
          position={[4, 7, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[1.6, 14, 1]}
        />
        {/* paredes de estúdio */}
        <Lightformer
          form="rect"
          intensity={1.6}
          color="#bcd6ee"
          position={[-9, 3, 2]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[10, 5, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.1}
          color="#e8d9bd"
          position={[9, 2.6, -2]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[9, 4.5, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.8}
          color="#9fb4c8"
          position={[0, 3, -10]}
          rotation={[0, 0, 0]}
          scale={[12, 4, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.5}
          color="#6d7680"
          position={[0, 2.5, 10]}
          rotation={[0, Math.PI, 0]}
          scale={[12, 3.5, 1]}
        />
      </Environment>
    </>
  )
}

function Floor() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[22, 72]} />
        <MeshReflectorMaterial
          blur={[280, 90]}
          resolution={1024}
          mixBlur={1}
          mixStrength={38}
          roughness={0.92}
          depthScale={1.2}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.3}
          color="#101418"
          metalness={0.55}
          mirror={0.55}
        />
      </mesh>
      {/* anel de palco */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[4.55, 4.62, 128]} />
        <meshBasicMaterial color="#3b8de0" transparent opacity={0.4} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, 0]}>
        <ringGeometry args={[4.62, 5.0, 128]} />
        <meshBasicMaterial color="#3b8de0" transparent opacity={0.05} />
      </mesh>
    </>
  )
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
