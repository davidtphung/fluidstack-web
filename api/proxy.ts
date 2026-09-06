import type { VercelRequest, VercelResponse } from "@vercel/node"

const ALLOWED_HOSTS = new Set([
  "epqs.nationalmap.gov",
  "arcgis.netl.doe.gov",
  "services5.arcgis.com",
  "data.dnrgis.state.co.us",
  "services1.arcgis.com",
  "services7.arcgis.com",
  "services.arcgis.com",
  "services2.arcgis.com",
  "hazards.fema.gov",
  "broadbandmap.fcc.gov",
  "geo.fcc.gov",
  "a.tile.opentopomap.org",
  "b.tile.opentopomap.org",
  "c.tile.opentopomap.org",
])

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res)
  if (req.method === "OPTIONS") return res.status(204).end()

  try {
    const target = typeof req.query.url === "string" ? req.query.url : ""
    if (!target) return res.status(400).json({ error: "Missing url query param" })

    let parsed: URL
    try {
      parsed = new URL(target)
    } catch {
      return res.status(400).json({ error: "Invalid url" })
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return res.status(400).json({ error: "Only http(s) allowed" })
    }
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      return res.status(403).json({ error: "Host not allowlisted", host: parsed.hostname })
    }

    const method = req.method === "POST" ? "POST" : "GET"
    const headers: Record<string, string> = { Accept: "application/json,*/*" }
    let body: string | undefined
    if (method === "POST") {
      headers["Content-Type"] = "application/x-www-form-urlencoded"
      if (typeof req.body === "string") body = req.body
      else if (req.body && typeof req.body === "object") {
        body = new URLSearchParams(req.body as Record<string, string>).toString()
      }
    }

    const upstream = await fetch(parsed.toString(), { method, headers, body })
    const text = await upstream.text()
    const ct = upstream.headers.get("content-type") || "application/json"
    res.setHeader("Content-Type", ct)
    return res.status(upstream.status).send(text)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Proxy failure"
    return res.status(502).json({ error: message })
  }
}
