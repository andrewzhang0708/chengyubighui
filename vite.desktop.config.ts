import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('./desktop', import.meta.url)),
  base: './',
  publicDir: false,
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { outDir: 'renderer', emptyOutDir: true },
});
