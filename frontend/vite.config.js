import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // ------------------------------------------------------------------
    // PWA support (Progressive Web App) — makes the site:
    //   1) Installable (Add to Home Screen) on mobile and desktop
    //   2) Partially usable offline: the UI itself (HTML/CSS/JS) is cached
    //      locally (Service Worker), and the last data shown (map,
    //      statistics, neighborhood list...) is also cached so it still
    //      shows up even if the connection drops — of course, submitting a
    //      new report or logging in still needs an actual internet
    //      connection; this is just for browsing data that was already
    //      saved before the disconnect.
    // ------------------------------------------------------------------
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      // We enable the Service Worker even in dev mode (npm run dev), not
      // just in the final build (npm run build) — so you can try the
      // offline feature directly while developing, without needing to run
      // a manual build
      devOptions: {
        enabled: true,
        type: 'module',
      },
      manifest: {
        name: 'Neighborhood Footprint',
        short_name: 'Neighborhood Footprint',
        description: 'Community-driven environmental pollution monitoring — a graduation project app',
        lang: 'en',
        dir: 'ltr',
        theme_color: '#1f5c3a',
        background_color: '#f4f7f5',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache all core UI files automatically at build time
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: [
          // 1) OpenStreetMap map tiles — cached so the parts of the map the
          // user has already browsed still show up even without internet
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles-cache',
              expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 2) Pollution report images uploaded to Supabase Storage
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'report-images-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 14 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 3) Backend data (map, statistics, neighborhoods...) — we always
          // try the network first (so the data stays fresh), and if there's
          // no internet we use the last saved version instead of showing a
          // blank page
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && /\/api\/(reports|neighborhoods)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-data-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 60, maxAgeSeconds: 3 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
