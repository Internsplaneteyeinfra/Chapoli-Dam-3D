import * as THREE from 'three';
import { LiveWeather, isRainy } from '../../utils/liveWeather';

/** Where a raindrop lands: scene-space height and whether it hits the reservoir water. */
export type SurfaceSampler = (x: number, z: number) => { y: number; water: boolean } | null;

const CENTER = new THREE.Vector2(-30, 30); // reservoir centre (local x, z)
const CLOUD_RING_MIN = 900;
const CLOUD_RING_MAX = 5200;
// Clouds float above the highest camera position (target ~110 + max zoom-out 2600), so they
// only ever appear in the sky above the horizon and never between the camera and the site
const CLOUD_BASE_HEIGHT = 3600; // minus up to ~775 for puff spread + half sprite height, still > 2710
const RAIN_HALF_SIZE = 1000; // rain falls over a 2 km square around the reservoir
const RAIN_DROPS = 5000;
const RAIN_FALL_SPEED = 650; // scene units / s
const STREAK_LENGTH = 16;
const RIPPLES = 320;
const RIPPLE_LIFE = 0.9; // s

/** Soft cloud puff texture: a few overlapping radial blobs on a canvas. */
const createPuffTexture = (): THREE.Texture => {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const blobs = [[64, 70, 46], [42, 76, 30], [86, 74, 32], [60, 52, 30], [78, 58, 24]];
  for (const [x, y, r] of blobs) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

interface Ripple { x: number; y: number; z: number; age: number; maxScale: number; water: boolean; active: boolean }

/**
 * Live weather in the 3D scene: drifting clouds around the valley (few when sunny, many when
 * cloudy, small darker ones in rain), rain streaks slanted by the live wind, and ripple /
 * splash rings where drops land on the reservoir water and on the ground.
 */
export class WeatherEffects {
  public group: THREE.Group;
  private puffTexture: THREE.Texture;
  private clouds: THREE.Group;
  private cloudMaterial: THREE.SpriteMaterial;

  private rain: THREE.LineSegments;
  private rainPositions: Float32Array;
  private drops: { x: number; y: number; z: number; ground: number; water: boolean; speed: number }[] = [];

  private ripples: THREE.InstancedMesh;
  private rippleState: Ripple[] = [];
  private nextRipple = 0;
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();

  private wind = new THREE.Vector2(0, 0); // scene units / s the clouds drift (x east, z south)
  private windKmh = 0;
  private raining = false;
  private surface: SurfaceSampler | null = null;
  private cloudSignature = '';

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'WeatherEffects';
    this.puffTexture = createPuffTexture();

    this.cloudMaterial = new THREE.SpriteMaterial({
      map: this.puffTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.92
    });
    this.clouds = new THREE.Group();
    this.group.add(this.clouds);

    this.rainPositions = new Float32Array(RAIN_DROPS * 6);
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    this.rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({
      color: 0xd6e6f5,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.group.add(this.rain);

    const ringGeo = new THREE.RingGeometry(0.75, 1, 28);
    ringGeo.rotateX(-Math.PI / 2);
    this.ripples = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending, // instance colour fading to black = fading out
      depthWrite: false,
      side: THREE.DoubleSide
    }), RIPPLES);
    this.ripples.frustumCulled = false;
    this.ripples.renderOrder = 7;
    for (let i = 0; i < RIPPLES; i++) {
      this.rippleState.push({ x: 0, y: 0, z: 0, age: 0, maxScale: 1, water: true, active: false });
      this.ripples.setColorAt(i, this.color.setRGB(0, 0, 0));
      this.dummy.scale.setScalar(0.0001);
      this.dummy.updateMatrix();
      this.ripples.setMatrixAt(i, this.dummy.matrix);
    }
    this.ripples.visible = false;
    this.group.add(this.ripples);
  }

  /** Current cloud drift velocity (x east, y = scene z / south), for the sky dome. */
  public get windVector(): THREE.Vector2 {
    return this.wind;
  }

  /** Surface height sampler (terrain or water) used for where drops land. */
  public setSurface(sampler: SurfaceSampler) {
    this.surface = sampler;
    if (this.raining) this.resetRain();
  }

  public setWeather(w: LiveWeather) {
    // Meteorological direction is where the wind comes FROM; drift toward the opposite bearing
    const toward = THREE.MathUtils.degToRad(w.windDirectionDeg + 180);
    const speed = Math.max(4, w.windSpeedKmh * 1.6);
    this.wind.set(Math.sin(toward) * speed, -Math.cos(toward) * speed);
    this.windKmh = w.windSpeedKmh;

    const rain = isRainy(w.weatherCode);
    const cloud = w.cloudCover / 100;
    const count = rain ? 9 : Math.round(5 + cloud * 22);
    const signature = `${count}-${rain}`;
    if (signature !== this.cloudSignature) {
      this.cloudSignature = signature;
      this.buildClouds(count, rain);
    }

    if (rain !== this.raining) {
      this.raining = rain;
      this.rain.visible = rain;
      this.ripples.visible = rain;
      if (rain) this.resetRain();
    }
  }

  private buildClouds(count: number, rain: boolean) {
    this.clouds.clear();
    // Rain: a few small, slightly dark clouds; otherwise bright white
    this.cloudMaterial.color.set(rain ? '#8f9aa7' : '#ffffff');
    for (let i = 0; i < count; i++) {
      const cloud = new THREE.Group();
      const puffs = 4 + Math.floor(Math.random() * 4);
      const base = (rain ? 380 : 520) + Math.random() * (rain ? 220 : 480);
      for (let j = 0; j < puffs; j++) {
        const sprite = new THREE.Sprite(this.cloudMaterial);
        const s = base * (0.6 + Math.random() * 0.6);
        sprite.scale.set(s * 1.6, s, 1);
        sprite.position.set((Math.random() - 0.5) * base * 2.2, (Math.random() - 0.5) * base * 0.35, (Math.random() - 0.5) * base);
        cloud.add(sprite);
      }
      const a = Math.random() * Math.PI * 2;
      const r = CLOUD_RING_MIN + Math.random() * (CLOUD_RING_MAX - CLOUD_RING_MIN);
      cloud.position.set(CENTER.x + Math.cos(a) * r, CLOUD_BASE_HEIGHT + Math.random() * 600, CENTER.y + Math.sin(a) * r);
      this.clouds.add(cloud);
    }
  }

  private spawnDrop(i: number, anywhereInColumn: boolean) {
    const x = CENTER.x + (Math.random() * 2 - 1) * RAIN_HALF_SIZE;
    const z = CENTER.y + (Math.random() * 2 - 1) * RAIN_HALF_SIZE;
    const hit = this.surface?.(x, z) ?? { y: 0, water: false };
    const top = hit.y + 300 + Math.random() * 600;
    const d = this.drops[i] ?? (this.drops[i] = { x, y: top, z, ground: hit.y, water: hit.water, speed: 0 });
    d.x = x;
    d.z = z;
    d.ground = hit.y;
    d.water = hit.water;
    d.speed = RAIN_FALL_SPEED * (0.85 + Math.random() * 0.3);
    d.y = anywhereInColumn ? hit.y + Math.random() * (top - hit.y) : top;
  }

  private resetRain() {
    for (let i = 0; i < RAIN_DROPS; i++) this.spawnDrop(i, true);
  }

  private addRipple(x: number, y: number, z: number, water: boolean) {
    const r = this.rippleState[this.nextRipple];
    this.nextRipple = (this.nextRipple + 1) % RIPPLES;
    r.x = x;
    r.y = y + 0.6;
    r.z = z;
    r.age = 0;
    r.water = water;
    r.maxScale = water ? 9 + Math.random() * 6 : 3 + Math.random() * 2;
    r.active = true;
  }

  public update(dt: number) {
    const step = Math.min(dt, 0.1);

    // Clouds drift with the live wind and wrap around the valley
    for (const cloud of this.clouds.children) {
      cloud.position.x += this.wind.x * step;
      cloud.position.z += this.wind.y * step;
      const dx = cloud.position.x - CENTER.x;
      const dz = cloud.position.z - CENTER.y;
      if (Math.hypot(dx, dz) > CLOUD_RING_MAX + 400) {
        cloud.position.x = CENTER.x - dx * 0.95;
        cloud.position.z = CENTER.y - dz * 0.95;
      }
    }

    if (!this.raining) return;

    // Rain streaks slanted along the wind
    const slant = Math.min(0.6, this.windKmh / 40);
    const wl = this.wind.length() || 1;
    const sx = (this.wind.x / wl) * slant;
    const sz = (this.wind.y / wl) * slant;
    let ripplesThisFrame = 0;
    for (let i = 0; i < RAIN_DROPS; i++) {
      const d = this.drops[i];
      d.y -= d.speed * step;
      d.x += sx * d.speed * step;
      d.z += sz * d.speed * step;
      if (d.y <= d.ground) {
        // Only a share of hits make visible rings so the pool always has fresh ones
        if (ripplesThisFrame < 30 && Math.random() < (d.water ? 0.7 : 0.3)) {
          this.addRipple(d.x, d.ground, d.z, d.water);
          ripplesThisFrame++;
        }
        this.spawnDrop(i, false);
      }
      const o = i * 6;
      this.rainPositions[o] = d.x;
      this.rainPositions[o + 1] = d.y;
      this.rainPositions[o + 2] = d.z;
      this.rainPositions[o + 3] = d.x - sx * STREAK_LENGTH;
      this.rainPositions[o + 4] = d.y + STREAK_LENGTH;
      this.rainPositions[o + 5] = d.z - sz * STREAK_LENGTH;
    }
    (this.rain.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    // Expanding, fading ripple rings
    for (let i = 0; i < RIPPLES; i++) {
      const r = this.rippleState[i];
      if (!r.active) continue;
      r.age += step;
      const t = r.age / RIPPLE_LIFE;
      if (t >= 1) {
        r.active = false;
        this.dummy.scale.setScalar(0.0001);
        this.ripples.setColorAt(i, this.color.setRGB(0, 0, 0));
      } else {
        this.dummy.scale.setScalar(0.5 + t * r.maxScale);
        const fade = (1 - t) * (r.water ? 0.85 : 0.5);
        this.ripples.setColorAt(i, r.water ? this.color.setRGB(0.75 * fade, 0.9 * fade, fade) : this.color.setRGB(fade, fade, fade));
      }
      this.dummy.position.set(r.x, r.y, r.z);
      this.dummy.updateMatrix();
      this.ripples.setMatrixAt(i, this.dummy.matrix);
    }
    this.ripples.instanceMatrix.needsUpdate = true;
    if (this.ripples.instanceColor) this.ripples.instanceColor.needsUpdate = true;
  }

  public dispose() {
    this.clouds.clear();
    this.cloudMaterial.dispose();
    this.puffTexture.dispose();
    this.rain.geometry.dispose();
    (this.rain.material as THREE.Material).dispose();
    this.ripples.geometry.dispose();
    (this.ripples.material as THREE.Material).dispose();
  }
}
