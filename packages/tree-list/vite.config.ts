import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

/**
 * - target ES2019: compatível com webpack 4 (Angular <= 11).
 * - Lit e o motor do data-grid vão embutidos no bundle.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@brunomouradev/data-grid/engine': fileURLToPath(new URL('../data-grid/src/engine/index.ts', import.meta.url)),
    },
  },
  build: {
    target: 'es2019',
    sourcemap: true,
    emptyOutDir: true,
    lib: {
      entry: 'src/index.ts',
      name: 'BmTreeList',
      formats: ['es', 'umd'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.umd.cjs'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
} as any);
