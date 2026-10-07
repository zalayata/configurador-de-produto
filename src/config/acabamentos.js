// Acabamentos disponíveis no configurador (pintura RAL e inox). Fonte única para a interface,
// o visualizador (cor/metal/rugosidade) e a ficha de impressão.

/** @typedef {{ id: string, rotulo: string, amostra: string, cor: string, metalico: number, rugoso: number, tipo: 'inox'|'pintura', ral?: string }} Acabamento */

/** @type {Acabamento[]} */
export const ACABAMENTOS = [
  { id: 'inox-304', rotulo: 'Inox 304 escovado', amostra: 'linear-gradient(135deg, #d9dee1 0%, #aeb6bb 45%, #ced4d8 55%, #9aa3a9 100%)', cor: '#c9cfd3', metalico: 0.92, rugoso: 0.38, tipo: 'inox' },
  { id: 'inox-polido', rotulo: 'Inox polido', amostra: 'linear-gradient(135deg, #f2f5f7 0%, #b9c2c8 40%, #eef1f3 60%, #a7b1b8 100%)', cor: '#d7dcdf', metalico: 1, rugoso: 0.14, tipo: 'inox' },
  { id: 'vinho-idugel', rotulo: 'Vinho Idugel', amostra: 'linear-gradient(135deg, #a32026, #7b1f1f)', cor: '#8b1a1a', metalico: 0.22, rugoso: 0.42, tipo: 'pintura' },
  { id: 'ral-5015', rotulo: 'Azul céu · RAL 5015', amostra: '#2271b3', cor: '#2271b3', metalico: 0.2, rugoso: 0.42, tipo: 'pintura', ral: 'RAL 5015' },
  { id: 'ral-5005', rotulo: 'Azul sinal · RAL 5005', amostra: '#154889', cor: '#154889', metalico: 0.2, rugoso: 0.42, tipo: 'pintura', ral: 'RAL 5005' },
  { id: 'ral-9003', rotulo: 'Branco sinal · RAL 9003', amostra: '#f2f3f2', cor: '#f2f3f2', metalico: 0.15, rugoso: 0.5, tipo: 'pintura', ral: 'RAL 9003' },
  { id: 'ral-7035', rotulo: 'Cinza claro · RAL 7035', amostra: '#d7d9d6', cor: '#d7d9d6', metalico: 0.15, rugoso: 0.5, tipo: 'pintura', ral: 'RAL 7035' },
  { id: 'ral-7016', rotulo: 'Grafite · RAL 7016', amostra: '#383e42', cor: '#383e42', metalico: 0.25, rugoso: 0.46, tipo: 'pintura', ral: 'RAL 7016' },
  { id: 'ral-3020', rotulo: 'Vermelho tráfego · RAL 3020', amostra: '#c1121c', cor: '#c1121c', metalico: 0.2, rugoso: 0.44, tipo: 'pintura', ral: 'RAL 3020' },
  { id: 'ral-6024', rotulo: 'Verde tráfego · RAL 6024', amostra: '#2e8b57', cor: '#2e8b57', metalico: 0.2, rugoso: 0.44, tipo: 'pintura', ral: 'RAL 6024' },
]

export const acabamentoPorId = (id) => ACABAMENTOS.find((a) => a.id === id) || ACABAMENTOS[0]

/** Parâmetros do visualizador para um acabamento. */
export const aparenciaDe = (acabamento) => ({
  cor: acabamento.cor,
  metalico: acabamento.metalico,
  rugoso: acabamento.rugoso,
  intensidadeAmbiente: acabamento.tipo === 'inox' ? 1.15 : 0.7,
})
