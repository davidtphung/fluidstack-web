import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Dedicated Fluidstack Vercel host (not GitHub Pages / not Sere).
export default defineConfig({
  base: "/site-fit/",
  plugins: [react()],
})
