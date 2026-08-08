import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"

// https://vite.dev/config/
export default defineConfig(() => ({
  // Custom domain (tyrotrade.ttech.business) serves from the root just like dev.
  // The CNAME file in public/ tells GitHub Pages to bind the deployment to
  // the custom domain, so the old "/tyro/" subpath base is no longer needed.
  base: "/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "pwa-icon.svg", "pwa-icon-maskable.svg", "apple-touch-icon.png"],
      manifest: {
        name: "tyroTrade - Ticaret Operasyonları Platformu",
        short_name: "tyroTrade",
        description:
          "tyroTrade - Tiryaki Agro / TTECH'in ticaret operasyonları platformu.",
        theme_color: "#0077b6",
        background_color: "#0a1628",
        display: "standalone",
        orientation: "portrait",
        lang: "tr",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "pwa-icon.svg",
            sizes: "192x192 512x512 any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "pwa-icon-maskable.svg",
            sizes: "192x192 512x512 any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Answer notifications go through the service worker so they can
        // carry action buttons (Yanıtla / Kapat) — the page-level
        // Notification constructor cannot do that. A SW notification has no
        // default click behaviour, so notify-sw.js adds the click handler.
        // importScripts keeps the generateSW strategy and this whole precache
        // config untouched; no switch to injectManifest needed.
        importScripts: ["/notify-sw.js"],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,mp3}"],
        navigateFallback: "/index.html",
        // Prefer fresh HTML so the popup callback always loads the latest inline
        // short-circuit script. Falls back to cache when offline.
        navigateFallbackDenylist: [/\?.*code=/, /#.*code=/],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "tyrotrade-html",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 8 },
            },
          },
        ],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MiB — current main bundle ~6.6 MiB
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}))
