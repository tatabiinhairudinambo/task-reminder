import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep native/server-only packages out of the bundler's module graph.
  serverExternalPackages: [
    '@prisma/client',
    '@prisma/adapter-pg',
    'pg',
    'bcryptjs',
    'exceljs',
  ],

  // `react-router-dom` resolves to a thin shim over the Next App Router, so the
  // ~18 ported components keep their existing imports (Link, useNavigate,
  // NavLink, ...) without a mechanical rewrite. See src/lib/react-router-dom.jsx.
  turbopack: {
    resolveAlias: {
      'react-router-dom': './src/lib/react-router-dom.jsx',
    },
  },
  webpack: (config) => {
    // `next build --webpack` / older toolchains use this path instead.
    config.resolve.alias['react-router-dom'] = path.resolve(
      __dirname,
      'src/lib/react-router-dom.jsx'
    );
    return config;
  },
};

export default nextConfig;
