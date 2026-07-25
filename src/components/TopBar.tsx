import { useRef } from 'react'
import { branding } from '../config/branding'
import { useImportModel } from '../hooks/useImportModel'

export function TopBar() {
  const importModel = useImportModel()
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <img
          className="brand-mark"
          src={`${import.meta.env.BASE_URL}logo-idugel.svg`}
          alt="Grupo Idugel"
        />
        <span className="brand-name">
          <em>Grupo</em>
          Idugel
        </span>
        <span className="brand-divider" />
        <span className="brand-app">Configurador de produto</span>
      </div>
      <div className="topbar-actions">
        <a className="btn btn-ghost" href={branding.siteUrl} target="_blank" rel="noreferrer">
          idugel.com.br
        </a>
        <button type="button" className="btn btn-outline" onClick={() => fileRef.current?.click()}>
          <UploadIcon />
          Importar modelo
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".glb,.gltf,.step,.stp,.iges,.igs,.brep,.brp,.stl,.obj"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void importModel(file)
            e.target.value = ''
          }}
        />
      </div>
    </header>
  )
}

function UploadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
