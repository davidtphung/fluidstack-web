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
      {loading && <div className="loading">Querying free public GIS sources...</div>}
      {!loading && !brief && <p className="muted">Click the map to generate a brief.</p>}
      {brief && !loading && (
        <div className="brief-body">
          <Row label="Coordinates" value={`${brief.lat.toFixed(5)}, ${brief.lon.toFixed(5)}`} />
          <Row label={`Wells radius R`} value={`${brief.radiusMi} mi`} />
          <Row label="Elevation" value={brief.elevationFt == null ? "UNKNOWN" : `${Math.round(brief.elevationFt).toLocaleString()} ft`} />
          <Row label="Slope note" value={brief.slopeNote} />
          <div className="section-label">Wells @ R</div>
          <Row label="NETL orphaned" value={brief.wells.orphaned == null ? "UNKNOWN" : String(brief.wells.orphaned)} />
          <Row label="NM OCD" value={brief.wells.nmOcd == null ? "UNKNOWN" : String(brief.wells.nmOcd)} />
          <Row label="CO OGCC" value={brief.wells.coOgcc == null ? "UNKNOWN" : String(brief.wells.coOgcc)} />
          <div className="section-label">Power</div>
          <Row label="Nearest substation" value={formatMiles(brief.power.nearestSubMi)} />
          <Row label="Substation name" value={brief.power.nearestSubName || "UNKNOWN"} />
          <Row label="Nearest transmission" value={formatMiles(brief.power.nearestLineMi)} />
          <Row label="Line kV (if present)" value={brief.power.nearestLineKv == null ? "UNKNOWN" : String(brief.power.nearestLineKv)} />
          <div className="section-label">Flood / fiber / wildfire</div>
          <Row label="FEMA flood flag" value={brief.flood.flag} />
          <Row label="Flood zones" value={brief.flood.zones.length ? brief.flood.zones.join("; ") : "none returned"} />
          <Row label="Fiber" value={brief.fiberNote} />
          <Row label="WHP wildfire" value="UNKNOWN" />
          <div className="section-label">Always UNKNOWN</div>
          <ul className="unknown-list">
            {brief.unknowns.map((u) => <li key={u}>{u}</li>)}
          </ul>
          {brief.errors.length > 0 && (
            <>
              <div className="section-label">Source errors</div>
              <ul className="error-list">{brief.errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </>
          )}
        </div>
      )}
    </aside>
  )
}
