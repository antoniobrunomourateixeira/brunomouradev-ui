import { defineConfig } from 'vite';

/** Build só do motor de dados (sem DOM), reaproveitável pelo PivotGrid ou no servidor. */
export default defineConfig({
  build: {
    target: 'es2019',
    sourcemap: true,
    emptyOutDir: false,
    lib: {
      entry: 'src/engine/index.ts',
      formats: ['es'],
      fileName: () => 'engine.js',
    },
  },
});
