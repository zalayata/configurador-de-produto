import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Base relativa: funciona no GitHub Pages (/configurador-de-produto/),
  // em domínio próprio e dentro de iframe no site da Idugel.
  base: './',
  optimizeDeps: {
    exclude: ['occt-import-js'],
  },
  build: {
    chunkSizeWarningLimit: 1800,
  },
})
