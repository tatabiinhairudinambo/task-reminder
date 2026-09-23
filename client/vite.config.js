import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')

  return {
    plugins: [
      tailwindcss(),
      react(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // Dev fallback so a clone without .env (gitignored) still works: the SPA
    // calls "/api" and Vite proxies it to the Laravel server on :8000.
    server: {
      proxy: {
        '/api': {
          target: env.VITE_BASE_URL || 'http://localhost:8000',
          changeOrigin: true,
        },
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
            // The WebGL login backdrop pulls in three.js. Keep it in its own
            // chunk: it is only reachable from the lazily-loaded Login route, so
            // the rest of the app never downloads it.
            if (id.includes('node_modules/three') || id.includes('@react-three')) return 'vendor-three'
          },
        },
      },
    },
  }
})
