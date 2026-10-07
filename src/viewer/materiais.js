// Gerência de materiais do visualizador.
//
// O visualizador NUNCA altera os materiais do modelo: cada material original recebe um clone
// "instrumentado" (onBeforeCompile) e as malhas passam a usar o clone. Ao descartar o
// visualizador, os materiais originais voltam intactos para as malhas.
//
// O clone ganha, no shader:
//   - cor de escopo com frente de onda por altura (uVwFrente), preservando relevo/sombreamento;
//   - fantasma translúcido com realce de borda (uVwFantasma);
//   - realce da peça sob o cursor (uVwRealce).
import { CORES_ESCOPO } from './constantes.js';

const GRANDE = 1e4;

const VERTEX_DECL = /* glsl */ `
varying vec3 vVwPos;
`;
const VERTEX_CORPO = /* glsl */ `
{
  vec4 vwP = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    vwP = instanceMatrix * vwP;
  #endif
  vVwPos = ( modelMatrix * vwP ).xyz;
}
`;
const FRAG_DECL = /* glsl */ `
varying vec3 vVwPos;
uniform vec3 uVwEscopo;
uniform float uVwFantasma;
uniform float uVwRealce;
uniform float uVwFrente;
uniform float uVwFaixa;
uniform float uVwInverte;
uniform float uVwBrilho;
uniform vec3 uVwCorRealce;
uniform vec3 uVwCorFantasma;
`;
const FRAG_COR = /* glsl */ `
float vwF = smoothstep( uVwFrente - uVwFaixa, uVwFrente + uVwFaixa, vVwPos.y );
float vwK = mix( 1.0 - vwF, vwF, uVwInverte );
{
  // a luminância do material original modula a cor de escopo: peças claras ficam mais vivas,
  // peças escuras mais profundas — o modelo continua "legível" mesmo todo de uma cor
  float vwL = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
  vec3 vwTinta = uVwEscopo * mix( 0.5, 0.82, smoothstep( 0.0, 0.85, vwL ) );
  diffuseColor.rgb = mix( diffuseColor.rgb, vwTinta, vwK );
}
`;
const FRAG_METAL = /* glsl */ `
metalnessFactor = mix( metalnessFactor, min( metalnessFactor, 0.12 ), vwK );
roughnessFactor = mix( roughnessFactor, clamp( roughnessFactor, 0.6, 0.85 ), vwK );
`;
const FRAG_EMISSIVO = /* glsl */ `
float vwBorda = pow( 1.0 - clamp( abs( dot( normalize( normal ), normalize( vViewPosition ) ) ), 0.0, 1.0 ), 2.2 );
{
  float vwCrista = 1.0 - smoothstep( 0.0, uVwFaixa * 1.4, abs( vVwPos.y - uVwFrente ) );
  totalEmissiveRadiance += mix( uVwEscopo, vec3( 1.0 ), 0.35 ) * vwCrista * vwCrista * uVwBrilho * 2.4;
}
`;
const FRAG_FINAL = /* glsl */ `
// realce por mistura (e não por soma): continua visível em peças brancas
{
  // clareia a peça preservando o matiz (a cor de escopo continua legível);
  // em peças já muito claras o realce puxa para um azul frio
  float vwLr = dot( gl_FragColor.rgb, vec3( 0.299, 0.587, 0.114 ) );
  vec3 vwAlvo = mix( vec3( 1.0 ), uVwCorRealce, smoothstep( 0.55, 0.85, vwLr ) );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, vwAlvo, uVwRealce * ( 0.14 + 0.5 * vwBorda ) );
}
if ( uVwFantasma > 0.001 ) {
  float vwCinza = dot( gl_FragColor.rgb, vec3( 0.299, 0.587, 0.114 ) );
  vec3 vwG = mix( vec3( vwCinza ), uVwCorFantasma, 0.6 );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, vwG, uVwFantasma * 0.9 );
  gl_FragColor.a *= mix( 1.0, mix( 0.035, 0.34, vwBorda ), uVwFantasma );
}
`;

function injetar(fonte, marcador, codigo, antes = false) {
  if (!fonte.includes(marcador)) return fonte;
  return fonte.replace(marcador, antes ? `${codigo}\n${marcador}` : `${marcador}\n${codigo}`);
}

export class GerenteMateriais {
  constructor(THREE, { raiz, limites, subgrupos = null }) {
    this.THREE = THREE;
    this.raiz = raiz;
    this.limites = limites;
    this.registros = []; // { malha, original, clones, sombraOriginal }
    this.grupos = new Map(); // id -> { id, escopo, materiais:Set, malhas:[], fantasma, realce }
    // subgrupos do modelo (p. ex. `motor-a-sup`): parte de um grupo isolável sozinha. O fantasma de cada peça
    // é o menor entre o do grupo e o da parte; a parte começa neutra (1) e só a parte isolada desce a 0.
    this.partes = new Map(); // id -> { id, grupoId, materiais:Set, fantasma }
    this._parteDoObjeto = new Map(Object.entries(subgrupos || {}).map(([id, o]) => [o, id]));
    this.clones = new Map(); // chave original|grupo -> clone
    this.planos = null;
    this.compartilhados = {
      uVwFrente: { value: -GRANDE },
      uVwFaixa: { value: 0.09 },
      uVwInverte: { value: 0 },
      uVwBrilho: { value: 0 },
      uVwCorRealce: { value: new THREE.Color(0.32, 0.6, 0.92) },
      uVwCorFantasma: { value: new THREE.Color(0.56, 0.66, 0.74) },
    };
    this.sincronizar();
  }

  /** Registra malhas ainda não instrumentadas (também após o modelo reconstruir peças). */
  sincronizar() {
    const conhecidas = new Set(this.registros.map((r) => r.malha));
    const vivas = new Set();
    this.raiz.traverse((o) => {
      if (!o.isMesh || o.userData.__vwAuxiliar) return;
      vivas.add(o);
      if (conhecidas.has(o)) {
        // o modelo pode ter trocado o material da malha por um novo
        const reg = this.registros.find((r) => r.malha === o);
        const atual = o.material;
        const ehClone = Array.isArray(atual) ? atual.every((m) => m.userData.__vwClone) : atual.userData.__vwClone;
        if (!ehClone) this._instrumentar(o, reg);
        return;
      }
      const reg = { malha: o, original: null, clones: null, sombraOriginal: o.castShadow };
      this.registros.push(reg);
      this._instrumentar(o, reg);
    });
    // malhas removidas pelo modelo
    this.registros = this.registros.filter((r) => {
      if (vivas.has(r.malha)) return true;
      const g = this.grupos.get(r.grupoId);
      if (g) g.malhas = g.malhas.filter((m) => m !== r.malha);
      return false;
    });
  }

  _instrumentar(malha, reg) {
    const ud = malha.userData || {};
    const grupoId = ud.groupId || '__sem-grupo';
    const escopo = ud.scope || 'existente';
    let grupo = this.grupos.get(grupoId);
    if (!grupo) {
      grupo = { id: grupoId, escopo, materiais: new Set(), malhas: [], fantasma: 0, realce: 0 };
      this.grupos.set(grupoId, grupo);
    }
    reg.grupoId = grupoId;
    const parte = this._parteDe(malha, grupoId);
    reg.parteId = parte ? parte.id : null;
    reg.original = malha.material;
    const lista = Array.isArray(malha.material) ? malha.material : [malha.material];
    const clones = lista.map((m) => this._clonar(m, grupo, parte));
    reg.clones = clones;
    malha.material = Array.isArray(malha.material) ? clones : clones[0];
    if (!grupo.malhas.includes(malha)) grupo.malhas.push(malha);
    if (this._fantasmaDe(grupo, parte) > 0.5) malha.castShadow = false;
  }

  /** Subgrupo mais próximo da malha (ancestral registrado em `subgrupos` com id diferente do grupo). */
  _parteDe(malha, grupoId) {
    for (let o = malha.parent; o && o !== this.raiz; o = o.parent) {
      const id = this._parteDoObjeto.get(o);
      if (id === undefined) continue;
      if (id === grupoId) return null;
      let parte = this.partes.get(id);
      if (!parte) {
        parte = { id, grupoId, materiais: new Set(), fantasma: 1 };
        this.partes.set(id, parte);
      }
      return parte;
    }
    return null;
  }

  _fantasmaDe(grupo, parte) {
    return parte ? Math.min(grupo.fantasma, parte.fantasma) : grupo.fantasma;
  }

  /** Subgrupo (id) de uma malha do modelo, ou null. */
  parteDaMalha(malha) {
    return this.registros.find((r) => r.malha === malha)?.parteId || null;
  }

  _clonar(original, grupo, parte = null) {
    const THREE = this.THREE;
    const chave = parte ? `${original.uuid}|${grupo.id}|${parte.id}` : `${original.uuid}|${grupo.id}`;
    const existente = this.clones.get(chave);
    if (existente) return existente;

    let m;
    if (original.isMeshStandardMaterial) {
      m = original.clone();
    } else {
      m = new THREE.MeshStandardMaterial({
        color: original.color ? original.color.clone() : new THREE.Color(0xffffff),
        map: original.map || null,
        transparent: !!original.transparent,
        opacity: original.opacity ?? 1,
        side: original.side ?? THREE.FrontSide,
        alphaTest: original.alphaTest || 0,
        roughness: 0.7,
        metalness: 0,
      });
    }
    // Transmissão exige um passe extra de renderização e não convive com a tampa de corte
    // (o alvo de transmissão não tem stencil): o visualizador usa transparência simples.
    let vidro = !!(original.transparent && (original.opacity ?? 1) < 0.9);
    if (m.transmission > 0) {
      m.transmission = 0;
      m.thickness = 0;
      m.transparent = true;
      m.opacity = Math.min(m.opacity, 0.3);
      m.depthWrite = false;
      vidro = true;
    }
    const proprios = {
      uVwEscopo: { value: new THREE.Color(CORES_ESCOPO[grupo.escopo] || '#8C9296') },
      uVwFantasma: { value: 0 },
      uVwRealce: { value: 0 },
    };
    m.userData = {
      ...m.userData,
      __vwClone: true,
      vw: {
        proprios,
        vidro,
        base: { transparent: m.transparent, depthWrite: m.depthWrite, side: m.side, clipShadows: m.clipShadows },
        grupo,
        parte,
      },
    };
    const compilarOriginal = original.onBeforeCompile;
    const chaveOriginal = typeof original.customProgramCacheKey === 'function' ? original.customProgramCacheKey() : '';
    m.onBeforeCompile = (shader, renderer) => {
      if (compilarOriginal) compilarOriginal.call(original, shader, renderer);
      Object.assign(shader.uniforms, this.compartilhados, proprios);
      shader.vertexShader = injetar(shader.vertexShader, '#include <common>', VERTEX_DECL);
      shader.vertexShader = injetar(shader.vertexShader, '#include <project_vertex>', VERTEX_CORPO);
      let f = shader.fragmentShader;
      f = injetar(f, '#include <common>', FRAG_DECL);
      f = injetar(f, '#include <color_fragment>', FRAG_COR);
      f = injetar(f, '#include <metalnessmap_fragment>', FRAG_METAL);
      f = injetar(f, '#include <emissivemap_fragment>', FRAG_EMISSIVO);
      f = injetar(f, '#include <dithering_fragment>', FRAG_FINAL);
      shader.fragmentShader = f;
    };
    m.customProgramCacheKey = () => `vw-4|${chaveOriginal}`;
    if (this.planos) this._aplicarPlanosEm(m);
    const fantasma = this._fantasmaDe(grupo, parte);
    if (fantasma > 0) {
      proprios.uVwFantasma.value = fantasma;
      m.transparent = true;
      m.depthWrite = false;
    }
    m.needsUpdate = true;
    this.clones.set(chave, m);
    grupo.materiais.add(m);
    if (parte) parte.materiais.add(m);
    return m;
  }

  // ---------------------------------------------------------------- onda de cor
  get frente() { return this.compartilhados.uVwFrente.value; }

  definirOnda({ frente, inverte, brilho, faixa }) {
    const c = this.compartilhados;
    if (frente !== undefined) c.uVwFrente.value = frente;
    if (inverte !== undefined) c.uVwInverte.value = inverte;
    if (brilho !== undefined) c.uVwBrilho.value = brilho;
    if (faixa !== undefined) c.uVwFaixa.value = faixa;
  }

  /** Estado de repouso, sem onda. */
  repouso(modo) {
    this.definirOnda({ frente: modo === 'escopo' ? GRANDE : -GRANDE, inverte: 0, brilho: 0 });
  }

  // ---------------------------------------------------------------- fantasma / realce
  /** Fantasma de um grupo ou de um subgrupo (parte); cada peça recebe o menor dos dois valores. */
  definirFantasma(grupoId, k) {
    const alvo = this.grupos.get(grupoId) || this.partes.get(grupoId);
    if (!alvo) return;
    alvo.fantasma = k;
    for (const m of alvo.materiais) {
      const { proprios, base, grupo, parte } = m.userData.vw;
      const efetivo = this._fantasmaDe(grupo, parte);
      const estavaAtivo = proprios.uVwFantasma.value > 0.001;
      const ativo = efetivo > 0.001;
      proprios.uVwFantasma.value = efetivo;
      if (ativo !== estavaAtivo) {
        m.transparent = ativo ? true : base.transparent;
        m.depthWrite = ativo ? false : base.depthWrite;
        m.needsUpdate = true;
      }
    }
    for (const reg of this.registros) {
      if (reg.grupoId !== grupoId && reg.parteId !== grupoId) continue;
      const efetivo = this._fantasmaDe(this.grupos.get(reg.grupoId), reg.parteId ? this.partes.get(reg.parteId) : null);
      reg.malha.castShadow = efetivo > 0.5 ? false : reg.sombraOriginal;
    }
  }

  definirRealce(grupoId, k) {
    const g = this.grupos.get(grupoId);
    if (!g) return;
    g.realce = k;
    for (const m of g.materiais) m.userData.vw.proprios.uVwRealce.value = k;
  }

  // ---------------------------------------------------------------- aparência (acabamento)
  /** Aparência atual do grupo (do primeiro material opaco): { cor: THREE.Color, metalico, rugoso }. */
  aparenciaDe(grupoId) {
    const g = this.grupos.get(grupoId);
    if (!g) return null;
    for (const m of g.materiais) {
      if (m.userData.vw?.vidro) continue;
      return { cor: m.color.clone(), metalico: m.metalness ?? 0, rugoso: m.roughness ?? 0.5 };
    }
    return null;
  }

  /**
   * Aplica cor/metal/rugosidade aos clones do grupo (extensão do contrato: acabamentos do configurador).
   * Os materiais originais do modelo não mudam; `restaurar()` devolve o modelo como chegou.
   */
  definirAparencia(grupoId, { cor, metalico, rugoso, intensidadeAmbiente } = {}) {
    const g = this.grupos.get(grupoId);
    if (!g) return;
    for (const m of g.materiais) {
      if (m.userData.vw?.vidro) continue;
      if (cor !== undefined) m.color.set(cor);
      if (metalico !== undefined && 'metalness' in m) m.metalness = metalico;
      if (rugoso !== undefined && 'roughness' in m) m.roughness = rugoso;
      if (intensidadeAmbiente !== undefined && 'envMapIntensity' in m) m.envMapIntensity = intensidadeAmbiente;
    }
  }

  // ---------------------------------------------------------------- corte
  _aplicarPlanosEm(m) {
    const THREE = this.THREE;
    const base = m.userData.vw.base;
    const ligado = !!this.planos;
    const lado = ligado ? THREE.DoubleSide : base.side;
    if (m.side !== lado) { m.side = lado; m.needsUpdate = true; }
    const tinha = !!(m.clippingPlanes && m.clippingPlanes.length);
    m.clippingPlanes = ligado ? this.planos : null;
    m.clipShadows = ligado ? true : base.clipShadows;
    if (tinha !== ligado) m.needsUpdate = true;
  }

  aplicarCorte(planos) {
    this.planos = planos && planos.length ? planos : null;
    for (const m of this.clones.values()) this._aplicarPlanosEm(m);
  }

  // ---------------------------------------------------------------- consulta
  corDominante(grupoId) {
    const THREE = this.THREE;
    const g = this.grupos.get(grupoId);
    const cor = new THREE.Color(0.7, 0.7, 0.7);
    if (!g) return cor;
    let melhor = -1;
    const caixa = new THREE.Box3();
    const tam = new THREE.Vector3();
    for (const malha of g.malhas) {
      const m = Array.isArray(malha.material) ? malha.material[0] : malha.material;
      if (!m || m.userData.vw?.vidro) continue;
      caixa.setFromObject(malha).getSize(tam);
      const v = tam.x * tam.y + tam.y * tam.z + tam.x * tam.z;
      if (v > melhor) { melhor = v; cor.copy(m.color); }
    }
    return cor;
  }

  restaurar() {
    for (const reg of this.registros) {
      reg.malha.material = reg.original;
      reg.malha.castShadow = reg.sombraOriginal;
    }
  }

  dispose() {
    this.restaurar();
    for (const m of this.clones.values()) m.dispose(); // texturas pertencem ao modelo: não descartar aqui
    this.clones.clear();
    this.grupos.clear();
    this.partes.clear();
    this.registros = [];
  }
}

export { GRANDE };
