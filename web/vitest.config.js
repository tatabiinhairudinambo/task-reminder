import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Same shim the Next config applies: react-router-dom -> App Router.
      'react-router-dom': path.resolve(__dirname, './src/lib/react-router-dom.jsx'),
      // next/link and next/navigation are aliased to test doubles so the
      // ported client tests run under Vitest without a Next runtime.
      'next/link': path.resolve(__dirname, './src/test/next-link.jsx'),
      'next/navigation': path.resolve(__dirname, './src/test/next-navigation.js'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
});
