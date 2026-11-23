import { defineConfig } from 'vite';

/**
 * Build do componente.
 * - target ES2019: o webpack 4 (Angular <= 11) não entende `??`, `?.` nem class fields.
 * - Lit vai embutido no bundle para o consumidor não precisar instalar nada.
 */
export default defineConfig({
  build: {
    target: 'es2019',
    sourcemap: true,
    emptyOutDir: true,
    lib: {
      entry: 'src/index.ts',
      name: 'BmDataGrid',
      formats: ['es', 'umd'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.umd.cjs'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
} as any);
