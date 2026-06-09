import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Deployment-aware base path. The Pages workflow injects `BASE_PATH`
// from `actions/configure-pages` so the build adapts to wherever Pages
// serves it:
//   • project site  → "/tyrotrade" → normalised to "/tyrotrade/"
//   • custom domain  → "/"          (tyrofreight.ttech.business at root)
// Local dev / no env → default to the project path.
const rawBase = process.env.BASE_PATH ?? "/tyrotrade/";
const base =
  rawBase === "/" || rawBase === ""
    ? "/"
    : rawBase.endsWith("/")
      ? rawBase
      : `${rawBase}/`;

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
});
