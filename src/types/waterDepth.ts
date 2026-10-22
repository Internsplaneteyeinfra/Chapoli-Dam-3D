import { SiltBBox } from './silt';

export interface WaterDepthPayload {
  source: string;
  targetReservoir: string;
  water: {
    name: string;
    description: string;
    imageDate: string;
    waterAreaHa: number;
    dataUrl: string;
  };
  depth: {
    name: string;
    description: string;
    imageDate: string;
    analysisDate: string;
    minDepthM: number;
    maxDepthM: number;
    meanDepthM: number;
    relativeVolumeMCM: number;
    palette: string[];
    dataUrl: string;
  };
  bbox: SiltBBox;
  gridDimensions: {
    width: number;
    height: number;
  };
  waterGrid: number[][];
  depthGrid: number[][];
}

/** Fraction (0..1) of permanent-water cells in the 3x3 neighbourhood of a local scene point. */
export const sampleWaterWetness = (wd: WaterDepthPayload, localX: number, localZ: number): number => {
  const b = wd.bbox.local;
  const { width, height } = wd.gridDimensions;
  const col = Math.floor(((localX - b.minX) / b.width) * width);
  const row = Math.floor(((localZ - b.minZ) / b.depth) * height);
  let wet = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (wd.waterGrid[row + dr]?.[col + dc]) wet++;
    }
  }
  return wet / 9;
};

/**
 * Bed elevation (m MSL) after lowering the basin to the satellite water bottom:
 * `level - depth * depthScale`, blended by 5x5 (~30 m) wetness with an eased curve so the
 * basin edge forms a sloping bank rather than a cliff.
 * Never raises the bed; returns `baseElev` unchanged outside permanent water.
 */
export const carveBedToWaterBottom = (
  wd: WaterDepthPayload,
  localX: number,
  localZ: number,
  baseElev: number,
  level: number,
  depthScale: number
): number => {
  const b = wd.bbox.local;
  const { width, height } = wd.gridDimensions;
  const col = Math.floor(((localX - b.minX) / b.width) * width);
  const row = Math.floor(((localZ - b.minZ) / b.depth) * height);
  let wet = 0;
  let depthSum = 0;
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      if (wd.waterGrid[row + dr]?.[col + dc]) {
        wet++;
        depthSum += wd.depthGrid[row + dr][col + dc];
      }
    }
  }
  if (wet === 0) return baseElev;
  const target = Math.min(baseElev, level - (depthSum / wet) * depthScale);
  const f = wet / 25;
  const eased = f * f * (3 - 2 * f); // smoothstep
  return baseElev + (target - baseElev) * eased;
};

/** Depth (m) at a local scene point, or null when the point is not permanent water. */
export const sampleWaterDepth = (wd: WaterDepthPayload, localX: number, localZ: number): number | null => {
  const b = wd.bbox.local;
  if (localX < b.minX || localX > b.maxX || localZ < b.minZ || localZ > b.maxZ) return null;
  const { width, height } = wd.gridDimensions;
  const col = Math.min(width - 1, Math.floor(((localX - b.minX) / b.width) * width));
  const row = Math.min(height - 1, Math.floor(((localZ - b.minZ) / b.depth) * height));
  if (!wd.waterGrid[row]?.[col]) return null;
  return wd.depthGrid[row][col];
};
