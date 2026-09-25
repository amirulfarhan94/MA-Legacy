import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// base: './' keeps asset paths relative so the build works on any static host
// (GitHub Pages, Netlify, a shared-hosting folder) without extra config.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // The app asks before reloading so a half-filled form is never lost.
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'logo.png', 'logo-mark.png'],
      manifest: {
        name: 'MA Legacy Solutions',
        short_name: 'MA Legacy',
        description: 'Quotations, invoices, receipts and service reports for MA Legacy Solutions',
        id: './',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f7f6f3',
        theme_color: '#16140f',
        categories: ['business', 'finance', 'productivity'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'New quotation', url: './#/d/quotations/new', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'New invoice', url: './#/d/invoices/new', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'New receipt', url: './#/d/receipts/new', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
})
