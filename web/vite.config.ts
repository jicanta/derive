import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * The dev server is the one place the browser is not same-origin with Derive,
 * so the install token is added to the proxied request here rather than
 * injected into the page. Read on the first proxied request, not when this
 * config is evaluated: `pnpm dev` starts the server and Vite together, and on
 * a fresh clone the token does not exist yet at that moment. Only a successful
 * read is cached, so the first request after the server boots works without a
 * Vite restart.
 */
const TOKEN_PATH = join(resolve(process.env.DERIVE_DATA_DIR ?? join(homedir(), '.derive')), 'token');
let token = '';
let warned = false;
function deriveToken(): string {
  if (token) return token;
  try {
    token = readFileSync(TOKEN_PATH, 'utf8').trim();
  } catch {
    token = '';
  }
  if (!token && !warned) {
    warned = true;
    console.warn(`[derive] no token at ${TOKEN_PATH}; start the derive server once so it can make one, then reload this page.`);
  }
  return token;
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4310',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            const t = deriveToken();
            if (t) proxyReq.setHeader('x-derive-token', t);
          });
        },
      },
    },
  },
  build: { chunkSizeWarningLimit: 2000 },
});
