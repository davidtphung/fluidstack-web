import type { LayerKey } from "../lib/sources"
import { CONUS_CENTER, SW_TEST_AOI } from "../lib/sources"
import type { LayerHealth } from "./MapView"

const LABELS: Record<LayerKey, string> = {
  topo: "USA topography (OpenTopoMap)",
  orphaned: "Abandoned: NETL orphaned",
  operating: "Operating: NETL Active",
  nmWells: "NM OCD Active (state depth)",
  coWells: "CO OGCC PR (state depth)",
  transmission: "HIFLD transmission",
  substations: "HIFLD substations",
  flood: "FEMA flood zones",
}

type Props = {
  open: boolean
  onClose: () => void
  layers: Record<LayerKey, boolean>
  onToggle: (key: LayerKey) => void
  radiusMi: number
  onRadius: (n: number) => void
  health: LayerHealth
  onJumpUsa: () => void
  onJumpPermian: () => void
}

function healthMark(h: LayerHealth[LayerKey] | undefined): string {
  if (!h || h.state === "idle") return ""
  if (h.state === "ok") return "OK"
  if (h.state === "empty") return "0"
  if (h.state === "blocked") return "CORS"
  return "ERR"
}

export function LayerPanel({
  open,
  onClose,
  layers,
  onToggle,
  radiusMi,
  onRadius,
  health,
  onJumpUsa,
  onJumpPermian,
}: Props) {
  return (
    <aside id="layer-panel" className={`panel layer-panel ${open ? "open" : ""}`}>
      <header className="panel-head">
        <div className="sheet-grab" aria-hidden="true" />
        <div className="brief-title-row">
          <div>
            <div className="eyebrow">Layers</div>
            <h2>Nick pain point</h2>
          </div>
          <button type="button" className="ghost sheet-close" onClick={onClose} aria-label="Close layers">
            Close
          </button>
        </div>
        <p className="muted">GIS topo plus operating and abandoned wells. Free API access. Screening-grade, not survey-grade.</p>
      </header>
      <div className="jump-row">
        <button type="button" className="jump" onClick={onJumpUsa}>
          {CONUS_CENTER.label}
        </button>
        <button type="button" className="jump" onClick={onJumpPermian}>
          Jump {SW_TEST_AOI.label}
        </button>
      </div>
      <div className="layer-list">
        {(Object.keys(LABELS) as LayerKey[]).map((key) => {
          const mark = healthMark(health[key])
          const failed = health[key]?.state === "blocked" || health[key]?.state === "error"
          return (
            <label key={key} className={`layer-row ${failed && layers[key] ? "layer-row-fail" : ""}`}>
              <input type="checkbox" checked={layers[key]} onChange={() => onToggle(key)} />
              <span className="layer-name">{LABELS[key]}</span>
              {layers[key] && mark && (
                <em className={`health health-${health[key]?.state || "idle"}`} title={health[key]?.detail}>
                  {mark}
                </em>
              )}
              {layers[key] && failed && (
                <span className="layer-empty">{health[key]?.detail || "Layer failed"}</span>
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
