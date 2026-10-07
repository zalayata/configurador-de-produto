// Dados fixos do controle de produção (não mudam com o andamento): equipamento, fornecedor e contato.
// Datas, cliente, ordem de produção e percentuais vêm de public/horizon/andamento.json.
import { branding } from '../config/branding'

export const PROJETO = {
  /** Nome do equipamento (título da página). */
  equipamento: 'Dosador Horizon',
  linha: 'Grupo Idugel',
  paginaTitulo: 'Controle de produção',
  fornecedor: {
    nome: branding.companyName,
    razao: branding.legalName,
    cidade: 'Joaçaba (SC)',
    endereco: branding.address,
    telefone: branding.phone,
    site: branding.siteUrl.replace(/^https?:\/\//, ''),
    siteUrl: branding.siteUrl,
    cnpj: branding.cnpj,
    tagline: branding.tagline,
    assinatura: branding.signature,
  },
  /** Texto do capítulo quando o andamento.json não carrega (afirmativo, sem ressalva). */
  semDados: 'O andamento da produção é acompanhado pela equipe Idugel.',
}

/** Caminho (relativo à página) do JSON do andamento, publicado em public/horizon/. */
export const CAMINHO_ANDAMENTO = 'horizon/andamento.json'
