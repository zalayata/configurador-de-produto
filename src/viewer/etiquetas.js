// Etiquetas HTML ancoradas em pontos do modelo, com linha-guia em SVG.
// O texto é DOM real (lista), portanto acessível a leitores de tela e à busca do navegador.
import { ROTULOS_ESCOPO } from './constantes.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class Etiquetas {
  constructor(THREE, recipiente, { aoSelecionar, reduzido }) {
    this.THREE = THREE;
    this.aoSelecionar = aoSelecionar;
    this.reduzido = reduzido;
    this.itens = [];
    this.v = new THREE.Vector3();

    this.raiz = document.createElement('div');
    this.raiz.className = 'vw-etiquetas';
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('class', 'vw-etiquetas__linhas');
    this.svg.setAttribute('aria-hidden', 'true');
    this.lista = document.createElement('ul');
    this.lista.className = 'vw-etiquetas__lista';
    this.lista.setAttribute('aria-label', 'Identificação das peças do modelo');
    this.raiz.append(this.svg, this.lista);
    recipiente.appendChild(this.raiz);
  }

  get ativas() { return this.itens.length > 0; }

  /** Etiquetas na ordem de Tab só com a órbita livre ligada (setInteractive do visualizador). */
  definirFocavel(v) {
    this.focavel = !!v;
    for (const it of this.itens) {
      const b = it.li.querySelector('.vw-etiqueta__corpo');
      if (!b) continue;
      if (this.focavel) b.removeAttribute('tabindex'); else b.tabIndex = -1;
    }
  }

  /** @param {Array<{anchor, text, scope}>} lista  @param {(anchor)=>Vector3|null} resolver */
  definir(lista, resolver) {
    this.limpar();
    if (!lista || !lista.length) return;
    this.resolver = resolver;
    lista.forEach((def, i) => {
      const li = document.createElement('li');
      li.className = `vw-etiqueta vw-etiqueta--${def.scope || 'neutro'} is-oculta`;
      li.style.setProperty('--vw-ordem', String(i));
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'vw-etiqueta__corpo';
      // fora da órbita livre a etiqueta só ilustra (o conteúdo está na página): fica fora da ordem de Tab
      if (!this.focavel) botao.tabIndex = -1;
      const marca = document.createElement('span');
      marca.className = 'vw-etiqueta__marca';
      marca.setAttribute('aria-hidden', 'true');
      const texto = document.createElement('span');
      texto.className = 'vw-etiqueta__texto';
      texto.textContent = def.text;
      botao.append(marca, texto);
      if (def.short) {
        // marcador numerado (telas estreitas): o texto completo continua no DOM para leitores de tela
        li.classList.add('vw-etiqueta--com-curto');
        const curto = document.createElement('span');
        curto.className = 'vw-etiqueta__curto';
        curto.setAttribute('aria-hidden', 'true');
        curto.textContent = def.short;
        botao.append(curto);
      }
      if (def.scope && ROTULOS_ESCOPO[def.scope]) {
        const sr = document.createElement('span');
        sr.className = 'vw-somente-leitor';
        sr.textContent = ` — ${ROTULOS_ESCOPO[def.scope]}`;
        botao.append(sr);
      }
      botao.addEventListener('click', () => this.aoSelecionar && this.aoSelecionar(def));
      li.append(botao);
      this.lista.append(li);

      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', `vw-guia vw-guia--${def.scope || 'neutro'} is-oculta`);
      const linha = document.createElementNS(SVG_NS, 'polyline');
      const halo = document.createElementNS(SVG_NS, 'circle');
      halo.setAttribute('class', 'vw-guia__halo');
      halo.setAttribute('r', '7');
      const ponto = document.createElementNS(SVG_NS, 'circle');
      ponto.setAttribute('class', 'vw-guia__ponto');
      ponto.setAttribute('r', '3.5');
      g.append(linha, halo, ponto);
      this.svg.append(g);

      this.itens.push({ def, li, g, linha, halo, ponto, x: 0, y: 0, w: 0, h: 0, posto: false, visivel: false, escolha: -1 });
    });
    this.medir();
  }

  /**
   * Área segura e obstáculos (em px do contêiner) que as etiquetas respeitam.
   *   area        { esq, topo, dir, base }  recuos a partir das bordas
   *   obstaculos  [{ x, y, w, h, peso }]    retângulos da interface (coluna de texto, títulos, botões)
   *   compacto    true: etiquetas com `short` viram marcadores numerados
   */
  definirLeiaute({ area = null, obstaculos = null, compacto = false } = {}) {
    this.area = area ? { esq: 0, topo: 0, dir: 0, base: 0, ...area } : null;
    this.obstaculos = Array.isArray(obstaculos) ? obstaculos.filter((o) => o && o.w > 0 && o.h > 0) : [];
    const mudou = !!compacto !== !!this.compacto;
    this.compacto = !!compacto;
    this.raiz.classList.toggle('vw-etiquetas--compacto', this.compacto);
    if (mudou) { this.medir(); for (const it of this.itens) it.posto = false; }
  }

  /** Obstáculo que se move com a câmera (rótulo da linha da laje); null remove. */
  definirObstaculoMovel(r) {
    this.obstaculoMovel = r && r.w > 0 && r.h > 0 ? r : null;
  }

  medir() {
    for (const it of this.itens) {
      it.w = it.li.offsetWidth;
      it.h = it.li.offsetHeight;
    }
  }

  limpar() {
    this.lista.textContent = '';
    this.svg.textContent = '';
    this.itens = [];
  }

  /**
   * Reposiciona as etiquetas. Devolve true enquanto ainda houver movimento de acomodação
   * (o visualizador continua renderizando até estabilizar).
   */
  atualizar(camera, largura, altura, { oculto } = {}) {
    if (!this.itens.length) return false;
    const estreito = largura < 560;
    const margem = 8;
    const afast = estreito ? 26 : 64;
    const sobe = estreito ? 30 : 38;
    const visiveis = [];

    for (const it of this.itens) {
      const p = this.resolver(it.def.anchor, it.def);
      let ok = !!p;
      if (ok) {
        this.v.copy(p).project(camera);
        // atrás da câmera ou fora do volume de visão
        ok = this.v.z > -1 && this.v.z < 1 && Math.abs(this.v.x) < 1.08 && Math.abs(this.v.y) < 1.08;
        if (ok && oculto && oculto(p, it.def)) ok = false;
      }
      if (!ok && it.escolha !== -1) it.escolha = -1;
      if (ok) {
        it.ax = (this.v.x * 0.5 + 0.5) * largura;
        it.ay = (-this.v.y * 0.5 + 0.5) * altura;
        if (!it.w) { it.w = it.li.offsetWidth; it.h = it.li.offsetHeight; }
        visiveis.push(it);
      }
      if (ok !== it.visivel) {
        it.visivel = ok;
        it.li.classList.toggle('is-oculta', !ok);
        it.g.classList.toggle('is-oculta', !ok);
        if (!ok) it.posto = false;
      }
    }
    if (!visiveis.length) return false;

    // área segura: margens do contêiner + recuos pedidos pela página (cabeçalho, indicadores, barra de base)
    const ar = this.area || { esq: 0, topo: 0, dir: 0, base: 0 };
    const x0 = Math.max(margem, ar.esq);
    const y0 = Math.max(margem, ar.topo);
    const x1 = Math.max(x0 + 40, largura - Math.max(margem, ar.dir));
    const y1 = Math.max(y0 + 24, altura - Math.max(margem, ar.base));
    const prender = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b));
    const obst = this.obstaculoMovel ? [...(this.obstaculos || []), this.obstaculoMovel] : (this.obstaculos || []);
    const folga = 6;
    const sobrepoe = (ax, ay, aw, ah, bx, by, bw, bh, f = 0) => {
      const sx = Math.min(ax + aw, bx + bw + f) - Math.max(ax, bx - f);
      const sy = Math.min(ay + ah, by + bh + f) - Math.max(ay, by - f);
      return sx > 0 && sy > 0 ? sx * sy : 0;
    };

    // Cada etiqueta escolhe, entre posições candidatas em volta da âncora, a que fica dentro da área
    // segura sem cobrir a interface, outra etiqueta ou outra âncora. O lado preferido é o da âncora em
    // relação ao centro das âncoras; a escolha anterior tem preferência (evita troca a cada quadro).
    const cx = visiveis.reduce((s, it) => s + it.ax, 0) / visiveis.length;
    visiveis.sort((a, b) => a.ay - b.ay || a.ax - b.ax);
    const postas = [];
    for (const it of visiveis) {
      const marcador = this.compacto && !!it.def.short;
      // def.afastar (px): afastamento horizontal próprio da etiqueta, só em janelas largas e altas
      // (na janela baixa a etiqueta afastada cairia sobre a linha da laje)
      const afastada = !marcador && !estreito && altura > 720 && it.def.afastar;
      // def.lado (1 direita, −1 esquerda): a etiqueta afastada só abre para esse lado (o outro fica sob o texto da página)
      const fixo = afastada && it.def.lado ? Math.sign(it.def.lado) : 0;
      const lado = fixo || (it.ax < cx ? -1 : 1);
      const dx = marcador ? 14 : afastada || afast;
      const dy = marcador ? 16 : sobe;
      const candidatos = [];
      for (const l of fixo ? [lado] : [lado, -lado]) {
        for (const v of [-1, 0, 1, -2.4, 2.4]) {
          const x = l < 0 ? it.ax - dx - it.w : it.ax + dx;
          candidatos.push([x, it.ay + v * dy - it.h / 2]);
        }
      }
      // acima e abaixo da âncora, centrada
      candidatos.push([it.ax - it.w / 2, it.ay - dy * 1.6 - it.h], [it.ax - it.w / 2, it.ay + dy * 1.6]);
      let melhor = null;
      candidatos.forEach(([bx, by], k) => {
        const x = prender(bx, x0, x1 - it.w);
        const y = prender(by, y0, y1 - it.h);
        let custo = k * 40 + (Math.abs(x - bx) + Math.abs(y - by)) * 6;
        if (k === it.escolha) custo -= 900;
        for (const o of obst) custo += sobrepoe(x, y, it.w, it.h, o.x, o.y, o.w, o.h, 8) * (o.peso ?? 1);
        for (const p of postas) custo += sobrepoe(x, y, it.w, it.h, p.tx, p.ty, p.w, p.h, folga) * 3;
        for (const o of visiveis) {
          // não cobre a própria âncora nem as das outras etiquetas
          custo += sobrepoe(x, y, it.w, it.h, o.ax - 9, o.ay - 9, 18, 18) * 4;
        }
        if (!melhor || custo < melhor.custo) melhor = { custo, x, y, k };
      });
      it.lado = lado;
      it.tx = melhor.x;
      it.ty = melhor.y;
      it.escolha = melhor.k;
      postas.push(it);
    }

    // acomodação final: afasta verticalmente pares que ainda se sobrepõem, preservando a ordem das âncoras
    for (let passo = 0; passo < 12; passo += 1) {
      let mexeu = false;
      for (let i = 0; i < visiveis.length; i += 1) {
        for (let j = i + 1; j < visiveis.length; j += 1) {
          const a = visiveis[i];
          const b = visiveis[j];
          const sobreX = Math.min(a.tx + a.w, b.tx + b.w) - Math.max(a.tx, b.tx);
          if (sobreX <= -folga) continue;
          const [ci, ba] = a.ty <= b.ty ? [a, b] : [b, a];
          const sobreY = ci.ty + ci.h + folga - ba.ty;
          if (sobreY <= 0) continue;
          ci.ty -= sobreY / 2;
          ba.ty += sobreY / 2;
          mexeu = true;
        }
      }
      for (const it of visiveis) it.ty = prender(it.ty, y0, y1 - it.h);
      if (!mexeu) break;
    }

    let movendo = false;
    for (const it of visiveis) {
      if (!it.posto || this.reduzido) {
        it.x = it.tx; it.y = it.ty; it.posto = true;
      } else {
        const dx = it.tx - it.x;
        const dy = it.ty - it.y;
        if (Math.abs(dx) + Math.abs(dy) > 0.4) {
          it.x += dx * 0.28; it.y += dy * 0.28; movendo = true;
        } else { it.x = it.tx; it.y = it.ty; }
      }
      it.li.style.transform = `translate3d(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px, 0)`;

      // linha-guia: âncora -> cotovelo -> borda da etiqueta
      const cyEt = it.y + it.h / 2;
      const esquerda = it.x + it.w / 2 < it.ax;
      const bx = esquerda ? it.x + it.w : it.x;
      const dentro = it.ax >= it.x - 2 && it.ax <= it.x + it.w + 2;
      let pts;
      if (dentro) {
        const by = it.ay < it.y ? it.y : it.y + it.h;
        pts = `${it.ax.toFixed(1)},${it.ay.toFixed(1)} ${it.ax.toFixed(1)},${by.toFixed(1)}`;
      } else {
        const cot = bx + (esquerda ? 1 : -1) * Math.min(18, Math.abs(it.ax - bx) * 0.5);
        pts = `${it.ax.toFixed(1)},${it.ay.toFixed(1)} ${cot.toFixed(1)},${cyEt.toFixed(1)} ${bx.toFixed(1)},${cyEt.toFixed(1)}`;
      }
      it.linha.setAttribute('points', pts);
      it.ponto.setAttribute('cx', it.ax.toFixed(1));
      it.ponto.setAttribute('cy', it.ay.toFixed(1));
      it.halo.setAttribute('cx', it.ax.toFixed(1));
      it.halo.setAttribute('cy', it.ay.toFixed(1));
    }
    return movendo;
  }

  /** Geometria atual das etiquetas visíveis (usada na exportação em PNG). */
  instantaneo() {
    return this.itens.filter((it) => it.visivel).map((it) => ({
      texto: it.def.text, escopo: it.def.scope, x: it.x, y: it.y, w: it.w, h: it.h, ax: it.ax, ay: it.ay,
      pontos: it.linha.getAttribute('points'),
    }));
  }

  dispose() {
    this.limpar();
    this.raiz.remove();
  }
}
