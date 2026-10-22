import * as THREE from 'three';
import { ChapoliData } from '../../types/reservoir';

export interface WaterSurfaceOptions {
  waterLevel: number;
  verticalExaggeration: number;
  opacity: number;
  visible: boolean;
}

export class WaterSurface {
  public group: THREE.Group;
  private data: ChapoliData;
  private options: WaterSurfaceOptions;
  private mesh: THREE.Mesh | null = null;
  private shorelineLine: THREE.LineSegments | null = null;
  private material: THREE.MeshStandardMaterial;

  constructor(data: ChapoliData, options: WaterSurfaceOptions) {
    this.data = data;
    this.options = options;
    this.group = new THREE.Group();
    this.group.name = 'WaterSurfaceGroup';

    // Rich, realistic reservoir water material (no wireframe, solid deep blue-teal)
    this.material = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Hydrological vibrant reservoir blue
      roughness: 0.12,
      metalness: 0.22,
      transparent: true,
      opacity: this.options.opacity ?? 0.90,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -1.5,
      polygonOffsetUnits: -1.5,
      side: THREE.DoubleSide
    });

    this.rebuildWaterMesh();
    this.group.visible = this.options.visible;
  }

  /**
   * Build continuous, solid 3D reservoir water body conforming to the basin
   * and clipped naturally by surrounding hills and dam structure.
   */
  public rebuildWaterMesh() {
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    if (this.shorelineLine) {
      this.group.remove(this.shorelineLine);
      this.shorelineLine.geometry.dispose();
      this.shorelineLine = null;
    }

    const { width, height } = this.data.dem;
    const waterY = this.options.waterLevel * this.options.verticalExaggeration;

    // Lowest possible bed level is 15.50m (deepest basin thalweg)
    if (this.options.waterLevel < 15.50) {
      return;
    }

    const vertices: number[] = [];
    const indices: number[] = [];
    const vertMap = new Map<string, number>();
    let vCount = 0;

    const getVertIndex = (r: number, c: number): number => {
      const key = `${r},${c}`;
      if (vertMap.has(key)) return vertMap.get(key)!;
      const cell = this.data.cells[r * width + c];
      vertices.push(cell.localX, waterY, cell.localZ);
      vertMap.set(key, vCount);
      return vCount++;
    };

    const wl = this.options.waterLevel;

    // Submerge quads within the reservoir basin where terrain is below water level.
    // If at least 2 vertices of a triangle are inside or bordering the tank and below waterLevel,
    // we include the triangle. The rising solid terrain slopes naturally clip the water surface!
    for (let r = 0; r < height - 1; r++) {
      for (let c = 0; c < width - 1; c++) {
        const c00 = this.data.cells[r * width + c];
        const c10 = this.data.cells[r * width + (c + 1)];
        const c01 = this.data.cells[(r + 1) * width + c];
        const c11 = this.data.cells[(r + 1) * width + (c + 1)];

        if (
          c00.isValid && c10.isValid && c01.isValid && c11.isValid &&
          c00.elevation !== null && c10.elevation !== null && c01.elevation !== null && c11.elevation !== null
        ) {
          // Check tank basin proximity: at least one corner inside the reservoir boundary
          const tankProximity = c00.inTank || c10.inTank || c01.inTank || c11.inTank;
          if (!tankProximity) continue;

          // Exclude quads downstream (west) of the 760m earthen dam alignment
          const quadX = (c00.localX + c10.localX + c01.localX + c11.localX) / 4;
          const quadZ = (c00.localZ + c10.localZ + c01.localZ + c11.localZ) / 4;
          const damXAtZ = -468.0 + (quadZ - (-411.6)) * ((-389.8 - (-468.0)) / (353.2 - (-411.6)));
          if (quadX < damXAtZ - 2.0) continue;

          // Triangle 1: (c00, c01, c10)
          const subCount1 = (c00.elevation <= wl ? 1 : 0) + (c01.elevation <= wl ? 1 : 0) + (c10.elevation <= wl ? 1 : 0);
          if (subCount1 >= 1) {
            const i00 = getVertIndex(r, c);
            const i01 = getVertIndex(r + 1, c);
            const i10 = getVertIndex(r, c + 1);
            indices.push(i00, i01, i10);
          }

          // Triangle 2: (c10, c01, c11)
          const subCount2 = (c10.elevation <= wl ? 1 : 0) + (c01.elevation <= wl ? 1 : 0) + (c11.elevation <= wl ? 1 : 0);
          if (subCount2 >= 1) {
            const i10 = getVertIndex(r, c + 1);
            const i01 = getVertIndex(r + 1, c);
            const i11 = getVertIndex(r + 1, c + 1);
            indices.push(i10, i01, i11);
          }
        }
      }
    }

    if (vertices.length === 0) return;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.renderOrder = 2; // Renders cleanly above reservoir bed
    this.mesh.userData = { isWater: true, elevation: this.options.waterLevel };
    this.group.add(this.mesh);

    // Extract ONLY perimeter boundary edges (edges belonging to exactly 1 triangle)
    // for a crisp glowing blue shoreline — ZERO wireframe lines inside the water!
    const edgeMap = new Map<string, [number, number]>();
    for (let i = 0; i < indices.length; i += 3) {
      const tri = [indices[i], indices[i + 1], indices[i + 2]];
      for (let j = 0; j < 3; j++) {
        const u = tri[j];
        const v = tri[(j + 1) % 3];
        const key = u < v ? `${u}_${v}` : `${v}_${u}`;
        if (edgeMap.has(key)) {
          edgeMap.delete(key); // Internal edge (shared by 2 triangles)
        } else {
          edgeMap.set(key, [u, v]); // Boundary candidate
        }
      }
    }

    const shorelinePts: THREE.Vector3[] = [];
    const pos = geo.attributes.position;
    for (const [u, v] of edgeMap.values()) {
      shorelinePts.push(
        new THREE.Vector3(pos.getX(u), waterY + 0.1, pos.getZ(u)),
        new THREE.Vector3(pos.getX(v), waterY + 0.1, pos.getZ(v))
      );
    }

    if (shorelinePts.length > 0) {
      const shorelineGeo = new THREE.BufferGeometry().setFromPoints(shorelinePts);
      const shorelineMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8, // Luminous cyan shoreline outline
        linewidth: 2,
        transparent: true,
        opacity: 0.85
      });
      this.shorelineLine = new THREE.LineSegments(shorelineGeo, shorelineMat);
      this.group.add(this.shorelineLine);
    }
  }

  public setWaterLevel(level: number) {
    this.options.waterLevel = level;
    this.rebuildWaterMesh();
  }

  public updateExaggeration(exaggeration: number) {
    this.options.verticalExaggeration = exaggeration;
    this.rebuildWaterMesh();
  }

  public setOpacity(opacity: number) {
    this.options.opacity = opacity;
    this.material.opacity = opacity;
  }

  public setVisible(visible: boolean) {
    this.options.visible = visible;
    this.group.visible = visible;
  }

  public animate(clock: THREE.Clock) {
    if (!this.mesh) return;
    const time = clock.getElapsedTime();
    // Subtle physical shimmer: slight roughness oscillation
    this.material.roughness = 0.14 + Math.sin(time * 1.5) * 0.02;
  }

  public dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
    }
    if (this.shorelineLine) {
      this.shorelineLine.geometry.dispose();
    }
    this.material.dispose();
  }
}
