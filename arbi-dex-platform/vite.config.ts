import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Прокси на arbiDexMarketData (GET/POST /store/keys) */
function marketDataProxy(target: string) {
  return {
    target,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/market-api/, ''),
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:3006'
  const storeApiProxyTarget = env.VITE_STORE_API_PROXY_TARGET || 'http://89.125.68.35:3002'

  const proxy = {
    // Market data — отдельный префикс, не пересекается с /api
    '/market-api': marketDataProxy(storeApiProxyTarget),
    // Legacy (../client)
    '/api-proxy': marketDataProxy(storeApiProxyTarget),
    // Auth и прочие API arbi-dex-server (в т.ч. /api/store после обновления сервера)
    '/api': {
      target: apiProxyTarget,
      changeOrigin: true,
    },
  }

  return {
    plugins: [react(), tailwindcss()],
    server: { proxy },
    preview: { proxy },
  }
})
