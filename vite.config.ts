import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Aligns with power.config.json: localAppUrl http://localhost:3000,
// buildPath ./dist, buildEntryPoint index.html
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { port: 3000, strictPort: true },
  build: { outDir: "dist" },
});
