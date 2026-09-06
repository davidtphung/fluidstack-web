import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// GitHub project Pages: https://davidtphung.github.io/fluidstack-web/site-fit/
export default defineConfig({
  base: "/fluidstack-web/site-fit/",
  plugins: [react()],
})
