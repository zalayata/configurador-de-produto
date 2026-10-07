/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const raiz = (caminho: string) => fileURLToPath(new URL(caminho, import.meta.url))

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
    rollupOptions: {
      // Duas páginas no mesmo dist/: o configurador (index.html) e o controle de produção
      // do Dosador Horizon (horizon.html). Ambas leem public/ ao lado.
      input: {
        index: raiz('./index.html'),
        horizon: raiz('./horizon.html'),
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
