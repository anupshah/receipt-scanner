import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig({
  base: '/receipt-scanner/',

  build: {
    target: 'es2022',
  },

  // ── HTTPS for local dev via mkcert ──────────────────────────
  // First run: mkcert installs a local CA and generates a cert automatically.
  // Needed for: camera access (requires secure context), PWA install prompt,
  // and testing service workers locally.
  server: {
    https: true, // vite-plugin-mkcert handles cert generation
  },

  plugins: [
    // mkcert must come before VitePWA
    mkcert(),

    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /tesseract/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tesseract-cache',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      manifest: {
        name: 'Receipt Scanner',
        short_name: 'Receipts',
        description: 'Scan receipts, extract VAT and totals, export to CSV',
        theme_color: '#279b78',
        background_color: '#f5f0eb',
        display: 'standalone',
        orientation: 'portrait',
        scope: './',
        start_url: './',
        icons: [
          { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],

  // ── Vitest configuration ────────────────────────────────────
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    server: {
      https: true,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts'],
    },
    ui: {
      open: true,
    },
  },
})
