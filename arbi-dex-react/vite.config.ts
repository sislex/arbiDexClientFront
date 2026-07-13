import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Inject backend config from shell env deterministically (Vite does not always
  // forward shell VITE_* vars into import.meta.env). Empty string → mock mode.
  define: {
    __ARBI_API_BASE_URL__: JSON.stringify(process.env.VITE_API_BASE_URL ?? ''),
    __ARBI_DEV_WALLET_KEY__: JSON.stringify(process.env.VITE_DEV_WALLET_KEY ?? ''),
  },
  server: { port: 5273 },
});
