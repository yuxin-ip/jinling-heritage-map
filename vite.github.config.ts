import path from 'node:path';
import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? '';

export default defineConfig({
  base:
    process.env.GITHUB_ACTIONS && repositoryName ? `/${repositoryName}/` : '/',
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  publicDir: 'public',
  build: { outDir: 'gh-pages-dist', emptyOutDir: true },
});
