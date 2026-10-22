import * as THREE from 'three';
import { SkyPalette, SunPosition } from '../../utils/liveWeather';

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // pin to the far plane
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 sunColor;
  uniform vec3 sunDir;
  uniform float sunVisible;
  uniform float cloudCover;
  uniform vec3 cloudColor;
  uniform float time;
  uniform vec2 wind;
  varying vec3 vDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    float t = smoothstep(-0.02, 0.55, h);
    vec3 col = mix(horizonColor, topColor, t);
    // below the horizon: settle into the horizon haze
    col = mix(col, horizonColor * 0.92, smoothstep(0.0, -0.15, h));

    // sun disc + glow
    float s = max(dot(dir, normalize(sunDir)), 0.0);
    col += sunColor * sunVisible * (pow(s, 900.0) * 2.0 + pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.08);

    // clouds projected on a dome above the camera, drifting slowly; amount follows live cloud cover
    if (h > 0.0 && cloudCover > 0.01) {
      vec2 uv = dir.xz / (h + 0.18) * 1.6 + wind * time * 0.00025;
      float n = fbm(uv);
      float threshold = 1.0 - cloudCover * 0.85;
      float c = smoothstep(threshold - 0.18, threshold + 0.12, n) * smoothstep(0.0, 0.12, h);
      col = mix(col, cloudColor, c * 0.9);
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * Sky dome driven by live conditions (see utils/liveWeather): gradient sky, real sun direction
 * and procedural clouds. Kept centred on the camera so it always surrounds the scene.
 */
export class LiveSky {
  public mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(radius = 9000) {
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        topColor: { value: new THREE.Color('#2f7fd0') },
        horizonColor: { value: new THREE.Color('#bfe0f4') },
        sunColor: { value: new THREE.Color('#fff6e0') },
        sunDir: { value: new THREE.Vector3(0.3, 0.8, -0.2) },
        sunVisible: { value: 1 },
        cloudCover: { value: 0.2 },
        cloudColor: { value: new THREE.Color('#f4f6f8') },
        time: { value: 0 },
        wind: { value: new THREE.Vector2(4, 1) }
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), this.material);
    this.mesh.name = 'LiveSkyDome';
    this.mesh.renderOrder = -10;
    this.mesh.frustumCulled = false;
  }

  public apply(palette: SkyPalette, sun: SunPosition) {
    const u = this.material.uniforms;
    u.topColor.value.setRGB(...palette.top);
    u.horizonColor.value.setRGB(...palette.horizon);
    u.sunColor.value.setRGB(...palette.sunColor);
    u.sunVisible.value = palette.sunVisible;
    u.cloudCover.value = palette.cloudCover;
    u.cloudColor.value.setRGB(...palette.cloudColor);
    // Scene axes: +X east, +Y up, +Z south
    const e = THREE.MathUtils.degToRad(sun.elevationDeg);
    const a = THREE.MathUtils.degToRad(sun.azimuthDeg);
    u.sunDir.value.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
  }

  /** Cloud drift velocity (x east, z south), same units as the 3D clouds. */
  public setWind(x: number, z: number) {
    this.material.uniforms.wind.value.set(x, z);
  }

  /** Follow the camera and advance cloud drift. */
  public update(camera: THREE.Camera, elapsed: number) {
    this.mesh.position.copy(camera.position);
    this.material.uniforms.time.value = elapsed;
  }

  public dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
