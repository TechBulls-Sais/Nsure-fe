import { defineConfig } from "vite";

export default defineConfig({
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
