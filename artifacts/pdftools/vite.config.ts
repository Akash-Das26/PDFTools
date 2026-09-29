import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT ?? '5173';

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? '/';
const apiPort = process.env.API_PORT ?? '8080';

export default defineConfig(async ({ mode }) => ({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    ...(mode === 'development' ? [runtimeErrorOverlay()] : []),
    ...(mode !== 'production' && process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    // `@` is the only path alias. A previous `@assets` alias pointed at the
    // repo-root attached_assets/ folder; the only file it ever served was an
    // unused logo import, removed with the frontend rebuild.
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Manual chunking retires the 500 kB-chunk warning by splitting the
        // former single 610 kB bundle into cacheable vendor buckets. Bucketing
        // by library family (not per-package) keeps request count low while
        // letting browsers cache the rarely-changing vendors separately from
        // app code. Buckets: react runtime; the Radix primitive set (28
        // packages, but only imported components ship) plus its two runtime
        // satellites (aria-hidden, react-remove-scroll) and the two packages
        // built on Radix Dialog (cmdk, vaul) — co-locating those avoids a
        // vendor↔radix circular-chunk warning; the icon pack; react-query;
        // everything else node_modules → vendor.
        // framer-motion and recharts are installed but imported by nothing
        // (only the unreferenced components/ui/chart.tsx mentions recharts),
        // so Rollup tree-shakes them out and no chunk is emitted for them.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
          if (
            id.includes('@radix-ui') ||
            /[\\/]node_modules[\\/](aria-hidden|react-remove-scroll|cmdk|vaul)[\\/]/.test(id)
          ) {
            return 'radix';
          }
          if (id.includes('lucide-react') || id.includes('react-icons')) return 'icons';
          if (id.includes('@tanstack')) return 'query';
          return 'vendor';
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.API_URL ?? `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
}));
