// Composição do PNG exportado: render 3D + logotipo + título + legenda de cores (+ etiquetas).
// Título, subtítulo, nota e itens da legenda vêm de quem exporta (`info`), nunca de dados fixos.
import { CORES_ESCOPO } from './constantes.js';

function carregarImagem(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // sem logotipo a exportação continua
    img.src = url;
  });
}

function retangulo(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function quebrar(ctx, texto, larguraMax) {
  const linhas = [];
  let atual = '';
  for (const palavra of texto.split(/\s+/)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (ctx.measureText(tentativa).width > larguraMax && atual) { linhas.push(atual); atual = palavra; } else atual = tentativa;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/**
 * @param {object} o
 *  render: HTMLCanvasElement já renderizado; largura/altura em px CSS; escala = px reais / px CSS
 */
export async function comporPNG({ render, largura, altura, escala, logoUrl, etiquetas = [], modoCor, fonte, tema = 'claro', comLegenda = true, info = {} }) {
  const titulo = info.titulo || 'Modelo 3D';
  const subtitulo = info.subtitulo || '';
  const nota = info.nota || '';
  const itens = Array.isArray(info.legenda) ? info.legenda.filter((i) => i && i.rotulo) : [];
  const cabecalhoLegenda = info.cabecalhoLegenda || (modoCor === 'escopo' ? 'CORES POR ESCOPO DE FORNECIMENTO' : 'LEGENDA');
  const W = Math.round(largura * escala);
  const H = Math.round(altura * escala);
  const tela = document.createElement('canvas');
  tela.width = W;
  tela.height = H;
  const ctx = tela.getContext('2d');
  const escuro = tema === 'escuro';
  const tinta = escuro ? '#eef2f3' : '#18201f';
  const tintaSuave = escuro ? 'rgba(238,242,243,.68)' : 'rgba(24,32,31,.66)';
  const familia = fonte || 'system-ui, -apple-system, "Segoe UI", sans-serif';

  if (comLegenda) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    if (escuro) { g.addColorStop(0, '#1b2224'); g.addColorStop(1, '#0d1112'); } else { g.addColorStop(0, '#f6f8f8'); g.addColorStop(1, '#dde4e5'); }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.drawImage(render, 0, 0, W, H);
  if (!comLegenda) return tela;

  ctx.save();
  ctx.scale(escala, escala);
  const compacto = largura < 640;
  const m = compacto ? 16 : 28;

  // ---- etiquetas (mesma posição da tela)
  ctx.lineJoin = 'round';
  for (const e of etiquetas) {
    const cor = CORES_ESCOPO[e.escopo] || '#5b6568';
    const pts = (e.pontos || '').split(' ').map((p) => p.split(',').map(Number)).filter((p) => p.length === 2);
    if (pts.length > 1) {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = cor;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(e.ax, e.ay, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(e.ax, e.ay, 3, 0, Math.PI * 2);
    ctx.fillStyle = cor;
    ctx.fill();

    retangulo(ctx, e.x, e.y, e.w, e.h, 7);
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.shadowColor = 'rgba(10,20,20,.22)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.save();
    retangulo(ctx, e.x, e.y, e.w, e.h, 7);
    ctx.clip();
    ctx.fillStyle = cor;
    ctx.fillRect(e.x, e.y, 4, e.h);
    ctx.restore();
    const tam = compacto ? 11 : 13;
    ctx.font = `600 ${tam}px ${familia}`;
    ctx.fillStyle = '#18201f';
    ctx.textBaseline = 'middle';
    // mesmas medidas da etiqueta HTML (borda 4 + recuo 10 + marca 8 + vão 8), para quebrar igual
    const recuo = compacto ? 23 : 30;
    ctx.beginPath();
    ctx.arc(e.x + recuo - (compacto ? 9 : 12), e.y + e.h / 2, compacto ? 3 : 4, 0, Math.PI * 2);
    ctx.fillStyle = cor;
    ctx.fill();
    ctx.fillStyle = '#18201f';
    const linhas = quebrar(ctx, e.texto, e.w - recuo - 11);
    const alt = tam * 1.25;
    linhas.forEach((l, i) => ctx.fillText(l, e.x + recuo, e.y + e.h / 2 + (i - (linhas.length - 1) / 2) * alt));
  }

  // ---- cabeçalho: logotipo + título
  const logo = logoUrl ? await carregarImagem(logoUrl) : null;
  let yTopo = m;
  if (logo) {
    const hLogo = compacto ? 30 : 46;
    const wLogo = hLogo * (logo.naturalWidth / logo.naturalHeight);
    if (escuro) {
      retangulo(ctx, m - 8, yTopo - 6, wLogo + 16, hLogo + 12, 8);
      ctx.fillStyle = 'rgba(255,255,255,.94)';
      ctx.fill();
    }
    ctx.drawImage(logo, m, yTopo, wLogo, hLogo);
    yTopo += hLogo + (compacto ? 12 : 16);
  }
  ctx.textBaseline = 'top';
  ctx.fillStyle = tinta;
  ctx.font = `700 ${compacto ? 16 : 22}px ${familia}`;
  const larguraTitulo = largura - m * 2;
  for (const l of quebrar(ctx, titulo, larguraTitulo)) {
    ctx.fillText(l, m, yTopo);
    yTopo += compacto ? 20 : 27;
  }
  ctx.fillStyle = tintaSuave;
  ctx.font = `500 ${compacto ? 11 : 13}px ${familia}`;
  if (subtitulo) ctx.fillText(subtitulo, m, yTopo + 2);

  // ---- rodapé: aviso + legenda
  ctx.font = `400 ${compacto ? 9.5 : 11}px ${familia}`;
  const aviso = nota ? quebrar(ctx, nota, largura - m * 2) : [];
  let yBase = altura - m;
  ctx.fillStyle = tintaSuave;
  ctx.textBaseline = 'alphabetic';
  for (let i = aviso.length - 1; i >= 0; i -= 1) {
    ctx.fillText(aviso[i], m, yBase);
    yBase -= compacto ? 13 : 15;
  }
  yBase -= 6;
  if (!itens.length) { ctx.restore(); return tela; }

  const tamLeg = compacto ? 11 : 13;
  ctx.font = `600 ${tamLeg}px ${familia}`;
  const altItem = compacto ? 20 : 24;
  const larg = Math.max(...itens.map((i) => ctx.measureText(i.rotulo).width)) + 44;
  const altCaixa = itens.length * altItem + 38;
  const x0 = m;
  const y0 = yBase - altCaixa;
  retangulo(ctx, x0, y0, Math.min(larg + 8, largura - m * 2), altCaixa, 10);
  ctx.fillStyle = escuro ? 'rgba(20,26,28,.86)' : 'rgba(255,255,255,.9)';
  ctx.shadowColor = 'rgba(10,20,20,.18)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 4;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = tintaSuave;
  ctx.font = `700 ${compacto ? 9 : 10}px ${familia}`;
  ctx.fillText(cabecalhoLegenda, x0 + 14, y0 + 17);
  ctx.font = `600 ${tamLeg}px ${familia}`;
  itens.forEach((it, i) => {
    const y = y0 + 30 + i * altItem + altItem / 2;
    retangulo(ctx, x0 + 14, y - 6, 16, 12, 3);
    ctx.fillStyle = it.cor;
    ctx.fill();
    ctx.fillStyle = tinta;
    ctx.fillText(it.rotulo, x0 + 38, y + 0.5);
  });
  ctx.restore();
  return tela;
}

export function baixar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
