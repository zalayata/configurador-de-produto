// Ícones de traço (24×24, stroke currentColor) da página de controle de produção.
// Um único componente: <Icone nome="fabrica" />. Decorativos (aria-hidden): o texto ao lado dá o sentido.
import type { ReactNode } from 'react'

export type NomeDoIcone =
  | 'pedido'
  | 'projeto'
  | 'compras'
  | 'fabrica'
  | 'pintura'
  | 'montagem'
  | 'teste'
  | 'carreta'
  | 'texto'
  | 'imprimir'
  | 'link'
  | 'fechar'
  | 'cima'
  | 'abrir'
  | 'camera'

const TRACOS: Record<NomeDoIcone, ReactNode> = {
  pedido: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
      <path d="m9.5 15 2 2 3.5-4.5" />
    </>
  ),
  projeto: (
    <>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v3" />
      <path d="M10.8 10 5 21M13.2 10 19 21" />
      <path d="M7.4 16.6a8 8 0 0 0 9.2 0" />
    </>
  ),
  compras: (
    <>
      <path d="M3.5 8 12 3.5 20.5 8 12 12.5z" />
      <path d="M3.5 8v8.5L12 21l8.5-4.5V8" />
      <path d="M12 12.5V21" />
    </>
  ),
  fabrica: (
    <>
      <path d="M3 21V9l5 3V9l5 3V9l5 3v9" />
      <path d="M3 21h18" />
      <path d="M7 21v-4h3v4M14 21v-4h3v4" />
    </>
  ),
  pintura: (
    <>
      <rect x="3.5" y="4" width="13" height="6" rx="1.5" />
      <path d="M16.5 7H20v5h-8v3" />
      <rect x="10.5" y="15" width="3" height="5.5" rx="1" />
    </>
  ),
  montagem: (
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  ),
  teste: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  carreta: (
    <>
      <rect x="1.5" y="4" width="14" height="12" rx="1" />
      <path d="M15.5 9h4l3 3v4h-7z" />
      <circle cx="6" cy="18.5" r="2.2" />
      <circle cx="18" cy="18.5" r="2.2" />
    </>
  ),
  texto: (
    <>
      <path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z" />
      <path d="M14 2.5V8h5.5" />
      <path d="M8.5 13h7M8.5 17h7" />
    </>
  ),
  imprimir: (
    <>
      <path d="M6 9V2.5h12V9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="7.5" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  fechar: <path d="M18 6 6 18M6 6l12 12" />,
  cima: <path d="m18 15-6-6-6 6" />,
  abrir: (
    <>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </>
  ),
  camera: (
    <>
      <path d="M22.5 19a2 2 0 0 1-2 2h-17a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.5l2-3h6l2 3h3.5a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="3.8" />
    </>
  ),
}

export const ehNomeDoIcone = (v: unknown): v is NomeDoIcone => typeof v === 'string' && v in TRACOS

export interface IconeProps {
  /** Nome do ícone (um id de capítulo desconhecido cai no ícone "texto"). */
  nome: string
  className?: string
}

export function Icone({ nome, className }: IconeProps) {
  const tracos = ehNomeDoIcone(nome) ? TRACOS[nome] : TRACOS.texto
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {tracos}
    </svg>
  )
}
