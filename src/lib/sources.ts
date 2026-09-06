export const DEFAULT_RADIUS_MI = 2

export const USA_OVERVIEW = {
  lon: -98.5,
  lat: 39.5,
  zoom: 3.8,
  label: "USA overview",
} as const

export const CONUS_CENTER: [number, number] = [USA_OVERVIEW.lon, USA_OVERVIEW.lat]
export const CONUS_ZOOM = USA_OVERVIEW.zoom

export const SW_TEST_AOI = {
  lon: -103.7,
  lat: 32.4,
  zoom: 9,
  label: "Permian / SE NM test AOI",
} as const

export const PERMIAN_CENTER: [number, number] = [SW_TEST_AOI.lon, SW_TEST_AOI.lat]
export const PERMIAN_ZOOM = SW_TEST_AOI.zoom

export const LAYER_IDS = {
  topo: "topo-hillshade",
  orphaned: "netl-orphaned",
  operating: "netl-operating",
  nmWells: "nm-ocd-wells",
  coWells: "co-ogcc-wells",
  transmission: "hifld-tx",
  substations: "hifld-subs",
  broadband: "fcc-bdc",
  flood: "fema-flood",
} as const

export const FALLBACK_LAYER_IDS = {
  osm: "osm-base",
  esriTopo: "esri-usa-topo",
} as const

export type LayerKey = keyof typeof LAYER_IDS

export const FCC_BDC_SERVICE =
  "https://services8.arcgis.com/peDZJliSvYims39Q/arcgis/rest/services/FCC_Broadband_Data_Collection_December_2024_View/FeatureServer"

/** Geometry layers 0-5. Related BDC record tables 6-11. Service maxRecordCount is often 50. */
export const FCC_BDC_LAYERS = {
  states: 0,
  counties: 1,
  tracts: 2,
  blockGroups: 3,
  blocks: 4,
  h3: 5,
} as const

export const FCC_BDC_TABLES = {
  h3: 6,
  blocks: 7,
  blockGroups: 8,
  tracts: 9,
  counties: 10,
  states: 11,
} as const

export const FCC_TECH_FIBER = 50
export const FCC_PAGE_SIZE = 50
export const FCC_MAX_FEATURES = 400

export const ENDPOINTS = {
  epqs: "https://epqs.nationalmap.gov/v1/json",
  netlOrphaned:
    "https://arcgis.netl.doe.gov/server/rest/services/Hosted/Orphaned_Wells_v2/FeatureServer/113/query",
  netlOperating:
    "https://arcgis.netl.doe.gov/server/rest/services/Hosted/Integrated_Public_Wells_AugEY25/FeatureServer/0/query",
  nmOcd:
    "https://services5.arcgis.com/f4lpEvI6fkgVYigk/ArcGIS/rest/services/New_Mexico_Oil_and_Gas_Wells__Nov2024/FeatureServer/30/query",
  coOgcc:
    "https://data.dnrgis.state.co.us/arcgis/rest/services/DNR_Public/OGCC_Wells/FeatureServer/0/query",
  hifldTx:
    "https://services2.arcgis.com/LYMgRMwHfrWWEg3s/arcgis/rest/services/HIFLD_US_Electric_Power_Transmission_Lines/FeatureServer/0/query",
  hifldSubs:
    "https://services.arcgis.com/njFNhDsUCentVYJW/ArcGIS/rest/services/Substations/FeatureServer/0/query",
  fccBdc: `${FCC_BDC_SERVICE}`,
  fccBdcH3: `${FCC_BDC_SERVICE}/${FCC_BDC_LAYERS.h3}/query`,
  fccBdcCounties: `${FCC_BDC_SERVICE}/${FCC_BDC_LAYERS.counties}/query`,
  fccBdcTracts: `${FCC_BDC_SERVICE}/${FCC_BDC_LAYERS.tracts}/query`,
  fccBdcBlockGroups: `${FCC_BDC_SERVICE}/${FCC_BDC_LAYERS.blockGroups}/query`,
  fccBdcH3Records: `${FCC_BDC_SERVICE}/${FCC_BDC_TABLES.h3}/query`,
  femaFlood:
    "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query",
} as const

export const OPEN_TOPO_TILES = [
  "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
  "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
  "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
]

/** USGS National Map topo. XYZ is z/y/x. Fills under OpenTopo at CONUS zooms. */
export const USGS_TOPO_TILES = [
  "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}",
]

/** Esri World Topo: USA coverage at CONUS overview zooms. XYZ is z/y/x. */
export const ESRI_USA_TOPO_TILES = [
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
]

export const ESRI_WORLD_TOPO_TILES = ESRI_USA_TOPO_TILES

export const OSM_STREET_TILES = [
  "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
  "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
  "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
]

/** Skip heavy ArcGIS feature queries until the camera is close enough. Topo tiles always load. */
export const HEAVY_LAYER_MIN_ZOOM: Partial<Record<LayerKey, number>> = {
  orphaned: 6,
  operating: 6,
  nmWells: 6,
  coWells: 6,
  transmission: 3,
  substations: 6,
  broadband: 7,
  flood: 8,
}

export function fccQueryForZoom(zoom: number): { url: string; label: string } {
  if (zoom < 8) return { url: ENDPOINTS.fccBdcCounties, label: "FCC BDC counties" }
  if (zoom < 10) return { url: ENDPOINTS.fccBdcTracts, label: "FCC BDC tracts" }
  if (zoom < 11.5) return { url: ENDPOINTS.fccBdcBlockGroups, label: "FCC BDC block groups" }
  return { url: ENDPOINTS.fccBdcH3, label: "FCC BDC H3 res 8" }
}

/** NETL status_category values are messy pipe lists. Active is the operating token we can filter. */
export const NETL_ACTIVE_WHERE = "status_category LIKE '%Active%'"
export const NM_ACTIVE_WHERE = "status = 'Active'"
export const CO_PR_WHERE = "Facil_Stat = 'PR'"

export const ALWAYS_UNKNOWN = [
  "MW headroom / interconnection capacity",
  "As-built fiber plant / conduit routes (FCC BDC is availability only)",
  "Title, easements, zoning, and politics",
  "Dollar walk-away / land economics",
  "WHP wildfire hazard (not wired; stays UNKNOWN)",
] as const

export const ATTRIBUTION_LINES = [
  "USGS EPQS elevation",
  "OpenTopoMap (OSM / SRTM hillshade style)",
  "USGS National Map topo fallback",
  "Esri World Topo fallback (USA coverage)",
  "NETL Orphaned Wells v2 (layer 113)",
  "NETL Integrated Public Wells AugEY25 (layer 0)",
  "NM OCD wells (layer 30)",
  "CO OGCC wells (layer 0)",
  "HIFLD US Electric Power Transmission Lines",
  "HIFLD substations",
  "FCC Broadband Data Collection Dec 2024 (availability, not as-built fiber)",
  "FEMA NFHL flood hazard zones",
]

export const LIVE_URLS = [
  "https://siteline-live.vercel.app/",
]

export const BUILDER_URL = "https://x.com/davidtphung"
export const BUILDER_LABEL = "Built by David T Phung"
