import { useMemo } from 'react'
import * as THREE from 'three'
import { useConfigurator } from '../state/store'
import { materialForFinish, fixed } from './materials'

interface MeshProps {
  material: THREE.Material
  position?: [number, number, number]
  rotation?: [number, number, number]
}

function B({
  size,
  material,
  position,
  rotation,
}: MeshProps & { size: [number, number, number] }) {
  return (
    <mesh material={material} position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  )
}

function Cyl({
  args,
  material,
  position,
  rotation,
}: MeshProps & {
  /** [raioTopo, raioBase, altura, segmentosRadiais] */
  args: [number, number, number, number]
}) {
  return (
    <mesh material={material} position={position} rotation={rotation} castShadow receiveShadow>
      <cylinderGeometry args={args} />
    </mesh>
  )
}

/** Círculo de parafusos decorativos na tampa da câmara. */
function BoltRing({ radius, z }: { radius: number; z: number }) {
  const bolts = useMemo(() => {
    const list: Array<[number, number]> = []
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      list.push([Math.cos(a) * radius, Math.sin(a) * radius])
    }
    return list
  }, [radius])
  return (
    <>
      {bolts.map(([x, y], i) => (
        <mesh
          key={i}
          material={fixed.inoxDetalhe}
          position={[x, y, z]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.032, 0.032, 0.05, 6]} />
        </mesh>
      ))}
    </>
  )
}

/**
 * Moinho de martelos demonstrativo, construído proceduralmente.
 * Cada grupo usa o material do acabamento escolhido na configuração.
 */
export function DemoModel() {
  const finishes = useConfigurator((s) => s.finishes)
  const options = useConfigurator((s) => s.options)

  const mCorpo = materialForFinish(finishes.corpo)
  const mEstrutura = materialForFinish(finishes.estrutura)
  const mMotor = materialForFinish(finishes.motor)
  const mPainel = materialForFinish(finishes.painel)

  return (
    <group>
      {/* ─── Estrutura e base ─── */}
      <group name="estrutura">
        <B size={[3.6, 0.18, 0.26]} material={mEstrutura} position={[0, 0.15, 0.62]} />
        <B size={[3.6, 0.18, 0.26]} material={mEstrutura} position={[0, 0.15, -0.62]} />
        <B size={[0.5, 0.16, 1.28]} material={mEstrutura} position={[-1.45, 0.16, 0]} />
        <B size={[0.5, 0.16, 1.28]} material={mEstrutura} position={[0.2, 0.16, 0]} />
        <B size={[0.5, 0.16, 1.28]} material={mEstrutura} position={[1.45, 0.16, 0]} />
        {/* coxins antivibração */}
        {[
          [-1.62, 0.62],
          [-1.62, -0.62],
          [1.62, 0.62],
          [1.62, -0.62],
        ].map(([x, z], i) => (
          <mesh key={i} material={fixed.borracha} position={[x, 0.035, z]} receiveShadow>
            <cylinderGeometry args={[0.11, 0.13, 0.07, 20]} />
          </mesh>
        ))}
        {/* colunas de apoio da câmara */}
        <B size={[0.14, 0.62, 0.14]} material={mEstrutura} position={[-1.25, 0.55, 0.44]} />
        <B size={[0.14, 0.62, 0.14]} material={mEstrutura} position={[-1.25, 0.55, -0.44]} />
        <B size={[0.14, 0.62, 0.14]} material={mEstrutura} position={[-0.15, 0.55, 0.44]} />
        <B size={[0.14, 0.62, 0.14]} material={mEstrutura} position={[-0.15, 0.55, -0.44]} />
        {/* trilhos do motor */}
        <B size={[1.35, 0.12, 0.18]} material={mEstrutura} position={[0.95, 0.3, 0.3]} />
        <B size={[1.35, 0.12, 0.18]} material={mEstrutura} position={[0.95, 0.3, -0.3]} />
      </group>

      {/* ─── Corpo de moagem ─── */}
      <group name="corpo">
        {/* câmara de moagem (eixo do rotor ao longo de Z) */}
        <Cyl
          args={[0.8, 0.8, 0.78, 40]}
          material={mCorpo}
          position={[-0.7, 1.52, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        {/* tampas laterais */}
        <Cyl
          args={[0.84, 0.84, 0.07, 40]}
          material={mCorpo}
          position={[-0.7, 1.52, 0.42]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <Cyl
          args={[0.84, 0.84, 0.07, 40]}
          material={mCorpo}
          position={[-0.7, 1.52, -0.42]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <group position={[-0.7, 1.52, 0.46]}>
          <BoltRing radius={0.72} z={0} />
        </group>
        {/* dobradiças da tampa de inspeção */}
        <B size={[0.09, 0.22, 0.1]} material={fixed.inoxDetalhe} position={[-1.52, 1.62, 0.42]} />
        <B size={[0.09, 0.22, 0.1]} material={fixed.inoxDetalhe} position={[-1.52, 1.32, 0.42]} />
        {/* garganta de alimentação */}
        <B size={[0.46, 0.5, 0.5]} material={mCorpo} position={[-0.7, 2.42, 0]} />
        {/* chute de descarga (tremonha inferior) */}
        <mesh
          material={mCorpo}
          position={[-0.7, 0.52, 0]}
          rotation={[0, Math.PI / 4, 0]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[0.72, 0.2, 0.5, 4]} />
        </mesh>
        <B size={[0.34, 0.2, 0.34]} material={mCorpo} position={[-0.7, 0.2, 0]} />

        {/* OPC-01 · moega ampliada */}
        {options.moega ? (
          <group position={[-0.7, 0, 0]}>
            <mesh
              material={mCorpo}
              position={[0, 3.02, 0]}
              rotation={[0, Math.PI / 4, 0]}
              castShadow
            >
              <cylinderGeometry args={[0.82, 0.26, 0.72, 4]} />
            </mesh>
            <mesh material={mCorpo} position={[0, 3.42, 0]} rotation={[0, Math.PI / 4, 0]}>
              <cylinderGeometry args={[0.86, 0.82, 0.1, 4]} />
            </mesh>
          </group>
        ) : (
          <B size={[0.56, 0.08, 0.6]} material={mCorpo} position={[-0.7, 2.71, 0]} />
        )}

        {/* OPC-02 · separador magnético no bocal */}
        {options.ima && (
          <group position={[-0.7, 2.42, 0]}>
            <B size={[0.62, 0.3, 0.66]} material={fixed.inoxDetalhe} position={[0, 0, 0]} />
            <B size={[0.1, 0.1, 0.72]} material={fixed.borracha} position={[-0.2, 0.12, 0]} />
            <B size={[0.1, 0.1, 0.72]} material={fixed.borracha} position={[0.2, 0.12, 0]} />
          </group>
        )}

        {/* OPC-03 · ciclone de descarga */}
        {options.ciclone && (
          <group position={[-2.55, 0, 0]}>
            <Cyl args={[0.46, 0.46, 0.95, 32]} material={mCorpo} position={[0, 2.62, 0]} />
            <Cyl args={[0.46, 0.09, 1.25, 32]} material={mCorpo} position={[0, 1.52, 0]} />
            <Cyl args={[0.09, 0.09, 0.5, 20]} material={mCorpo} position={[0, 0.75, 0]} />
            <Cyl args={[0.15, 0.15, 0.55, 24]} material={mCorpo} position={[0, 3.35, 0]} />
            {/* duto pneumático vindo do moinho */}
            <Cyl
              args={[0.13, 0.13, 1.15, 20]}
              material={mCorpo}
              position={[0.68, 2.98, 0]}
              rotation={[0, 0, Math.PI / 2]}
            />
            <Cyl args={[0.13, 0.13, 2.4, 20]} material={mCorpo} position={[1.25, 1.75, 0]} />
            <Cyl
              args={[0.13, 0.13, 0.55, 20]}
              material={mCorpo}
              position={[1.5, 0.5, 0]}
              rotation={[0, 0, Math.PI / 3]}
            />
            {/* pernas de sustentação */}
            {[0, 1, 2].map((i) => {
              const a = (i / 3) * Math.PI * 2 + Math.PI / 6
              return (
                <B
                  key={i}
                  size={[0.09, 2.1, 0.09]}
                  material={mEstrutura}
                  position={[Math.cos(a) * 0.52, 1.05, Math.sin(a) * 0.52]}
                />
              )
            })}
          </group>
        )}
      </group>

      {/* ─── Motor e transmissão ─── */}
      <group name="motor">
        <Cyl
          args={[0.33, 0.33, 0.82, 32]}
          material={mMotor}
          position={[0.95, 0.69, -0.05]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <Cyl
          args={[0.34, 0.34, 0.14, 32]}
          material={mMotor}
          position={[0.95, 0.69, -0.5]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <B size={[0.2, 0.14, 0.26]} material={mMotor} position={[0.95, 1.07, -0.1]} />
        <B size={[0.7, 0.1, 0.6]} material={mMotor} position={[0.95, 0.41, -0.05]} />
        {/* proteção da transmissão por correias (liga o motor ao rotor) */}
        <group position={[0.125, 1.1, 0.48]} rotation={[0, 0, 0.47]}>
          <B size={[1.9, 0.5, 0.13]} material={mMotor} position={[0, 0, 0]} />
          <Cyl
            args={[0.46, 0.46, 0.13, 32]}
            material={mMotor}
            position={[-0.95, 0, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <Cyl
            args={[0.3, 0.3, 0.13, 32]}
            material={mMotor}
            position={[0.95, 0, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          />
        </group>
      </group>

      {/* ─── Painel de comando ─── */}
      <group name="painel" position={[2.35, 0, -0.55]}>
        <B size={[0.62, 1.55, 0.4]} material={mPainel} position={[0, 0.95, 0]} />
        <B size={[0.56, 0.06, 0.34]} material={mPainel} position={[0, 1.76, 0]} />
        <B size={[0.12, 0.16, 0.12]} material={fixed.borracha} position={[-0.2, 0.08, 0]} />
        <B size={[0.12, 0.16, 0.12]} material={fixed.borracha} position={[0.2, 0.08, 0]} />
        {/* porta: friso */}
        <B size={[0.54, 1.4, 0.015]} material={mPainel} position={[0, 0.95, 0.205]} />
        {/* tela IHM (OPC-05 liga a tela colorida) */}
        <B
          size={[0.3, 0.22, 0.03]}
          material={options.ihm ? fixed.telaLigada : fixed.telaDesligada}
          position={[0, 1.38, 0.215]}
        />
        {/* botões */}
        {[-0.14, 0, 0.14].map((x, i) => (
          <mesh
            key={i}
            material={i === 2 ? fixed.luzVermelha : fixed.botao}
            position={[x, 1.05, 0.22]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.035, 0.035, 0.04, 16]} />
          </mesh>
        ))}
        {/* chave geral */}
        <B size={[0.1, 0.14, 0.05]} material={fixed.borracha} position={[0.16, 0.72, 0.22]} />

        {/* OPC-06 · sinalizador de status */}
        {options.sinalizador && (
          <group position={[0, 1.79, 0]}>
            <Cyl args={[0.02, 0.02, 0.3, 12]} material={fixed.inoxDetalhe} position={[0, 0.15, 0]} />
            <Cyl args={[0.055, 0.055, 0.09, 20]} material={fixed.luzVerde} position={[0, 0.36, 0]} />
            <Cyl args={[0.055, 0.055, 0.09, 20]} material={fixed.luzAmbar} position={[0, 0.46, 0]} />
            <Cyl
              args={[0.055, 0.055, 0.09, 20]}
              material={fixed.luzVermelha}
              position={[0, 0.56, 0]}
            />
            <Cyl args={[0.06, 0.06, 0.025, 20]} material={fixed.borracha} position={[0, 0.62, 0]} />
          </group>
        )}
      </group>

      {/* ─── OPC-04 · plataforma de operação ─── */}
      {options.plataforma && (
        <group name="plataforma" position={[-0.7, 0, -1.35]}>
          <B size={[1.7, 0.07, 0.85]} material={mEstrutura} position={[0, 1.62, 0]} />
          {[
            [-0.78, -0.36],
            [-0.78, 0.36],
            [0.78, -0.36],
            [0.78, 0.36],
          ].map(([x, z], i) => (
            <B key={i} size={[0.09, 1.62, 0.09]} material={mEstrutura} position={[x, 0.81, z]} />
          ))}
          {/* guarda-corpo */}
          <B size={[1.7, 0.05, 0.05]} material={mEstrutura} position={[0, 2.62, -0.4]} />
          <B size={[1.7, 0.05, 0.05]} material={mEstrutura} position={[0, 2.2, -0.4]} />
          <B size={[0.05, 1.05, 0.05]} material={mEstrutura} position={[-0.8, 2.12, -0.4]} />
          <B size={[0.05, 1.05, 0.05]} material={mEstrutura} position={[0.8, 2.12, -0.4]} />
          <B size={[0.05, 0.05, 0.8]} material={mEstrutura} position={[-0.8, 2.62, 0]} />
          <B size={[0.05, 0.05, 0.8]} material={mEstrutura} position={[0.8, 2.62, 0]} />
          {/* escada lateral */}
          <group position={[1.15, 0, 0.1]} rotation={[0, 0, 0]}>
            <B size={[0.06, 1.68, 0.06]} material={mEstrutura} position={[0, 0.84, 0.28]} />
            <B size={[0.06, 1.68, 0.06]} material={mEstrutura} position={[0, 0.84, -0.28]} />
            {[0.3, 0.62, 0.94, 1.26, 1.55].map((y, i) => (
              <mesh
                key={i}
                material={fixed.inoxDetalhe}
                position={[0, y, 0]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow
              >
                <cylinderGeometry args={[0.025, 0.025, 0.56, 12]} />
              </mesh>
            ))}
          </group>
        </group>
      )}
    </group>
  )
}
