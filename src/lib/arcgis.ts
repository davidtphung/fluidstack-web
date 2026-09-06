import { corsGetJson, withQuery } from "./corsFetch"
import type { BBox } from "./geo"

export type ArcGisFeature = {
  attributes?: Record<string, unknown>
  geometry?: {
    x?: number
    y?: number
    paths?: number[][][]
    rings?: number[][][]
  }
}

export type ArcGisResponse = {
  features?: ArcGisFeature[]
  count?: number
  error?: { message?: string; code?: number }
}

export function envelopeJson(b: BBox): string {
  return JSON.stringify({
    xmin: b.xmin,
    ymin: b.ymin,
    xmax: b.xmax,
    ymax: b.ymax,
    spatialReference: { wkid: 4326 },
  })
}

export async function arcgisQuery(
  url: string,
  params: Record<string, string>,
): Promise<ArcGisResponse> {
  const data = await corsGetJson<ArcGisResponse>(withQuery(url, { f: "json", ...params }))
  if (data.error) {
    throw new Error(data.error.message || `ArcGIS error ${data.error.code ?? ""}`.trim())
  }
  return data
}

export async function arcgisCount(
  url: string,
  b: BBox,
  where = "1=1",
): Promise<number> {
  const data = await arcgisQuery(url, {
    where,
    geometry: envelopeJson(b),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    returnCountOnly: "true",
    outSR: "4326",
  })
  if (typeof data.count === "number") return data.count
  return data.features?.length ?? 0
}

export async function arcgisFeatures(
  url: string,
  b: BBox,
  opts: { where?: string; outFields?: string; limit?: number } = {},
): Promise<ArcGisFeature[]> {
  const data = await arcgisQuery(url, {
    where: opts.where ?? "1=1",
    geometry: envelopeJson(b),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: opts.outFields ?? "*",
    returnGeometry: "true",
    outSR: "4326",
    resultRecordCount: String(opts.limit ?? 800),
  })
  return data.features ?? []
}

export function featuresToGeoJSON(
  features: ArcGisFeature[],
  kind: "point" | "line" | "polygon",
): GeoJSON.FeatureCollection {
  const out: GeoJSON.Feature[] = []
  features.forEach((f, i) => {
    const g = f.geometry
    let geometry: GeoJSON.Geometry | null = null
    if (kind === "point" && g && typeof g.x === "number" && typeof g.y === "number") {
      geometry = { type: "Point", coordinates: [g.x, g.y] }
    } else if (kind === "line" && g && Array.isArray(g.paths)) {
      geometry = { type: "MultiLineString", coordinates: g.paths }
    } else if (kind === "polygon" && g && Array.isArray(g.rings)) {
      geometry = { type: "Polygon", coordinates: g.rings }
    }
    if (!geometry) return
    out.push({
      type: "Feature",
      id: i,
      properties: f.attributes || {},
      geometry,
    })
  })
  return { type: "FeatureCollection", features: out }
}
