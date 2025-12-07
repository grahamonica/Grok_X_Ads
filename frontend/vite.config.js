import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/app/',
  build: {
    outDir: '../static/app',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/generate-demographics': 'http://localhost:8000',
      '/generate-ad-image': 'http://localhost:8000',
      '/analyze-brand-style': 'http://localhost:8000',
      '/proxy-image': 'http://localhost:8000',
    }
  }
})
