// Avisos da página: toast (role=status) e a foto ampliada (diálogo modal com véu, legenda e botão fechar).
// O App fecha a foto no Esc (abrirFoto(null)); aqui o foco vai para o botão ao abrir e volta ao sair.
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { NOMES_CURTOS } from '../capitulos'
import { formatarData } from '../cronograma'
import { useHorizon } from '../estado'
import { Icone } from './Icones'

export function Aviso() {
  const toast = useHorizon((s) => s.toast)
  const dismissToast = useHorizon((s) => s.dismissToast)
  // a região viva existe sempre: o leitor de tela anuncia o texto quando ele entra
  return (
    <div className="hz-toast-regiao" role="status" aria-live="polite">
      {toast ? (
        <button type="button" className="toast hz-toast" onClick={dismissToast} title="Fechar aviso">
          {toast}
        </button>
      ) : null}
    </div>
  )
}

export function FotoAmpliada() {
  const foto = useHorizon((s) => s.fotoAberta)
  const abrirFoto = useHorizon((s) => s.abrirFoto)
  const botao = useRef<HTMLButtonElement>(null)
  const origem = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!foto) return
    origem.current = document.activeElement as HTMLElement | null
    botao.current?.focus()
    return () => {
      origem.current?.focus?.()
    }
  }, [foto])

  if (!foto) return null

  const data = formatarData(foto.data)
  const etapa = NOMES_CURTOS[foto.etapa]
  const legenda = foto.legenda ?? etapa
  const texto = data ? `${data} · ${legenda}` : legenda
  const fechar = () => abrirFoto(null)
  const prenderFoco = (ev: KeyboardEvent<HTMLDivElement>) => {
    // único elemento focável do diálogo: o Tab fica nele
    if (ev.key === 'Tab') {
      ev.preventDefault()
      botao.current?.focus()
    }
  }

  return (
    <div className="hz-foto-veu" onClick={fechar} role="presentation">
      <div
        className="hz-foto-dialogo"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hz-foto-legenda"
        onClick={(ev) => ev.stopPropagation()}
        onKeyDown={prenderFoco}
      >
        <img
          className="hz-foto-imagem"
          src={`${import.meta.env.BASE_URL}${foto.arquivo}`}
          alt={foto.legenda ? `${foto.legenda} — ${etapa}` : `Foto da etapa ${etapa}`}
        />
        <p id="hz-foto-legenda" className="hz-foto-legenda">
          {texto}
        </p>
        <button ref={botao} type="button" className="hz-foto-fechar" onClick={fechar} aria-label="Fechar foto">
          <Icone nome="fechar" />
        </button>
      </div>
    </div>
  )
}
