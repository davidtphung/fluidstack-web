import { useEffect, useRef } from "react"
import maplibregl, { type GeoJSONSource, type Map, type MapMouseEvent } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { LAYER_IDS, OPEN_TOPO_TILES, type LayerKey } from "../lib/sources"
import { bboxAround } from "../lib/geo"
import { proxyPostJson } from "../lib/proxy"
import { ENDPOINTS } from "../lib/sources"

type Props = {
  layers: Record<LayerKey, boolean>
  pin: { lon: number; lat: number } | null
  onPin: (lon: number, lat: number) => void
  radiusMi: number
}

type ArcGisFeatureCollection = {
  features?: Array<{ attributes?: Record<string, unknown>; geometry?: unknown }>
  geometryType?: string
}

function esriToGeoJSON(data: ArcGisFeatureCollection, kind: "point" | "line" | "polygon") {
  const features = (data.features || []).map((f, i) => {
    const g = f.geometry as Record<string, unknown> | undefined
    let geometry: GeoJSON.Geometry | null = null
    if (kind === "point" && g && typeof g.x === "number" && typeof g.y === "number") {
      geometry = { type: "Point", coordinates: [g.x as number, g.y as number] }
    } else if (kind === "line" && g && Array.isArray(g.paths)) {
      geometry = { type: "MultiLineString", coordinates: g.paths as number[][][] }
    } else if (kind === "polygon" && g && Array.isArray(g.rings)) {
      geometry = { type: "Polygon", coordinates: g.rings as number[][][] }
    }
    return {
      type: "Feature" as const,
      id: i,
      properties: f.attributes || {},
      geometry,
    }
  }).filter((f) => f.geometry)
  return { type: "FeatureCollection" as const, features }
}

async function loadLayer(url: string, map: Map, sourceId: string, kind: "point" | "line" | "polygon", b: ReturnType<typeof bboxAround>) {
  const geometry = JSON.stringify({
    xmin: b.xmin, ymin: b.ymin, xmax: b.xmax, ymax: b.ymax,
    spatialReference: { wkid: 4326 },
  })
  const data = await proxyPostJson<ArcGisFeatureCollection>(url, {
    where: "1=1",
    geometry,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "*",
    returnGeometry: "true",
    outSR: "4326",
    resultRecordCount: "1000",
    f: "json",
  })
  const geojson = esriToGeoJSON(data, kind)
  const src = map.getSource(sourceId) as GeoJSONSource | undefined
  if (src) src.setData(geojson)
}

export function MapView({ layers, pin, onPin, radiusMi }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap",
          },
          topo: {
            type: "raster",
            tiles: OPEN_TOPO_TILES,
            tileSize: 256,
            attribution: "OpenTopoMap",
          },
        },
        layers: [
          { id: "osm-base", type: "raster", source: "osm" },
          { id: LAYER_IDS.topo, type: "raster", source: "topo", layout: { visibility: "none" }, paint: { "raster-opacity": 0.85 } },
        ],
      },
      center: [-104.5, 33.5],
      zoom: 6,
      attributionControl: false,
    })
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right")
    map.addControl(new maplibregl.ScaleControl({ unit: "imperial" }))

    map.on("load", () => {
      const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] }
      const addEmpty = (id: string) => map.addSource(id, { type: "geojson", data: empty })
      addEmpty("src-orphaned"); addEmpty("src-nm"); addEmpty("src-co"); addEmpty("src-tx"); addEmpty("src-subs"); addEmpty("src-flood"); addEmpty("src-pin-ring")
      map.addLayer({ id: LAYER_IDS.flood, type: "fill", source: "src-flood", paint: { "fill-color": "#38bdf8", "fill-opacity": 0.28 }, layout: { visibility: "none" } })
      map.addLayer({ id: LAYER_IDS.transmission, type: "line", source: "src-tx", paint: { "line-color": "#f59e0b", "line-width": 2.2 }, layout: { visibility: "none" } })
      map.addLayer({ id: LAYER_IDS.orphaned, type: "circle", source: "src-orphaned", paint: { "circle-radius": 4, "circle-color": "#fb7185", "circle-stroke-width": 1, "circle-stroke-color": "#0a0c0f" }, layout: { visibility: "none" } })
      map.addLayer({ id: LAYER_IDS.nmWells, type: "circle", source: "src-nm", paint: { "circle-radius": 3.5, "circle-color": "#a78bfa", "circle-stroke-width": 1, "circle-stroke-color": "#0a0c0f" }, layout: { visibility: "none" } })
      map.addLayer({ id: LAYER_IDS.coWells, type: "circle", source: "src-co", paint: { "circle-radius": 3.5, "circle-color": "#34d399", "circle-stroke-width": 1, "circle-stroke-color": "#0a0c0f" }, layout: { visibility: "none" } })
      map.addLayer({ id: LAYER_IDS.substations, type: "circle", source: "src-subs", paint: { "circle-radius": 6, "circle-color": "#fbbf24", "circle-stroke-width": 2, "circle-stroke-color": "#111" }, layout: { visibility: "none" } })
      map.addLayer({ id: "pin-ring", type: "line", source: "src-pin-ring", paint: { "line-color": "#22d3ee", "line-width": 2, "line-dasharray": [2, 1] } })
    })

    map.on("click", (e: MapMouseEvent) => onPin(e.lngLat.lng, e.lngLat.lat))
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [onPin])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const setVis = (id: string, on: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none")
    }
    ;(Object.keys(layers) as LayerKey[]).forEach((k) => setVis(LAYER_IDS[k], layers[k]))
  }, [layers])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !pin) return
    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ color: "#22d3ee" }).setLngLat([pin.lon, pin.lat]).addTo(map)
    } else {
      markerRef.current.setLngLat([pin.lon, pin.lat])
    }
    const ringSrc = map.getSource("src-pin-ring") as GeoJSONSource | undefined
    if (ringSrc) {
      const b = bboxAround(pin.lon, pin.lat, radiusMi)
      ringSrc.setData({
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [[ [b.xmin, b.ymin], [b.xmax, b.ymin], [b.xmax, b.ymax], [b.xmin, b.ymax], [b.xmin, b.ymin] ]],
          },
        }],
      })
    }
  }, [pin, radiusMi])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const onMove = () => {
      if (!map.isStyleLoaded()) return
      const bounds = map.getBounds()
      const b = { xmin: bounds.getWest(), ymin: bounds.getSouth(), xmax: bounds.getEast(), ymax: bounds.getNorth() }
      const jobs: Promise<void>[] = []
      if (layers.orphaned) jobs.push(loadLayer(ENDPOINTS.netlOrphaned, map, "src-orphaned", "point", b).catch(() => undefined))
      if (layers.nmWells) jobs.push(loadLayer(ENDPOINTS.nmOcd, map, "src-nm", "point", b).catch(() => undefined))
      if (layers.coWells) jobs.push(loadLayer(ENDPOINTS.hifldTx, map, "src-tx", "line", b).catch(() => undefined))
      if (layers.transmission) jobs.push(loadLayer(ENDPOINTS.hifldTx, map, "src-tx", "line", b).catch(() => undefined))
      if (layers.substations) jobs.push(loadLayer(ENDPOINTS.hifldSubs, map, "src-subs", "point", b).catch(() => undefined))
      if (layers.flood) jobs.push(loadLayer(ENDPOINTS.femaFlood, map, "src-flood", "polygon", b).catch(() => undefined))
      void Promise.all(jobs)
    }
    const t = window.setTimeout(onMove, 400)
    map.on("moveend", onMove)
    return () => { window.clearTimeout(t); map.off("moveend", onMove) }
  }, [layers])

  return <div className="map-root" ref={containerRef} />
}
