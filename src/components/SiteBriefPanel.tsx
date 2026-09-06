import type { SiteBrief } from "../lib/siteBrief"
import { formatMiles } from "../lib/geo"

type Props = {
  brief: SiteBrief | null
  loading: boolean
  onClose: () => void
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="brief-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function n(v: number | null): string {
  return v == null ? "UNKNOWN" : String(v)
}

export function SiteBriefPanel({ brief, loading, onClose }: Props) {
  return (
    <aside className={`panel brief-panel ${brief || loading ? "open" : ""}`}>
      <header className="panel-head">
        <div className="eyebrow">Site Brief</div>
        <div className="brief-title-row">
          <h2>Pinned screen</h2>
          <button type="button" className="ghost" onClick={onClose} aria-label="Close brief">Close</button>
        </div>
      </header>
      {loading && <div className="loading">Querying confirmed public GIS sources...</div>}
      {!loading && !brief && <p className="muted">Click the map to generate a brief.</p>}
      {brief && !loading && (
        <div className="brief-body">
          <Row label="Coordinates" value={`${brief.lat.toFixed(5)}, ${brief.lon.toFixed(5)}`} />
          <Row label="Radius R" value={`${brief.radiusMi} mi`} />
          <Row label="Elevation" value={brief.elevationFt == null ? "UNKNOWN" : `${Math.round(brief.elevationFt).toLocaleString()} ft`} />
          <Row label="Slope note" value={brief.slopeNote} />

          <div className="section-label">Abandoned wells @ R</div>
          <Row label="NETL orphaned L113" value={n(brief.wells.orphaned)} />

          <div className="section-label">Operating / status wells @ R</div>
          <Row label="NETL Active (status_category)" value={n(brief.wells.operatingActive)} />
          <Row label="NETL integrated all statuses" value={n(brief.wells.operatingAll)} />
          <Row label="NM OCD Active" value={n(brief.wells.nmActive)} />
          <Row label="NM OCD all statuses" value={n(brief.wells.nmAll)} />
          <Row label="CO OGCC Facil_Stat PR" value={n(brief.wells.coPr)} />
          <Row label="CO OGCC all statuses" value={n(brief.wells.coAll)} />

          <div className="section-label">Power (optional HIFLD)</div>
          <Row label="Nearest substation" value={formatMiles(brief.power.nearestSubMi)} />
          <Row label="Substation name" value={brief.power.nearestSubName || "UNKNOWN"} />
          <Row label="Nearest transmission" value={formatMiles(brief.power.nearestLineMi)} />
          <Row label="Line kV if present" value={brief.power.nearestLineKv == null ? "UNKNOWN" : String(brief.power.nearestLineKv)} />

          <div className="section-label">Flood</div>
          <Row label="FEMA flood flag" value={brief.flood.flag} />
          <Row label="Flood zones" value={brief.flood.zones.length ? brief.flood.zones.join("; ") : "none returned"} />

          <div className="section-label">Always UNKNOWN</div>
          <ul className="unknown-list">
            {brief.unknowns.map((u) => <li key={u}>{u}</li>)}
          </ul>
          {brief.errors.length > 0 && (
            <>
              <div className="section-label">Source errors / CORS</div>
              <ul className="error-list">{brief.errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </>
          )}
        </div>
      )}
    </aside>
  )
}
