import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // Remote access via `tailscale serve` (https://<pc>.<tailnet>.ts.net);
    // Vite rejects requests whose Host header isn't listed here.
    allowedHosts: ['.ts.net'],
    proxy: {
      '/v1': {
        target: 'http://localhost:8100',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
