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
  /** Basin depth exaggeration (Depth x1..x5); the deposit scales with it to stay in proportion */
  depthScale?: number;
  /** Water surface (m MSL) the exaggerated deposit may not rise above */
  capLevel?: number;
}

// Visual height factor for the deposit body: silt thickness is <= 0.97 m, too thin to read in 3D
const DEPOSIT_VISUAL_SCALE = 12;

// Wall colours per class, matching the classification overlay (1 Low .. 4 Very High)
export const CLASS_WALL_COLORS: Record<number, THREE.Color> = {
  1: new THREE.Color('#00ff00'),
  2: new THREE.Color('#ffff00'),
  3: new THREE.Color('#ffa500'),
  4: new THREE.Color('#ff0000')
};
export const VOLUME_RAMP = ['#ffffe5', '#fff7bc', '#fee391', '#fec44f', '#fe9929', '#ec7014', '#cc4c02', '#993404', '#662506']
  .map(h => new THREE.Color(h));

export class SiltLayer {
  public group: THREE.Group;
  private data: ChapoliData;
  private siltData: SiltSeriesPayload;
  private options: SiltLayerOptions;

  private mesh: THREE.Mesh | null = null;
  private material: THREE.MeshStandardMaterial;
  // Side walls that turn the draped surface into a solid deposit body
  private walls: THREE.Mesh | null = null;
  private wallMaterial: THREE.MeshStandardMaterial;
  private boundaryEdges: { a: number; b: number; cls: number }[] = [];
  private textureCache: Map<string, THREE.Texture> = new Map();
  private baseVertices: Float32Array | null = null;
  private baseThicknesses: Float32Array | null = null;
  private baseBedElevations: Float32Array | null = null;
  // Optional basin carve so silt drapes the lowered bed instead of floating above it
  private bedElevationFn: ((x: number, z: number, baseElev: number) => number) | null = null;

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
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -1.8,
      polygonOffsetUnits: -1.8,
      side: THREE.DoubleSide
    });

    this.wallMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      opacity: this.options.opacity,
      roughness: 0.85,
      metalness: 0.04,
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

    const currentMonthData = this.siltData.months[this.options.activeMonth] || this.siltData.months[this.siltData.activeDefaultMonth];
    const tGrid = currentMonthData.thicknessGrid;
    const cGrid = currentMonthData.classGrid;
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

    const sampleClass = (lx: number, lz: number): number => {
      if (lx < bbox.minX || lx > bbox.maxX || lz < bbox.minZ || lz > bbox.maxZ) return 0;
      const col = Math.min(gridW - 1, Math.max(0, Math.floor(((lx - bbox.minX) / bbox.width) * gridW)));
      const row = Math.min(gridH - 1, Math.max(0, Math.floor(((lz - bbox.minZ) / bbox.depth) * gridH)));
      return cGrid[row]?.[col] ?? 0;
    };

    // Edge -> use count + class of the quad that owns it; edges used once form the deposit outline
    const edgeUse = new Map<string, { a: number; b: number; cls: number; n: number }>();
    const addEdge = (a: number, b: number, cls: number) => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      const e = edgeUse.get(key);
      if (e) e.n++;
      else edgeUse.set(key, { a, b, cls, n: 1 });
    };

    const getVertIndex = (r: number, c: number): number => {
      const key = `${r},${c}`;
      if (vertMap.has(key)) return vertMap.get(key)!;
      const cell = this.data.cells[r * width + c];
      const lx = cell.localX;
      const lz = cell.localZ;
      const rawBedElev = cell.elevation ?? 34.0;
      const bedElev = this.bedElevationFn ? this.bedElevationFn(lx, lz, rawBedElev) : rawBedElev;
      const thick = sampleThickness(lx, lz);

      // UV coordinates normalized across silt bounding box
      const u = Math.max(0.0, Math.min(1.0, (lx - bbox.minX) / bbox.width));
      const v = Math.max(0.0, Math.min(1.0, 1.0 - (lz - bbox.minZ) / bbox.depth));

      const y = this.depositTop(bedElev, thick) * this.options.verticalExaggeration;

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

          // Only build the deposit where Sentinel-2 classified silt
          const cls = sampleClass((qMinX + qMaxX) / 2, (qMinZ + qMaxZ) / 2);
          if (cls === 0) continue;

          const i00 = getVertIndex(r, c);
          const i01 = getVertIndex(r + 1, c);
          const i10 = getVertIndex(r, c + 1);
          const i11 = getVertIndex(r + 1, c + 1);

          indices.push(i00, i01, i10);
          indices.push(i10, i01, i11);
          // Quad outline (the shared diagonal is internal)
          addEdge(i00, i01, cls);
          addEdge(i01, i11, cls);
          addEdge(i11, i10, cls);
          addEdge(i10, i00, cls);
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

    this.boundaryEdges = [...edgeUse.values()].filter(e => e.n === 1);
    this.rebuildWalls();
  }

  /** Deposit height factor applied to the per-pixel silt thickness (m). */
  private depositScale(): number {
    return this.options.thicknessMultiplier * (this.options.depthScale ?? 1) * DEPOSIT_VISUAL_SCALE;
  }

  /**
   * Deposit top (m MSL): bed + exaggerated thickness, but never above the water surface,
   * so shallow rim deposits keep their real thickness instead of standing up like a fence.
   */
  private depositTop(bedElev: number, thick: number): number {
    const scaled = bedElev + thick * this.depositScale();
    if (this.options.capLevel === undefined) return scaled;
    return Math.max(bedElev + thick, Math.min(scaled, this.options.capLevel));
  }

  /**
   * Deposit at a local point for cross-section rendering: bed-relative top (m MSL) and class,
   * or null where Sentinel-2 classified no silt or the layer is hidden.
   */
  public sampleDeposit(x: number, z: number, bedElev: number): { top: number; cls: number; thick: number } | null {
    if (!this.options.visible) return null;
    const month = this.siltData.months[this.options.activeMonth] || this.siltData.months[this.siltData.activeDefaultMonth];
    const bbox = this.siltData.bbox.local;
    if (x < bbox.minX || x > bbox.maxX || z < bbox.minZ || z > bbox.maxZ) return null;
    const { width: gw, height: gh } = month.gridDimensions;
    const col = Math.min(gw - 1, Math.max(0, Math.floor(((x - bbox.minX) / bbox.width) * gw)));
    const row = Math.min(gh - 1, Math.max(0, Math.floor(((z - bbox.minZ) / bbox.depth) * gh)));
    const cls = month.classGrid[row]?.[col] ?? 0;
    if (cls === 0) return null;
    const thick = month.thicknessGrid[row]?.[col] ?? 0;
    return { top: this.depositTop(bedElev, thick), cls, thick };
  }

  public get visualMode(): SiltVisualMode {
    return this.options.visualMode;
  }

  public setCapLevel(level: number | undefined) {
    if (this.options.capLevel === level) return;
    this.options.capLevel = level;
    this.updateVertexHeights();
  }

  /**
   * Vertical walls along the deposit outline, from the silt top down to the (carved) bed,
   * coloured by class (or volume ramp) and darkened toward the bottom so the deposit
   * reads as a solid body in side and oblique views.
   */
  private rebuildWalls() {
    if (this.walls) {
      this.group.remove(this.walls);
      this.walls.geometry.dispose();
      this.walls = null;
    }
    if (!this.mesh || !this.baseBedElevations || !this.baseThicknesses || this.boundaryEdges.length === 0) return;

    const pos = this.mesh.geometry.attributes.position;
    const ex = this.options.verticalExaggeration;
    const positions: number[] = [];
    const colors: number[] = [];

    const colorFor = (cls: number, thick: number): THREE.Color => {
      if (this.options.visualMode === 'classification') return CLASS_WALL_COLORS[cls] ?? CLASS_WALL_COLORS[1];
      const t = Math.min(1, thick / 0.9658) * (VOLUME_RAMP.length - 1);
      const i = Math.min(VOLUME_RAMP.length - 2, Math.floor(t));
      return VOLUME_RAMP[i].clone().lerp(VOLUME_RAMP[i + 1], t - i);
    };

    for (const { a, b, cls } of this.boundaryEdges) {
      const ax = pos.getX(a), az = pos.getZ(a), ay = pos.getY(a);
      const bx = pos.getX(b), bz = pos.getZ(b), by = pos.getY(b);
      const aBot = this.baseBedElevations[a] * ex;
      const bBot = this.baseBedElevations[b] * ex;
      const top = colorFor(cls, (this.baseThicknesses[a] + this.baseThicknesses[b]) / 2);
      const bot = top.clone().multiplyScalar(0.55);
      const quad: [number, number, number, THREE.Color][] = [
        [ax, ay, az, top], [bx, by, bz, top], [ax, aBot, az, bot],
        [bx, by, bz, top], [bx, bBot, bz, bot], [ax, aBot, az, bot]
      ];
      for (const [x, y, z, col] of quad) {
        positions.push(x, y, z);
        colors.push(col.r, col.g, col.b);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
    geo.computeVertexNormals();
    this.walls = new THREE.Mesh(geo, this.wallMaterial);
    this.walls.renderOrder = 3;
    this.walls.userData = { isSiltLayer: true };
    this.group.add(this.walls);
  }

  /**
   * Load and apply the appropriate texture based on active month and visual mode.
   */
  public updateTexture() {
    const month = this.siltData.months[this.options.activeMonth] || this.siltData.months[this.siltData.activeDefaultMonth];
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

  public setBedElevationFn(fn: ((x: number, z: number, baseElev: number) => number) | null) {
    this.bedElevationFn = fn;
    this.rebuildGeometry();
  }

  public setVisualMode(mode: SiltVisualMode) {
    if (this.options.visualMode === mode) return;
    this.options.visualMode = mode;
    this.updateTexture();
    this.rebuildWalls();
  }

  public setDepthScale(scale: number) {
    if (this.options.depthScale === scale) return;
    this.options.depthScale = scale;
    this.updateVertexHeights();
  }

  public setOpacity(opacity: number) {
    this.options.opacity = opacity;
    this.material.opacity = opacity;
    this.material.needsUpdate = true;
    this.wallMaterial.opacity = opacity;
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
      const y = this.depositTop(bedElev, thick) * this.options.verticalExaggeration;
      posAttr.setY(i, y);
    }
    posAttr.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.rebuildWalls();
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
    this.walls?.geometry.dispose();
    this.material.dispose();
    this.wallMaterial.dispose();
  }
}
