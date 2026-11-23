/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// `npm run build:preview` makes a single self-contained page for the shareable preview link:
// relative paths, no service worker, one JavaScript bundle and the in-memory router.
const previewLink = process.env.VITE_ROUTER === 'memory';

export default defineConfig({
  base: previewLink ? './' : '/',
  resolve: previewLink ? { alias: { 'virtual:pwa-register': '/src/lib/pwa-stub.ts' } } : {},
  build: previewLink ? { outDir: 'dist-preview', rollupOptions: { output: { inlineDynamicImports: true } } } : {},
  plugins: [
    react(),
    !previewLink &&
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'letterhead.jpg'],
      manifest: {
        name: 'Patience Suppliers POS',
        short_name: 'Patience POS',
        description: 'Sales, quotations, invoices and stock for Patience Suppliers (Z) Ltd',
        theme_color: '#009541',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,webmanifest}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
  },
});
