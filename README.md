# fluidstack-web

Public Fluidstack Land Desk apps (Site Fit + Site Brief). **Not Sere / Shinkei.**

Do **not** enable GitHub Pages on this repo while `davidtphung.github.io/*` 301s to `sere.davidtphung.com/*`. There is no CNAME here. Do not add one.

## Public URLs (not Sere)

| Surface | URL | Status |
| --- | --- | --- |
| Site Fit map | https://raw.githack.com/davidtphung/fluidstack-web/claw/site-fit/index.html | Public, no login, not Sere. First visit may show a raw.githack interstitial. |
| Hub | https://fluidstack-web.vercel.app/ | Public, no login |
| Site Brief | https://fluidstack-site-brief.vercel.app/ | Public, no login |
| Vercel Site Fit | https://fluidstack-web.vercel.app/site-fit/ | HTML is public; JS bundle on this host is stale until Vercel quota resets |

## Blockers

- `https://davidtphung.github.io/fluidstack-web/` **301s** to `http://sere.davidtphung.com/fluidstack-web/` because of the user-level Pages custom domain. Do not publish Fluidstack there.
- Vercel production deploys and git builds are **rate-limited for 24 hours** on this hobby team. MCP cannot create a new no-SSO production project until that resets.
- Cloudflare `*.workers.dev` preview deploys a bot challenge. Claim that preview on a real Cloudflare account to get a durable `pages.dev` / workers hostname without the interstitial.

## Hard rules

- Never invent wells, owners, or prices
- EPQS failure leaves elevation UNKNOWN
- WHP wildfire not wired
- Screening aid only
