export const DEFAULT_RADIUS_MI = 2

export const LAYER_IDS = {
  topo: "topo-hillshade",
  orphaned: "netl-orphaned",
  nmWells: "nm-ocd-wells",
  coWells: "co-ogcc-wells",
  transmission: "hifld-tx",
  substations: "hifld-subs",
  flood: "fema-flood",
} as const

export type LayerKey = keyof typeof LAYER_IDS

export const ENDPOINTS = {
  epqs: "https://epqs.nationalmap.gov/v1/json",
  netlOrphaned:
    "https://arcgis.netl.doe.gov/server/rest/services/Hosted/Orphaned_Wells_v2/FeatureServer/113/query",
  nmOcd:
    "https://services5.arcgis.com/f4lpEvI6fkgVYigk/ArcGIS/rest/services/New_Mexico_Oil_and_Gas_Wells__Nov2024/FeatureServer/30/query",
  coOgcc:
    "https://data.dnrgis.state.co.us/arcgis/rest/services/DNR_Public/OGCC_Wells/FeatureServer/0/query",
  hifldTx:
    "https://services2.arcgis.com/LYMgRMwHfrWWEg3s/arcgis/rest/services/HIFLD_US_Electric_Power_Transmission_Lines/FeatureServer/0/query",
  hifldSubs:
    "https://services.arcgis.com/njFNhDsUCentVYJW/ArcGIS/rest/services/Substations/FeatureServer/0/query",
  femaFlood:
    "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query",
  fccBdc:
    "https://geo.fcc.gov/api/census/area",
} as const

export const OPEN_TOPO_TILES = [
  "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
  "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
  "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
]

export const ALWAYS_UNKNOWN = [
  "MW headroom / interconnection capacity",
  "Fiber routes and carrier identity",
  "Title, easements, zoning, and politics",
  "Dollar walk-away / land economics",
  "WHP wildfire hazard (not wired; upstream HTTP 403)",
] as const

export const ATTRIBUTION_LINES = [
  "USGS EPQS elevation",
  "OpenTopoMap (OSM / SRTM hillshade style)",
  "NETL Orphaned Wells (L113)",
  "NM OCD wells (L30)",
  "CO OGCC wells (L0)",
  "HIFLD transmission + substations",
  "FEMA NFHL flood hazard zones",
  "FCC broadband context (best effort)",
]
