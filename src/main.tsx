import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/saira-semi-condensed/600.css'
import '@fontsource/saira-semi-condensed/700.css'
import '@fontsource/saira/400.css'
import '@fontsource/archivo/400.css'
import '@fontsource/archivo/500.css'
import '@fontsource/archivo/600.css'
import './styles/global.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
