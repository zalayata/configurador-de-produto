// Palco compartilhado pelas páginas 3D (configurador e controle de produção): luzes de estúdio industrial,
// ambiente procedural e piso refletivo com o anel de palco na cor da marca.
import { Environment, Lightformer, MeshReflectorMaterial } from '@react-three/drei'

export function StageLights() {
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
      <pointLight position={[0, 3.4, -7]} intensity={24} color="#d3564f" distance={16} />
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

export function Floor({ ringRadius = 4.55 }: { ringRadius?: number }) {
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
        <ringGeometry args={[ringRadius, ringRadius + 0.07, 128]} />
        <meshBasicMaterial color="#d3262c" transparent opacity={0.45} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, 0]}>
        <ringGeometry args={[ringRadius + 0.07, ringRadius + 0.45, 128]} />
        <meshBasicMaterial color="#d3262c" transparent opacity={0.05} />
      </mesh>
    </>
  )
}
