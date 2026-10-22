import * as THREE from 'three';
import { ChapoliData } from '../../types/reservoir';
import { SiltSeriesPayload, SiltVisualMode, SiltMonthRecord } from '../../types/silt';

export interface SiltLayerOptions {
  visible: boolean;
  activeMonth: string;
  visualMode: SiltVisualMode;
  opacity: number;
  verticalExaggeration: number;
  thicknessMultiplier: number;
}

export class SiltLayer {
  public group: THREE.Group;
  private data: ChapoliData;
  private siltData: SiltSeriesPayload;
  private options: SiltLayerOptions;

  private mesh: THREE.Mesh | null = null;
  private material: THREE.MeshStandardMaterial;
  private textureCache: Map<string, THREE.Texture> = new Map();
  private baseVertices: Float32Array | null = null;
  private baseThicknesses: Float32Array | null = null;
  private baseBedElevations: Float32Array | null = null;

  constructor(data: ChapoliData, siltData: SiltSeriesPayload, options: SiltLayerOptions) {
    this.data = data;
    this.siltData = siltData;
    this.options = options;

    this.group = new THREE.Group();
    this.group.name = 'SiltClassificationAndVolumeGroup';

    // Standard material with transparency, high roughness for silt/sediment, and proper depth offset
    this.material = new THREE.MeshStandardMaterial({
      transparent: true,
      opacity: this.options.opacity,
      roughness: 0.88,
      metalness: 0.04,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.8,
      polygonOffsetUnits: -1.8,
      side: THREE.DoubleSide
    });

    this.rebuildGeometry();
    this.updateTexture();
    this.group.visible = this.options.visible;
  }

  /**
   * Rebuild the 3D surface mesh conforming to the reservoir bed
   * with precise UV mapping to the Sentinel-2 silt bounding box.
   */
  public rebuildGeometry() {
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }

    const { width, height } = this.data.dem;
    const bbox = this.siltData.bbox.local;

    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const thicknesses: number[] = [];
    const bedElevs: number[] = [];
    const vertMap = new Map<string, number>();
    let vCount = 0;

    const currentMonthData = this.siltData.months[this.options.activeMonth] || this.siltData.months['sep'];
    const tGrid = currentMonthData.thicknessGrid;
    const gridW = currentMonthData.gridDimensions.width;
    const gridH = currentMonthData.gridDimensions.height;

    // Helper to sample local silt thickness at localX, localZ
    const sampleThickness = (lx: number, lz: number): number => {
      if (lx < bbox.minX || lx > bbox.maxX || lz < bbox.minZ || lz > bbox.maxZ) return 0;
      const u = (lx - bbox.minX) / bbox.width;
      const v = (lz - bbox.minZ) / bbox.depth;
      const col = Math.min(gridW - 1, Math.max(0, Math.floor(u * gridW)));
      const row = Math.min(gridH - 1, Math.max(0, Math.floor(v * gridH)));
      return tGrid[row]?.[col] ?? 0;
    };

    const getVertIndex = (r: number, c: number): number => {
      const key = `${r},${c}`;
      if (vertMap.has(key)) return vertMap.get(key)!;
      const cell = this.data.cells[r * width + c];
      const lx = cell.localX;
      const lz = cell.localZ;
      const bedElev = cell.elevation ?? 34.0;
      const thick = sampleThickness(lx, lz);

      // UV coordinates normalized across silt bounding box
      const u = Math.max(0.0, Math.min(1.0, (lx - bbox.minX) / bbox.width));
      const v = Math.max(0.0, Math.min(1.0, 1.0 - (lz - bbox.minZ) / bbox.depth));

      const y = (bedElev + thick * this.options.thicknessMultiplier) * this.options.verticalExaggeration;

      vertices.push(lx, y, lz);
      uvs.push(u, v);
      thicknesses.push(thick);
      bedElevs.push(bedElev);

      vertMap.set(key, vCount);
      return vCount++;
    };

    for (let r = 0; r < height - 1; r++) {
      for (let c = 0; c < width - 1; c++) {
        const c00 = this.data.cells[r * width + c];
        const c10 = this.data.cells[r * width + (c + 1)];
        const c01 = this.data.cells[(r + 1) * width + c];
        const c11 = this.data.cells[(r + 1) * width + (c + 1)];

        if (c00?.isValid && c10?.isValid && c01?.isValid && c11?.isValid) {
          // Quad must be within reservoir and within/intersecting silt bounding box
          const inTank = c00.inTank || c10.inTank || c01.inTank || c11.inTank;
          if (!inTank) continue;

          const qMinX = Math.min(c00.localX, c10.localX);
          const qMaxX = Math.max(c00.localX, c10.localX);
          const qMinZ = Math.min(c00.localZ, c01.localZ);
          const qMaxZ = Math.max(c00.localZ, c01.localZ);

          if (qMaxX < bbox.minX || qMinX > bbox.maxX || qMaxZ < bbox.minZ || qMinZ > bbox.maxZ) {
            continue;
          }

          const i00 = getVertIndex(r, c);
          const i01 = getVertIndex(r + 1, c);
          const i10 = getVertIndex(r, c + 1);
          const i11 = getVertIndex(r + 1, c + 1);

          indices.push(i00, i01, i10);
          indices.push(i10, i01, i11);
        }
      }
    }

    if (vertices.length === 0) return;

    this.baseVertices = new Float32Array(vertices);
    this.baseThicknesses = new Float32Array(thicknesses);
    this.baseBedElevations = new Float32Array(bedElevs);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.renderOrder = 3; // Above bed, beneath water
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.userData = { isSiltLayer: true };
    this.group.add(this.mesh);
  }

  /**
   * Load and apply the appropriate texture based on active month and visual mode.
   */
  public updateTexture() {
    const month = this.siltData.months[this.options.activeMonth] || this.siltData.months['sep'];
    const dataUrl = this.options.visualMode === 'classification'
      ? month.classificationDataUrl
      : month.volumeDataUrl;

    const cacheKey = `${this.options.activeMonth}_${this.options.visualMode}`;

    if (this.textureCache.has(cacheKey)) {
      const tex = this.textureCache.get(cacheKey)!;
      this.material.map = tex;
      this.material.needsUpdate = true;
      return;
    }

    const loader = new THREE.TextureLoader();
    loader.load(dataUrl, (tex) => {
      tex.minFilter = THREE.NearestFilter;
      tex.magFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;

      this.textureCache.set(cacheKey, tex);
      this.material.map = tex;
      this.material.needsUpdate = true;
    });
  }

  public setActiveMonth(monthKey: string) {
    if (this.options.activeMonth === monthKey) return;
    this.options.activeMonth = monthKey;
    this.updateTexture();
    this.rebuildGeometry();
  }

  public setVisualMode(mode: SiltVisualMode) {
    if (this.options.visualMode === mode) return;
    this.options.visualMode = mode;
    this.updateTexture();
  }

  public setOpacity(opacity: number) {
    this.options.opacity = opacity;
    this.material.opacity = opacity;
    this.material.needsUpdate = true;
  }

  public setThicknessMultiplier(multiplier: number) {
    if (this.options.thicknessMultiplier === multiplier) return;
    this.options.thicknessMultiplier = multiplier;
    this.updateVertexHeights();
  }

  public updateExaggeration(exaggeration: number) {
    this.options.verticalExaggeration = exaggeration;
    this.updateVertexHeights();
  }

  private updateVertexHeights() {
    if (!this.mesh || !this.baseBedElevations || !this.baseThicknesses) return;
    const posAttr = this.mesh.geometry.attributes.position;
    const count = posAttr.count;

    for (let i = 0; i < count; i++) {
      const bedElev = this.baseBedElevations[i];
      const thick = this.baseThicknesses[i];
      const y = (bedElev + thick * this.options.thicknessMultiplier) * this.options.verticalExaggeration;
      posAttr.setY(i, y);
    }
    posAttr.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }

  public setVisible(visible: boolean) {
    this.options.visible = visible;
    this.group.visible = visible;
  }

  public dispose() {
    this.textureCache.forEach(tex => tex.dispose());
    this.textureCache.clear();
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    this.material.dispose();
  }
}
