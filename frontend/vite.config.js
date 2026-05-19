import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/chat':    { target: 'http://localhost:8000', changeOrigin: true },
      '/sim':     { target: 'http://localhost:8000', changeOrigin: true },
      '/metrics': { target: 'http://localhost:8000', changeOrigin: true },
      '/health':  { target: 'http://localhost:8000', changeOrigin: true },
      '/ws':      { target: 'ws://localhost:8000',   ws: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'motion':       ['framer-motion'],
          'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
          'charts':       ['chart.js', 'react-chartjs-2', 'recharts'],
          'gsap':         ['gsap', '@gsap/react'],
          'query':        ['@tanstack/react-query', 'zustand'],
        },
      },
    },
  },
})
