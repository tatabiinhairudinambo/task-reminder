import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('chart.js') || id.includes('react-chartjs-2')) return 'vendor-chart'
          if (id.includes('date-fns')) return 'vendor-date'
          if (id.includes('@radix-ui')) return 'vendor-radix'
          // Silk (login background) pulls in three.js. Keep it in its own
          // chunk so the auth page's code is cached independently.
          if (id.includes('node_modules/three') || id.includes('@react-three')) return 'vendor-three'
        },
      },
    },
  },
})
