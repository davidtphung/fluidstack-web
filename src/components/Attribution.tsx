import { ATTRIBUTION_LINES } from "../lib/sources"

export function Attribution() {
  return (
    <footer className="attr-footer">
      <strong>Fluidstack AI DC Site Fit</strong>
      <span>Data: {ATTRIBUTION_LINES.join(" · ")}</span>
      <span>Screening only. Never invents wells, owners, or prices. Unknowns stay unknown.</span>
    </footer>
  )
}
