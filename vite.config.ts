/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from './server/env.mjs';
import { lumoApi } from './server/lumo-api.mjs';
import { extractApi } from './server/extract.mjs';
import { accountApi } from './server/account-api.mjs';
import { personalApi } from './server/personal-api.mjs';
import { logSetup } from './server/setup-log.mjs';

// The same .env loader as `npm start`. Server-only secrets (GROQ_*) stay in the
// dev server's process; nothing from .env is bundled into the browser code
// unless it starts with VITE_.
const env = loadEnv();

export default defineConfig({
  // Set BASE_PATH=/repo-name/ when hosting under a subpath (GitHub Pages).
  base: process.env.BASE_PATH || '/',
  plugins: [
    react(),
    {
      name: 'lumo-api',
      configureServer(server) {
        server.middlewares.use(lumoApi);
        server.middlewares.use(extractApi);
        server.middlewares.use(accountApi);
        server.middlewares.use(personalApi);
        server.httpServer?.once('listening', () => void logSetup(env, (m) => server.config.logger.info(m)));
      },
      configurePreviewServer(server) {
        server.middlewares.use(lumoApi);
        server.middlewares.use(extractApi);
        server.middlewares.use(accountApi);
      },
    },
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.mjs'],
  },
});
