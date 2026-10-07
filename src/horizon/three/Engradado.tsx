// Engradado de expedição: estrado de madeira, quadro de cantoneiras, tábuas laterais e de topo que aparecem
// conforme o fechamento (fração do passo "Embalagem") e cintas de arqueação depois do carregamento.
// Envolve o dosador: ~3,4 × 1,3 × 2,3 m, centrado na origem do grupo pai, piso em y = 0.
import { useMemo } from 'react'
import type * as THREE from 'three'
import { caixa, cantoneira, cinta, madeira, madeiraEscura } from './materiais'

/** Altura do estrado: o dosador sobe este tanto na expedição. */
export const ALTURA_DO_ESTRADO = 0.14

const HX = 1.7 // meia largura (x)
const HZ = 0.65 // meia profundidade (z)
const TOPO = 2.3 // altura total
const TABUA = 0.14 // largura das tábuas
const PASSO = 0.155 // tábua + fresta

interface Tabua {
  geo: THREE.BoxGeometry
  pos: [number, number, number]
}

/** Tábuas na ordem em que são pregadas: por nível, lados longos, lados curtos; por fim o topo. */
function tabuasDeFechamento(): Tabua[] {
  const lista: Tabua[] = []
  const longa = caixa(2 * HX, TABUA, 0.02)
  const curta = caixa(0.02, TABUA, 2 * HZ)
  for (let y = ALTURA_DO_ESTRADO + TABUA / 2; y + TABUA / 2 <= TOPO + 0.001; y += PASSO) {
    lista.push({ geo: longa, pos: [0, y, HZ + 0.01] })
    lista.push({ geo: longa, pos: [0, y, -HZ - 0.01] })
    lista.push({ geo: curta, pos: [HX + 0.01, y, 0] })
    lista.push({ geo: curta, pos: [-HX - 0.01, y, 0] })
  }
  const topo = caixa(TABUA, 0.02, 2 * HZ + 0.04)
  for (let x = -HX + TABUA / 2; x + TABUA / 2 <= HX + 0.001; x += PASSO) {
    lista.push({ geo: topo, pos: [x, TOPO + 0.01, 0] })
  }
  return lista
}

export interface EngradadoProps {
  /** 0 = só o estrado e o quadro; 1 = todas as tábuas no lugar. */
  fechamento: number
  /** Cintas de arqueação (carregamento concluído). */
  cintas: boolean
}

export function Engradado({ fechamento, cintas }: EngradadoProps) {
  const tabuas = useMemo(tabuasDeFechamento, [])
  const f = Math.min(1, Math.max(0, Number.isFinite(fechamento) ? fechamento : 0))
  const mostradas = Math.round(tabuas.length * f)

  const longarina = caixa(2 * HX, 0.1, 0.1)
  const tabuaDoEstrado = caixa(0.12, 0.04, 2 * HZ)
  const poste = caixa(0.05, TOPO - ALTURA_DO_ESTRADO, 0.05)
  const barraX = caixa(2 * HX, 0.05, 0.05)
  const barraZ = caixa(0.05, 0.05, 2 * HZ)
  const cintaTopo = caixa(0.05, 0.008, 2 * HZ + 0.08)
  const cintaLado = caixa(0.05, TOPO + 0.04, 0.008)

  const tabuasDoEstrado = useMemo(() => {
    const xs: number[] = []
    for (let x = -HX + 0.1; x <= HX - 0.1 + 0.001; x += 0.25) xs.push(x)
    return xs
  }, [])

  return (
    <group name="engradado">
      {/* estrado */}
      {[-HZ + 0.05, 0, HZ - 0.05].map((z) => (
        <mesh key={`l${z}`} geometry={longarina} material={madeiraEscura} position={[0, 0.05, z]} castShadow receiveShadow />
      ))}
      {tabuasDoEstrado.map((x) => (
        <mesh key={`e${x}`} geometry={tabuaDoEstrado} material={madeira} position={[x, 0.12, 0]} castShadow receiveShadow />
      ))}

      {/* quadro de cantoneiras */}
      {[
        [HX - 0.025, HZ - 0.025],
        [HX - 0.025, -HZ + 0.025],
        [-HX + 0.025, HZ - 0.025],
        [-HX + 0.025, -HZ + 0.025],
      ].map(([x, z]) => (
        <mesh
          key={`p${x}${z}`}
          geometry={poste}
          material={cantoneira}
          position={[x, ALTURA_DO_ESTRADO + (TOPO - ALTURA_DO_ESTRADO) / 2, z]}
          castShadow
        />
      ))}
      <mesh geometry={barraX} material={cantoneira} position={[0, TOPO - 0.025, HZ - 0.025]} castShadow />
      <mesh geometry={barraX} material={cantoneira} position={[0, TOPO - 0.025, -HZ + 0.025]} castShadow />
      <mesh geometry={barraZ} material={cantoneira} position={[HX - 0.025, TOPO - 0.025, 0]} castShadow />
      <mesh geometry={barraZ} material={cantoneira} position={[-HX + 0.025, TOPO - 0.025, 0]} castShadow />

      {/* tábuas de fechamento, na ordem de pregação */}
      {tabuas.slice(0, mostradas).map((t, i) => (
        <mesh key={i} geometry={t.geo} material={madeira} position={t.pos} castShadow receiveShadow />
      ))}

      {/* cintas de arqueação */}
      {cintas &&
        [-1.0, 0, 1.0].map((x) => (
          <group key={`c${x}`}>
            <mesh geometry={cintaTopo} material={cinta} position={[x, TOPO + 0.025, 0]} />
            <mesh geometry={cintaLado} material={cinta} position={[x, (TOPO + 0.04) / 2, HZ + 0.035]} />
            <mesh geometry={cintaLado} material={cinta} position={[x, (TOPO + 0.04) / 2, -HZ - 0.035]} />
          </group>
        ))}
    </group>
  )
}
