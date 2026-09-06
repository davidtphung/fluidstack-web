import { useEffect, useRef } from "react"
import maplibregl, { type GeoJSONSource, type Map, type MapMouseEvent } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import {
  CONUS_CENTER,
  CONUS_ZOOM,
  ESRI_WORLD_TOPO_TILES,
  FCC_MAX_FEATURES,
  FCC_PAGE_SIZE,
  HEAVY_LAYER_MIN_ZOOM,
  LAYER_IDS,
  NETL_ACTIVE_WHERE,
  OPEN_TOPO_TILES,
  OSM_STREET_TILES,
  PERMIAN_CENTER,
  PERMIAN_ZOOM,
  USGS_TOPO_TILES,
  fccQueryForZoom,
  type LayerKey,
  ENDPOINTS,
} from "../lib/sources"
import { bboxAround } from "../lib/geo"
import { proxyPostJson } from "../lib/proxy"

export type LayerHealth = Record<LayerKey, { state: "idle" | "ok" | "empty" | "blocked" | "error"; detail?: string }>

type Props = {
  layers: Record<LayerKey, boolean>
  pin: { lon: number; lat: number } | null
  onPin: (lon: number, lat: number) => void
  radiusMi: number
  onHealth?: (key: LayerKey, health: LayerHealth[LayerKey]) => void
  flyTo?: { lon: number; lat: number; zoom: number } | null
}

type ArcGisFeatureCollection = {
  features?: Array<{ attributes?: Record<string, unknown>; geometry?: unknown }>
  geometryType?: string
  exceededTransferLimit?: boolean
}

const STREETS_LAYER_ID = "osm-streets"

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

async function loadLayer(
  url: string,
  map: Map,
  sourceId: string,
  kind: "point" | "line" | "polygon",
  b: ReturnType<typeof bboxAround>,
  where = "1=1",
) {
  const geometry = JSON.stringify({
    xmin: b.xmin, ymin: b.ymin, xmax: b.xmax, ymax: b.ymax,
    spatialReference: { wkid: 4326 },
  })
  const data = await proxyPostJson<ArcGisFeatureCollection>(url, {
    where,
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
  const geojson = esriToGeoJSON(data, kind) as GeoJSON.FeatureCollection
  const src = map.getSource(sourceId) as GeoJSONSource | undefined
  if (src) src.setData(geojson)
  const n = geojson.features.length
  return { count: n, health: { state: n ? "ok" as const : "empty" as const, detail: `${n} drawn (bbox sample)` } }
}

async function loadLayerPaged(
  url: string,
  map: Map,
  sourceId: string,
  kind: "point" | "line" | "polygon",
  b: ReturnType<typeof bboxAround>,
  opts: { where?: string; outFields?: string; pageSize?: number; maxFeatures?: number } = {},
) {
  const pageSize = opts.pageSize ?? FCC_PAGE_SIZE
  const maxFeatures = opts.maxFeatures ?? FCC_MAX_FEATURES
  const geometry = JSON.stringify({
    xmin: b.xmin, ymin: b.ymin, xmax: b.xmax, ymax: b.ymax,
    spatialReference: { wkid: 4326 },
  })
  const collected: NonNullable<ArcGisFeatureCollection["features"]> = []
  let offset = 0
  while (collected.length < maxFeatures) {
    const take = Math.min(pageSize, maxFeatures - collected.length)
    const data = await proxyPostJson<ArcGisFeatureCollection>(url, {
      where: opts.where ?? "1=1",
      geometry,
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: opts.outFields ?? "*",
      returnGeometry: "true",
      outSR: "4326",
      resultOffset: String(offset),
      resultRecordCount: String(take),
      f: "json",
    })
    const feats = data.features || []
    collected.push(...feats)
    if (!data.exceededTransferLimit && feats.length < take) break
    if (feats.length === 0) break
    offset += feats.length
  }
  const geojson = esriToGeoJSON({ features: collected }, kind) as GeoJSON.FeatureCollection
  const src = map.getSource(sourceId) as GeoJSONSource | undefined
  if (src) src.setData(geojson)
  const n = geojson.features.length
  return {
    count: n,
    health: {
      state: n ? "ok" as const : "empty" as const,
      detail: `${n} drawn (paginated bbox sample)`,
    },
  }
}

function applyLayerVisibility(map: Map, layers: Record<LayerKey, boolean>) {
  const setVis = (id: string, on: boolean) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none")
  }
  // USGS + Esri stay under OpenTopo as fallback fill whenever topo is on
  setVis("usgs-fallback", layers.topo)
  setVis("esri-fallback", layers.topo)
  setVis(STREETS_LAYER_ID, false)
  ;(Object.keys(layers) as LayerKey[]).forEach((k) => setVis(LAYER_IDS[k], layers[k]))
}

export function MapView({ layers, pin, onPin, radiusMi, onHealth, flyTo }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const layersRef = useRef(layers)
  layersRef.current = layers
  const onPinRef = useRef(onPin)
  onPinRef.current = onPin
  const onHealthRef = useRef(onHealth)
  onHealthRef.current = onHealth

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          "usgs-topo": {
            type: "raster",
            tiles: USGS_TOPO_TILES,
            tileSize: 256,
            attribution: "USGS National Map",
            maxzoom: 16,
          },
          "esri-topo": {
            type: "raster",
            tiles: ESRI_WORLD_TOPO_TILES,
            tileSize: 256,
            attribution: "Esri World Topo",
            maxzoom: 16,
          },
          opentopo: {
            type: "raster",
            tiles: OPEN_TOPO_TILES,
            tileSize: 256,
            attribution: "OpenTopoMap",
            maxzoom: 17,
          },
          osm: {
            type: "raster",
            tiles: OSM_STREET_TILES,
            tileSize: 256,
            attribution: "&copy; OpenStreetMap",
            maxzoom: 19,
          },
        },
        layers: [
          // Fallbacks under OpenTopo so sparse/failed OpenTopo tiles still show USA topo
          {
            id: "usgs-fallback",
            type: "raster",
            source: "usgs-topo",
            layout: { visibility: "visible" },
            paint: { "raster-opacity": 1 },
          },
          {
            id: "esri-fallback",
            type: "raster",
            source: "esri-topo",
            layout: { visibility: "visible" },
            paint: { "raster-opacity": 0.55 },
          },
          {
            id: LAYER_IDS.topo,
            type: "raster",
            source: "opentopo",
            layout: { visibility: "visible" },
            paint: { "raster-opacity": 1 },
          },
          {
            id: STREETS_LAYER_ID,
            type: "raster",
            source: "osm",
            layout: { visibility: "none" },
            paint: { "raster-opacity": 0.72 },
          },
        ],
      },
      center: CONUS_CENTER,
      zoom: CONUS_ZOOM,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    })

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right")
    map.addControl(new maplibregl.ScaleControl({ unit: "imperial" }))
    map.addControl(new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: false,
    }), "top-right")

    const onLoad = () => {
      const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] }
      const addEmpty = (id: string) => {
        if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: empty })
      }
      addEmpty("src-orphaned")
      addEmpty("src-operating")
      addEmpty("src-nm")
      addEmpty("src-co")
      addEmpty("src-tx")
      addEmpty("src-subs")
      addEmpty("src-broadband")
      addEmpty("src-flood")
      addEmpty("src-pin-ring")

      const addIfMissing = (
        id: string,
        layer: maplibregl.AddLayerObject,
      ) => {
        if (!map.getLayer(id)) map.addLayer(layer)
      }

      addIfMissing(LAYER_IDS.flood, {
        id: LAYER_IDS.flood,
        type: "fill",
        source: "src-flood",
        paint: { "fill-color": "#38bdf8", "fill-opacity": 0.28 },
        layout: { visibility: "none" },
      })
      addIfMissing(LAYER_IDS.broadband, {
        id: LAYER_IDS.broadband,
        type: "fill",
        source: "src-broadband",
        paint: {
          "fill-color": [
            "case",
            [">", ["coalesce", ["get", "ServedBSLsFiber"], 0], 0],
            "#22d3ee",
            [">", ["coalesce", ["get", "ServedBSLs"], 0], 0],
            "#64748b",
            "#334155",
          ],
          "fill-opacity": 0.32,
          "fill-outline-color": "#94a3b8",
        },
        layout: { visibility: "none" },
      })
      addIfMissing(LAYER_IDS.transmission, {
        id: LAYER_IDS.transmission,
        type: "line",
        source: "src-tx",
        paint: { "line-color": "#f59e0b", "line-width": 2.4 },
        layout: { visibility: "none" },
      })
      addIfMissing(LAYER_IDS.orphaned, {
        id: LAYER_IDS.orphaned,
        type: "circle",
        source: "src-orphaned",
        paint: {
          "circle-radius": 4,
          "circle-color": "#fb7185",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#0a0c0f",
        },
        layout: { visibility: "none" },
      })
      addIfMissing(LAYER_IDS.operating, {
        id: LAYER_IDS.operating,
        type: "circle",
        source: "src-operating",
        paint: {
          "circle-radius": 3.6,
          "circle-color": "#22d3ee",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#0a0c0f",
        },
        layout: { visibility: "none" },
      })
      addIfMissing(LAYER_IDS.nmWells, {
        id: LAYER_IDS.nmWells,
        type: "circle",
        source: "src-nm",
        paint: {
          "circle-radius": 3.5,
          "circle-color": "#a78bfa",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#0a0c0f",
        },
        layout: { visibility: "none" },
      })
      addIfMissing(LAYER_IDS.coWells, {
        id: LAYER_IDS.coWells,
        type: "circle",
        source: "src-co",
        paint: {
          "circle-radius": 3.5,
          "circle-color": "#34d399",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#0a0c0f",
        },
        layout: { visibility: "none" },
      })
      addIfMissing(LAYER_IDS.substations, {
        id: LAYER_IDS.substations,
        type: "circle",
        source: "src-subs",
        paint: {
          "circle-radius": 6,
          "circle-color": "#fbbf24",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#111",
        },
        layout: { visibility: "none" },
      })
      addIfMissing("pin-ring", {
        id: "pin-ring",
        type: "line",
        source: "src-pin-ring",
        paint: { "line-color": "#22d3ee", "line-width": 2, "line-dasharray": [2, 1] },
      })

      // Fix race: apply current layer toggles immediately after overlays exist
      applyLayerVisibility(map, layersRef.current)
      onHealthRef.current?.("topo", { state: "ok", detail: "OpenTopoMap visible; USGS + Esri fallbacks under it" })
    }

    map.on("load", onLoad)
    map.on("styledata", () => {
      if (map.isStyleLoaded()) applyLayerVisibility(map, layersRef.current)
    })

    map.on("click", (e: MapMouseEvent) => onPinRef.current(e.lngLat.lng, e.lngLat.lat))
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    applyLayerVisibility(map, layers)
  }, [layers])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !flyTo) return
    map.flyTo({
      center: [flyTo.lon, flyTo.lat],
      zoom: flyTo.zoom,
      essential: true,
      duration: 1200,
    })
  }, [flyTo])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !pin) return
    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ color: "#22d3ee" })
        .setLngLat([pin.lon, pin.lat])
        .addTo(map)
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
            coordinates: [[
              [b.xmin, b.ymin],
              [b.xmax, b.ymin],
              [b.xmax, b.ymax],
              [b.xmin, b.ymax],
              [b.xmin, b.ymin],
            ]],
          },
        }],
      })
    }
  }, [pin, radiusMi])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const report = (key: LayerKey, health: LayerHealth[LayerKey]) => onHealthRef.current?.(key, health)
    const onMove = () => {
      if (!map.isStyleLoaded()) return
      const bounds = map.getBounds()
      const b = {
        xmin: bounds.getWest(),
        ymin: bounds.getSouth(),
        xmax: bounds.getEast(),
        ymax: bounds.getNorth(),
      }
      const jobs: Promise<void>[] = []
      const track = (
        key: LayerKey,
        promise: Promise<{ health: LayerHealth[LayerKey] }>,
      ) => {
        jobs.push(
          promise
            .then((r) => report(key, r.health))
            .catch(() => report(key, { state: "blocked", detail: "CORS blocked or network failed. Layer marked UNKNOWN." })),
        )
      }
      const zoom = map.getZoom()
      const gated = (key: LayerKey) => {
        const minZ = HEAVY_LAYER_MIN_ZOOM[key]
        if (minZ != null && zoom < minZ) {
          report(key, { state: "idle", detail: `Zoom to ${minZ}+ to draw this layer` })
          return true
        }
        return false
      }
      if (layers.orphaned && !gated("orphaned")) track("orphaned", loadLayer(ENDPOINTS.netlOrphaned, map, "src-orphaned", "point", b))
      if (layers.operating && !gated("operating")) track("operating", loadLayer(ENDPOINTS.netlOperating, map, "src-operating", "point", b, NETL_ACTIVE_WHERE))
      if (layers.nmWells && !gated("nmWells")) track("nmWells", loadLayer(ENDPOINTS.nmOcd, map, "src-nm", "point", b))
      if (layers.coWells && !gated("coWells")) track("coWells", loadLayer(ENDPOINTS.coOgcc, map, "src-co", "point", b))
      if (layers.transmission && !gated("transmission")) track("transmission", loadLayer(ENDPOINTS.hifldTx, map, "src-tx", "line", b))
      if (layers.substations && !gated("substations")) track("substations", loadLayer(ENDPOINTS.hifldSubs, map, "src-subs", "point", b))
      if (layers.broadband && !gated("broadband")) {
        const fcc = fccQueryForZoom(zoom)
        track("broadband", loadLayerPaged(fcc.url, map, "src-broadband", "polygon", b, {
          outFields: "GEOID,TotalBSLs,ServedBSLs,ServedBSLsFiber,UniqueProvidersFiber",
          pageSize: FCC_PAGE_SIZE,
          maxFeatures: FCC_MAX_FEATURES,
        }).then((r) => ({
          health: { ...r.health, detail: `${r.health.detail} · ${fcc.label}` },
        })))
      }
      if (layers.flood && !gated("flood")) track("flood", loadLayer(ENDPOINTS.femaFlood, map, "src-flood", "polygon", b))
      void Promise.all(jobs)
    }
    const t = window.setTimeout(onMove, 400)
    map.on("moveend", onMove)
    return () => {
      window.clearTimeout(t)
      map.off("moveend", onMove)
    }
  }, [layers])

  const jumpPermian = () => {
    const map = mapRef.current
    if (!map) return
    map.flyTo({ center: PERMIAN_CENTER, zoom: PERMIAN_ZOOM, essential: true, duration: 1400 })
  }

  const jumpConus = () => {
    const map = mapRef.current
    if (!map) return
    map.flyTo({ center: CONUS_CENTER, zoom: CONUS_ZOOM, essential: true, duration: 1200 })
  }

  return (
    <div className="map-wrap">
      <div className="map-root" ref={containerRef} role="application" aria-label="Siteline USA screening map" />
      <div className="map-jump-bar" role="toolbar" aria-label="Map jumps">
        <button type="button" className="jump-btn" onClick={jumpConus}>USA</button>
        <button type="button" className="jump-btn jump-permian" onClick={jumpPermian}>Jump Permian</button>
      </div>
    </div>
  )
}
