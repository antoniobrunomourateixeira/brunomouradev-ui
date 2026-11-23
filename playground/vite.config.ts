import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Aponta para o código-fonte dos pacotes: edições na lib aparecem na hora (HMR), sem build.
export default defineConfig({
  resolve: {
    alias: {
      '@brunomouradev/data-grid/engine': src('../packages/data-grid/src/engine/index.ts'),
      '@brunomouradev/data-grid': src('../packages/data-grid/src/index.ts'),
      '@brunomouradev/pivot-grid': src('../packages/pivot-grid/src/index.ts'),
      '@brunomouradev/tree-list': src('../packages/tree-list/src/index.ts'),
    },
  },
  build: {
    rollupOptions: {
      input: { main: src('index.html'), pivot: src('pivot.html'), tree: src('tree.html') },
    },
  },
  server: { port: 5173 },
});
