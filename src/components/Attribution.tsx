import { ATTRIBUTION_LINES, BUILDER_LABEL, BUILDER_URL } from "../lib/sources"

export function Attribution() {
  return (
    <footer className="attr-footer">
      <div className="attr-brand-row">
        <strong>Siteline · NLT143 RESEARCH</strong>
        <a
          className="builder-link"
          href={BUILDER_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          {BUILDER_LABEL}
        </a>
      </div>
      <span>Data: {ATTRIBUTION_LINES.join(" · ")}</span>
      <span>Screening only. Never invents wells, owners, MW, or prices. Unknowns stay unknown.</span>
    </footer>
  )
}
