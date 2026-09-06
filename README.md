# Fluidstack Land Desk

Public Site Fit map for Fluidstack Land Desk. Not Sere / Shinkei.

Vite + React + MapLibre. The browser fetches public GIS hosts directly (CORS).

Hard rules: never invent wells/owners/prices; EPQS failure leaves elev UNKNOWN; WHP not wired.

`api/proxy.ts` is optional for Vercel only. The static app does not use it.

## Hosting

`davidtphung.github.io/*` 301s to a user-level Pages custom domain. This repo does **not** enable GitHub Pages and has **no** CNAME.

Public site: Vercel production (no SSO), root path `/`.
