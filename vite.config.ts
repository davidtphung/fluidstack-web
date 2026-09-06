import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// CDN backup build. React + MapLibre load from import maps.
// Internal: do not host under sere.davidtphung.com.
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
