import { useCallback, useMemo, useState } from "react"
import { MapView, type LayerHealth } from "./components/MapView"
import { LayerPanel } from "./components/LayerPanel"
import { SiteBriefPanel } from "./components/SiteBriefPanel"
import { Attribution } from "./components/Attribution"
import { buildSiteBrief, type SiteBrief } from "./lib/siteBrief"
import { CONUS_CENTER, DEFAULT_RADIUS_MI, SW_TEST_AOI, type LayerKey } from "./lib/sources"

const INITIAL_LAYERS: Record<LayerKey, boolean> = {
  topo: true,
  orphaned: true,
  operating: true,
  nmWells: false,
  coWells: false,
  transmission: false,
  substations: false,
  flood: false,
}

const INITIAL_HEALTH = Object.fromEntries(
  (Object.keys(INITIAL_LAYERS) as LayerKey[]).map((k) => [k, { state: "idle" as const }]),
) as LayerHealth

function emptyBrief(lon: number, lat: number, radiusMi: number, message: string): SiteBrief {
  return {
    lon, lat, radiusMi,
    elevationFt: null,
    slopeNote: "UNKNOWN",
    wells: {
      orphaned: null,
      operatingActive: null,
      operatingAll: null,
      nmActive: null,
      nmAll: null,
      coPr: null,
      coAll: null,
    },
    power: { nearestSubMi: null, nearestSubName: null, nearestLineMi: null, nearestLineKv: null },
    flood: { flag: "UNKNOWN", zones: [] },
    unknowns: [
      "MW headroom / interconnection capacity",
      "Fiber routes and carrier identity",
      "Title, easements, zoning, and politics",
      "Dollar walk-away / land economics",
      "Site brief failed to load",
    ],
    errors: [message],
  }
}

export default function App() {
  const [layers, setLayers] = useState(INITIAL_LAYERS)
  const [radiusMi, setRadiusMi] = useState(DEFAULT_RADIUS_MI)
  const [pin, setPin] = useState<{ lon: number; lat: number } | null>(null)
  const [brief, setBrief] = useState<SiteBrief | null>(null)
  const [loading, setLoading] = useState(false)
  const [health, setHealth] = useState<LayerHealth>(INITIAL_HEALTH)
  const [flyTo, setFlyTo] = useState<{ lon: number; lat: number; zoom: number } | null>(null)
  const [layersOpen, setLayersOpen] = useState(false)

  const briefOpen = Boolean(brief || loading)

  const onToggle = useCallback((key: LayerKey) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const onHealth = useCallback((key: LayerKey, next: LayerHealth[LayerKey]) => {
    setHealth((prev) => (prev[key]?.detail === next.detail && prev[key]?.state === next.state ? prev : { ...prev, [key]: next }))
  }, [])

  const onPin = useCallback(async (lon: number, lat: number) => {
    setPin({ lon, lat })
    setLoading(true)
    setBrief(null)
    setLayersOpen(false)
    try {
      setBrief(await buildSiteBrief(lon, lat, radiusMi))
    } catch (e) {
      setBrief(emptyBrief(lon, lat, radiusMi, e instanceof Error ? e.message : "Brief failed"))
    } finally {
      setLoading(false)
    }
  }, [radiusMi])

  const onJumpUsa = useCallback(() => {
    setFlyTo({ lon: CONUS_CENTER.lon, lat: CONUS_CENTER.lat, zoom: CONUS_CENTER.zoom })
    setLayersOpen(false)
  }, [])

  const onJumpPermian = useCallback(() => {
    setFlyTo({ lon: SW_TEST_AOI.lon, lat: SW_TEST_AOI.lat, zoom: SW_TEST_AOI.zoom })
    setLayersOpen(false)
  }, [])

  const onCloseBrief = useCallback(() => {
    setBrief(null)
    setPin(null)
  }, [])

  const subtitle = useMemo(
    () => "Interactive USA topo plus gas wells for test-fit screening. Tap the map to pin.",
    [],
  )

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand">NLT143 RESEARCH by David T Phung</div>
          <h1>Site Fit</h1>
          <p>{subtitle}</p>
        </div>
        <div className="topbar-badge">Leave-behind for Fluidstack / Nick · not official Fluidstack</div>
      </header>
      <div className="workspace">
        <button
          type="button"
          className="layers-fab"
          onClick={() => setLayersOpen(true)}
          aria-expanded={layersOpen}
          aria-controls="layer-panel"
        >
          Layers
        </button>
        <div
          className={`sheet-backdrop ${layersOpen ? "show" : ""}`}
          onClick={() => setLayersOpen(false)}
          hidden={!layersOpen}
        />
        <LayerPanel
          open={layersOpen}
          onClose={() => setLayersOpen(false)}
          layers={layers}
          onToggle={onToggle}
          radiusMi={radiusMi}
          onRadius={setRadiusMi}
          health={health}
          onJumpUsa={onJumpUsa}
          onJumpPermian={onJumpPermian}
        />
        <main className="map-stage">
          <MapView
            layers={layers}
            pin={pin}
            onPin={onPin}
            radiusMi={radiusMi}
            onHealth={onHealth}
            flyTo={flyTo}
          />
        </main>
        <div
          className={`sheet-backdrop brief-backdrop ${briefOpen ? "show" : ""}`}
          onClick={onCloseBrief}
          hidden={!briefOpen}
        />
        <SiteBriefPanel brief={brief} loading={loading} onClose={onCloseBrief} />
      </div>
      <Attribution />
    </div>
  )
}
