import { defineConfig } from 'vite';

// Served from https://stevengann.github.io/pointer-defense/
export default defineConfig({
  base: '/pointer-defense/',
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
});
