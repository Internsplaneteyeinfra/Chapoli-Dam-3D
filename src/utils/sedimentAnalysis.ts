import { ChapoliData, CrossSectionPoint, SedimentVolumeStats, DataProvenance } from '../types/reservoir';

export class SedimentAnalysisEngine {
  private data: ChapoliData;
  private cellArea: number;
  private minLocalX: number;
  private minLocalZ: number;

  constructor(data: ChapoliData) {
    this.data = data;
    this.cellArea = data.dem.dx * data.dem.dy;
    // Calculate local bounding origins
    this.minLocalX = data.dem.bounds.left - data.origin.x;
    this.minLocalZ = -(data.dem.bounds.top - data.origin.y);
  }

  /**
   * Check if point (localX, localZ) is inside the reservoir polygon (Ray casting algorithm)
   */
  isInsideTank(localX: number, localZ: number): boolean {
    const poly = this.data.tank.coords_local;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], zi = poly[i][1];
      const xj = poly[j][0], zj = poly[j][1];
      const intersect = ((zi > localZ) !== (zj > localZ)) &&
        (localX < (xj - xi) * (localZ - zi) / (zj - zi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Sample present bed elevation from the unified 10m grid with smooth bilinear interpolation
   */
  getPresentBedElevation(localX: number, localZ: number): { elevation: number | null; isValid: boolean } {
    const { dx, dy, width, height } = this.data.dem;

    const colFrac = (localX - this.minLocalX) / dx;
    const rowFrac = (localZ - this.minLocalZ) / dy;

    const col0 = Math.floor(colFrac);
    const row0 = Math.floor(rowFrac);
    const col1 = col0 + 1;
    const row1 = row0 + 1;

    if (row0 < 0 || row1 >= height || col0 < 0 || col1 >= width) {
      return { elevation: null, isValid: false };
    }

    const q00 = this.data.dem_grid[row0]?.[col0];
    const q10 = this.data.dem_grid[row0]?.[col1];
    const q01 = this.data.dem_grid[row1]?.[col0];
    const q11 = this.data.dem_grid[row1]?.[col1];

    if (q00 === null || q10 === null || q01 === null || q11 === null) {
      const nearestCol = Math.min(width - 1, Math.max(0, Math.round(colFrac)));
      const nearestRow = Math.min(height - 1, Math.max(0, Math.round(rowFrac)));
      const val = this.data.dem_grid[nearestRow]?.[nearestCol];
      if (val !== null && val !== undefined) {
        return { elevation: val, isValid: true };
      }
      return { elevation: null, isValid: false };
    }

    // Bilinear interpolation
    const tx = colFrac - col0;
    const ty = rowFrac - row0;
    const interp = (1 - tx) * (1 - ty) * q00 +
                   tx * (1 - ty) * q10 +
                   (1 - tx) * ty * q01 +
                   tx * ty * q11;

    return { elevation: Math.round(interp * 100) / 100, isValid: true };
  }

  /**
   * Sample original pre-impoundment bed elevation.
   * Strictly pinches to 0.0m thickness at the shoreline (38.25m) and along dry margins.
   */
  getOriginalBedElevation(localX: number, localZ: number, sampleMode: boolean = false): number | null {
    if (!sampleMode) return null;

    const { elevation, isValid } = this.getPresentBedElevation(localX, localZ);
    if (!isValid || elevation === null) return null;

    // Check if within reservoir basin (elev <= 38.25 FRL) and inside tank
    const inTank = this.isInsideTank(localX, localZ);
    if (!inTank || elevation >= 38.25) {
      // Dry surrounding hillside or above waterline: original ground equals current ground
      return elevation;
    }

    // Inside reservoir basin: sediment thickness pinches seamlessly to 0 at 38.25m shoreline
    const distToCenter = Math.sqrt(localX * localX + localZ * localZ);
    const depthFactor = Math.max(0, (38.25 - elevation) / (38.25 - 15.50)); // 0 at shoreline (38.25m), 1 at deepest bed (15.5m)
    const centerFactor = Math.max(0.2, 1 - distToCenter / 550);
    
    // Model sediment deposit smoothly tapering to 0 at the margins
    const estimatedThickness = Math.max(0, Math.min(elevation - 15.50, (2.6 * Math.pow(depthFactor, 1.3) * centerFactor)));
    return Math.round((elevation - estimatedThickness) * 100) / 100;
  }

  /**
   * Generate 2D cross-section profile along a transect line
   */
  generateCrossSection(
    startLocal: [number, number],
    endLocal: [number, number],
    waterLevel: number,
    sampleMode: boolean,
    numSamples: number = 120
  ): CrossSectionPoint[] {
    const points: CrossSectionPoint[] = [];
    const dx = endLocal[0] - startLocal[0];
    const dz = endLocal[1] - startLocal[1];
    const totalDistance = Math.sqrt(dx * dx + dz * dz);

    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      const curX = startLocal[0] + dx * t;
      const curZ = startLocal[1] + dz * t;
      const dist = totalDistance * t;

      const { elevation: presBed, isValid } = this.getPresentBedElevation(curX, curZ);
      const inTank = this.isInsideTank(curX, curZ);
      const isSubmerged = inTank && isValid && presBed !== null && presBed < waterLevel;

      let origBed: number | null = null;
      let thickness: number | null = null;

      if (sampleMode && isValid && presBed !== null) {
        origBed = this.getOriginalBedElevation(curX, curZ, true);
        if (isSubmerged && origBed !== null && presBed > origBed) {
          thickness = Math.round((presBed - origBed) * 100) / 100;
        }
      }

      points.push({
        distanceM: Math.round(dist),
        originalBed: origBed,
        presentBed: presBed,
        waterSurface: waterLevel,
        sedimentThickness: thickness,
        isSurveyed: isValid
      });
    }

    return points;
  }

  /**
   * Compute comprehensive sediment volume statistics across the reservoir
   */
  computeSedimentStats(sampleMode: boolean): SedimentVolumeStats {
    if (!sampleMode) {
      return {
        surveyedAreaM2: this.data.tank.area_m2,
        surveyedAreaHa: this.data.tank.area_ha,
        volumeM3: 0,
        volumeMCM: 0,
        meanThicknessM: 0,
        maxThicknessM: 0,
        coveragePercent: (this.data.dem.validCells / this.data.dem.totalCells) * 100,
        capacityLossPercent: 0,
        provenance: 'UNAVAILABLE' as DataProvenance
      };
    }

    let totalVol = 0;
    let maxThickness = 0;
    let validThicknessCount = 0;
    let sumThickness = 0;
    let submergedArea = 0;

    for (const cell of this.data.cells) {
      if (cell.isValid && cell.inTank && cell.elevation !== null && cell.elevation < 38.25) {
        const origElev = this.getOriginalBedElevation(cell.localX, cell.localZ, true);
        if (origElev !== null && cell.elevation > origElev) {
          const thickness = cell.elevation - origElev;
          const cellVol = thickness * this.cellArea;
          totalVol += cellVol;
          sumThickness += thickness;
          validThicknessCount++;
          if (thickness > maxThickness) maxThickness = thickness;
          submergedArea += this.cellArea;
        }
      }
    }

    const meanThickness = validThicknessCount > 0 ? sumThickness / validThicknessCount : 0;
    const volMCM = totalVol / 1e6;
    const capLossPercent = (volMCM / this.data.baseline_specs.grossStorage_MCM) * 100;

    return {
      surveyedAreaM2: Math.round(submergedArea),
      surveyedAreaHa: Math.round((submergedArea / 10000) * 100) / 100,
      volumeM3: Math.round(totalVol),
      volumeMCM: Math.round(volMCM * 10000) / 10000,
      meanThicknessM: Math.round(meanThickness * 100) / 100,
      maxThicknessM: Math.round(maxThickness * 100) / 100,
      coveragePercent: Math.round((this.data.dem.validCells / this.data.dem.totalCells) * 1000) / 10,
      capacityLossPercent: Math.round(capLossPercent * 100) / 100,
      provenance: 'SIMULATED' as DataProvenance
    };
  }

  /**
   * Dynamic water volume and submerged area calculation for any water elevation
   */
  calculateWaterStorage(waterLevel: number): { areaM2: number; areaHa: number; volumeM3: number; volumeMCM: number } {
    let vol = 0;
    let area = 0;

    for (const cell of this.data.cells) {
      if (cell.isValid && cell.inTank && cell.elevation !== null && cell.elevation <= waterLevel) {
        const depth = waterLevel - cell.elevation;
        vol += depth * this.cellArea;
        area += this.cellArea;
      }
    }

    return {
      areaM2: Math.round(area),
      areaHa: Math.round((area / 10000) * 100) / 100,
      volumeM3: Math.round(vol),
      volumeMCM: Math.round((vol / 1e6) * 10000) / 10000
    };
  }
}
