import * as THREE from 'three';
import { ChapoliData } from '../../types/reservoir';
import { SedimentAnalysisEngine } from '../../utils/sedimentAnalysis';

export interface SedimentLayerOptions {
  verticalExaggeration: number;
  sampleMode: boolean;
  visible: boolean;
  opacity: number;
}

export class SedimentLayer {
  public group: THREE.Group;
  private data: ChapoliData;
  private options: SedimentLayerOptions;
  private engine: SedimentAnalysisEngine;
  private mesh: THREE.Mesh | null = null;
  private material: THREE.MeshStandardMaterial;

  constructor(data: ChapoliData, options: SedimentLayerOptions, engine: SedimentAnalysisEngine) {
    this.data = data;
    this.options = options;
    this.engine = engine;
    this.group = new THREE.Group();
    this.group.name = 'SedimentLayerGroup';

    // Anti Z-fighting material with polygon offset and depth write
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.65,
      metalness: 0.15,
      transparent: true,
      opacity: this.options.opacity,
      polygonOffset: true,
      polygonOffsetFactor: -3.0,
      polygonOffsetUnits: -6.0,
      depthWrite: false, // Prevents depth occlusion conflicts with underlying terrain
      side: THREE.DoubleSide
    });

    this.rebuildMesh();
    this.group.visible = this.options.visible;
  }

  public rebuildMesh() {
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }

    if (!this.options.sampleMode) {
      // In strictly observed mode, pre-impoundment baseline is unavailable in raw files
      return;
    }

    const { width, height } = this.data.dem;
    const vertices: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const vertMap = new Map<string, number>();
    let vCount = 0;
    const color = new THREE.Color();

    const getVertIndex = (r: number, c: number): number => {
      const key = `${r},${c}`;
      if (vertMap.has(key)) return vertMap.get(key)!;
      const cell = this.data.cells[r * width + c];
      const presElev = cell.elevation!;
      const origElev = this.engine.getOriginalBedElevation(cell.localX, cell.localZ, true) ?? presElev;
      const thickness = Math.max(0, presElev - origElev);

      // Top surface of sediment deposit: slightly offset above bed to guarantee clean rendering
      const yOffset = 0.08 * this.options.verticalExaggeration;
      vertices.push(
        cell.localX,
        presElev * this.options.verticalExaggeration + yOffset,
        cell.localZ
      );

      // Warm Amber-Gold to Deep Terracotta gradient based on sediment thickness
      // 0.05m -> light gold (HSL 45 deg)
      // 1.5m  -> rich amber (HSL 36 deg)
      // 2.5m+ -> deep terracotta (HSL 20 deg)
      const t = Math.min(1.0, Math.max(0.0, (thickness - 0.05) / 2.5));
      // Hue: 0.12 (warm gold) down to 0.05 (burnt orange/terracotta)
      const hue = 0.125 - t * 0.075;
      const sat = 0.90 + t * 0.08;
      const lightness = 0.55 - t * 0.18;
      color.setHSL(hue, sat, lightness);
      colors.push(color.r, color.g, color.b);

      vertMap.set(key, vCount);
      return vCount++;
    };

    // Submerged sediment quads inside the basin
    // ONLY generate geometry where there is meaningful sediment accumulation (thickness >= 0.06m)
    for (let r = 0; r < height - 1; r++) {
      for (let c = 0; c < width - 1; c++) {
        const c00 = this.data.cells[r * width + c];
        const c10 = this.data.cells[r * width + (c + 1)];
        const c01 = this.data.cells[(r + 1) * width + c];
        const c11 = this.data.cells[(r + 1) * width + (c + 1)];

        if (
          c00.isValid && c10.isValid && c01.isValid && c11.isValid &&
          c00.inTank && c10.inTank && c01.inTank && c11.inTank &&
          c00.elevation !== null && c10.elevation !== null && c01.elevation !== null && c11.elevation !== null &&
          c00.elevation <= 38.25 && c10.elevation <= 38.25 && c01.elevation <= 38.25 && c11.elevation <= 38.25
        ) {
          const t00 = c00.elevation - (this.engine.getOriginalBedElevation(c00.localX, c00.localZ, true) ?? c00.elevation);
          const t10 = c10.elevation - (this.engine.getOriginalBedElevation(c10.localX, c10.localZ, true) ?? c10.elevation);
          const t01 = c01.elevation - (this.engine.getOriginalBedElevation(c01.localX, c01.localZ, true) ?? c01.elevation);
          const t11 = c11.elevation - (this.engine.getOriginalBedElevation(c11.localX, c11.localZ, true) ?? c11.elevation);

          // Only render quad if at least 2 vertices have active sediment accumulation (>= 0.05m)
          const activeVerts = (t00 >= 0.05 ? 1 : 0) + (t10 >= 0.05 ? 1 : 0) + (t01 >= 0.05 ? 1 : 0) + (t11 >= 0.05 ? 1 : 0);
          if (activeVerts >= 2) {
            const i00 = getVertIndex(r, c);
            const i10 = getVertIndex(r, c + 1);
            const i01 = getVertIndex(r + 1, c);
            const i11 = getVertIndex(r + 1, c + 1);

            // Clean CCW upward triangles (+Y normal)
            indices.push(i00, i01, i10);
            indices.push(i10, i01, i11);
          }
        }
      }
    }

    if (vertices.length === 0) return;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.userData = { isSediment: true };
    this.group.add(this.mesh);
  }

  public updateExaggeration(exaggeration: number) {
    this.options.verticalExaggeration = exaggeration;
    this.rebuildMesh();
  }

  public setSampleMode(enabled: boolean) {
    this.options.sampleMode = enabled;
    this.rebuildMesh();
  }

  public setOpacity(opacity: number) {
    this.options.opacity = opacity;
    this.material.opacity = opacity;
  }

  public setVisible(visible: boolean) {
    this.options.visible = visible;
    this.group.visible = visible;
  }

  public dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
    }
    this.material.dispose();
  }
}
