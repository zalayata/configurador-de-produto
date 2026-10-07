// Utilidades da página: formatação pt-BR, criação de DOM e pequenos auxiliares.

const nfCache = new Map();
/** Número em pt-BR (vírgula decimal, ponto de milhar). */
export function num(valor, casasMin = 0, casasMax = casasMin) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  const chave = `${casasMin}:${casasMax}`;
  if (!nfCache.has(chave)) {
    nfCache.set(chave, new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casasMin, maximumFractionDigits: casasMax }));
  }
  return nfCache.get(chave).format(valor);
}

const MAPA_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => MAPA_ESC[c]);

/** Cria um elemento a partir de HTML (primeiro nó). */
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export const limitar = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
export const doisDigitos = (n) => String(n).padStart(2, '0');

/** Faixa de tela da direção de arte: desktop, janela baixa ou empilhada. */
export function faixaDeTela() {
  if (window.innerWidth < 900) return 'empilhada';
  if (window.innerHeight <= 720) return 'baixa';
  return 'desktop';
}

export const movimentoReduzido = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

/** Marcador de forma do escopo (redundância de forma: círculo, quadrado barrado, losango). */
export function marcador(escopo) {
  const classe = `marca-escopo marca-escopo--${escopo}`;
  if (escopo === 'incluso') {
    return `<svg class="${classe}" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="6.5"/></svg>`;
  }
  if (escopo === 'nao-incluso') {
    return `<svg class="${classe}" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="1.5" y="1.5" width="13" height="13"/><path class="marca-escopo__barra" d="M3 13 13 3"/></svg>`;
  }
  return `<svg class="${classe}" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 1.6 14.4 8 8 14.4 1.6 8Z"/></svg>`;
}

/** Ícones de linha (traço cromo). */
export const ICONES = {
  menu: '<path d="M4 8h16M4 16h10"/>',
  fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
  baixo: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  cima: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  baixar: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  abrir: '<path d="M8 5h11v11M19 5 6 18"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
  imprimir: '<path d="M7 9V4h10v5M7 17H4v-7h16v7h-3M7 14h10v6H7z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  mira: '<circle cx="12" cy="12" r="6"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  cubo: '<path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3zM4 7.5l8 4.5 8-4.5M12 12v9"/>',
  tabela: '<path d="M4 5h16v14H4zM4 10h16M4 15h16M10 5v14"/>',
  texto: '<path d="M5 6h14M5 10h14M5 14h9M5 18h11"/>',
  // acompanhamento do pedido (rota com início e fim)
  rota: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>',
};
export function icone(nome, extra = '') {
  return `<svg class="icone ${extra}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONES[nome] || ''}</svg>`;
}

/** Copia texto; devolve false quando a área de transferência não está disponível. */
export async function copiar(texto) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch (e) { /* cai no método alternativo */ }
  try {
    const campo = document.createElement('textarea');
    campo.value = texto;
    campo.setAttribute('readonly', '');
    campo.style.cssText = 'position:fixed;left:-999px;top:0;opacity:0';
    document.body.appendChild(campo);
    campo.select();
    const ok = document.execCommand('copy');
    campo.remove();
    return ok;
  } catch (e) {
    return false;
  }
}

/** Prende o foco dentro de um painel modal. Devolve a função que desfaz. */
export function prenderFoco(painel, aoEsc) {
  const focaveis = () => $$('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', painel)
    .filter((e) => e.offsetParent !== null || e === document.activeElement);
  const aoTeclar = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); aoEsc && aoEsc(); return; }
    if (e.key !== 'Tab') return;
    const lista = focaveis();
    if (!lista.length) return;
    const primeiro = lista[0];
    const ultimo = lista[lista.length - 1];
    const ativo = document.activeElement;
    // foco fora da lista (p. ex. na folha com tabindex=-1 ou fora do painel): entra pela ponta
    if (!painel.contains(ativo) || !lista.includes(ativo)) {
      const dentro = painel.contains(ativo) && ativo !== painel;
      if (dentro) {
        // segue a ordem do documento a partir do elemento atual
        const seguinte = e.shiftKey
          ? [...lista].reverse().find((f) => f.compareDocumentPosition(ativo) & Node.DOCUMENT_POSITION_FOLLOWING)
          : lista.find((f) => f.compareDocumentPosition(ativo) & Node.DOCUMENT_POSITION_PRECEDING);
        e.preventDefault();
        (seguinte || (e.shiftKey ? ultimo : primeiro)).focus();
        return;
      }
      e.preventDefault();
      (e.shiftKey ? ultimo : primeiro).focus();
      return;
    }
    if (e.shiftKey && ativo === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && ativo === ultimo) { e.preventDefault(); primeiro.focus(); }
  };
  // fase de captura no documento: vale mesmo quando o foco escapou do painel
  document.addEventListener('keydown', aoTeclar, true);
  return () => document.removeEventListener('keydown', aoTeclar, true);
}
