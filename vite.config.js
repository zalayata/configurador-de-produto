import { defineConfig } from 'vite'

// Base relativa: funciona no GitHub Pages (/configurador-de-produto/), em domínio próprio e dentro de iframe.
export default defineConfig({
  base: './',
  optimizeDeps: {
    exclude: ['occt-import-js'],
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1800,
  },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 5174, strictPort: true },
})
