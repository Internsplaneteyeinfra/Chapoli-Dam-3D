import * as THREE from 'three';
import { WaterDepthPayload } from '../../types/waterDepth';

export interface PermanentWaterLayerOptions {
  visible: boolean;
  waterLevel: number;
  baselineLevel?: number;
  verticalExaggeration: number;
  opacity: number;
  /** Extra exaggeration applied only to the water body's depth (bottom goes depth x scale below the surface) */
  depthScale: number;
}

// Body colours: light blue at the surface edge fading to deep navy at the bottom
const BODY_TOP = new THREE.Color('#38bdf8');
const BODY_DEEP = new THREE.Color('#0c2d5a');

// Flow toward the dam (west, -X), in UV units per second
export const FLOW_SPEED = 0.012;
export const RIPPLE_REPEAT = 22;

/** Tileable ripple normal map built from a few periodic sine waves. */
export const createRippleNormalMap = (size = 256): THREE.DataTexture => {
  const h = new Float32Array(size * size);
  const waves = [
    { kx: 3, ky: 1, a: 1.0, p: 0.0 },
    { kx: -2, ky: 4, a: 0.7, p: 1.3 },
    { kx: 5, ky: -3, a: 0.45, p: 2.1 },
    { kx: 1, ky: 7, a: 0.3, p: 0.6 },
    { kx: 8, ky: 2, a: 0.2, p: 2.9 }
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      for (const w of waves) {
        v += w.a * Math.sin(2 * Math.PI * (w.kx * x + w.ky * y) / size + w.p);
      }
      h[y * size + x] = v;
    }
  }
  const data = new Uint8Array(size * size * 4);
  const strength = 2.2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = h[y * size + ((x - 1 + size) % size)];
      const r = h[y * size + ((x + 1) % size)];
      const d = h[((y - 1 + size) % size) * size + x];
      const u = h[((y + 1) % size) * size + x];
      const n = new THREE.Vector3((l - r) * strength, (d - u) * strength, 1).normalize();
      const i = (y * size + x) * 4;
      data[i] = (n.x * 0.5 + 0.5) * 255;
      data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(RIPPLE_REPEAT, RIPPLE_REPEAT);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
};

/**
 * Sentinel-1 permanent water rendered as a 3D water body:
 * - a flowing surface at the water level, shaded blue by Sentinel-2 relative
 *   depth (light blue = shallow, navy = deep), with ripples drifting toward the dam;
 * - side walls extruded down by the satellite depth (6.5 - 20 m) times `depthScale`,
 *   meeting the reservoir bed, which is carved to the same depth (TerrainMesh.setBedCarve).
 */
export class PermanentWaterLayer {
  public group: THREE.Group;
  private wd: WaterDepthPayload;
  private options: PermanentWaterLayerOptions;

  private surface: THREE.Mesh;
  private surfaceMaterial: THREE.MeshStandardMaterial;
  private body: THREE.Mesh | null = null;
  private bodyMaterial: THREE.MeshStandardMaterial;
  private texture: THREE.Texture | null = null;
  private rippleMap: THREE.DataTexture;
  private bodyVisible = true;

  constructor(wd: WaterDepthPayload, options: PermanentWaterLayerOptions) {
    this.wd = wd;
    this.options = options;
    this.group = new THREE.Group();
    this.group.name = 'PermanentWaterDepthGroup';

    this.rippleMap = createRippleNormalMap();

    this.surfaceMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.18,
      metalness: 0.15,
      normalMap: this.rippleMap,
      normalScale: new THREE.Vector2(0.6, 0.6),
      emissive: 0xffffff,
      emissiveIntensity: 0.35, // keeps the depth blues readable under scene lighting
      transparent: true,
      opacity: options.opacity,
      alphaTest: 0.35,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      side: THREE.DoubleSide
    });

    this.bodyMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.3,
      metalness: 0.1,
      emissive: 0x0c4a6e,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: Math.min(0.8, options.opacity),
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const b = wd.bbox.local;
    const geo = new THREE.PlaneGeometry(b.width, b.depth);
    // Plane lies in XZ; UV v=1 (image top) must sit at minZ (north)
    geo.rotateX(-Math.PI / 2);
    geo.translate(b.minX + b.width / 2, 0, b.minZ + b.depth / 2);

    this.surface = new THREE.Mesh(geo, this.surfaceMaterial);
    this.surface.renderOrder = 5;
    this.surface.userData = { isPermanentWater: true };
    this.group.add(this.surface);

    new THREE.TextureLoader().load(wd.depth.dataUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      this.texture = tex;
      this.surfaceMaterial.map = tex;
      this.surfaceMaterial.emissiveMap = tex;
      this.surfaceMaterial.needsUpdate = true;
    });

    this.rebuild();
    this.group.visible = options.visible;
  }

  /** Corner (vertex) depth = mean depth of the wet cells touching that corner. */
  private cornerDepths(): Float32Array {
    const { width: W, height: H } = this.wd.gridDimensions;
    const grid = this.wd.waterGrid;
    const depth = this.wd.depthGrid;
    const out = new Float32Array((W + 1) * (H + 1));
    for (let r = 0; r <= H; r++) {
      for (let c = 0; c <= W; c++) {
        let sum = 0;
        let n = 0;
        for (const [rr, cc] of [[r - 1, c - 1], [r - 1, c], [r, c - 1], [r, c]]) {
          if (rr >= 0 && rr < H && cc >= 0 && cc < W && grid[rr][cc]) {
            sum += depth[rr][cc];
            n++;
          }
        }
        out[r * (W + 1) + c] = n ? sum / n : 0;
      }
    }
    return out;
  }

  /** Rebuild the extruded water walls for the current level, depth scale and exaggeration. */
  private rebuild() {
    this.surface.position.y = this.options.waterLevel * this.options.verticalExaggeration;

    if (this.body) {
      this.group.remove(this.body);
      this.body.geometry.dispose();
      this.body = null;
    }

    const { width: W, height: H } = this.wd.gridDimensions;
    const grid = this.wd.waterGrid;
    const b = this.wd.bbox.local;
    const ex = this.options.verticalExaggeration;
    const topY = this.options.waterLevel * ex;
    const maxDepth = this.wd.depth.maxDepthM || 20;
    const corners = this.cornerDepths();

    const positions: number[] = [];
    const colors: number[] = [];
    const cx = (c: number) => b.minX + (c / W) * b.width;
    const cz = (r: number) => b.minZ + (r / H) * b.depth;
    const depthAt = (r: number, c: number) => corners[r * (W + 1) + c];
    const baseline = this.options.baselineLevel ?? 38.25;
    const bottomY = (r: number, c: number) => Math.min(topY, (baseline - depthAt(r, c) * this.options.depthScale) * ex);
    const colorFor = (d: number) => BODY_TOP.clone().lerp(BODY_DEEP, Math.min(1, d / maxDepth));

    const pushVert = (x: number, y: number, z: number, col: THREE.Color) => {
      positions.push(x, y, z);
      colors.push(col.r, col.g, col.b);
    };

    const isWet = (r: number, c: number) => r >= 0 && r < H && c >= 0 && c < W && !!grid[r][c];

    // Wall quad between grid corners (r0,c0)-(r1,c1), from surface down to the bottom
    const pushWall = (r0: number, c0: number, r1: number, c1: number) => {
      const b0 = bottomY(r0, c0), b1 = bottomY(r1, c1);
      // Skip if water level is at or below bed elevation
      if (topY <= b0 && topY <= b1) return;
      const x0 = cx(c0), z0 = cz(r0), x1 = cx(c1), z1 = cz(r1);
      const deep0 = colorFor(depthAt(r0, c0)), deep1 = colorFor(depthAt(r1, c1));
      pushVert(x0, topY, z0, BODY_TOP);
      pushVert(x1, topY, z1, BODY_TOP);
      pushVert(x0, b0, z0, deep0);
      pushVert(x1, topY, z1, BODY_TOP);
      pushVert(x1, b1, z1, deep1);
      pushVert(x0, b0, z0, deep0);
    };

    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        if (!grid[r][c]) continue;

        // No bottom faces: the reservoir bed is carved to this depth and forms the floor.
        // Walls on edges facing dry cells
        if (!isWet(r - 1, c)) pushWall(r, c, r, c + 1);
        if (!isWet(r + 1, c)) pushWall(r + 1, c, r + 1, c + 1);
        if (!isWet(r, c - 1)) pushWall(r, c, r + 1, c);
        if (!isWet(r, c + 1)) pushWall(r, c + 1, r + 1, c + 1);
      }
    }

    if (positions.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
      geo.computeVertexNormals();

      this.body = new THREE.Mesh(geo, this.bodyMaterial);
      this.body.renderOrder = 4;
      this.body.name = 'PermanentWaterBody';
      this.body.visible = this.bodyVisible;
      this.group.add(this.body);
    }
  }

  public setWaterLevel(level: number) {
    if (this.options.waterLevel === level) return;
    this.options.waterLevel = level;
    this.rebuild();
  }

  public setDepthScale(scale: number) {
    if (this.options.depthScale === scale) return;
    this.options.depthScale = scale;
    this.rebuild();
  }

  public updateExaggeration(exaggeration: number) {
    if (this.options.verticalExaggeration === exaggeration) return;
    this.options.verticalExaggeration = exaggeration;
    this.rebuild();
  }

  public setOpacity(opacity: number) {
    this.options.opacity = opacity;
    this.surfaceMaterial.opacity = opacity;
    this.bodyMaterial.opacity = Math.min(0.8, opacity);
  }

  /** Show or hide the extruded side walls (the surface stays); hidden while silt is shown. */
  public setBodyVisible(visible: boolean) {
    this.bodyVisible = visible;
    if (this.body) this.body.visible = visible;
  }

  public setVisible(visible: boolean) {
    this.options.visible = visible;
    this.group.visible = visible;
  }

  /** Drift the ripple normal map toward the dam for a flowing-water surface. */
  public animate(clock: THREE.Clock) {
    if (!this.group.visible) return;
    const t = clock.getElapsedTime();
    this.rippleMap.offset.set(t * FLOW_SPEED * RIPPLE_REPEAT * 0.1, Math.sin(t * 0.25) * 0.02);
  }

  public dispose() {
    this.texture?.dispose();
    this.rippleMap.dispose();
    this.surface.geometry.dispose();
    this.surfaceMaterial.dispose();
    this.body?.geometry.dispose();
    this.bodyMaterial.dispose();
  }
}
