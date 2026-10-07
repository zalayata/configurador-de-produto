// Corte com TAMPA SÓLIDA.
//
// Técnica: plano de recorte + stencil. Para cada grupo do modelo:
//   1. as faces de trás das malhas do grupo incrementam o stencil e as da frente decrementam
//      (sem escrever cor nem profundidade, já recortadas pelo plano);
//   2. onde o stencil ficou diferente de zero o plano de corte está DENTRO de um sólido:
//      ali se desenha a tampa do grupo, com a cor do material (ou do escopo) e hachura;
//   3. o stencil é limpo antes do próximo grupo.
// Só sólidos fechados participam (ver geometriaFechada); vidros ficam de fora.
import { CORES_ESCOPO, ORDEM_TAMPAS } from './constantes.js';
import { geometriaFechada } from './geometria.js';

const EIXOS = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
// eixos (u, v) da hachura em cada plano de corte
const BASE_HACHURA = { x: [[0, 0, 1], [0, 1, 0]], y: [[1, 0, 0], [0, 0, 1]], z: [[1, 0, 0], [0, 1, 0]] };

const TAMPA_VERT_DECL = 'varying vec3 vVwPos;';
const TAMPA_VERT = 'vVwPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;';
const TAMPA_FRAG_DECL = /* glsl */ `
varying vec3 vVwPos;
uniform vec3 uVwEscopo;
uniform float uVwFrente;
uniform float uVwFaixa;
uniform float uVwInverte;
uniform float uVwBrilho;
uniform vec3 uVwU;
uniform vec3 uVwV;
uniform float uVwAngulo;
uniform float uVwPasso;
uniform float uVwTom;
float vwHachura( float h ) {
  float d = abs( fract( h ) - 0.5 );
  float w = max( fwidth( h ), 1e-4 );
  float meia = max( 0.08, w * 0.75 );
  return 1.0 - smoothstep( meia - w, meia + w, d );
}
`;
const TAMPA_FRAG_COR = /* glsl */ `
{
  float vwF = smoothstep( uVwFrente - uVwFaixa, uVwFrente + uVwFaixa, vVwPos.y );
  float vwK = mix( 1.0 - vwF, vwF, uVwInverte );
  diffuseColor.rgb = mix( diffuseColor.rgb, uVwEscopo * uVwTom, vwK );
  // hachura de desenho técnico, em coordenadas de mundo (não "escorrega" com a câmera)
  vec2 vwUV = vec2( dot( vVwPos, uVwU ), dot( vVwPos, uVwV ) );
  float vwH = ( vwUV.x * cos( uVwAngulo ) + vwUV.y * sin( uVwAngulo ) ) / uVwPasso;
  // passo adaptativo: de longe a hachura dobra de espaçamento (com transição suave entre
  // níveis) em vez de virar ruído
  float vwNivel = max( 0.0, log2( max( fwidth( vwH ), 1e-5 ) * 9.0 ) );
  float vwLinha = mix(
    vwHachura( vwH / exp2( floor( vwNivel ) ) ),
    vwHachura( vwH / exp2( floor( vwNivel ) + 1.0 ) ),
    smoothstep( 0.25, 0.75, fract( vwNivel ) ) );
  float vwLum = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
  diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * 0.5 + vec3( 0.06 ) * ( 1.0 - vwLum ), vwLinha * 0.8 );
  float vwCrista = 1.0 - smoothstep( 0.0, uVwFaixa * 1.4, abs( vVwPos.y - uVwFrente ) );
  diffuseColor.rgb += uVwEscopo * vwCrista * vwCrista * uVwBrilho * 0.8;
}
`;

export class Corte {
  constructor(THREE, { cena, gerente, limites, modelo }) {
    this.THREE = THREE;
    this.cena = cena;
    this.gerente = gerente;
    this.limites = limites;
    this.modelo = modelo;
    this.plano = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    this.planos = [this.plano];
    this.eixo = null;
    this.invertido = false;
    this.posicao = 1;
    this.conjunto = null; // THREE.Group com auxiliares de stencil e tampas
    this.tampas = new Map(); // grupoId -> { tampa, auxiliares:[] }
    this.matTras = null;
    this.matFrente = null;
    this.estatistica = { solidos: 0, abertos: 0 };
  }

  get ativo() { return !!this.eixo; }

  /** Coordenada de mundo do plano para uma posição 0..1 no eixo. */
  coordenada(eixo, posicao) {
    const min = this.limites.min[eixo];
    const max = this.limites.max[eixo];
    const folga = (max - min) * 0.002;
    return min - folga + (max - min + 2 * folga) * posicao;
  }

  /** Define o plano imediatamente (a animação fica por conta do visualizador). */
  definir(eixo, posicao, invertido) {
    const mudouEixo = eixo !== this.eixo || invertido !== this.invertido;
    this.eixo = eixo;
    this.invertido = !!invertido;
    this.posicao = posicao;
    if (!eixo) {
      this.gerente.aplicarCorte(null);
      this._desmontar();
      return;
    }
    const c = this.coordenada(eixo, posicao);
    const [x, y, z] = EIXOS[eixo];
    // normal: mantém o lado de menor coordenada; invertido mantém o lado de maior coordenada
    if (this.invertido) this.plano.normal.set(x, y, z), (this.plano.constant = -c);
    else this.plano.normal.set(-x, -y, -z), (this.plano.constant = c);
    if (!this.conjunto) {
      this.gerente.aplicarCorte(this.planos);
      this._montar();
    }
    if (mudouEixo) this._orientar();
    this._posicionar(c);
  }

  // ------------------------------------------------------------------ construção
  _materiaisStencil() {
    const THREE = this.THREE;
    if (this.matTras) return;
    const base = {
      depthWrite: false, depthTest: false, colorWrite: false,
      stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc, clippingPlanes: this.planos,
    };
    this.matTras = new THREE.MeshBasicMaterial({
      ...base, side: THREE.BackSide,
      stencilFail: THREE.IncrementWrapStencilOp, stencilZFail: THREE.IncrementWrapStencilOp, stencilZPass: THREE.IncrementWrapStencilOp,
    });
    this.matFrente = new THREE.MeshBasicMaterial({
      ...base, side: THREE.FrontSide,
      stencilFail: THREE.DecrementWrapStencilOp, stencilZFail: THREE.DecrementWrapStencilOp, stencilZPass: THREE.DecrementWrapStencilOp,
    });
  }

  _auxiliar(malha, material, ordem) {
    const THREE = this.THREE;
    let aux;
    if (malha.isInstancedMesh) {
      aux = new THREE.InstancedMesh(malha.geometry, material, malha.count);
      aux.instanceMatrix = malha.instanceMatrix;
      aux.frustumCulled = false;
    } else {
      aux = new THREE.Mesh(malha.geometry, material);
    }
    // acompanha a malha original (rotação dos rolos, vista explodida) sem custo: mesma matriz
    aux.matrixAutoUpdate = false;
    aux.matrixWorldAutoUpdate = false;
    aux.matrixWorld = malha.matrixWorld;
    aux.renderOrder = ordem;
    aux.castShadow = false;
    aux.receiveShadow = false;
    aux.raycast = () => {};
    aux.userData.__vwAuxiliar = true;
    return aux;
  }

  _montar() {
    const THREE = this.THREE;
    this._materiaisStencil();
    this.conjunto = new THREE.Group();
    this.conjunto.name = 'vw-corte';
    this.conjunto.userData.__vwAuxiliar = true;
    this.cena.add(this.conjunto);
    this.estatistica = { solidos: 0, abertos: 0 };

    const diag = this.limites.getSize(new THREE.Vector3()).length();
    this.geoTampa = new THREE.PlaneGeometry(diag * 4, diag * 4);

    const ids = [...this.gerente.grupos.keys()].sort((a, b) => {
      const ia = ORDEM_TAMPAS.indexOf(a); const ib = ORDEM_TAMPAS.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    ids.forEach((id, i) => {
      const grupo = this.gerente.grupos.get(id);
      const ordem = 10 + i * 2;
      const auxiliares = [];
      for (const malha of grupo.malhas) {
        if (!malha.visible || malha.userData.noCap) continue;
        const m = Array.isArray(malha.material) ? malha.material[0] : malha.material;
        if (m.userData.vw?.vidro) continue;
        if (!geometriaFechada(malha.geometry)) { this.estatistica.abertos += 1; continue; }
        this.estatistica.solidos += 1;
        const a = this._auxiliar(malha, this.matTras, ordem);
        const b = this._auxiliar(malha, this.matFrente, ordem);
        auxiliares.push(a, b);
        this.conjunto.add(a, b);
      }
      if (!auxiliares.length) return;
      const tampa = new THREE.Mesh(this.geoTampa, this._materialTampa(grupo, i));
      tampa.renderOrder = ordem + 1;
      tampa.frustumCulled = false;
      tampa.castShadow = false;
      tampa.receiveShadow = true;
      tampa.raycast = () => {};
      tampa.userData.__vwAuxiliar = true;
      tampa.userData.groupId = id;
      tampa.onAfterRender = (renderer) => renderer.clearStencil();
      this.conjunto.add(tampa);
      this.tampas.set(id, { tampa, auxiliares });
    });
    this._orientar();
    this.atualizarFantasmas();
  }

  _materialTampa(grupo, indice) {
    const THREE = this.THREE;
    const cor = this.gerente.corDominante(grupo.id);
    // a seção é um pouco mais fechada que a superfície, para ler como "material cortado"
    const hsl = {};
    cor.getHSL(hsl);
    cor.setHSL(hsl.h, Math.min(1, hsl.s * 1.05), Math.min(0.7, hsl.l * 0.8 + 0.02));
    const m = new THREE.MeshStandardMaterial({
      color: cor, roughness: 0.78, metalness: 0.0, side: THREE.DoubleSide,
      stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc,
      stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp,
    });
    const proprios = {
      uVwEscopo: { value: new THREE.Color(CORES_ESCOPO[grupo.escopo] || '#8C9296') },
      uVwU: { value: new THREE.Vector3(1, 0, 0) },
      uVwV: { value: new THREE.Vector3(0, 1, 0) },
      // ângulo alternado por grupo: peças vizinhas do mesmo escopo continuam distinguíveis
      uVwAngulo: { value: (indice % 2 ? -1 : 1) * (Math.PI / 4) + (indice % 3) * 0.26 },
      uVwPasso: { value: 0.022 + (indice % 3) * 0.004 },
      // tom alternado: seções de peças diferentes do mesmo escopo não se fundem
      uVwTom: { value: [0.62, 0.95, 0.78, 1.12][indice % 4] },
    };
    m.userData.proprios = proprios;
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.gerente.compartilhados, proprios);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${TAMPA_VERT_DECL}`)
        .replace('#include <project_vertex>', `#include <project_vertex>\n${TAMPA_VERT}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${TAMPA_FRAG_DECL}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n${TAMPA_FRAG_COR}`);
    };
    m.customProgramCacheKey = () => 'vw-tampa-4';
    return m;
  }

  _orientar() {
    if (!this.conjunto || !this.eixo) return;
    const THREE = this.THREE;
    const [u, v] = BASE_HACHURA[this.eixo];
    const paraFora = this.plano.normal.clone().negate(); // lado removido (de onde se olha)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), paraFora);
    for (const { tampa } of this.tampas.values()) {
      tampa.quaternion.copy(q);
      tampa.material.userData.proprios.uVwU.value.set(...u);
      tampa.material.userData.proprios.uVwV.value.set(...v);
    }
  }

  _posicionar(c) {
    if (!this.conjunto) return;
    const centro = this.limites.getCenter(new this.THREE.Vector3());
    centro[this.eixo] = c;
    for (const { tampa } of this.tampas.values()) tampa.position.copy(centro);
  }

  /** Recalcula a cor das tampas a partir dos materiais atuais (depois de uma troca de acabamento). */
  atualizarCores() {
    for (const [id, { tampa }] of this.tampas) {
      const cor = this.gerente.corDominante(id);
      const hsl = {};
      cor.getHSL(hsl);
      cor.setHSL(hsl.h, Math.min(1, hsl.s * 1.05), Math.min(0.7, hsl.l * 0.8 + 0.02));
      tampa.material.color.copy(cor);
    }
  }

  /** Grupos em modo fantasma não recebem tampa. */
  atualizarFantasmas() {
    for (const [id, { tampa, auxiliares }] of this.tampas) {
      const g = this.gerente.grupos.get(id);
      const visivel = !g || g.fantasma < 0.5;
      tampa.visible = visivel;
      for (const a of auxiliares) a.visible = visivel;
    }
  }

  /** Reconstrói as tampas (o modelo trocou geometrias). */
  reconstruir() {
    if (!this.ativo) return;
    const { eixo, posicao, invertido } = this;
    this._desmontar();
    this.eixo = null;
    this.definir(eixo, posicao, invertido);
  }

  /** O ponto (mundo) foi removido pelo corte? */
  removido(ponto) {
    return this.ativo && this.plano.distanceToPoint(ponto) < 0;
  }

  _desmontar() {
    if (!this.conjunto) return;
    this.cena.remove(this.conjunto);
    for (const { tampa } of this.tampas.values()) tampa.material.dispose();
    this.tampas.clear();
    this.geoTampa.dispose();
    this.conjunto = null;
  }

  dispose() {
    this._desmontar();
    this.matTras && this.matTras.dispose();
    this.matFrente && this.matFrente.dispose();
    this.matTras = null;
    this.matFrente = null;
  }
}
