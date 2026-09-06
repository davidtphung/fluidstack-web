import { useEffect, useRef, useState } from "react"
import maplibregl, { type GeoJSONSource, type Map, type MapMouseEvent } from "maplibre-gl"
import {
  CO_PR_WHERE,
  CONUS_CENTER,
  ENDPOINTS,
  ESRI_USA_TOPO_TILES,
  FALLBACK_LAYER_IDS,
  HEAVY_LAYER_MIN_ZOOM,
  LAYER_IDS,
  NETL_ACTIVE_WHERE,
  NM_ACTIVE_WHERE,
  OPEN_TOPO_TILES,
  OSM_STREET_TILES,
  type LayerKey,
} from "../lib/sources"
import { bboxAround, type BBox } from "../lib/geo"
import { arcgisFeatures, featuresToGeoJSON } from "../lib/arcgis"
import { describeIssue } from "../lib/corsFetch"

export type LayerHealth = Record<LayerKey, { state: "idle" | "ok" | "empty" | "blocked" | "error"; detail?: string }>

type Props = {
  layers: Record<LayerKey, boolean>
  pin: { lon: number; lat: number } | null
  onPin: (lon: number, lat: number) => void
  radiusMi: number
  onHealth: (key: LayerKey, health: LayerHealth[LayerKey]) => void
  flyTo: { lon: number; lat: number; zoom: number } | null
}

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] }

const VECTOR_SOURCES: Record<Exclude<LayerKey, "topo">, string> = {
  orphaned: "src-orphaned",
  operating: "src-operating",
  nmWells: "src-nm",
  coWells: "src-co",
  transmission: "src-tx",
  substations: "src-subs",
  flood: "src-flood",
}

function probeTile(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    let settled = false
    const done = (ok: boolean) => {
      if (settled) return
      settled = true
      resolve(ok)
    }
    img.onload = () => done(true)
    img.onerror = () => done(false)
    img.referrerPolicy = "no-referrer"
    img.src = url
    window.setTimeout(() => done(false), 7000)
  })
}

async function loadLayer(
  url: string,
  map: Map,
  sourceId: string,
  kind: "point" | "line" | "polygon",
  b: BBox,
  host: string,
  where?: string,
): Promise<LayerHealth[LayerKey]> {
  try {
    const feats = await arcgisFeatures(url, b, { where, limit: kind === "polygon" ? 200 : 800 })
    const geojson = featuresToGeoJSON(feats, kind)
    const src = map.getSource(sourceId) as GeoJSONSource | undefined
    if (src) src.setData(geojson)
    if (!geojson.features.length) return { state: "empty", detail: "0 features in this view" }
    return { state: "ok", detail: `${geojson.features.length} drawn (bbox sample, not a census)` }
  } catch (e) {
    const issue = describeIssue(e, host)
    const src = map.getSource(sourceId) as GeoJSONSource | undefined
    if (src) src.setData(EMPTY)
    return {
      state: issue.kind === "blocked" ? "blocked" : "error",
      detail: issue.message,
    }
  }
}

function applyVisibility(map: Map, layers: Record<LayerKey, boolean>, hideOpenTopo = false) {
  if (!map.isStyleLoaded()) return
  ;(Object.keys(LAYER_IDS) as LayerKey[]).forEach((key) => {
    const id = LAYER_IDS[key]
    if (!map.getLayer(id)) return
    const on = key === "topo" && hideOpenTopo ? false : layers[key]
    map.setLayoutProperty(id, "visibility", on ? "visible" : "none")
  })
  if (map.getLayer(FALLBACK_LAYER_IDS.esriTopo)) {
    map.setLayoutProperty(FALLBACK_LAYER_IDS.esriTopo, "visibility", layers.topo ? "visible" : "none")
  }
  if (map.getLayer(FALLBACK_LAYER_IDS.osm)) {
    map.setLayoutProperty(FALLBACK_LAYER_IDS.osm, "visibility", layers.topo ? "none" : "visible")
  }
}

export function MapView({ layers, pin, onPin, radiusMi, onHealth, flyTo }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const onPinRef = useRef(onPin)
  const onHealthRef = useRef(onHealth)
  const layersRef = useRef(layers)
  const hideOpenTopoRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  onPinRef.current = onPin
  onHealthRef.current = onHealth
  layersRef.current = layers

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const container = containerRef.current
    let cancelled = false

    const map = new maplibregl.Map({
      container,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: OSM_STREET_TILES,
            tileSize: 256,
            attribution: "&copy; OpenStreetMap",
            maxzoom: 19,
          },
          "esri-topo": {
            type: "raster",
            tiles: ESRI_USA_TOPO_TILES,
            tileSize: 256,
            attribution: "Esri World Topo (Esri, USGS, NOAA)",
            maxzoom: 19,
          },
          topo: {
            type: "raster",
            tiles: OPEN_TOPO_TILES,
            tileSize: 256,
            attribution: "OpenTopoMap",
            maxzoom: 17,
          },
        },
        layers: [
          {
            id: FALLBACK_LAYER_IDS.osm,
            type: "raster",
            source: "osm",
            layout: { visibility: "none" },
          },
          {
            id: FALLBACK_LAYER_IDS.esriTopo,
            type: "raster",
            source: "esri-topo",
            layout: { visibility: "visible" },
            paint: { "raster-opacity": 1 },
          },
          {
            id: LAYER_IDS.topo,
            type: "raster",
            source: "topo",
            layout: { visibility: "visible" },
            paint: { "raster-opacity": 0.9 },
          },
        ],
      },
      center: [CONUS_CENTER.lon, CONUS_CENTER.lat],
      zoom: CONUS_CENTER.zoom,
      minZoom: 2,
      maxZoom: 17,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      fadeDuration: 180,
      cooperativeGestures: false,
      failIfMajorPerformanceCaveat: false,
    })

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false, showCompass: false }), "top-right")
    map.addControl(new maplibregl.ScaleControl({ unit: "imperial" }))
    map.addControl(new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: false,
    }), "top-right")

    const syncVisibility = () => applyVisibility(map, layersRef.current, hideOpenTopoRef.current)

    const addVectorLayers = () => {
      const addEmpty = (id: string) => {
        if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: EMPTY })
      }
      addEmpty("src-orphaned")
      addEmpty("src-operating")
      addEmpty("src-nm")
      addEmpty("src-co")
      addEmpty("src-tx")
      addEmpty("src-subs")
      addEmpty("src-flood")
      addEmpty("src-pin-ring")
      const addIfMissing = (id: string, spec: Parameters<Map["addLayer"]>[0]) => {
        if (!map.getLayer(id)) map.addLayer(spec)
      }
      addIfMissing(LAYER_IDS.flood, { id: LAYER_IDS.flood, type: "fill", source: "src-flood", paint: { "fill-color": "#38bdf8", "fill-opacity": 0.28 } })
      addIfMissing(LAYER_IDS.transmission, { id: LAYER_IDS.transmission, type: "line", source: "src-tx", paint: { "line-color": "#f59e0b", "line-width": 2.2 } })
      addIfMissing(LAYER_IDS.orphaned, { id: LAYER_IDS.orphaned, type: "circle", source: "src-orphaned", paint: { "circle-radius": 4, "circle-color": "#fb7185", "circle-stroke-width": 1, "circle-stroke-color": "#0a0c0f" } })
      addIfMissing(LAYER_IDS.operating, { id: LAYER_IDS.operating, type: "circle", source: "src-operating", paint: { "circle-radius": 3.6, "circle-color": "#22d3ee", "circle-stroke-width": 1, "circle-stroke-color": "#0a0c0f" } })
      addIfMissing(LAYER_IDS.nmWells, { id: LAYER_IDS.nmWells, type: "circle", source: "src-nm", paint: { "circle-radius": 3.4, "circle-color": "#a78bfa", "circle-stroke-width": 1, "circle-stroke-color": "#0a0c0f" } })
      addIfMissing(LAYER_IDS.coWells, { id: LAYER_IDS.coWells, type: "circle", source: "src-co", paint: { "circle-radius": 3.4, "circle-color": "#34d399", "circle-stroke-width": 1, "circle-stroke-color": "#0a0c0f" } })
      addIfMissing(LAYER_IDS.substations, { id: LAYER_IDS.substations, type: "circle", source: "src-subs", paint: { "circle-radius": 6, "circle-color": "#fbbf24", "circle-stroke-width": 2, "circle-stroke-color": "#111" } })
      addIfMissing("pin-ring", { id: "pin-ring", type: "line", source: "src-pin-ring", paint: { "line-color": "#e8eef6", "line-width": 2, "line-dasharray": [2, 1] } })
      syncVisibility()
    }

    map.on("load", () => {
      addVectorLayers()
      map.resize()
      syncVisibility()
      if (!cancelled) setMapReady(true)
    })
    map.on("styledata", () => {
      addVectorLayers()
      syncVisibility()
    })
    map.on("error", (event) => {
      const err = event.error
      const message = err instanceof Error ? err.message : "Map failed to paint"
      const sourceId = "sourceId" in event ? String((event as { sourceId?: string }).sourceId || "") : ""
      if (/webgl|webgl2|context/i.test(message) && !cancelled) {
        setMapError("This browser could not start a WebGL map context.")
      }
      if ((sourceId === "topo" || /opentopomap/i.test(message)) && !hideOpenTopoRef.current) {
        hideOpenTopoRef.current = true
        onHealthRef.current("topo", {
          state: "ok",
          detail: "Esri World Topo fallback (OpenTopoMap tile failed)",
        })
        syncVisibility()
      }
    })

    map.on("sourcedata", (event) => {
      if (event.sourceId === "topo" && event.isSourceLoaded && !hideOpenTopoRef.current) {
        onHealthRef.current("topo", { state: "ok", detail: "OpenTopoMap tiles" })
      }
      if (event.sourceId === "esri-topo" && event.isSourceLoaded && hideOpenTopoRef.current) {
        onHealthRef.current("topo", {
          state: "ok",
          detail: "Esri World Topo fallback (OpenTopoMap tile failed)",
        })
      }
    })

    void (async () => {
      const sample = OPEN_TOPO_TILES[0].replace("{z}", "3").replace("{x}", "1").replace("{y}", "2")
      const openTopoOk = await probeTile(sample)
      if (cancelled || openTopoOk) return
      const esriSample = ESRI_USA_TOPO_TILES[0]
        .replace("{z}", "3")
        .replace("{y}", "3")
        .replace("{x}", "1")
      const esriOk = await probeTile(esriSample)
      if (cancelled) return
      if (esriOk) {
        hideOpenTopoRef.current = true
        onHealthRef.current("topo", {
          state: "ok",
          detail: "Esri World Topo fallback (OpenTopoMap tile failed)",
        })
        syncVisibility()
      } else {
        onHealthRef.current("topo", {
          state: "error",
          detail: "OpenTopoMap and Esri USA topo tiles failed to load",
        })
        setMapError("Topography tiles failed to load. Streets stay available if you turn the topo layer off.")
      }
    })()

    map.on("click", (e: MapMouseEvent) => onPinRef.current(e.lngLat.lng, e.lngLat.lat))

    const resize = () => map.resize()
    window.addEventListener("resize", resize)
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    requestAnimationFrame(resize)
    window.setTimeout(resize, 120)

    mapRef.current = map
    return () => {
      cancelled = true
      window.removeEventListener("resize", resize)
      ro.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => applyVisibility(map, layers, hideOpenTopoRef.current)
    if (map.isStyleLoaded()) apply()
    else map.once("load", apply)
  }, [layers])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !pin) {
      markerRef.current?.remove()
      markerRef.current = null
      const ringSrc = map?.getSource("src-pin-ring") as GeoJSONSource | undefined
      if (ringSrc) ringSrc.setData(EMPTY)
      return
    }
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
    if (!map || !flyTo) return
    map.flyTo({
      center: [flyTo.lon, flyTo.lat],
      zoom: flyTo.zoom,
      essential: true,
      speed: 1.15,
      curve: 1.35,
    })
  }, [flyTo])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let timer = 0
    const onMove = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (!map.isStyleLoaded()) return
        const zoom = map.getZoom()
        const bounds = map.getBounds()
        const b: BBox = {
          xmin: bounds.getWest(),
          ymin: bounds.getSouth(),
          xmax: bounds.getEast(),
          ymax: bounds.getNorth(),
        }
        const report = (key: LayerKey, health: LayerHealth[LayerKey]) => onHealthRef.current(key, health)

        ;(Object.keys(VECTOR_SOURCES) as Array<keyof typeof VECTOR_SOURCES>).forEach((key) => {
          if (!layers[key]) return
          const minZoom = HEAVY_LAYER_MIN_ZOOM[key]
          const sourceId = VECTOR_SOURCES[key]
          if (minZoom != null && zoom < minZoom) {
            const src = map.getSource(sourceId) as GeoJSONSource | undefined
            if (src) src.setData(EMPTY)
            report(key, { state: "idle", detail: `Zoom in past ${minZoom} to load this layer` })
          }
        })

        if (layers.orphaned && zoom >= (HEAVY_LAYER_MIN_ZOOM.orphaned ?? 0)) {
          void loadLayer(ENDPOINTS.netlOrphaned, map, "src-orphaned", "point", b, "arcgis.netl.doe.gov")
            .then((h) => report("orphaned", h))
        }
        if (layers.operating && zoom >= (HEAVY_LAYER_MIN_ZOOM.operating ?? 0)) {
          void loadLayer(ENDPOINTS.netlOperating, map, "src-operating", "point", b, "arcgis.netl.doe.gov", NETL_ACTIVE_WHERE)
            .then((h) => report("operating", h))
        }
        if (layers.nmWells && zoom >= (HEAVY_LAYER_MIN_ZOOM.nmWells ?? 0)) {
          void loadLayer(ENDPOINTS.nmOcd, map, "src-nm", "point", b, "services5.arcgis.com", NM_ACTIVE_WHERE)
            .then((h) => report("nmWells", h))
        }
        if (layers.coWells && zoom >= (HEAVY_LAYER_MIN_ZOOM.coWells ?? 0)) {
          void loadLayer(ENDPOINTS.coOgcc, map, "src-co", "point", b, "data.dnrgis.state.co.us", CO_PR_WHERE)
            .then((h) => report("coWells", h))
        }
        if (layers.transmission && zoom >= (HEAVY_LAYER_MIN_ZOOM.transmission ?? 0)) {
          void loadLayer(ENDPOINTS.hifldTx, map, "src-tx", "line", b, "services2.arcgis.com")
            .then((h) => report("transmission", h))
        }
        if (layers.substations && zoom >= (HEAVY_LAYER_MIN_ZOOM.substations ?? 0)) {
          void loadLayer(ENDPOINTS.hifldSubs, map, "src-subs", "point", b, "services.arcgis.com")
            .then((h) => report("substations", h))
        }
        if (layers.flood && zoom >= (HEAVY_LAYER_MIN_ZOOM.flood ?? 0)) {
          void loadLayer(ENDPOINTS.femaFlood, map, "src-flood", "polygon", b, "hazards.fema.gov")
            .then((h) => report("flood", h))
        }
      }, 450)
    }
    const start = () => onMove()
    if (map.isStyleLoaded()) start()
    else map.once("load", start)
    map.on("moveend", onMove)
    return () => {
      window.clearTimeout(timer)
      map.off("moveend", onMove)
    }
  }, [layers])

  return (
    <div className="map-stage-inner">
      <div className="map-root" ref={containerRef} role="application" aria-label="CONUS OpenTopo map" />
      {!mapReady && !mapError && (
        <div className="map-skeleton" aria-live="polite">
          <div className="skeleton-block" />
          <p>Loading CONUS OpenTopo...</p>
        </div>
      )}
      {mapError && (
        <div className="map-empty" role="status">
          <strong>Map tiles unavailable</strong>
          <p>{mapError}</p>
        </div>
      )}
    </div>
  )
}
