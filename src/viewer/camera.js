// Câmera: vistas predefinidas calculadas a partir dos limites do modelo e da proporção da tela,
// e transição de pose em ARCO (a câmera orbita o alvo em vez de atravessar o modelo).
import { FOV_PADRAO, GRUPOS_ACIONAMENTO, GRUPOS_BANCO } from './constantes.js';
import { caixaDe } from './geometria.js';
import { suavizar } from './tweens.js';

export class Camera {
  constructor(THREE, { camera, controles, modelo, tweens, invalidar, reduzido }) {
    this.THREE = THREE;
    this.camera = camera;
    this.controles = controles;
    this.modelo = modelo;
    this.tweens = tweens;
    this.invalidar = invalidar;
    this.reduzido = reduzido;
    this.vista = null; // id da vista atual (null = pose livre)
    this.emTransicao = false;
    this.medirCaixas();
  }

  medirCaixas() {
    const THREE = this.THREE;
    const { root, bounds } = this.modelo;
    const tudo = bounds.clone();
    const doGrupo = (ids) => (o) => ids.includes(o.userData.groupId);
    const centroX = (o) => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).x;

    let banco = caixaDe(THREE, root, doGrupo(GRUPOS_BANCO));
    if (banco.isEmpty()) banco = tudo.clone();
    banco.min.y = Math.max(banco.min.y, 0);

    let sobPiso = caixaDe(THREE, root, (o) => o.userData.groupId !== 'piso'
      && new THREE.Box3().setFromObject(o).max.y < 0.05);
    if (sobPiso.isEmpty()) sobPiso = tudo.clone();
    sobPiso.max.y = Math.max(sobPiso.max.y, 0);

    // acionamento da passagem A (extremidade −X)
    let acion = caixaDe(THREE, root, (o) => GRUPOS_ACIONAMENTO.includes(o.userData.groupId) && centroX(o) < 0);
    if (acion.isEmpty()) acion = sobPiso.clone();

    this.caixas = { tudo, banco, sobPiso, acion };
  }

  /** Pose que enquadra `caixa` olhando na direção `dir` (do alvo para a câmera). */
  enquadrar(caixa, dir, { margem = 1.1, fov = FOV_PADRAO, deslocY = 0 } = {}) {
    const THREE = this.THREE;
    const aspecto = this.camera.aspect || 1.6;
    const alvo = caixa.getCenter(new THREE.Vector3());
    alvo.y += deslocY;
    const d = new THREE.Vector3(...dir).normalize();
    const direita = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), d).normalize();
    const cima = new THREE.Vector3().crossVectors(d, direita).normalize();
    const tv = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    const th = tv * aspecto;
    let dist = 0;
    const v = new THREE.Vector3();
    for (let i = 0; i < 8; i += 1) {
      v.set(i & 1 ? caixa.max.x : caixa.min.x, i & 2 ? caixa.max.y : caixa.min.y, i & 4 ? caixa.max.z : caixa.min.z).sub(alvo);
      const x = Math.abs(v.dot(direita));
      const y = Math.abs(v.dot(cima));
      const z = v.dot(d);
      dist = Math.max(dist, z + (x / th) * margem, z + (y / tv) * margem);
    }
    const pos = alvo.clone().addScaledVector(d, dist);
    return { position: pos.toArray(), target: alvo.toArray(), fov };
  }

  poseDaVista(id) {
    const c = this.caixas;
    const retrato = (this.camera.aspect || 1.6) < 0.8;
    switch (id) {
      case 'frente': return this.enquadrar(c.tudo, [0, 0.06, 1]);
      case 'tras': return this.enquadrar(c.tudo, [0, 0.06, -1]);
      case 'lateral': return this.enquadrar(c.tudo, [-1, 0.06, 0]);
      case 'topo': return this.enquadrar(c.tudo, [0, 1, 0.02]);
      case 'sob-piso': return this.enquadrar(c.sobPiso, [0.62, -0.3, 0.72], { margem: retrato ? 1.08 : 1.22 });
      case 'acionamento': return this.enquadrar(c.acion, [-0.72, -0.1, 0.68], { margem: 1.35 });
      case 'interior': return this.enquadrar(c.banco, [0.42, 0.26, 0.87], { margem: 1.3 });
      case 'produto': return this.enquadrar(c.banco, [-0.56, 0.3, 0.77], { margem: 1.4 });
      case 'iso':
      default: return this.enquadrar(c.tudo, [0.58, 0.36, 0.73], { margem: 1.06 });
    }
  }

  definirVista(id, { imediato = false, duracao = 1.4 } = {}) {
    const pose = this.poseDaVista(id);
    this.definirPose(pose, { duracao: imediato ? 0 : duracao });
    this.vista = id;
  }

  poseAtual() {
    const arred = (n) => Math.round(n * 1000) / 1000;
    return {
      position: this.camera.position.toArray().map(arred),
      target: this.controles.target.toArray().map(arred),
      fov: arred(this.camera.fov),
    };
  }

  cancelar() {
    this.tweens.cancelar('camera');
    this.emTransicao = false;
  }

  definirPose({ position, target, fov }, { duracao = 1.2 } = {}) {
    const THREE = this.THREE;
    const cam = this.camera;
    const ctl = this.controles;
    this.vista = null;
    const alvo1 = new THREE.Vector3(...(target || ctl.target.toArray()));
    const pos1 = new THREE.Vector3(...(position || cam.position.toArray()));
    const fov1 = fov || cam.fov;

    const aplicar = (pos, alvo, f) => {
      cam.position.copy(pos);
      ctl.target.copy(alvo);
      if (cam.fov !== f) { cam.fov = f; cam.updateProjectionMatrix(); }
      cam.lookAt(alvo);
      ctl.update();
      this.invalidar();
    };

    if (this.reduzido || duracao <= 0) {
      this.cancelar();
      aplicar(pos1, alvo1, fov1);
      return;
    }

    const alvo0 = ctl.target.clone();
    const fov0 = cam.fov;
    const e0 = new THREE.Spherical().setFromVector3(cam.position.clone().sub(alvo0));
    const e1 = new THREE.Spherical().setFromVector3(pos1.clone().sub(alvo1));
    // menor caminho angular
    let dTheta = e1.theta - e0.theta;
    if (dTheta > Math.PI) dTheta -= 2 * Math.PI;
    if (dTheta < -Math.PI) dTheta += 2 * Math.PI;
    // um leve recuo no meio do trajeto dá leitura de "voo" em mudanças grandes
    const giro = Math.abs(dTheta) + Math.abs(e1.phi - e0.phi);
    const recuo = Math.min(0.22, giro * 0.07) * Math.max(e0.radius, e1.radius);

    const e = new THREE.Spherical();
    const alvo = new THREE.Vector3();
    const pos = new THREE.Vector3();
    this.emTransicao = true;
    this.tweens.criar({
      canal: 'camera',
      duracao,
      curva: suavizar.cubica,
      aoAtualizar: (k) => {
        e.radius = THREE.MathUtils.lerp(e0.radius, e1.radius, k) + Math.sin(k * Math.PI) * recuo;
        e.theta = e0.theta + dTheta * k;
        e.phi = THREE.MathUtils.lerp(e0.phi, e1.phi, k);
        e.makeSafe();
        alvo.lerpVectors(alvo0, alvo1, k);
        pos.setFromSpherical(e).add(alvo);
        aplicar(pos, alvo, THREE.MathUtils.lerp(fov0, fov1, k));
      },
      aoTerminar: () => { this.emTransicao = false; },
    });
  }
}
