export type DataProvenance = 
  | 'OBSERVED' 
  | 'DERIVED' 
  | 'MODELLED' 
  | 'INTERPOLATED' 
  | 'SIMULATED' 
  | 'ASSUMED' 
  | 'UNAVAILABLE';

export interface ReservoirOrigin {
  x: number; // UTM Easting (EPSG:32643)
  y: number; // UTM Northing (EPSG:32643)
  lon: number;
  lat: number;
  crs: string;
}

export interface TankBoundary {
  area_m2: number;
  area_ha: number;
  perimeter_m: number;
  bounds_32643?: [number, number, number, number] | number[];
  bounds_32642?: [number, number, number, number] | number[];
  coords_wgs84: [number, number][];
  coords_local: [number, number][];
}

export interface DamGeometry {
  name: string;
  type: string;
  topOfDam_m: number;
  crestLength_m: number;
  calculatedCrestLength_m: number;
  crestWidth_m: number;
  structuralHeight_m: number;
  deepestBedLevel_m: number;
  spillwayCrest_m: number;
  spillwayType: string;
  maxHeadOverSpillway_m: number;
  maxWaterLevel_m: number;
  fullReservoirLevel_m: number;
  minDrawdownLevel_m: number;
  northAbutmentLocal: [number, number];
  southAbutmentLocal: [number, number];
  upstreamSlope: number;
  downstreamSlope: number;
  status: string;
}

export interface LiveTelemetry {
  damId: string;
  reportedLevel_m: number;
  reportedStorage_Hamts: number;
  reportedStorage_MCM: number;
  deadLevel_m: number;
  fullLevel_m: number;
  maxStorage_Hamts: number;
  discharge_cumecs: number;
  lastObservation: string;
  source: string;
  status: string;
  fetchTimestamp: string;
}

export interface DEMCell {
  row: number;
  col: number;
  x: number;
  y: number;
  localX: number;
  localZ: number;
  elevation: number | null;
  rawFabdemElevation?: number | null;
  f30Elevation?: number | null;
  isValid: boolean;
  inTank: boolean;
}

export type DtmSurfaceMode = 'bathymetric' | 'f30_dtm' | 'raw_fabdem';

export interface DEMSummary {
  width: number;
  height: number;
  crs: string;
  bounds: { left: number; bottom: number; right: number; top: number };
  dx: number;
  dy: number;
  nodata: number;
  totalCells: number;
  validCells: number;
  nodataCells: number;
  minElevation: number;
  maxElevation: number;
  meanElevation: number;
  medianElevation: number;
  rawDemValidCells: number;
  rawDemTotalCells: number;
  contourLevels: number;
  sourceDtm?: string;
  f30Summary?: {
    source: string;
    validPoints: number;
    minElevation: number;
    maxElevation: number;
    originalCrs: string;
    projectedCrs: string;
    datumNote: string;
  };
}

export interface MeshData {
  vertices: number[];
  colors: number[];
  indices: number[];
}

export interface ContourSegment {
  wgs84: [number, number][];
  proj: [number, number][];
  local: [number, number][];
  isClosed: boolean;
  lengthM: number;
}

export interface ContourLineData {
  elevation: number;
  fid?: string;
  segments: ContourSegment[];
}

export interface StoragePoint {
  elevation: number;
  submergedCells: number;
  area_m2: number;
  area_ha: number;
  volume_m3: number;
  volume_mcm: number;
}

export interface BaselineSpecs {
  reservoirName: string;
  location: string;
  river?: string;
  catchmentArea_km2: number;
  meanAnnualRainfall_mm?: number;
  designFlood_cumecs?: number;
  grossStorage_MCM: number;
  grossStorage_Hamts: number;
  liveStorage_MCM: number;
  liveStorage_Hamts: number;
  deadStorage_MCM: number;
  deadStorage_Hamts: number;
  frl_m: number;
  mddl_m: number;
  mwl_m?: number;
  topOfDam_m?: number;
  damLength_m?: number;
  damHeight_m?: number;
  deepestBedLevel_m?: number;
  spillwayType?: string;
  spillwayCrest_m?: number;
  maxHeadOverSpillway_m?: number;
  submergenceArea_ha?: number;
  waterSupplyComponent_MLD?: number;
  canalDischarge_cumecs?: number;
  canalLength_km?: number;
  culturableCommandArea_ha?: number;
  sourceAttribution: string;
  liveMonitoringUrl?: string;
}

export interface ChapoliData {
  origin: ReservoirOrigin;
  tank: TankBoundary;
  dam_geometry?: DamGeometry;
  dem: DEMSummary;
  dem_grid: (number | null)[][];
  raw_fabdem_grid?: (number | null)[][];
  cells: DEMCell[];
  mesh_data: MeshData;
  raw_mesh_data?: MeshData;
  f30_mesh_data?: MeshData;
  contours: ContourLineData[];
  storage_curve: StoragePoint[];
  baseline_specs: BaselineSpecs;
  live_telemetry?: LiveTelemetry;
}

export interface InspectionResult {
  x: number;
  z: number;
  easting: number;
  northing: number;
  lon: number;
  lat: number;
  elevation: number | null;
  waterLevel: number;
  waterDepth: number | null;
  originalBedElev: number | null;
  sedimentThickness: number | null;
  inTank: boolean;
  provenance: DataProvenance;
  qualityNote: string;
  siltClass?: string;
  siltClassColor?: string;
  siltVolumeScore?: number;
  siltThicknessM?: number;
  siltMonthName?: string;
}

export interface CrossSectionPoint {
  distanceM: number;
  originalBed: number | null;
  presentBed: number | null;
  waterSurface: number;
  sedimentThickness: number | null;
  isSurveyed: boolean;
}

export interface SedimentVolumeStats {
  surveyedAreaM2: number;
  surveyedAreaHa: number;
  volumeM3: number;
  volumeMCM: number;
  meanThicknessM: number;
  maxThicknessM: number;
  coveragePercent: number;
  capacityLossPercent: number;
  provenance: DataProvenance;
}

export interface ImportedSurvey {
  id: string;
  name: string;
  surveyDate: string;
  surveyor: string;
  pointCount: number;
  meanElevation: number;
  isCustom: boolean;
}
