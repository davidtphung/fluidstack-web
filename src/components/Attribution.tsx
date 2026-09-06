import { ATTRIBUTION_LINES } from "../lib/sources"

export function Attribution() {
  return (
    <footer className="attr-footer">
      <strong>NLT143 RESEARCH by David T Phung</strong>
      <span>Leave-behind for Fluidstack / Nick Caceras. Not an official Fluidstack product.</span>
      <span>Data: {ATTRIBUTION_LINES.join(" · ")}</span>
      <span>Screening only. Never invents wells, owners, prices, MW, or comps. Unknowns stay UNKNOWN.</span>
    </footer>
  )
}
