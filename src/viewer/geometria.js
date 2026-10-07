// Utilidades de geometria.

const cacheFechado = new WeakMap();

/**
 * Verifica se a geometria é um sólido fechado (toda aresta orientada tem a sua oposta).
 * Só sólidos fechados recebem tampa de corte: em cascas abertas a contagem de stencil
 * não fecha e a tampa "vazaria" pela tela.
 */
export function geometriaFechada(geo) {
  if (cacheFechado.has(geo)) return cacheFechado.get(geo);
  const pos = geo.attributes.position;
  let fechado = false;
  if (pos && pos.count >= 4 && pos.count < 400000) {
    // solda vértices coincidentes (normais/UVs duplicam vértices nas quinas)
    const ids = new Uint32Array(pos.count);
    const mapa = new Map();
    const q = 1e4; // décimo de milímetro
    let prox = 0;
    for (let i = 0; i < pos.count; i += 1) {
      const k = `${Math.round(pos.getX(i) * q)}_${Math.round(pos.getY(i) * q)}_${Math.round(pos.getZ(i) * q)}`;
      let id = mapa.get(k);
      if (id === undefined) { id = prox; prox += 1; mapa.set(k, id); }
      ids[i] = id;
    }
    const idx = geo.index;
    const n = idx ? idx.count : pos.count;
    const arestas = new Map();
    const N = prox + 1;
    let validos = 0;
    for (let i = 0; i + 2 < n; i += 3) {
      const a = ids[idx ? idx.getX(i) : i];
      const b = ids[idx ? idx.getX(i + 1) : i + 1];
      const c = ids[idx ? idx.getX(i + 2) : i + 2];
      if (a === b || b === c || a === c) continue; // triângulo degenerado
      validos += 1;
      for (const [u, v] of [[a, b], [b, c], [c, a]]) {
        const direta = u * N + v;
        const oposta = v * N + u;
        const pend = arestas.get(oposta);
        if (pend) {
          if (pend === 1) arestas.delete(oposta); else arestas.set(oposta, pend - 1);
        } else {
          arestas.set(direta, (arestas.get(direta) || 0) + 1);
        }
      }
    }
    fechado = validos >= 4 && arestas.size === 0;
  }
  cacheFechado.set(geo, fechado);
  return fechado;
}

/** Caixa (mundo) das malhas aceitas pelo filtro. */
export function caixaDe(THREE, raiz, filtro) {
  const caixa = new THREE.Box3();
  const tmp = new THREE.Box3();
  raiz.traverse((o) => {
    if (!o.isMesh || o.userData.__vwAuxiliar || (filtro && !filtro(o))) return;
    tmp.setFromObject(o);
    if (!tmp.isEmpty()) caixa.union(tmp);
  });
  return caixa;
}
