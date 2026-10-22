import * as THREE from 'three';
import { TerrainMesh } from './TerrainMesh';
import { SiltLayer, CLASS_WALL_COLORS, VOLUME_RAMP } from './SiltLayer';
import { WaterDepthPayload, sampleWaterDepth } from '../../types/waterDepth';

export interface SectionCapParams {
  cutX: number;
  verticalExaggeration: number;
  terrain: TerrainMesh;
  silt: SiltLayer | null;
  waterDepthData?: WaterDepthPayload;
  waterVisible: boolean;
  waterLevel: number;
}

// Ground fill (sand/earth) from the section base up to the surface, as in a survey cross-section
const GROUND_TOP = new THREE.Color('#a8956a');
const GROUND_BOTTOM = new THREE.Color('#6b5a3e');
const WATER_COLOR = new THREE.Color('#1b6b8f');

const Z_STEP = 4; // m between section samples
const BASE_MARGIN = 12; // m of earth shown below the lowest surface point

/**
 * Solid cross-section face drawn on the east-west clipping plane (x = cutX), so the cut reads
 * like a survey section: earth up to the (carved) ground, the silt deposit band coloured by
 * class (or volume), and the permanent water column up to the observed surface.
 */
export class SectionCap {
  public group: THREE.Group;
  private solid: THREE.Mesh | null = null;
  private water: THREE.Mesh | null = null;
  private solidMaterial: THREE.MeshLambertMaterial;
  private waterMaterial: THREE.MeshLambertMaterial;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'SectionCapGroup';
    this.solidMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.waterMaterial = new THREE.MeshLambertMaterial({
      color: WATER_COLOR,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      side: THREE.DoubleSide
    });
  }

  public clear() {
    for (const m of [this.solid, this.water]) {
      if (m) {
        this.group.remove(m);
        m.geometry.dispose();
      }
    }
    this.solid = null;
    this.water = null;
  }

  public build(p: SectionCapParams) {
    this.clear();
    const ex = p.verticalExaggeration;
    // Just inside the kept (x >= cutX) side so the renderer clip plane does not remove it
    const x = p.cutX + 0.3;

    type Sample = { z: number; ground: number; siltTop: number | null; siltColor: THREE.Color | null; waterTop: number | null };
    const samples: Sample[] = [];
    for (let z = -1200; z <= 1200; z += Z_STEP) {
      const ground = p.terrain.sampleSurfaceElevation(x, z);
      if (ground === null) continue;
      let siltTop: number | null = null;
      let siltColor: THREE.Color | null = null;
      const dep = p.silt?.sampleDeposit(x, z, ground) ?? null;
      if (dep && dep.top > ground) {
        siltTop = dep.top;
        if (p.silt!.visualMode === 'classification') {
          siltColor = CLASS_WALL_COLORS[dep.cls] ?? CLASS_WALL_COLORS[1];
        } else {
          const t = Math.min(1, dep.thick / 0.9658) * (VOLUME_RAMP.length - 1);
          const i = Math.min(VOLUME_RAMP.length - 2, Math.floor(t));
          siltColor = VOLUME_RAMP[i].clone().lerp(VOLUME_RAMP[i + 1], t - i);
        }
      }
      let waterTop: number | null = null;
      if (p.waterVisible && p.waterDepthData && sampleWaterDepth(p.waterDepthData, x, z) !== null) {
        const floor = siltTop ?? ground;
        if (p.waterLevel > floor) waterTop = p.waterLevel;
      }
      samples.push({ z, ground, siltTop, siltColor, waterTop });
    }
    if (samples.length < 2) return;

    const base = Math.min(...samples.map(s => s.ground)) - BASE_MARGIN;
    const solidPos: number[] = [];
    const solidCol: number[] = [];
    const waterPos: number[] = [];

    const pushQuad = (
      pos: number[], col: number[] | null,
      z0: number, z1: number,
      y0a: number, y1a: number, y0b: number, y1b: number,
      cTop?: THREE.Color, cBot?: THREE.Color
    ) => {
      // (z0, y0a..y1a) and (z1, y0b..y1b): bottom edge y0, top edge y1
      const v = [
        [z0, y0a, cBot], [z1, y0b, cBot], [z0, y1a, cTop],
        [z1, y0b, cBot], [z1, y1b, cTop], [z0, y1a, cTop]
      ] as const;
      for (const [z, y, c] of v) {
        pos.push(x, y * ex, z);
        if (col && c) col.push(c.r, c.g, c.b);
      }
    };

    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i];
      const b = samples[i + 1];
      if (b.z - a.z > Z_STEP * 1.5) continue; // gap in the DTM

      // Earth from the section base up to the ground surface
      pushQuad(solidPos, solidCol, a.z, b.z, base, a.ground, base, b.ground, GROUND_TOP, GROUND_BOTTOM);

      // Silt band from the ground up to the deposit top
      if (a.siltTop !== null && b.siltTop !== null && a.siltColor) {
        const dark = a.siltColor.clone().multiplyScalar(0.7);
        pushQuad(solidPos, solidCol, a.z, b.z, a.ground, a.siltTop, b.ground, b.siltTop, a.siltColor, dark);
      }

      // Water column from the deposit (or ground) up to the surface
      if (a.waterTop !== null && b.waterTop !== null) {
        pushQuad(waterPos, null, a.z, b.z, a.siltTop ?? a.ground, a.waterTop, b.siltTop ?? b.ground, b.waterTop);
      }
    }

    const solidGeo = new THREE.BufferGeometry();
    solidGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(solidPos), 3));
    solidGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(solidCol), 3));
    solidGeo.computeVertexNormals();
    this.solid = new THREE.Mesh(solidGeo, this.solidMaterial);
    this.solid.renderOrder = 2;
    this.group.add(this.solid);

    if (waterPos.length) {
      const waterGeo = new THREE.BufferGeometry();
      waterGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(waterPos), 3));
      waterGeo.computeVertexNormals();
      this.water = new THREE.Mesh(waterGeo, this.waterMaterial);
      this.water.renderOrder = 6;
      this.group.add(this.water);
    }
  }

  public dispose() {
    this.clear();
    this.solidMaterial.dispose();
    this.waterMaterial.dispose();
  }
}
