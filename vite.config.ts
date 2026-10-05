import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true,
    proxy: { '/api': { target: loadEnv(mode, '.', '').NINEFOLD_API_TARGET || 'http://127.0.0.1:8080', changeOrigin: true } } },
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'] },
}))
