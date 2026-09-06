import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Dedicated Fluidstack host (Vercel). Not GitHub Pages / not Sere.
export default defineConfig({
  base: "/",
  plugins: [react()],
})
