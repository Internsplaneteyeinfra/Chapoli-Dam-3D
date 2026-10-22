export type TreeArchetype = 'large_canopy' | 'medium_forest' | 'small_tree' | 'shrub';

export interface TreeData {
  id: number;
  lat: number;
  lon: number;
  utmX: number;
  utmY: number;
  localX: number;
  localZ: number;
  elevation: number;
  height: number;
  crownRadius: number;
  type: TreeArchetype;
  color: string;
}

export interface VegetationPayload {
  totalTrees: number;
  crs: string;
  origin: {
    x: number;
    y: number;
    lon: number;
    lat: number;
    crs: string;
  };
  heightStats: {
    minHeight_m: number;
    maxHeight_m: number;
    meanHeight_m: number;
  };
  typeCounts: Record<TreeArchetype, number>;
  trees: TreeData[];
}
