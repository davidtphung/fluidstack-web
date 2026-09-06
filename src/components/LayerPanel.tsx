import type { LayerKey } from "../lib/sources"
import { SW_TEST_AOI, USA_OVERVIEW } from "../lib/sources"
import type { LayerHealth } from "./MapView"

const GROUPS: { title: string; keys: LayerKey[] }[] = [
  { title: "Terrain", keys: ["topo"] },
  { title: "Wells", keys: ["orphaned", "operating", "nmWells", "coWells"] },
  { title: "Grid / electric", keys: ["transmission", "substations"] },
  { title: "Broadband / fiber availability", keys: ["broadband"] },
  { title: "Hazards", keys: ["flood"] },
]

const LABELS: Record<LayerKey, string> = {
  topo: "USA topography (OpenTopoMap)",
  orphaned: "Abandoned: NETL orphaned",
  operating: "Operating: NETL Active",
  nmWells: "NM OCD Active (state depth)",
  coWells: "CO OGCC PR (state depth)",
  transmission: "Grid: US electric transmission (HIFLD)",
  substations: "Grid: substations (HIFLD)",
  broadband: "FCC BDC Dec 2024 availability (not as-built fiber)",
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
            <h2>Siteline screening</h2>
          </div>
          <button type="button" className="ghost sheet-close" onClick={onClose} aria-label="Close layers">
            Close
          </button>
        </div>
        <p className="muted">
          Topo, wells, HIFLD grid, and FCC broadband availability. Free public sources.
          Screening-grade, not survey-grade. Fiber layer is availability, not conduit routes.
        </p>
      </header>
      <div className="jump-row">
        <button type="button" className="jump" onClick={onJumpUsa}>
          {USA_OVERVIEW.label}
        </button>
        <button type="button" className="jump" onClick={onJumpPermian}>
          Jump {SW_TEST_AOI.label}
        </button>
      </div>
      <div className="layer-list">
        {GROUPS.map((group) => (
          <div key={group.title} className="layer-group">
            <div className="section-label">{group.title}</div>
            {group.keys.map((key) => {
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
                  {layers[key] && health[key]?.state === "idle" && health[key]?.detail && (
                    <span className="layer-hint">{health[key]?.detail}</span>
                  )}
                </label>
              )
            })}
          </div>
        ))}
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
        Click the map to pin a Site Brief. Counts never invent wells, owners, MW, or prices.
        If a host blocks CORS, that layer shows CORS / UNKNOWN and the rest keep working.
      </p>
    </aside>
  )
}
