import type { LayerKey } from "../lib/sources"

const LABELS: Record<LayerKey, string> = {
  topo: "OpenTopo / hillshade",
  orphaned: "NETL orphaned wells",
  nmWells: "NM OCD wells",
  coWells: "CO OGCC wells",
  transmission: "HIFLD transmission",
  substations: "HIFLD substations",
  flood: "FEMA flood zones",
}

type Props = {
  layers: Record<LayerKey, boolean>
  onToggle: (key: LayerKey) => void
  radiusMi: number
  onRadius: (n: number) => void
}

export function LayerPanel({ layers, onToggle, radiusMi, onRadius }: Props) {
  return (
    <aside className="panel layer-panel">
      <header className="panel-head">
        <div className="eyebrow">Layers</div>
        <h2>Site screen</h2>
        <p className="muted">Toggle free public layers. Counts never invent wells or owners.</p>
      </header>
      <div className="layer-list">
        {(Object.keys(LABELS) as LayerKey[]).map((key) => (
          <label key={key} className="layer-row">
            <input type="checkbox" checked={layers[key]} onChange={() => onToggle(key)} />
            <span>{LABELS[key]}</span>
          </label>
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
      <p className="hint">Click the map to drop a pin and open the Site Brief.</p>
    </aside>
  )
}
