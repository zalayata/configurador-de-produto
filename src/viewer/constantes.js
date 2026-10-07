// Constantes do visualizador. No configurador não há fonte de escopo fixa: rótulos de grupo,
// ordem das tampas de corte e escopos vêm do modelo em uso (configurarVisualizador) e podem ser
// trocados a cada produto. Os valores abaixo são o estado neutro.

// Cores e rótulos de escopo (usados só quando o modelo informa `scope` nas malhas).
export const CORES_ESCOPO = { incluso: '#0B8A43', 'nao-incluso': '#C8201E', existente: '#8C9296' };
export const ROTULOS_ESCOPO = { incluso: 'Incluso', 'nao-incluso': 'Não incluso', existente: 'Existente' };

// Rótulo público de cada grupo (preenchido por configurarVisualizador a partir de model.labels).
export const ROTULOS_GRUPO = {};
export const ESCOPO_DO_GRUPO = {};

// Ordem de desenho das tampas de corte: envoltórios primeiro, miolo por último
// (as tampas são coplanares; a última desenhada prevalece onde as seções se sobrepõem).
export const ORDEM_TAMPAS = [];

// Grupos usados pelos enquadramentos especiais da câmera (vazios = a câmera usa o modelo inteiro).
export const GRUPOS_ACIONAMENTO = [];
export const GRUPOS_BANCO = [];

export const VISTAS = ['iso', 'frente', 'lateral', 'tras', 'topo', 'produto'];

export const FOV_PADRAO = 32;

/** Define rótulos, escopos e ordem de tampas do modelo atual (substitui os anteriores). */
export function configurarVisualizador({ rotulos = {}, escopos = {}, ordemTampas = [], coresEscopo = null, rotulosEscopo = null } = {}) {
  for (const k of Object.keys(ROTULOS_GRUPO)) delete ROTULOS_GRUPO[k];
  for (const k of Object.keys(ESCOPO_DO_GRUPO)) delete ESCOPO_DO_GRUPO[k];
  Object.assign(ROTULOS_GRUPO, rotulos);
  Object.assign(ESCOPO_DO_GRUPO, escopos);
  ORDEM_TAMPAS.splice(0, ORDEM_TAMPAS.length, ...ordemTampas);
  if (coresEscopo) Object.assign(CORES_ESCOPO, coresEscopo);
  if (rotulosEscopo) Object.assign(ROTULOS_ESCOPO, rotulosEscopo);
}
