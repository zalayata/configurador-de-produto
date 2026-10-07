// Motor mínimo de interpolações, avançado pelo laço do visualizador (sem timers próprios).

export const suavizar = {
  linear: (t) => t,
  cubica: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  saida: (t) => 1 - Math.pow(1 - t, 3),
  quintica: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
};

export class Tweens {
  constructor() {
    this.ativos = new Set();
  }

  /**
   * @param {object} o  { duracao (s), atraso (s), curva, aoAtualizar(k 0..1 já suavizado, bruto), aoTerminar(), canal }
   * `canal` garante exclusividade: um novo tween no mesmo canal cancela o anterior.
   */
  criar({ duracao = 0.6, atraso = 0, curva = suavizar.cubica, aoAtualizar, aoTerminar, canal = null }) {
    if (canal) this.cancelar(canal);
    const tw = { duracao, atraso, curva, aoAtualizar, aoTerminar, canal, t: 0, morto: false };
    tw.cancelar = () => { tw.morto = true; this.ativos.delete(tw); };
    if (duracao <= 0) {
      aoAtualizar && aoAtualizar(1, 1);
      aoTerminar && aoTerminar();
      tw.morto = true;
      return tw;
    }
    this.ativos.add(tw);
    return tw;
  }

  cancelar(canal) {
    for (const tw of this.ativos) if (tw.canal === canal) tw.cancelar();
  }

  cancelarTudo() {
    this.ativos.clear();
  }

  get ocupado() {
    return this.ativos.size > 0;
  }

  avancar(dt) {
    for (const tw of [...this.ativos]) {
      if (tw.morto) continue;
      tw.t += dt;
      const bruto = Math.min(1, Math.max(0, (tw.t - tw.atraso) / tw.duracao));
      tw.aoAtualizar && tw.aoAtualizar(tw.curva(bruto), bruto);
      if (bruto >= 1 && !tw.morto) {
        tw.morto = true;
        this.ativos.delete(tw);
        tw.aoTerminar && tw.aoTerminar();
      }
    }
  }
}
