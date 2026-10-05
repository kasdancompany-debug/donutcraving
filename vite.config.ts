import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // We apply updates ourselves (see useKioskServiceWorker) at a safe moment
      // — the attract screen between guests — rather than yanking the page
      // out from under someone mid-session.
      registerType: 'prompt',
      injectRegister: false,
      manifest: false,
      devOptions: { enabled: false },
      workbox: {
        // Keep the precache manifest to the small app shell; the large,
        // rarely-changing camera-ML assets (wasm runtime, .task models,
        // fonts, donut art) are cached on first real use instead (below),
        // so a kiosk that never enables ?pose=1 never downloads that model.
        globPatterns: ['**/*.{js,css,html,ico,svg}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }: { url: URL }) =>
              url.pathname.startsWith('/models/') ||
              url.pathname.startsWith('/mediapipe/') ||
              url.pathname.startsWith('/fonts/') ||
              url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'kiosk-static-assets',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
