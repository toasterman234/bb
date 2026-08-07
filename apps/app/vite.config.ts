import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type UserConfig } from "vite";
import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { sharedUiEnvSeam } from "./vite-shared-ui-seam.js";

const appDir = dirname(fileURLToPath(import.meta.url));

export const sharedViteConfig = {
  plugins: [
    sharedUiEnvSeam(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  // Keep app and Ladle dep optimization metadata from clobbering each other.
  cacheDir: "node_modules/.vite/app",
  build: {
    // Skip compressed-size calculation to keep production app builds fast.
    reportCompressedSize: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      // Build the full desktop application and the trimmed mobile shell from
      // the same source tree. /mobile/index.html is a genuine second Vite
      // entry, not a static reimplementation of bb's HTTP API.
      input: [resolve(appDir, "index.html"), resolve(appDir, "mobile/index.html")],
      output: {
        manualChunks(id) {
          // This tiny 85-line pure function has no deps beyond a domain type,
          // but Vite groups it into a massive 1.7MB aggregation chunk. Force
          // it into its own chunk so sidebar clicks don't pull in 18 co-bundled
          // modules just to format a "Branch: main" label.
          if (id.includes("/lib/workspace-checkout-display")) {
            return "checkout-display";
          }
        },
      },
    },
  },
  optimizeDeps: {
    // The terminal imports xterm lazily when the panel mounts. Pre-optimize
    // these packages so opening the terminal does not discover new deps and
    // invalidate Vite's optimized-dependency hash mid-session.
    include: ["@xterm/addon-fit", "@xterm/addon-web-links", "@xterm/xterm"],
  },
  resolve: {
    conditions: ["source"],
    alias: {
      "@": resolve(appDir, "./src"),
    },
  },
} satisfies UserConfig;

export default defineConfig(sharedViteConfig);
