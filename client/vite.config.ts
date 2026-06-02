import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During development the client runs on :5173 and proxies /api to the
// Express server on :8787 so the OpenAI key never reaches the browser.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // expose on the LAN so you can open it on your phone
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});
