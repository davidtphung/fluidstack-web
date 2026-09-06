import type { LayerKey } from "../lib/sources"
import { SW_TEST_AOI } from "../lib/sources"
import type { LayerHealth } from "./MapView"

const LABELS: Record<LayerKey, string> = {
  topo: "OpenTopo hillshade",
  orphaned: "Abandoned: NETL orphaned",
  operating: "Operating: NETL Active",
  nmWells: "NM OCD Active (state depth)",
  coWells: "CO OGCC PR (state depth)",
  transmission: "HIFLD transmission",
  substations: "HIFLD substations",
  flood: "FEMA flood zones",
}

type Props = {
  layers: Record<LayerKey, boolean>
  onToggle: (key: LayerKey) => void
  radiusMi: number
  onRadius: (n: number) => void
  health: LayerHealth
  onJumpPermian: () => void
}

function healthMark(h: LayerHealth[LayerKey] | undefined): string {
  if (!h || h.state === "idle") return ""
  if (h.state === "ok") return "OK"
  if (h.state === "empty") return "0"
  if (h.state === "blocked") return "CORS"
  return "ERR"
}

export function LayerPanel({ layers, onToggle, radiusMi, onRadius, health, onJumpPermian }: Props) {
  return (
    <aside className="panel layer-panel">
      <header className="panel-head">
        <div className="eyebrow">Layers</div>
        <h2>Nick pain point</h2>
        <p className="muted">GIS topo plus operating and abandoned wells. Free API access. Screening-grade, not survey-grade.</p>
      </header>
      <button type="button" className="jump" onClick={onJumpPermian}>
        Jump to {SW_TEST_AOI.label}
      </button>
      <div className="layer-list">
        {(Object.keys(LABELS) as LayerKey[]).map((key) => {
          const mark = healthMark(health[key])
          return (
            <label key={key} className="layer-row">
              <input type="checkbox" checked={layers[key]} onChange={() => onToggle(key)} />
              <span className="layer-name">{LABELS[key]}</span>
              {layers[key] && mark && (
                <em className={`health health-${health[key]?.state || "idle"}`} title={health[key]?.detail}>
                  {mark}
                </em>
              )}
            </label>
          )
        })}
      </div>
      <label className="radius-row">
        <span>Brief radius R</span>
        <div className="radius-controls">
          <input
            type="range"
            min={0.5}
            max={10}
            step={0.5}
            value={radiusMi}
            onChange={(e) => onRadius(parseFloat(e.target.value))}
          />
          <strong>{radiusMi.toFixed(1)} mi</strong>
        </div>
      </label>
      <p className="hint">
        Click the map to pin a Site Brief. Counts never invent wells or owners.
        If a host blocks CORS, that layer shows CORS / UNKNOWN and the rest keep working.
      </p>
    </aside>
  )
}
