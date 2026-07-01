import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  // Polyfill Node.js globals used by ethers v5 in the browser bundle
  define: {
    global: "globalThis",
    "process.env": "{}",
  },

  optimizeDeps: {
    esbuildOptions: {
      // ethers v5 relies on Node.js globals at build time
      define: {
        global: "globalThis",
      },
    },
  },

  server: {
    port: 3000,

    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        // Blockchain mint transactions can take 60-90 s on Sepolia.
        // Default Vite proxy timeout (~30 s) is too short and returns 502.
        timeout: 120_000,
        proxyTimeout: 120_000,
      },
      "/uploads": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
