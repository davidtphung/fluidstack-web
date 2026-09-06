# Fluidstack AI DC Site Fit

Vite + React + MapLibre site-fit map packaged under this hub.

Live (after Pages enabled): https://davidtphung.github.io/fluidstack-web/site-fit/

Vite base is `/fluidstack-web/site-fit/` for project Pages.

The browser fetches GIS hosts directly (CORS). `api/proxy.ts` is optional for Vercel only; Pages does not use it.

Hard rules: never invent wells/owners/prices; EPQS failure leaves elev UNKNOWN; WHP not wired.
