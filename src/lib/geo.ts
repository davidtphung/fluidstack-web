export type LonLat = { lon: number; lat: number }

export type BBox = {
  xmin: number
  ymin: number
  xmax: number
  ymax: number
}

export function milesToDegreesLat(mi: number): number {
  return mi / 69.0
}

export function milesToDegreesLon(mi: number, lat: number): number {
  return mi / (69.0 * Math.cos((lat * Math.PI) / 180))
}

export function bboxAround(lon: number, lat: number, radiusMi: number): BBox {
  const dLat = milesToDegreesLat(radiusMi)
  const dLon = milesToDegreesLon(radiusMi, lat)
  return {
    xmin: lon - dLon,
    ymin: lat - dLat,
    xmax: lon + dLon,
    ymax: lat + dLat,
  }
}

export function haversineMiles(a: LonLat, b: LonLat): number {
  const R = 3958.7613
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function formatMiles(mi: number | null | undefined): string {
  if (mi == null || Number.isNaN(mi)) return "UNKNOWN"
  if (mi < 0.1) return `${(mi * 5280).toFixed(0)} ft`
  return `${mi.toFixed(2)} mi`
}
