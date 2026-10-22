import * as THREE from 'three';

export class InspectionMarker {
  public group: THREE.Group;
  private pinMesh: THREE.Mesh;
  private ringMesh: THREE.Mesh;
  private measurementLine: THREE.Line | null = null;
  private verticalLineGeo: THREE.BufferGeometry | null = null;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'InspectionMarkerGroup';

    // Glowing cyan marker pin
    const pinGeo = new THREE.SphereGeometry(3.5, 16, 16);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    this.pinMesh = new THREE.Mesh(pinGeo, pinMat);

    // Outer radar ring
    const ringGeo = new THREE.RingGeometry(5, 7, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    this.ringMesh = new THREE.Mesh(ringGeo, ringMat);

    this.group.add(this.pinMesh);
    this.group.add(this.ringMesh);
    this.group.visible = false;
  }

  public setPosition(x: number, y: number, z: number, origY: number | null, exaggeration: number) {
    this.group.position.set(x, y, z);
    this.group.visible = true;

    // If measurement caliper between origY and current Y
    if (this.measurementLine) {
      this.group.remove(this.measurementLine);
      this.verticalLineGeo?.dispose();
      this.measurementLine = null;
    }

    if (origY !== null && origY < y / exaggeration) {
      const origSceneY = origY * exaggeration;
      const currentSceneY = y;
      
      const pts = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, origSceneY - currentSceneY, 0)
      ];
      this.verticalLineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineDashedMaterial({
        color: 0xf59e0b, // Amber sediment caliper
        dashSize: 2,
        gapSize: 1,
        linewidth: 3
      });
      this.measurementLine = new THREE.Line(this.verticalLineGeo, lineMat);
      this.measurementLine.computeLineDistances();
      this.group.add(this.measurementLine);
    }
  }

  public hide() {
    this.group.visible = false;
  }

  public animate(clock: THREE.Clock) {
    if (!this.group.visible) return;
    const elapsed = clock.getElapsedTime();
    // Pulse ring scale
    const s = 1 + Math.sin(elapsed * 4) * 0.2;
    this.ringMesh.scale.set(s, s, s);
  }

  public dispose() {
    this.pinMesh.geometry.dispose();
    this.ringMesh.geometry.dispose();
    this.verticalLineGeo?.dispose();
  }
}
