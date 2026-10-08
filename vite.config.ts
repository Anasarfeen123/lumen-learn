/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { lumoApi } from './server/lumo-api.mjs';

export default defineConfig(({ mode }) => {
  // Server-only secrets (GROQ_*) from .env go to the dev middleware, never to the bundle.
  const env = loadEnv(mode, process.cwd(), 'GROQ_');
  for (const [k, v] of Object.entries(env)) process.env[k] ??= v;

  return {
    // Set BASE_PATH=/repo-name/ when hosting under a subpath (GitHub Pages).
    base: process.env.BASE_PATH || '/',
    plugins: [
      react(),
      {
        name: 'lumo-api',
        configureServer(server) {
          server.middlewares.use(lumoApi);
        },
        configurePreviewServer(server) {
          server.middlewares.use(lumoApi);
        },
      },
    ],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'server/**/*.test.mjs'],
    },
  };
});
