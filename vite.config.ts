import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Siteline host. Never publish under sere.
// site-fit/ is the githack CDN build (relative assets).
export default defineConfig({
  base: "./",
  plugins: [react()],
})
