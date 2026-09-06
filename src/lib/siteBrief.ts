import { bboxAround, haversineMiles } from "./geo"
import { arcgisCount, arcgisQuery, envelopeJson } from "./arcgis"
import { corsGetJson, describeIssue, withQuery } from "./corsFetch"
import {
  ALWAYS_UNKNOWN,
  CO_PR_WHERE,
  DEFAULT_RADIUS_MI,
  ENDPOINTS,
  NETL_ACTIVE_WHERE,
  NM_ACTIVE_WHERE,
} from "./sources"

export type SiteBrief = {
  lon: number
  lat: number
  radiusMi: number
  elevationFt: number | null
  slopeNote: string
  wells: {
    orphaned: number | null
    operatingActive: number | null
    operatingAll: number | null
    nmActive: number | null
    nmAll: number | null
    coPr: number | null
    coAll: number | null
  }
  power: {
    nearestSubMi: number | null
    nearestSubName: string | null
    nearestLineMi: number | null
    nearestLineKv: number | null
  }
  flood: { flag: "YES" | "NO" | "UNKNOWN"; zones: string[] }
  unknowns: string[]
  errors: string[]
}

function hostOf(url: string): string {
  try { return new URL(url).hostname } catch { return "source" }
}

async function safeCount(url: string, lon: number, lat: number, radiusMi: number, where: string, label: string, errors: string[], unknowns: string[]) {
  try {
    return await arcgisCount(url, bboxAround(lon, lat, radiusMi), where)
  } catch (e) {
    const issue = describeIssue(e, hostOf(url))
    errors.push(`${label}: ${issue.message}`)
    unknowns.push(label)
    return null
  }
}

async function fetchElevation(lon: number, lat: number): Promise<number | null> {
  const data = await corsGetJson<{ value?: number | string }>(
    withQuery(ENDPOINTS.epqs, {
      x: String(lon),
      y: String(lat),
      wkid: "4326",
      units: "Feet",
    }),
  )
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

function pointFromFeature(attrs: Record<string, unknown> | undefined, geometry?: { x?: number; y?: number }) {
  if (geometry && typeof geometry.x === "number" && typeof geometry.y === "number") {
    return { lon: geometry.x, lat: geometry.y }
  }
  if (!attrs) return null
  const lon = attrs.LONGITUDE ?? attrs.longitude ?? attrs.LON ?? attrs.X
  const lat = attrs.LATITUDE ?? attrs.latitude ?? attrs.LAT ?? attrs.Y
  if (typeof lon === "number" && typeof lat === "number") return { lon, lat }
  return null
}

async function nearestSubstation(lon: number, lat: number, radiusMi: number) {
  const data = await arcgisQuery(ENDPOINTS.hifldSubs, {
    where: "1=1",
    geometry: envelopeJson(bboxAround(lon, lat, Math.max(radiusMi, 10))),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "NAME,MAX_VOLT",
    returnGeometry: "true",
    outSR: "4326",
    resultRecordCount: "200",
  })
  let best: { mi: number; name: string | null } | null = null
  for (const f of data.features || []) {
    const p = pointFromFeature(f.attributes, f.geometry)
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
  const data = await arcgisQuery(ENDPOINTS.hifldTx, {
    where: "1=1",
    geometry: envelopeJson(bboxAround(lon, lat, Math.max(radiusMi, 10))),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "VOLTAGE,VOLT_CLASS",
    returnGeometry: "true",
    outSR: "4326",
    resultRecordCount: "100",
  })
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
  const data = await arcgisQuery(ENDPOINTS.femaFlood, {
    where: "1=1",
    geometry,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF",
    returnGeometry: "false",
    outSR: "4326",
  })
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
    if (elevationFt == null) unknowns.push("Elevation (EPQS returned no value)")
    slope = await slopeNote(lon, lat, elevationFt)
  } catch (e) {
    const issue = describeIssue(e, "epqs.nationalmap.gov")
    errors.push(`Elevation: ${issue.message}`)
    unknowns.push("Elevation (EPQS)")
  }

  const [
    orphaned, operatingActive, operatingAll, nmActive, nmAll, coPr, coAll,
  ] = await Promise.all([
    safeCount(ENDPOINTS.netlOrphaned, lon, lat, radiusMi, "1=1", "NETL orphaned well count", errors, unknowns),
    safeCount(ENDPOINTS.netlOperating, lon, lat, radiusMi, NETL_ACTIVE_WHERE, "NETL operating (status contains Active)", errors, unknowns),
    safeCount(ENDPOINTS.netlOperating, lon, lat, radiusMi, "1=1", "NETL integrated well count", errors, unknowns),
    safeCount(ENDPOINTS.nmOcd, lon, lat, radiusMi, NM_ACTIVE_WHERE, "NM OCD Active well count", errors, unknowns),
    safeCount(ENDPOINTS.nmOcd, lon, lat, radiusMi, "1=1", "NM OCD well count", errors, unknowns),
    safeCount(ENDPOINTS.coOgcc, lon, lat, radiusMi, CO_PR_WHERE, "CO OGCC Facil_Stat PR count", errors, unknowns),
    safeCount(ENDPOINTS.coOgcc, lon, lat, radiusMi, "1=1", "CO OGCC well count", errors, unknowns),
  ])
  const wells = { orphaned, operatingActive, operatingAll, nmActive, nmAll, coPr, coAll }

  const power = {
    nearestSubMi: null as number | null,
    nearestSubName: null as string | null,
    nearestLineMi: null as number | null,
    nearestLineKv: null as number | null,
  }
  try {
    const sub = await nearestSubstation(lon, lat, radiusMi)
    if (sub) {
      power.nearestSubMi = sub.mi
      power.nearestSubName = sub.name
    } else {
      unknowns.push("Nearest substation within search window")
    }
  } catch (e) {
    errors.push(`Substations: ${describeIssue(e, "services.arcgis.com").message}`)
    unknowns.push("Nearest substation distance")
  }
  try {
    const line = await nearestTransmission(lon, lat, radiusMi)
    if (line) {
      power.nearestLineMi = line.mi
      power.nearestLineKv = line.kv
    } else {
      unknowns.push("Nearest transmission within search window")
    }
  } catch (e) {
    errors.push(`Transmission: ${describeIssue(e, "services2.arcgis.com").message}`)
    unknowns.push("Nearest transmission distance")
  }

  let flood: SiteBrief["flood"] = { flag: "UNKNOWN", zones: [] }
  try {
    flood = await floodFlag(lon, lat)
  } catch (e) {
    errors.push(`Flood: ${describeIssue(e, "hazards.fema.gov").message}`)
    unknowns.push("FEMA flood flag")
  }

  return {
    lon, lat, radiusMi, elevationFt, slopeNote: slope, wells, power, flood,
    unknowns, errors,
  }
}
