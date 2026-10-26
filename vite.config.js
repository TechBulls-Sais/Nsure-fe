import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.NSURE_API_URL || "http://127.0.0.1:8080",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
        // The proxy makes API calls same-origin; dropping Origin lets any local dev port reach the backend.
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.removeHeader("origin");
          });
        },
      },
    },
  },
  build: {
    rollupOptions: {
      // Motion's React-server boundary directive is irrelevant to this client-only SPA.
      onwarn(warning, warn) {
        if (
          warning.code === "MODULE_LEVEL_DIRECTIVE" &&
          warning.message.includes("use client")
        )
          return;
        warn(warning);
      },
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (
            /\/(motion|framer-motion|motion-dom|motion-utils|animejs)\//.test(
              id,
            )
          )
            return "animation";
          if (/\/(react|react-dom|scheduler)\//.test(id)) return "react-vendor";
        },
      },
    },
  },
});
