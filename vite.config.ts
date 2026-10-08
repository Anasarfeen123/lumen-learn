/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { lumoApi } from './server/lumo-api.mjs';

export default defineConfig({
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
});
