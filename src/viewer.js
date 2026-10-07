// Visualizador 3D reutilizável — portado do hotsite da linha Chromium (contrato: CONTRATOS.md, seção 4)
// e estendido para o configurador: aparência por grupo (acabamentos), foco de câmera em um grupo,
// visibilidade por grupo, realce programático e informações de exportação.
//
// Organização:
//   viewer/materiais.js  clones instrumentados (onda de cor, fantasma, realce)
//   viewer/corte.js      plano de corte com tampa sólida (stencil) e hachura
//   viewer/camera.js     vistas predefinidas e transição de pose em arco
//   viewer/etiquetas.js  etiquetas HTML com linha-guia
//   viewer/exportar.js   composição do PNG com logotipo e legenda
//   viewer/tweens.js     interpolações avançadas pelo laço de renderização
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import './viewer.css';
import { FOV_PADRAO, ROTULOS_ESCOPO, ROTULOS_GRUPO, VISTAS, configurarVisualizador } from './viewer/constantes.js';
import { Tweens, suavizar } from './viewer/tweens.js';
import { GerenteMateriais } from './viewer/materiais.js';
import { Corte } from './viewer/corte.js';
import { Camera } from './viewer/camera.js';
import { Etiquetas } from './viewer/etiquetas.js';
import { baixar, comporPNG } from './viewer/exportar.js';

const limitar = (v, a = 0, b = 1) => Math.min(b, Math.max(a, Number.isFinite(+v) ? +v : a));

export const VISTAS_DISPONIVEIS = VISTAS;

export class InstallationViewer {
  /**
   * @param {HTMLElement} container
   * @param {object} opcoes
   *   model          retorno de buildInstallation (obrigatório)
   *   reducedMotion  true | false | 'auto' (segue prefers-reduced-motion)
   *   logoUrl        logotipo usado no PNG exportado
   *   tooltip        mostra a dica com o nome da peça sob o cursor (padrão true)
   *   view           vista inicial (padrão 'iso')
   */
  constructor(container, { model, reducedMotion = false, logoUrl = null, tooltip = true, view = 'iso' } = {}) {
    if (!container) throw new Error('InstallationViewer: contêiner ausente.');
    if (!model || !model.root) throw new Error('InstallationViewer: modelo inválido (falta root).');
    this.container = container;
    this.model = model;
    // rótulos, escopos e ordem de tampas deste modelo
    configurarVisualizador({ rotulos: model.labels || {}, escopos: model.scopes || {}, ordemTampas: model.capOrder || [] });
    this.exportInfo = { titulo: model.descricao || 'Modelo 3D', subtitulo: '', nota: '', legenda: [] };
    this.logoUrl = logoUrl || `${(import.meta.env && import.meta.env.BASE_URL) || './'}media/idugel-30-anos.png`;
    this._mediaReduzido = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    this.reducedMotion = reducedMotion === 'auto' ? !!(this._mediaReduzido && this._mediaReduzido.matches) : !!reducedMotion;

    this._ouvintes = new Map();
    this._tweens = new Tweens();
    this._sujo = true;
    this._rodando = false;
    this._naTela = true;
    this._raf = 0;
    this._ultimo = 0;
    this._descartado = false;
    this._velocidade = 0; // valor aplicado (suavizado)
    this._fatorGrupo = {}; // explodida: fator atual por grupo
    this._fantasma = new Map(); // grupoId -> { v, alvo }
    this._realce = new Map(); // grupoId -> { v, alvo }
    this._sobCursor = null;
    this._enquadre = { x: 0, y: 0 };

    this.estado = {
      mode: 'natural',
      cut: { axis: null, position: 0.5, inverted: false },
      isolate: null,
      explode: 0,
      speed: 0,
      autoRotate: false,
      interactive: false,
      labels: null,
    };

    this._montarDOM(tooltip);
    this._montarCena();
    this._montarModelo();
    this._montarEntrada();
    this._observar();

    this.resize();
    this._camera.definirVista(VISTAS.includes(view) ? view : 'iso', { imediato: true });
    this.ready = this._preparar();
  }

  // =================================================================== montagem
  _montarDOM(comDica) {
    const c = this.container;
    c.classList.add('vw');
    if (this.reducedMotion) c.classList.add('vw--reduzido');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, stencil: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.localClippingEnabled = true;
    this.canvas = this.renderer.domElement;
    this.canvas.classList.add('vw__tela');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', this.model.descricao || 'Modelo 3D do produto.');
    c.appendChild(this.canvas);

    this._etiquetas = new Etiquetas(THREE, c, {
      reduzido: this.reducedMotion,
      aoSelecionar: (def) => this._emitirSelecao(typeof def.anchor === 'string' ? this._grupoDaAncora(def.anchor) : null, def),
    });

    if (comDica) {
      this._dica = document.createElement('div');
      this._dica.className = 'vw-dica';
      this._dica.setAttribute('aria-hidden', 'true');
      c.appendChild(this._dica);
    }
    // anúncio discreto da peça selecionada para leitores de tela
    this._anuncio = document.createElement('div');
    this._anuncio.className = 'vw-somente-leitor';
    this._anuncio.setAttribute('aria-live', 'polite');
    c.appendChild(this._anuncio);
  }

  _montarCena() {
    this.scene = new THREE.Scene();
    this._pmrem = new THREE.PMREMGenerator(this.renderer);
    const sala = new RoomEnvironment();
    this._ambiente = this._pmrem.fromScene(sala, 0.04);
    this.scene.environment = this._ambiente.texture;
    this.scene.environmentIntensity = 0.62;
    sala.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });

    this.camera = new THREE.PerspectiveCamera(FOV_PADRAO, 1.6, 0.05, 120);

    const b = this.model.bounds;
    const centro = b.getCenter(new THREE.Vector3());
    const R = b.getSize(new THREE.Vector3()).length() / 2;

    // luz principal (com sombra suave)
    this._luzPrincipal = new THREE.DirectionalLight(0xfff8f0, 2.0);
    this._luzPrincipal.position.set(centro.x - R * 0.85, b.max.y + R * 1.35, centro.z + R * 1.3);
    this._luzPrincipal.target.position.copy(centro);
    this._luzPrincipal.castShadow = true;
    this._luzPrincipal.shadow.mapSize.set(2048, 2048);
    this._luzPrincipal.shadow.bias = -0.0003;
    this._luzPrincipal.shadow.normalBias = 0.02;
    this._luzPrincipal.shadow.radius = 5;
    this.scene.add(this._luzPrincipal, this._luzPrincipal.target);
    this._ajustarSombra(1);

    // preenchimento frio, do lado oposto
    this._luzPreench = new THREE.DirectionalLight(0xdce8ff, 0.6);
    this._luzPreench.position.set(centro.x + R * 1.4, centro.y + R * 0.6, centro.z - R * 1.1);
    this.scene.add(this._luzPreench);

    // luz quente sob a laje: revela o acionamento, que fica na sombra do piso.
    // Só existe quando o modelo tem geometria abaixo do piso (y < 0); um produto apoiado no chão não a recebe.
    this._luzesSobPiso = [];
    const ySob = Math.min(-0.2, b.min.y * 0.55);
    const temSubsolo = b.min.y < -0.15;
    for (const [x, z, i] of temSubsolo ? [[R * 0.35, R * 0.9, 16], [-R * 0.6, -R * 0.75, 9], [-R * 0.9, R * 0.5, 7]] : []) {
      const l = new THREE.PointLight(0xffe2bd, i, R * 4.5, 1.7);
      l.position.set(centro.x + x, ySob, centro.z + z);
      this.scene.add(l);
      this._luzesSobPiso.push(l);
    }
    const rebatida = new THREE.HemisphereLight(0xffffff, 0xcdb9a0, 0.12);
    this.scene.add(rebatida);
    this._luzRebatida = rebatida;

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = !this.reducedMotion;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.75;
    this.controls.zoomSpeed = 0.8;
    this.controls.panSpeed = 0.7;
    this.controls.minDistance = Math.max(0.35, R * 0.22);
    this.controls.maxDistance = R * 5.5;
    this.controls.autoRotateSpeed = 0.9;
    this.controls.enabled = false;
    this.canvas.style.touchAction = 'pan-y';
    this.controls.addEventListener('change', () => {
      // só um movimento real do usuário transforma a vista predefinida em pose livre
      if (this._usuarioMovendo && !this._moveu) {
        this._moveu = true;
        this._camera.vista = null;
        this._esconderDica();
      }
      this.invalidate();
    });
    this.controls.addEventListener('start', () => {
      this._camera.cancelar();
      this._usuarioMovendo = true;
      this._moveu = false;
      this.container.classList.add('vw--arrastando');
    });
    this.controls.addEventListener('end', () => {
      this._usuarioMovendo = false;
      this.container.classList.remove('vw--arrastando');
      if (this._moveu) this._emitir('statechange', this.getState());
    });

    this._camera = new Camera(THREE, {
      camera: this.camera, controles: this.controls, modelo: this.model, tweens: this._tweens,
      invalidar: () => this.invalidate(), reduzido: this.reducedMotion,
    });
  }

  _ajustarSombra(fatorExplodida) {
    const b = this._caixaExplodida(fatorExplodida);
    const r = b.getSize(new THREE.Vector3()).length() / 2 * 1.05;
    const cam = this._luzPrincipal.shadow.camera;
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
    cam.near = 0.2;
    cam.far = this._luzPrincipal.position.distanceTo(this._luzPrincipal.target.position) + r * 2;
    cam.updateProjectionMatrix();
  }

  _caixaExplodida(fator) {
    const b = this.model.bounds.clone();
    if (!this.model.explode || fator <= 0) return b;
    const min = new THREE.Vector3();
    const max = new THREE.Vector3();
    for (const v of Object.values(this.model.explode)) {
      if (!v) continue;
      min.min(v);
      max.max(v);
    }
    b.min.addScaledVector(min, fator);
    b.max.addScaledVector(max, fator);
    return b;
  }

  _montarModelo() {
    const m = this.model;
    this.scene.add(m.root);
    m.root.updateMatrixWorld(true);
    this._posBase = {};
    for (const [id, g] of Object.entries(m.groups || {})) {
      this._posBase[id] = g.position.clone();
      this._fatorGrupo[id] = 0;
    }
    this._gerente = new GerenteMateriais(THREE, { raiz: m.root, limites: m.bounds, subgrupos: m.groups });
    this._corte = new Corte(THREE, { cena: this.scene, gerente: this._gerente, limites: m.bounds, modelo: m });
    this._corteAtual = { eixo: null, invertido: false, pos: 1 };
    this._raycaster = new THREE.Raycaster();
  }

  _montarEntrada() {
    const el = this.canvas;
    this._ponteiro = { x: 0, y: 0, dentro: false, pendente: false, baixo: null };
    this._aoMover = (e) => {
      if (e.pointerType === 'touch') return;
      const r = el.getBoundingClientRect();
      this._ponteiro.x = e.clientX - r.left;
      this._ponteiro.y = e.clientY - r.top;
      this._ponteiro.dentro = true;
      this._ponteiro.pendente = true;
      this._acordar();
    };
    this._aoSair = () => {
      this._ponteiro.dentro = false;
      this._definirSobCursor(null);
    };
    this._aoBaixar = (e) => {
      this._ponteiro.baixo = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    this._aoSoltar = (e) => {
      const b = this._ponteiro.baixo;
      this._ponteiro.baixo = null;
      if (!b) return;
      const d = Math.hypot(e.clientX - b.x, e.clientY - b.y);
      if (d > 6 || performance.now() - b.t > 600) return;
      const r = el.getBoundingClientRect();
      const alvo = this._picar(e.clientX - r.left, e.clientY - r.top);
      if (alvo) this._emitirSelecao(alvo.groupId, null, alvo);
      else this._emitir('deselect', null);
    };
    el.addEventListener('pointermove', this._aoMover);
    el.addEventListener('pointerleave', this._aoSair);
    el.addEventListener('pointerdown', this._aoBaixar);
    el.addEventListener('pointerup', this._aoSoltar);
  }

  _observar() {
    if ('ResizeObserver' in window) {
      this._obsTamanho = new ResizeObserver(() => this.resize());
      this._obsTamanho.observe(this.container);
    } else {
      this._aoRedimensionar = () => this.resize();
      window.addEventListener('resize', this._aoRedimensionar);
    }
    if ('IntersectionObserver' in window) {
      this._obsTela = new IntersectionObserver((entradas) => {
        this._naTela = entradas[entradas.length - 1].isIntersecting;
        this._acordar();
      }, { rootMargin: '80px' });
      this._obsTela.observe(this.container);
    }
    this._aoVisibilidade = () => this._acordar();
    document.addEventListener('visibilitychange', this._aoVisibilidade);
    this._aoContextoPerdido = (e) => { e.preventDefault(); this._semContexto = true; };
    this._aoContextoRestaurado = () => { this._semContexto = false; this.invalidate(); };
    this.canvas.addEventListener('webglcontextlost', this._aoContextoPerdido);
    this.canvas.addEventListener('webglcontextrestored', this._aoContextoRestaurado);
  }

  async _preparar() {
    try {
      if (this.renderer.compileAsync) await this.renderer.compileAsync(this.scene, this.camera);
    } catch (e) { /* a compilação síncrona no primeiro quadro resolve */ }
    if (this._descartado) return this;
    this._renderizar();
    this.start();
    return this;
  }

  // =================================================================== laço
  invalidate() {
    this._sujo = true;
    this._acordar();
  }

  get _podeRodar() {
    return this._rodando && this._naTela && !document.hidden && !this._descartado;
  }

  _acordar() {
    if (!this._podeRodar) {
      if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
      return;
    }
    // durante um quadro o próprio laço decide se continua (evita laços duplicados)
    if (!this._raf && !this._emQuadro) {
      this._ultimo = 0;
      this._raf = requestAnimationFrame(this._quadro);
    }
  }

  _quadro = (agora) => {
    this._raf = 0;
    if (!this._podeRodar) return;
    // teto de 100 ms: em máquinas lentas as transições mantêm a duração real; ao voltar de uma aba oculta não há salto
    const dt = this._ultimo ? Math.min(0.1, (agora - this._ultimo) / 1000) : 1 / 60;
    this._ultimo = agora;
    this._emQuadro = true;

    this._tweens.avancar(dt);
    let ativo = this._tweens.ocupado;

    if (this._velocidade > 0.0005 && this.model.animated && this.model.animated.update) {
      this.model.animated.update(dt, this._velocidade);
      this._sujo = true;
      ativo = true;
    }
    if (this._avancarTransicoes(dt)) ativo = true;

    if (this.controls.autoRotate || this.controls.enabled) {
      if (this.controls.update(dt)) this._sujo = true;
      if (this.controls.autoRotate) ativo = true;
    }
    if (this._ponteiro.pendente) {
      this._ponteiro.pendente = false;
      if (this._ponteiro.dentro && !this._ponteiro.baixo && !this._camera.emTransicao) {
        this._definirSobCursor(this._picar(this._ponteiro.x, this._ponteiro.y));
        this._moverDica();
      }
    }
    if (ativo) this._sujo = true;
    if (this._sujo && !this._semContexto) {
      this._sujo = false;
      this._renderizar();
    }
    this._emQuadro = false;
    // renderização sob demanda: o laço dorme quando nada se move
    if (ativo || this._sujo) this._raf = requestAnimationFrame(this._quadro);
    else this._ultimo = 0;
  };

  _renderizar() {
    this.quadrosRenderizados = (this.quadrosRenderizados || 0) + 1;
    this.renderer.render(this.scene, this.camera);
    if (this._etiquetas.ativas) {
      // a âncora removida pelo corte já foi levada à face seccionada (ver _pontoDaAncora);
      // se ainda assim estiver no lado removido, a peça não tem seção visível e a etiqueta some
      const movendo = this._etiquetas.atualizar(this.camera, this._largura, this._altura, {
        oculto: (p) => this._corte.removido(p),
      });
      if (movendo) this._sujo = true;
    }
    // extensão do contrato: 'quadro' a cada imagem desenhada (a página acompanha a câmera sem laço próprio)
    if (this._ouvintes.has('quadro')) this._emitir('quadro');
  }

  /** Transições contínuas por grupo (fantasma e realce). */
  _avancarTransicoes(dt) {
    let ativo = false;
    const passo = (mapa, tempo, aplicar) => {
      for (const [id, s] of mapa) {
        if (s.v === s.alvo) continue;
        const d = this.reducedMotion ? 1 : dt / tempo;
        s.v = s.alvo > s.v ? Math.min(s.alvo, s.v + d) : Math.max(s.alvo, s.v - d);
        aplicar(id, suavizar.cubica(s.v));
        ativo = true;
      }
    };
    const antes = ativo;
    passo(this._fantasma, 0.55, (id, k) => this._gerente.definirFantasma(id, k));
    if (ativo !== antes || ativo) this._corte.atualizarFantasmas();
    passo(this._realce, 0.18, (id, k) => this._gerente.definirRealce(id, k));
    return ativo;
  }

  // =================================================================== API: cor
  setColorMode(modo, { animate = true } = {}) {
    const alvo = modo === 'escopo' ? 'escopo' : 'natural';
    const mudou = alvo !== this.estado.mode;
    this.estado.mode = alvo;
    this.container.dataset.vwModo = alvo;
    const g = this._gerente;
    const c = g.compartilhados;
    if (!animate || this.reducedMotion) {
      this._tweens.cancelar('onda');
      this._onda = null;
      g.repouso(alvo);
      this.invalidate();
      if (mudou) this._emitir('statechange', this.getState());
      return;
    }
    if (!mudou && !this._onda) return;

    const faixa = 0.1;
    const caixa = this._caixaExplodida(Math.max(this.estado.explode, ...Object.values(this._fatorGrupo), 0));
    const base = caixa.min.y - faixa * 1.6;
    const topo = caixa.max.y + faixa * 1.6;
    let de;
    let ate;
    if (this._onda) {
      // onda em andamento: inverte o sentido a partir de onde está
      de = c.uVwFrente.value;
      const sobeParaEscopo = c.uVwInverte.value < 0.5;
      ate = (alvo === 'escopo') === sobeParaEscopo ? topo : base;
    } else {
      // a onda sempre sobe: de baixo (acionamento) para cima (banco)
      g.definirOnda({ inverte: alvo === 'escopo' ? 0 : 1 });
      de = base;
      ate = topo;
    }
    const fracao = Math.abs(ate - de) / (topo - base);
    this._onda = { alvo };
    g.definirOnda({ faixa, frente: de });
    this._tweens.criar({
      canal: 'onda',
      duracao: Math.max(0.35, 1.7 * fracao),
      curva: suavizar.cubica,
      aoAtualizar: (k, bruto) => {
        g.definirOnda({ frente: de + (ate - de) * k, brilho: Math.pow(Math.sin(Math.PI * bruto), 0.5) });
        this._sujo = true;
      },
      aoTerminar: () => {
        this._onda = null;
        g.repouso(alvo);
        this.invalidate();
      },
    });
    this.invalidate();
    this._emitir('statechange', this.getState());
  }

  // =================================================================== API: corte
  setCut(corte, { animate = true } = {}) {
    const c = corte || {};
    const eixo = ['x', 'y', 'z'].includes(c.axis) ? c.axis : null;
    const invertido = !!c.inverted;
    const posicao = limitar(c.position ?? 0.5);
    this.estado.cut = { axis: eixo, position: posicao, inverted: invertido };
    const atual = this._corteAtual;
    const aberto = (inv) => (inv ? 0 : 1);
    const imediato = !animate || this.reducedMotion;

    const aplicar = (pos) => {
      atual.pos = pos;
      this._corte.definir(atual.eixo, pos, atual.invertido);
      this._sujo = true;
    };

    if (!eixo) {
      if (!atual.eixo) { this._tweens.cancelar('corte'); return; }
      const de = atual.pos;
      const ate = aberto(atual.invertido);
      this._tweens.criar({
        canal: 'corte', duracao: imediato ? 0 : 0.6, curva: suavizar.cubica,
        aoAtualizar: (k) => aplicar(de + (ate - de) * k),
        aoTerminar: () => { atual.eixo = null; this._corte.definir(null); this.invalidate(); },
      });
    } else {
      if (atual.eixo !== eixo || atual.invertido !== invertido) {
        atual.eixo = eixo;
        atual.invertido = invertido;
        atual.pos = aberto(invertido);
      }
      const de = atual.pos;
      this._tweens.criar({
        canal: 'corte', duracao: imediato ? 0 : 0.85, curva: suavizar.cubica,
        aoAtualizar: (k) => aplicar(de + (posicao - de) * k),
      });
    }
    this.invalidate();
    this._emitir('statechange', this.getState());
  }

  // =================================================================== API: isolamento
  setIsolation(ids) {
    const g = this._gerente;
    // aceita ids de grupo e de subgrupo (p. ex. `motor-a-sup`): o subgrupo listado fica à vista mesmo com o grupo em fantasma
    const lista = Array.isArray(ids) && ids.length ? ids.filter((id) => g.grupos.has(id) || g.partes.has(id)) : null;
    this.estado.isolate = lista && lista.length ? [...lista] : null;
    for (const id of g.grupos.keys()) {
      const alvo = this.estado.isolate && !this.estado.isolate.includes(id) ? 1 : 0;
      const s = this._fantasma.get(id) || { v: 0, alvo: 0 };
      s.alvo = alvo;
      this._fantasma.set(id, s);
    }
    for (const id of g.partes.keys()) {
      const alvo = this.estado.isolate && this.estado.isolate.includes(id) ? 0 : 1;
      const s = this._fantasma.get(id) || { v: 1, alvo: 1 };
      s.alvo = alvo;
      this._fantasma.set(id, s);
    }
    if (this._sobCursor && this._ehFantasma(this._sobCursor.groupId, this._sobCursor.malha)) this._definirSobCursor(null);
    this.invalidate();
    this._emitir('statechange', this.getState());
  }

  _ehFantasma(id, malha = null) {
    const s = this._fantasma.get(id);
    if (!s || s.alvo <= 0.5) return false;
    const parte = malha ? this._gerente.parteDaMalha(malha) : null;
    const p = parte ? this._fantasma.get(parte) : null;
    return !(p && p.alvo < 0.5);
  }

  // =================================================================== API: explodida
  setExplode(fator, { animate = true } = {}) {
    const alvo = limitar(fator);
    this.estado.explode = alvo;
    const m = this.model;
    if (!m.explode || !m.groups) return;
    const ids = Object.keys(m.groups).filter((id) => m.explode[id]);
    // as peças mais altas saem primeiro: a leitura é de "desmontagem" em cascata
    ids.sort((a, b) => ((m.anchors?.[b]?.y ?? 0) - (m.anchors?.[a]?.y ?? 0)));
    const imediato = !animate || this.reducedMotion;
    this._ajustarSombra(Math.max(alvo, ...Object.values(this._fatorGrupo), 0));
    ids.forEach((id, i) => {
      const de = this._fatorGrupo[id] || 0;
      this._tweens.criar({
        canal: `explodida:${id}`,
        duracao: imediato ? 0 : 1.0,
        atraso: imediato ? 0 : i * 0.045,
        curva: suavizar.quintica,
        aoAtualizar: (k) => {
          const f = de + (alvo - de) * k;
          this._fatorGrupo[id] = f;
          m.groups[id].position.copy(this._posBase[id]).addScaledVector(m.explode[id], f);
          this._sujo = true;
        },
        aoTerminar: () => { if (i === ids.length - 1) this._ajustarSombra(alvo); },
      });
    });
    this.invalidate();
    this._emitir('statechange', this.getState());
  }

  // =================================================================== API: animação
  setAnimationSpeed(fator) {
    const alvo = limitar(fator);
    this.estado.speed = alvo;
    const de = this._velocidade;
    this._tweens.criar({
      canal: 'velocidade',
      duracao: this.reducedMotion ? 0 : 0.8,
      curva: suavizar.saida,
      aoAtualizar: (k) => { this._velocidade = de + (alvo - de) * k; },
    });
    this.invalidate();
    this._emitir('statechange', this.getState());
  }

  // =================================================================== API: câmera
  setView(id, { immediate = false, duration = 1.4 } = {}) {
    const vista = VISTAS.includes(id) ? id : 'iso';
    this._camera.definirVista(vista, { imediato: immediate, duracao: duration });
    this.invalidate();
    this._emitir('statechange', this.getState());
  }

  setPose(pose, { duration = 1.2 } = {}) {
    if (!pose) return;
    this._camera.definirPose(pose, { duracao: duration });
    this.invalidate();
    this._emitir('statechange', this.getState());
  }

  /** Interrompe a transição de câmera em andamento. */
  cancelPose() {
    this._camera.cancelar();
  }

  /**
   * Desloca o modelo na tela sem mudar a perspectiva (frações da largura/altura).
   * Útil quando um painel de texto ocupa parte do palco.
   */
  setFraming({ x = 0, y = 0 } = {}, { duration = 0.9 } = {}) {
    const de = { ...this._enquadre };
    const ate = { x: limitar(x, -0.5, 0.5), y: limitar(y, -0.5, 0.5) };
    this._tweens.criar({
      canal: 'enquadre',
      duracao: this.reducedMotion ? 0 : duration,
      aoAtualizar: (k) => {
        this._enquadre.x = de.x + (ate.x - de.x) * k;
        this._enquadre.y = de.y + (ate.y - de.y) * k;
        this._aplicarEnquadre();
        this._sujo = true;
      },
    });
    this.invalidate();
  }

  _aplicarEnquadre() {
    const { x, y } = this._enquadre;
    const w = this._largura || 1;
    const h = this._altura || 1;
    if (Math.abs(x) < 1e-4 && Math.abs(y) < 1e-4) this.camera.clearViewOffset();
    else this.camera.setViewOffset(w, h, -x * w, -y * h, w, h);
  }

  setInteractive(ligado) {
    const v = !!ligado;
    this.estado.interactive = v;
    this.controls.enabled = v;
    this.canvas.style.touchAction = v ? 'none' : 'pan-y';
    this.container.classList.toggle('vw--interativo', v);
    if (this._etiquetas && this._etiquetas.definirFocavel) this._etiquetas.definirFocavel(v);
    this.invalidate();
  }

  setAutoRotate(ligado) {
    const v = !!ligado && !this.reducedMotion;
    this.estado.autoRotate = v;
    this.controls.autoRotate = v;
    if (v) { this._camera.cancelar(); this._camera.vista = null; }
    this.invalidate();
    this._emitir('statechange', this.getState());
  }

  // =================================================================== API: etiquetas
  setLabels(lista) {
    const validas = Array.isArray(lista) && lista.length
      ? lista.filter((e) => e && e.text && (Array.isArray(e.anchor) || this.model.anchors?.[e.anchor]))
      : null;
    this.estado.labels = validas && validas.length ? validas.map((e) => ({ ...e })) : null;
    this._etiquetas.definir(this.estado.labels, (ancora) => this._pontoDaAncora(ancora));
    this.invalidate();
    this._emitir('statechange', this.getState());
  }

  /**
   * Área segura e obstáculos das etiquetas, em px do contêiner (extensão do contrato):
   * { area: { esq, topo, dir, base }, obstaculos: [{ x, y, w, h, peso }], compacto }.
   */
  setLabelLayout(leiaute) {
    this._leiauteEtiquetas = leiaute || {};
    this._etiquetas.definirLeiaute(this._leiauteEtiquetas);
    this.invalidate();
  }

  /** Retângulo da interface que acompanha a câmera (rótulo da linha da laje); null remove. */
  setLabelMovingObstacle(r) {
    this._etiquetas.definirObstaculoMovel(r);
    if (this._etiquetas.ativas) this.invalidate();
  }

  _grupoDaAncora(chave) {
    if (this.model.groups?.[chave]) return chave;
    const ids = Object.keys(this.model.groups || {}).sort((a, b) => b.length - a.length);
    return ids.find((id) => chave.startsWith(id)) || null;
  }

  _pontoDaAncora(ancora) {
    this._pAncora = this._pAncora || new THREE.Vector3();
    if (Array.isArray(ancora)) return this._pAncora.set(ancora[0], ancora[1], ancora[2]);
    const p = this.model.anchors?.[ancora];
    if (!p) return null;
    this._pAncora.copy(p);
    const g = this._grupoDaAncora(ancora);
    if (g && this.model.explode?.[g]) this._pAncora.addScaledVector(this.model.explode[g], this._fatorGrupo[g] || 0);
    // corte ativo: se a âncora ficou no lado removido e a peça atravessa o plano, a etiqueta aponta
    // para a face seccionada da peça (a âncora é projetada sobre o plano de corte)
    if (this._corte.ativo && this._corte.removido(this._pAncora)) {
      const caixa = this._caixaDoGrupo(g);
      const plano = this._corte.plano;
      if (caixa && plano.intersectsBox(caixa)) {
        plano.projectPoint(this._pAncora, this._pAncora);
        // um fio para dentro do lado mantido: o teste de remoção não oscila sobre o plano
        this._pAncora.addScaledVector(plano.normal, 0.002);
      }
    }
    return this._pAncora;
  }

  /** Caixa (mundo) das malhas de um grupo do contrato; em cache até o modelo trocar geometrias. */
  _caixaDoGrupo(id) {
    if (!id || !this.model.groups?.[id]) return null;
    this._caixasGrupo = this._caixasGrupo || new Map();
    if (!this._caixasGrupo.has(id)) {
      const caixa = new THREE.Box3();
      const parcial = new THREE.Box3();
      const base = this._posBase[id];
      const atual = this.model.groups[id].position;
      this.model.groups[id].traverse((o) => {
        if (!o.isMesh || o.userData.__vwAuxiliar) return;
        parcial.setFromObject(o);
        if (!parcial.isEmpty()) caixa.union(parcial);
      });
      // medida na posição de repouso (sem o deslocamento da vista explodida)
      if (base && !caixa.isEmpty()) caixa.translate(new THREE.Vector3().subVectors(base, atual));
      this._caixasGrupo.set(id, caixa.isEmpty() ? null : caixa);
    }
    return this._caixasGrupo.get(id);
  }

  // =================================================================== API: extensões do configurador
  /**
   * Acabamento de um grupo: { cor (css), metalico 0..1, rugoso 0..1, intensidadeAmbiente }.
   * Com animate, cor e parâmetros interpolam em `duration` segundos; a tampa de corte acompanha.
   */
  setGroupAppearance(groupId, aparencia, { animate = true, duration = 0.45 } = {}) {
    const g = this._gerente;
    if (!g.grupos.has(groupId)) return;
    const de = g.aparenciaDe(groupId);
    const ate = {
      cor: aparencia.cor !== undefined ? new THREE.Color(aparencia.cor) : null,
      metalico: aparencia.metalico,
      rugoso: aparencia.rugoso,
      intensidadeAmbiente: aparencia.intensidadeAmbiente,
    };
    const aplicarFinal = () => {
      g.definirAparencia(groupId, { ...aparencia });
      this._corte.atualizarCores();
      this.invalidate();
    };
    if (!animate || this.reducedMotion || !de || !ate.cor) { aplicarFinal(); return; }
    const cor = new THREE.Color();
    this._tweens.criar({
      canal: `aparencia:${groupId}`,
      duracao: duration,
      curva: suavizar.cubica,
      aoAtualizar: (k) => {
        cor.copy(de.cor).lerp(ate.cor, k);
        g.definirAparencia(groupId, {
          cor,
          metalico: ate.metalico !== undefined ? THREE.MathUtils.lerp(de.metalico, ate.metalico, k) : undefined,
          rugoso: ate.rugoso !== undefined ? THREE.MathUtils.lerp(de.rugoso, ate.rugoso, k) : undefined,
          intensidadeAmbiente: ate.intensidadeAmbiente,
        });
        this._sujo = true;
      },
      aoTerminar: aplicarFinal,
    });
    this.invalidate();
  }

  /** Realce programático de um grupo (o mesmo efeito do cursor); null apaga. */
  highlightGroup(groupId) {
    const g = this._gerente;
    for (const [id, s] of this._realce) if (id !== groupId && id !== this._sobCursor?.groupId) s.alvo = 0;
    if (groupId && g.grupos.has(groupId)) {
      const s = this._realce.get(groupId) || { v: 0, alvo: 0 };
      s.alvo = 1;
      this._realce.set(groupId, s);
    }
    this._realceFixo = groupId || null;
    this.invalidate();
  }

  /** Leva a câmera, em arco, a enquadrar um grupo (mantendo a direção atual de observação). */
  focusGroup(groupId, { duration = 1.1, margem = 1.6 } = {}) {
    const caixa = this._caixaDoGrupo(groupId);
    if (!caixa) return false;
    const alvo = this.controls.target;
    const dir = this.camera.position.clone().sub(alvo);
    if (dir.lengthSq() < 1e-6) dir.set(0.6, 0.4, 0.7);
    // um pouco mais de altura: evita olhar o grupo rente ao piso
    dir.normalize();
    dir.y = Math.max(dir.y, 0.22);
    const pose = this._camera.enquadrar(caixa, dir.toArray(), { margem });
    this.setPose(pose, { duration });
    return true;
  }

  /** Mostra ou esconde um grupo (as tampas de corte são refeitas). */
  setGroupVisible(groupId, visivel) {
    const grupo = this.model.groups?.[groupId];
    if (!grupo) return;
    grupo.visible = !!visivel;
    this._hidden = this._hidden || new Set();
    if (visivel) this._hidden.delete(groupId); else this._hidden.add(groupId);
    this._corte.reconstruir();
    this.invalidate();
  }

  /** Título, subtítulo, nota e legenda [{ cor, rotulo }] usados no PNG exportado. */
  setExportInfo(info) {
    this.exportInfo = { ...this.exportInfo, ...(info || {}) };
  }

  // =================================================================== API: estado
  getState() {
    const e = this.estado;
    const s = {
      mode: e.mode,
      cut: e.cut.axis ? { ...e.cut } : null,
      isolate: e.isolate ? [...e.isolate] : null,
      explode: e.explode,
      speed: e.speed,
      autoRotate: e.autoRotate,
    };
    if (this._camera.vista) s.view = this._camera.vista;
    else s.pose = this._camera.poseAtual();
    if (e.labels) s.labels = e.labels.map((l) => ({ ...l }));
    return s;
  }

  applyState(s, { immediate = false } = {}) {
    if (!s || typeof s !== 'object') return;
    const animate = !immediate;
    if (s.mode) this.setColorMode(s.mode, { animate });
    if ('cut' in s) this.setCut(s.cut || { axis: null }, { animate });
    if ('isolate' in s) {
      this.setIsolation(s.isolate);
      if (immediate) for (const [id, f] of this._fantasma) { f.v = f.alvo; this._gerente.definirFantasma(id, f.v); }
      this._corte.atualizarFantasmas();
    }
    if ('explode' in s) this.setExplode(s.explode, { animate });
    if ('speed' in s) this.setAnimationSpeed(s.speed);
    if (s.view) this.setView(s.view, { immediate });
    else if (s.pose) this.setPose(s.pose, { duration: immediate ? 0 : 1.2 });
    if ('autoRotate' in s) this.setAutoRotate(s.autoRotate);
    if ('labels' in s) this.setLabels(s.labels);
    this.invalidate();
  }

  // =================================================================== API: exportação
  /**
   * Gera o PNG da vista atual. Devolve { blob, dataURL, largura, altura }.
   * withLegend compõe logotipo, título, legenda de cores e etiquetas visíveis.
   */
  async exportPNG({ withLegend = true, download = true, scale = 2, theme = 'claro', filename } = {}) {
    const razaoAtual = this.renderer.getPixelRatio();
    const maxLado = Math.max(this._largura, this._altura);
    const escala = Math.max(1, Math.min(scale, 4096 / maxLado));
    this.renderer.setPixelRatio(escala);
    this.renderer.setSize(this._largura, this._altura, false);
    this.renderer.render(this.scene, this.camera);
    // cópia imediata: o buffer de desenho só é garantido até o fim deste quadro
    const copia = document.createElement('canvas');
    copia.width = this.canvas.width;
    copia.height = this.canvas.height;
    copia.getContext('2d').drawImage(this.canvas, 0, 0);
    this.renderer.setPixelRatio(razaoAtual);
    this.renderer.setSize(this._largura, this._altura, false);
    this.invalidate();

    const tela = await comporPNG({
      render: copia, largura: this._largura, altura: this._altura, escala,
      logoUrl: this.logoUrl, etiquetas: withLegend ? this._etiquetas.instantaneo() : [],
      modoCor: this.estado.mode, fonte: getComputedStyle(this.container).fontFamily, tema: theme, comLegenda: withLegend,
      info: this.exportInfo,
    });
    const blob = await new Promise((ok) => tela.toBlob(ok, 'image/png'));
    const dataURL = tela.toDataURL('image/png');
    if (download && blob) baixar(blob, filename || `idugel-${this.model.id || 'modelo'}-${this._camera.vista || 'vista'}.png`);
    return { blob, dataURL, largura: tela.width, altura: tela.height };
  }

  // =================================================================== API: modelo
  /** Repassa ao modelo e reinstrumenta as peças que ele reconstruir. */
  setMotorPulleyDiameter(mm) {
    if (typeof this.model.setMotorPulleyDiameter !== 'function') return;
    this.model.setMotorPulleyDiameter(mm);
    this.refresh();
  }

  /** Chame depois que o modelo trocar malhas/materiais por conta própria. */
  refresh() {
    this.model.root.updateMatrixWorld(true);
    this._caixasGrupo = null;
    this._gerente.sincronizar();
    this._corte.reconstruir();
    this.invalidate();
  }

  // =================================================================== eventos
  on(evento, cb) {
    if (!this._ouvintes.has(evento)) this._ouvintes.set(evento, new Set());
    this._ouvintes.get(evento).add(cb);
    return () => this.off(evento, cb);
  }

  off(evento, cb) {
    this._ouvintes.get(evento)?.delete(cb);
  }

  _emitir(evento, dados) {
    const lista = this._ouvintes.get(evento);
    if (!lista) return;
    for (const cb of [...lista]) {
      try { cb(dados); } catch (e) { console.error(`[visualizador] erro em ouvinte de "${evento}"`, e); }
    }
  }

  _descrever(groupId, malha) {
    const ud = malha?.userData || {};
    const g = this._gerente.grupos.get(groupId);
    return {
      groupId,
      label: this.model.labels?.[groupId] || ROTULOS_GRUPO[groupId] || ud.label || groupId,
      scope: ud.scope || g?.escopo || null,
      part: ud.label || null,
    };
  }

  _emitirSelecao(groupId, def, alvo) {
    if (!groupId) return;
    const d = this._descrever(groupId, alvo?.malha);
    if (def?.scope) d.scope = def.scope;
    this._anuncio.textContent = `${d.label}${d.scope ? ` — ${ROTULOS_ESCOPO[d.scope] || d.scope}` : ''}`;
    this._emitir('select', d);
  }

  // =================================================================== seleção / realce
  _picar(x, y) {
    if (!this._largura) return null;
    const ndc = new THREE.Vector2((x / this._largura) * 2 - 1, -(y / this._altura) * 2 + 1);
    this._raycaster.setFromCamera(ndc, this.camera);
    const acertos = this._raycaster.intersectObject(this.model.root, true);
    let vidro = null;
    for (const a of acertos) {
      const id = a.object.userData?.groupId;
      if (!id || a.object.userData.__vwAuxiliar) continue;
      if (this._ehFantasma(id, a.object)) continue;
      if (this._corte.removido(a.point)) continue;
      const alvo = { groupId: id, malha: a.object, ponto: a.point };
      // vidro não bloqueia a seleção do que está atrás dele; só vale se não houver mais nada
      const mat = Array.isArray(a.object.material) ? a.object.material[0] : a.object.material;
      if (mat?.userData?.vw?.vidro) { vidro = vidro || alvo; continue; }
      return alvo;
    }
    return vidro;
  }

  _definirSobCursor(alvo) {
    const anterior = this._sobCursor?.groupId || null;
    const novo = alvo?.groupId || null;
    this._sobCursor = alvo;
    if (anterior === novo) return;
    for (const id of [anterior, novo]) {
      if (!id) continue;
      const s = this._realce.get(id) || { v: 0, alvo: 0 };
      s.alvo = id === novo || id === this._realceFixo ? 1 : 0;
      this._realce.set(id, s);
    }
    this.canvas.style.cursor = novo ? 'pointer' : '';
    if (this._dica) {
      if (novo) {
        const d = this._descrever(novo, alvo.malha);
        this._dica.textContent = '';
        const marca = document.createElement('span');
        marca.className = `vw-dica__marca vw-dica__marca--${d.scope}`;
        const nome = document.createElement('strong');
        nome.textContent = d.label;
        const esc = document.createElement('span');
        esc.className = 'vw-dica__escopo';
        esc.textContent = ROTULOS_ESCOPO[d.scope] || '';
        this._dica.append(marca, nome, esc);
        this._dica.classList.add('is-visivel');
      } else this._esconderDica();
    }
    this._emitir('hover', novo ? this._descrever(novo, alvo.malha) : null);
    this.invalidate();
  }

  _moverDica() {
    if (!this._dica || !this._sobCursor) return;
    const w = this._dica.offsetWidth;
    const x = Math.min(Math.max(8, this._ponteiro.x + 16), this._largura - w - 8);
    const y = Math.max(8, this._ponteiro.y - 38);
    this._dica.style.transform = `translate3d(${x.toFixed(0)}px, ${y.toFixed(0)}px, 0)`;
  }

  _esconderDica() {
    this._dica?.classList.remove('is-visivel');
  }

  // =================================================================== ciclo de vida
  resize() {
    if (this._descartado) return;
    const w = Math.floor(this.container.clientWidth);
    const h = Math.floor(this.container.clientHeight);
    if (!w || !h) return;
    if (w === this._largura && h === this._altura) return;
    this._largura = w;
    this._altura = h;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this._aplicarEnquadre();
    this.camera.updateProjectionMatrix();
    // a vista predefinida depende da proporção: reenquadra se o usuário não moveu a câmera
    if (this._camera && this._camera.vista && !this._camera.emTransicao) {
      this._camera.definirVista(this._camera.vista, { imediato: true });
    }
    this._etiquetas.medir();
    // renderiza já, para não piscar entre o redimensionamento e o próximo quadro
    if (this._rodando && !this._semContexto) { this._sujo = false; this._renderizar(); }
    this.invalidate();
  }

  start() {
    if (this._descartado) return;
    this._rodando = true;
    this._sujo = true;
    this._acordar();
  }

  stop() {
    this._rodando = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
  }

  dispose() {
    if (this._descartado) return;
    this.stop();
    this._descartado = true;
    this._tweens.cancelarTudo();
    this._obsTamanho?.disconnect();
    this._obsTela?.disconnect();
    if (this._aoRedimensionar) window.removeEventListener('resize', this._aoRedimensionar);
    document.removeEventListener('visibilitychange', this._aoVisibilidade);
    const el = this.canvas;
    el.removeEventListener('pointermove', this._aoMover);
    el.removeEventListener('pointerleave', this._aoSair);
    el.removeEventListener('pointerdown', this._aoBaixar);
    el.removeEventListener('pointerup', this._aoSoltar);
    el.removeEventListener('webglcontextlost', this._aoContextoPerdido);
    el.removeEventListener('webglcontextrestored', this._aoContextoRestaurado);
    this.controls.dispose();

    // devolve o modelo exatamente como foi recebido
    this._corte.dispose();
    this._gerente.dispose();
    for (const [id, g] of Object.entries(this.model.groups || {})) {
      if (this._posBase[id]) g.position.copy(this._posBase[id]);
    }
    this.scene.remove(this.model.root);

    this._etiquetas.dispose();
    this._dica?.remove();
    this._anuncio.remove();
    this._luzPrincipal.shadow.map?.dispose();
    this._ambiente.dispose();
    this._pmrem.dispose();
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    el.remove();
    this.container.classList.remove('vw', 'vw--interativo', 'vw--reduzido', 'vw--arrastando');
    delete this.container.dataset.vwModo;
    this._ouvintes.clear();
  }
}

export default InstallationViewer;
