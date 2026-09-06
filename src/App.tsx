import { useCallback, useMemo, useState } from "react"
import { MapView } from "./components/MapView"
import { LayerPanel } from "./components/LayerPanel"
import { SiteBriefPanel } from "./components/SiteBriefPanel"
import { Attribution } from "./components/Attribution"
import { buildSiteBrief, type SiteBrief } from "./lib/siteBrief"
import { DEFAULT_RADIUS_MI, type LayerKey } from "./lib/sources"

const INITIAL_LAYERS: Record<LayerKey, boolean> = {
  topo: true,
  orphaned: false,
  nmWells: false,
  coWells: false,
  transmission: true,
  substations: true,
  flood: false,
}

export default function App() {
  const [layers, setLayers] = useState(INITIAL_LAYERS)
  const [radiusMi, setRadiusMi] = useState(DEFAULT_RADIUS_MI)
  const [pin, setPin] = useState<{ lon: number; lat: number } | null>(null)
  const [brief, setBrief] = useState<SiteBrief | null>(null)
  const [loading, setLoading] = useState(false)

  const onToggle = useCallback((key: LayerKey) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const onPin = useCallback(async (lon: number, lat: number) => {
    setPin({ lon, lat })
    setLoading(true)
    setBrief(null)
    try {
      const next = await buildSiteBrief(lon, lat, radiusMi)
      setBrief(next)
    } catch (e) {
      setBrief({
        lon, lat, radiusMi,
        elevationFt: null,
        slopeNote: "UNKNOWN",
        wells: { orphaned: null, nmOcd: null, coOgcc: null },
        power: { nearestSubMi: null, nearestSubName: null, nearestLineMi: null, nearestLineKv: null },
        flood: { flag: "UNKNOWN", zones: [] },
        fiberNote: "UNKNOWN",
        unknowns: ["Site brief failed to load"],
        errors: [e instanceof Error ? e.message : "Brief failed"],
      })
    } finally {
      setLoading(false)
    }
  }, [radiusMi])

  const subtitle = useMemo(() => "Click-to-pin DC site screening for the Southwest corridor", [])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand">Fluidstack AI</div>
          <h1>DC Site Fit</h1>
          <p>{subtitle}</p>
        </div>
        <div className="topbar-badge">Production screen · free public layers</div>
      </header>
      <div className="workspace">
        <LayerPanel layers={layers} onToggle={onToggle} radiusMi={radiusMi} onRadius={setRadiusMi} />
        <main className="map-stage">
          <MapView layers={layers} pin={pin} onPin={onPin} radiusMi={radiusMi} />
        </main>
        <SiteBriefPanel brief={brief} loading={loading} onClose={() => { setBrief(null); setPin(null) }} />
      </div>
      <Attribution />
    </div>
  )
}
