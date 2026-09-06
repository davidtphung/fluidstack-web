import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Dedicated Fluidstack host. Never publish under sere.
// site-fit/ is served from rawcdn / relative paths, so keep base relative.
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
