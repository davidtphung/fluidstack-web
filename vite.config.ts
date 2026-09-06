import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Dedicated Siteline CDN backup host.
// Internal: do not host under sere.davidtphung.com.
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
