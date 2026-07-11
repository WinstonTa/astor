import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Pinned (not Vite's default 5173): backend/.env's FRONTEND_URL — the only
  // origin the backend's CORS allows — is http://localhost:5183. strictPort
  // fails loudly instead of silently falling back to a different port, which
  // would just reproduce the same "which port is it actually on" mismatch.
  server: {
    port: 5183,
    strictPort: true,
  },
  // Pre-bundle the markdown stack so a running dev server picks it up cleanly.
  optimizeDeps: {
    include: ["react-markdown", "remark-gfm"],
  },
});
