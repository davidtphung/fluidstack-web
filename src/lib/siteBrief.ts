import { bboxAround, haversineMiles, type LonLat } from "./geo"
import { proxyGet, proxyPostJson } from "./proxy"
import { ALWAYS_UNKNOWN, DEFAULT_RADIUS_MI, ENDPOINTS } from "./sources"

export type SiteBrief = {
  lon: number
  lat: number
  radiusMi: number
  elevationFt: number | null
  slopeNote: string
  wells: {
    orphaned: number | null
    nmOcd: number | null
    coOgcc: number | null
  }
  power: {
    nearestSubMi: number | null
    nearestSubName: string | null
    nearestLineMi: number | null
    nearestLineKv: number | null
  }
  flood: { flag: "YES" | "NO" | "UNKNOWN"; zones: string[] }
  fiberNote: string
  unknowns: string[]
  errors: string[]
}

type ArcGisFeature = {
  attributes?: Record<string, unknown>
  geometry?: {
    x?: number
    y?: number
    paths?: number[][][]
  }
}

type ArcGisResponse = {
  features?: ArcGisFeature[]
  count?: number
  error?: { message?: string }
}

function envelopeParams(b: ReturnType<typeof bboxAround>) {
  return JSON.stringify({
    xmin: b.xmin,
    ymin: b.ymin,
    xmax: b.xmax,
    ymax: b.ymax,
    spatialReference: { wkid: 4326 },
  })
}

async function countWells(url: string, lon: number, lat: number, radiusMi: number) {
  const geometry = envelopeParams(bboxAround(lon, lat, radiusMi))
  const data = await proxyPostJson<ArcGisResponse>(url, {
    where: "1=1",
    geometry,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    returnCountOnly: "true",
    outSR: "4326",
    f: "json",
  })
  if (data.error) throw new Error(data.error.message || "ArcGIS error")
  return typeof data.count === "number" ? data.count : (data.features?.length ?? 0)
}

async function fetchElevation(lon: number, lat: number): Promise<number | null> {
  const url = `${ENDPOINTS.epqs}?x=${lon}&y=${lat}&units=Feet&wkid=4326`
  const res = await proxyGet(url)
  if (!res.ok) throw new Error(`EPQS ${res.status}`)
  const data = (await res.json()) as { value?: number | string }
  const v = typeof data.value === "string" ? parseFloat(data.value) : data.value
  return typeof v === "number" && !Number.isNaN(v) ? v : null
}

async function slopeNote(lon: number, lat: number, centerElev: number | null): Promise<string> {
  if (centerElev == null) return "Slope UNKNOWN (no center elevation)"
  const offset = 0.01
  try {
    const samples = await Promise.all([
      fetchElevation(lon + offset, lat),
      fetchElevation(lon - offset, lat),
      fetchElevation(lon, lat + offset),
      fetchElevation(lon, lat - offset),
    ])
    const vals = samples.filter((v): v is number => v != null)
    if (vals.length < 2) return "Slope UNKNOWN (sparse EPQS samples)"
    const spread = Math.max(...vals, centerElev) - Math.min(...vals, centerElev)
    const approxPct = (spread / (offset * 69 * 5280)) * 100
    if (approxPct < 1) return `Low relief (~${approxPct.toFixed(1)}% rough grade from EPQS neighbors)`
    if (approxPct < 5) return `Moderate relief (~${approxPct.toFixed(1)}% rough grade from EPQS neighbors)`
    return `Steeper relief (~${approxPct.toFixed(1)}% rough grade from EPQS neighbors)`
  } catch {
    return "Slope UNKNOWN (EPQS neighbor sample failed)"
  }
}

function pointFromFeature(f: ArcGisFeature): LonLat | null {
  const g = f.geometry
  if (!g) return null
  if (typeof g.x === "number" && typeof g.y === "number") return { lon: g.x, lat: g.y }
  const attrs = f.attributes || {}
  const lon = attrs.LONGITUDE ?? attrs.longitude ?? attrs.LON ?? attrs.X
  const lat = attrs.LATITUDE ?? attrs.latitude ?? attrs.LAT ?? attrs.Y
  if (typeof lon === "number" && typeof lat === "number") return { lon, lat }
  return null
}

async function nearestSubstation(lon: number, lat: number, radiusMi: number) {
  const geometry = envelopeParams(bboxAround(lon, lat, Math.max(radiusMi, 10)))
  const data = await proxyPostJson<ArcGisResponse>(ENDPOINTS.hifldSubs, {
    where: "1=1",
    geometry,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "NAME,MAX_VOLT",
    returnGeometry: "true",
    outSR: "4326",
    resultRecordCount: "200",
    f: "json",
  })
  if (data.error) throw new Error(data.error.message || "Substation query failed")
  let best: { mi: number; name: string | null } | null = null
  for (const f of data.features || []) {
    const p = pointFromFeature(f)
    if (!p) continue
    const mi = haversineMiles({ lon, lat }, p)
    if (!best || mi < best.mi) {
      const name = typeof f.attributes?.NAME === "string" ? f.attributes.NAME : null
      best = { mi, name }
    }
  }
  return best
}

async function nearestTransmission(lon: number, lat: number, radiusMi: number) {
  const geometry = envelopeParams(bboxAround(lon, lat, Math.max(radiusMi, 10)))
  const data = await proxyPostJson<ArcGisResponse>(ENDPOINTS.hifldTx, {
    where: "1=1",
    geometry,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "VOLTAGE,VOLT_CLASS",
    returnGeometry: "true",
    outSR: "4326",
    resultRecordCount: "100",
    f: "json",
  })
  if (data.error) throw new Error(data.error.message || "Transmission query failed")
  let best: { mi: number; kv: number | null } | null = null
  const origin = { lon, lat }
  for (const f of data.features || []) {
    const paths = f.geometry?.paths
    if (!paths) continue
    for (const path of paths) {
      for (const pt of path) {
        if (pt.length < 2) continue
        const mi = haversineMiles(origin, { lon: pt[0], lat: pt[1] })
        if (!best || mi < best.mi) {
          const kv = typeof f.attributes?.VOLTAGE === "number" ? f.attributes.VOLTAGE : null
          best = { mi, kv }
        }
      }
    }
  }
  return best
}

async function floodFlag(lon: number, lat: number) {
  const geometry = JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: 4326 } })
  const data = await proxyPostJson<ArcGisResponse>(ENDPOINTS.femaFlood, {
    where: "1=1",
    geometry,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF",
    returnGeometry: "false",
    outSR: "4326",
    f: "json",
  })
  if (data.error) throw new Error(data.error.message || "FEMA query failed")
  const feats = data.features || []
  if (!feats.length) return { flag: "NO" as const, zones: [] as string[] }
  const zones = feats.map((f) => {
    const z = f.attributes?.FLD_ZONE
    const sub = f.attributes?.ZONE_SUBTY
    return [z, sub].filter(Boolean).join(" / ") || "zone present"
  })
  const sfha = feats.some((f) => String(f.attributes?.SFHA_TF || "").toUpperCase() === "T")
  const high = feats.some((f) => {
    const z = String(f.attributes?.FLD_ZONE || "").toUpperCase()
    return z.startsWith("A") || z.startsWith("V")
  })
  return { flag: sfha || high ? ("YES" as const) : ("YES" as const), zones }
}

async function fiberNote(lat: number, lon: number): Promise<string> {
  try {
    const url = `${ENDPOINTS.fccBdc}?lat=${lat}&lon=${lon}&format=json`
    const res = await proxyGet(url)
    if (!res.ok) return "Fiber availability UNKNOWN (FCC request failed)"
    const data = (await res.json()) as { results?: unknown[] }
    if (!data.results?.length) return "Fiber availability UNKNOWN (no FCC area hit)"
    return "Census/FCC area context returned; fiber routes and carrier remain UNKNOWN"
  } catch {
    return "Fiber availability UNKNOWN (FCC not workable here)"
  }
}

export async function buildSiteBrief(
  lon: number,
  lat: number,
  radiusMi = DEFAULT_RADIUS_MI,
): Promise<SiteBrief> {
  const errors: string[] = []
  const unknowns = [...ALWAYS_UNKNOWN]

  let elevationFt: number | null = null
  let slope = "Slope UNKNOWN"
  try {
    elevationFt = await fetchElevation(lon, lat)
    slope = await slopeNote(lon, lat, elevationFt)
  } catch (e) {
    errors.push(`Elevation: ${e instanceof Error ? e.message : "failed"}`)
    unknowns.push("Elevation (EPQS)")
  }

  const wells = { orphaned: null as number | null, nmOcd: null as number | null, coOgcc: null as number | null }
  try { wells.orphaned = await countWells(ENDPOINTS.netlOrphaned, lon, lat, radiusMi) }
  catch (e) { errors.push(`NETL wells: ${e instanceof Error ? e.message : "failed"}`); unknowns.push("NETL orphaned well count") }
  try { wells.nmOcd = await countWells(ENDPOINTS.nmOcd, lon, lat, radiusMi) }
  catch (e) { errors.push(`NM OCD: ${e instanceof Error ? e.message : "failed"}`); unknowns.push("NM OCD well count") }
  try { wells.coOgcc = await countWells(ENDPOINTS.coOgcc, lon, lat, radiusMi) }
  catch (e) { errors.push(`CO OGCC: ${e instanceof Error ? e.message : "failed"}`); unknowns.push("CO OGCC well count") }

  const power = {
    nearestSubMi: null as number | null,
    nearestSubName: null as string | null,
    nearestLineMi: null as number | null,
    nearestLineKv: null as number | null,
  }
  try {
    const sub = await nearestSubstation(lon, lat, radiusMi)
    if (sub) { power.nearestSubMi = sub.mi; power.nearestSubName = sub.name }
    else unknowns.push("Nearest substation within search window")
  } catch (e) {
    errors.push(`Substations: ${e instanceof Error ? e.message : "failed"}`)
    unknowns.push("Nearest substation distance")
  }
  try {
    const line = await nearestTransmission(lon, lat, radiusMi)
    if (line) { power.nearestLineMi = line.mi; power.nearestLineKv = line.kv }
    else unknowns.push("Nearest transmission within search window")
  } catch (e) {
    errors.push(`Transmission: ${e instanceof Error ? e.message : "failed"}`)
    unknowns.push("Nearest transmission distance")
  }

  let flood: SiteBrief["flood"] = { flag: "UNKNOWN", zones: [] }
  try { flood = await floodFlag(lon, lat) }
  catch (e) {
    errors.push(`Flood: ${e instanceof Error ? e.message : "failed"}`)
    unknowns.push("FEMA flood flag")
  }

  const fiber = await fiberNote(lat, lon)

  return {
    lon, lat, radiusMi, elevationFt, slopeNote: slope, wells, power, flood,
    fiberNote: fiber, unknowns, errors,
  }
}
