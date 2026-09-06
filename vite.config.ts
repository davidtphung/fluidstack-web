import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// CDN backup build. React + MapLibre load from import maps. Never publish under sere.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      external: [
        "react",
        "react/jsx-runtime",
        "react-dom",
        "react-dom/client",
        "maplibre-gl",
      ],
    },
  },
})