import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Static build of the Finder, intended to be served from inside the guest
 * Linux behind a path prefix (the host proxies /guest/*).
 *
 * `base: "./"` emits relative asset URLs so the bundle works regardless of the
 * prefix it is mounted under, and a single bundled chunk keeps the number of
 * requests the guest httpd has to serve to a minimum.
 */
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2020",
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
