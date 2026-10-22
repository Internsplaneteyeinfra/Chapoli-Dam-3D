export type SiltVisualMode = 'classification' | 'volume';

export interface SiltBBox {
  wgs84: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  utm43n: {
    minEasting: number;
    maxEasting: number;
    minNorthing: number;
    maxNorthing: number;
  };
  local: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    width: number;
    depth: number;
  };
}

export interface SiltClassStat {
  count: number;
  percent: number;
  color: string;
  label: string;
}

export interface SiltMonthRecord {
  key: string;
  name: string;
  monthNumber: string;
  year: number;
  dateLabel: string;
  waterAreaHa: number;
  meanSiltScore: number;
  sedimentIndexP5: number;
  sedimentIndexP95: number;
  totalSiltVolumeM3: number;
  totalSiltVolumeMCM: number;
  validPixels: number;
  classificationBreakdown: {
    low: SiltClassStat;
    moderate: SiltClassStat;
    high: SiltClassStat;
    veryHigh: SiltClassStat;
  };
  classificationDataUrl: string;
  volumeDataUrl: string;
  gridDimensions: {
    width: number;
    height: number;
  };
  classGrid: number[][];
  thicknessGrid: number[][];
}

export interface SiltTimelineItem {
  key: string;
  month: string;
  fullName: string;
  volumeM3: number;
  volumeMCM: number;
  meanScore: number;
  waterAreaHa: number;
  isPeak: boolean;
  isMonsoon: boolean;
}

export interface SiltLegendItem {
  level: number;
  label: string;
  color: string;
  hex: string;
  desc: string;
}

export interface SiltSeriesPayload {
  source: string;
  targetReservoir: string;
  year: number;
  bbox: SiltBBox;
  months: Record<string, SiltMonthRecord>;
  timeline: SiltTimelineItem[];
  activeDefaultMonth: string;
  classificationLegend: SiltLegendItem[];
  volumeLegend: {
    minVal: number;
    midVal: number;
    maxVal: number;
    unit: string;
    thicknessMaxM: number;
    palette: string[];
  };
}
