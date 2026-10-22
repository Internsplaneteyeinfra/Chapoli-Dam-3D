import * as THREE from 'three';

export class TransectLineVisual {
  public group: THREE.Group;
  private lineMesh: THREE.Line | null = null;
  private beaconA: THREE.Mesh;
  private beaconB: THREE.Mesh;
  private lineGeo: THREE.BufferGeometry | null = null;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'TransectVisualGroup';

    // Beacon A (Emerald Green)
    const coneGeo = new THREE.ConeGeometry(4, 12, 16);
    coneGeo.rotateX(Math.PI); // Point downward
    const beaconMatA = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    this.beaconA = new THREE.Mesh(coneGeo, beaconMatA);

    // Beacon B (Rose Pink)
    const beaconMatB = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
    this.beaconB = new THREE.Mesh(coneGeo, beaconMatB);

    this.group.add(this.beaconA);
    this.group.add(this.beaconB);
    this.group.visible = false;
  }

  public setPoints(
    start: [number, number],
    end: [number, number],
    elevStart: number,
    elevEnd: number,
    exaggeration: number
  ) {
    if (this.lineMesh) {
      this.group.remove(this.lineMesh);
      this.lineGeo?.dispose();
    }

    const startV = new THREE.Vector3(start[0], elevStart * exaggeration + 5, start[1]);
    const endV = new THREE.Vector3(end[0], elevEnd * exaggeration + 5, end[1]);

    this.beaconA.position.copy(startV);
    this.beaconB.position.copy(endV);

    const pts = [startV, endV];
    this.lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      linewidth: 3
    });
    this.lineMesh = new THREE.Line(this.lineGeo, lineMat);
    this.group.add(this.lineMesh);
    this.group.visible = true;
  }

  public hide() {
    this.group.visible = false;
  }

  public dispose() {
    this.beaconA.geometry.dispose();
    this.beaconB.geometry.dispose();
    this.lineGeo?.dispose();
  }
}
