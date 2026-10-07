// Atmosfera em canvas 2D, em duas camadas: atrás do WebGL (feixe, névoa, farinha fina)
// e à frente (grãos grandes e desfocados). Não toca no visualizador.
// A farinha nunca recebe verde ou vermelho.

const FARINHA = [239, 230, 210];
const FARINHA_FRIA = [207, 224, 234];

export class Atmosfera {
  constructor({ tras, frente, grao, reduzido = false }) {
    this.tras = tras;
    this.frente = frente;
    this.reduzido = reduzido;
    this.ctxT = tras.getContext('2d');
    this.ctxF = frente.getContext('2d');
    this.alvo = { farinha: 0, feixe: 0, fria: 0, nevoa: 0.5 };
    this.atual = { farinha: 0, feixe: 0, fria: 0, nevoa: 0.5 };
    this.ritmo = 1;
    this.ativo = false;
    this.pontos = [];
    this.graos = [];
    this.raf = 0;
    this.ultimo = 0;
    this.quadro = this.quadro.bind(this);
    if (grao) grao.style.backgroundImage = `url(${this.texturaDeGrao()})`;
    this.medir();
  }

  texturaDeGrao() {
    const c = document.createElement('canvas');
    c.width = 192; c.height = 192;
    const x = c.getContext('2d');
    const img = x.createImageData(192, 192);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 90 + Math.random() * 120;
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }

  medir() {
    const r = this.tras.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    this.w = w; this.h = h;
    // camada de trás em meia resolução; a da frente também (os grãos são desfocados)
    this.escala = 0.5;
    for (const c of [this.tras, this.frente]) {
      c.width = Math.round(w * this.escala);
      c.height = Math.round(h * this.escala);
    }
    const movel = w < 900;
    const nPontos = movel ? 320 : 900;
    const nGraos = movel ? 40 : 110;
    this.pontos = Array.from({ length: nPontos }, () => this.novoPonto(true));
    this.graos = Array.from({ length: nGraos }, () => this.novoGrao(true));
    this.desenhar(0);
  }

  novoPonto(inicial) {
    return {
      x: Math.random() * this.w,
      y: inicial ? Math.random() * this.h : -10,
      r: 0.75 + Math.random() * 1.75,
      a: 0.1 + Math.random() * 0.45,
      vy: 6 + Math.random() * 16,
      fase: Math.random() * Math.PI * 2,
      onda: 6 + Math.random() * 18,
      ordem: Math.random(),
    };
  }

  novoGrao(inicial) {
    return {
      x: Math.random() * this.w,
      y: inicial ? Math.random() * this.h : -30,
      r: 4 + Math.random() * 7,
      vy: 10 + Math.random() * 18,
      vx: -4 + Math.random() * 8,
      fase: Math.random() * Math.PI * 2,
      ordem: Math.random(),
    };
  }

  /** Cenário do capítulo: { farinha 0..1, feixe, fria }. */
  definir(cenario = {}, ritmo = 1) {
    this.alvo.farinha = this.reduzido ? 0 : (cenario.farinha || 0);
    this.alvo.feixe = cenario.feixe ? 1 : 0;
    this.alvo.fria = cenario.fria ? 1 : 0;
    this.ritmo = ritmo;
    this.acordar();
  }

  definirRitmo(r) { this.ritmo = r; }

  ligar(v) {
    this.ativo = !!v;
    if (v) this.acordar();
    else {
      cancelAnimationFrame(this.raf); this.raf = 0;
      this.ctxT.clearRect(0, 0, this.tras.width, this.tras.height);
      this.ctxF.clearRect(0, 0, this.frente.width, this.frente.height);
    }
  }

  acordar() {
    if (!this.ativo) return;
    if (this.reduzido) { this.atual = { ...this.alvo }; this.desenhar(0); return; }
    if (!this.raf) { this.ultimo = 0; this.raf = requestAnimationFrame(this.quadro); }
  }

  quadro(agora) {
    this.raf = 0;
    if (!this.ativo || document.hidden) { if (this.ativo) setTimeout(() => this.acordar(), 500); return; }
    const dt = this.ultimo ? Math.min(0.05, (agora - this.ultimo) / 1000) : 1 / 60;
    this.ultimo = agora;
    const k = 1 - Math.exp(-dt / 0.45);
    for (const c of Object.keys(this.atual)) this.atual[c] += (this.alvo[c] - this.atual[c]) * k;
    this.desenhar(dt, agora / 1000);
    const parado = this.atual.farinha < 0.004 && this.alvo.farinha === 0 && Math.abs(this.atual.feixe - this.alvo.feixe) < 0.01;
    if (!parado) this.raf = requestAnimationFrame(this.quadro);
  }

  desenhar(dt, t = 0) {
    const { ctxT: a, ctxF: f, w, h, escala: e } = this;
    const at = this.atual;
    a.setTransform(e, 0, 0, e, 0, 0);
    f.setTransform(e, 0, 0, e, 0, 0);
    a.clearRect(0, 0, w, h);
    f.clearRect(0, 0, w, h);

    // feixe diagonal do alto à esquerda
    if (at.feixe > 0.01) {
      a.save();
      a.globalAlpha = 0.16 * at.feixe;
      a.translate(w * 0.18, -h * 0.1);
      a.rotate(0.5);
      const g = a.createLinearGradient(0, 0, w * 0.34, 0);
      g.addColorStop(0, 'rgba(159,196,218,0)');
      g.addColorStop(0.5, 'rgba(207,224,234,1)');
      g.addColorStop(1, 'rgba(159,196,218,0)');
      a.fillStyle = g;
      a.fillRect(0, 0, w * 0.34, h * 1.8);
      a.restore();
    }
    // névoa baixa
    if (at.fria > 0.01) {
      const g = a.createLinearGradient(0, h * 0.55, 0, h);
      g.addColorStop(0, 'rgba(159,196,218,0)');
      g.addColorStop(1, `rgba(120,160,185,${0.12 * at.fria})`);
      a.fillStyle = g;
      a.fillRect(0, h * 0.55, w, h * 0.45);
    }

    if (at.farinha <= 0.004) return;
    const cor = FARINHA.map((v, i) => Math.round(v + (FARINHA_FRIA[i] - v) * at.fria));
    const rgb = `${cor[0]},${cor[1]},${cor[2]}`;
    const ritmo = this.ritmo;
    // faixa do feixe: os pontos brilham ao cruzá-la
    for (const p of this.pontos) {
      if (p.ordem > at.farinha) continue;
      if (dt) {
        p.y += p.vy * ritmo * dt;
        p.fase += dt * 0.6;
        if (p.y > h + 10) Object.assign(p, this.novoPonto(false));
      }
      const x = p.x + Math.sin(p.fase) * p.onda;
      const noFeixe = at.feixe > 0.01 ? Math.max(0, 1 - Math.abs((x - w * 0.18) - (p.y + h * 0.1) * 0.55 - w * 0.12) / (w * 0.16)) : 0;
      a.globalAlpha = Math.min(0.8, p.a * (0.55 + noFeixe * 0.9));
      a.fillStyle = `rgb(${rgb})`;
      a.beginPath();
      a.arc(x, p.y, p.r, 0, 6.2832);
      a.fill();
    }
    a.globalAlpha = 1;

    for (const g of this.graos) {
      if (g.ordem > at.farinha) continue;
      if (dt) {
        g.y += g.vy * ritmo * dt;
        g.x += (g.vx + Math.sin(g.fase + t * 0.4) * 6) * dt;
        if (g.y > h + 30) Object.assign(g, this.novoGrao(false));
      }
      const grad = f.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
      grad.addColorStop(0, `rgba(${rgb},0.11)`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      f.fillStyle = grad;
      f.beginPath();
      f.arc(g.x, g.y, g.r, 0, 6.2832);
      f.fill();
    }
  }
}
