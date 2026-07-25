import { useRef } from 'react'
import { branding } from '../config/branding'
import { useImportModel } from '../hooks/useImportModel'

export function TopBar() {
  const importModel = useImportModel()
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" rx="7" fill="currentColor" opacity="0.14" />
          <path
            d="M9 8h4v16H9zM16 8h4.5c4 0 7 3 7 8s-3 8-7 8H16v-4h4.2c1.9 0 3.2-1.6 3.2-4s-1.3-4-3.2-4H16z"
            fill="currentColor"
          />
        </svg>
        <span className="brand-name">{branding.companyName}</span>
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
