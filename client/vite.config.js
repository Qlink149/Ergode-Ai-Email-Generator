import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Standard Vite + React setup. The dev server proxies /api calls to the
// Express server (server/server.js) so the browser can call "/api/reports"
// without worrying about ports or CORS during development.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
