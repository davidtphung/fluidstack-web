# fluidstack-web

Public Fluidstack Land Desk hub for Site Fit and Site Brief.

## Live URLs (after GitHub Pages is enabled)

- Hub: https://davidtphung.github.io/fluidstack-web/
- Site Fit: https://davidtphung.github.io/fluidstack-web/site-fit/
- Site Brief (stub): https://davidtphung.github.io/fluidstack-web/site-brief/

Prefer these github.io project URLs. Do not publish a CNAME for a custom Fluidstack host from this repo.

## Layout

- `index.html` hub links to `site-fit/` and `site-brief/`
- `site-fit/` Vite + React + MapLibre app (CORS-direct GIS fetches)
- `site-brief/` status stub until fluidstack-site-brief ships
- `.github/workflows/pages.yml` builds Site Fit into `docs/site-fit/` and deploys the static hub

## Site Fit base

Vite `base` is `/fluidstack-web/site-fit/` for GitHub project Pages.

## Hard rules

- Never invent wells, owners, or prices
- EPQS failure leaves elevation UNKNOWN
- WHP wildfire not wired
- Screening aid only

## Local

```bash
cd site-fit
npm install
npm run build
```

Build output for Pages assembly is `site-fit/dist` copied to `docs/site-fit/`.
