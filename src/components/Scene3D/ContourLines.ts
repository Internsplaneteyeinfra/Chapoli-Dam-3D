import * as THREE from 'three';
import { ChapoliData } from '../../types/reservoir';

export interface ContourOptions {
  verticalExaggeration: number;
  visible: boolean;
  majorInterval: number; // 5 meters
}

export class ContourLines {
  public group: THREE.Group;
  private data: ChapoliData;
  private options: ContourOptions;
  private lineObjects: { line: THREE.LineSegments | THREE.LineLoop | THREE.Line; elev: number; baseY: number }[] = [];

  constructor(data: ChapoliData, options: ContourOptions) {
    this.data = data;
    this.options = options;
    this.group = new THREE.Group();
    this.group.name = 'ContourLinesGroup';

    this.buildContours();
    this.group.visible = this.options.visible;
  }

  private buildContours() {
    for (const contour of this.data.contours) {
      const elev = contour.elevation;
      const isMajor = Math.round(elev) % this.options.majorInterval === 0;
      const isFRL = Math.abs(elev - 38) < 0.5;

      // Subtle, refined line styling that conforms cleanly to the terrain
      let colorHex = 0x64748b; // Subtle slate for minor 1m contours
      if (isMajor) colorHex = 0x38bdf8; // Cyan for 5m major contours
      if (isFRL) colorHex = 0x0284c7; // Deep blue near FRL

      const mat = new THREE.LineBasicMaterial({
        color: colorHex,
        linewidth: isMajor ? 1.5 : 1,
        transparent: true,
        opacity: isMajor ? 0.75 : 0.35
      });

      for (const seg of contour.segments) {
        const pts: THREE.Vector3[] = [];
        for (const pt of seg.local) {
          // Add small 0.05m visual offset to prevent z-fighting with terrain faces
          pts.push(new THREE.Vector3(pt[0], elev * this.options.verticalExaggeration + 0.05, pt[1]));
        }

        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const line = seg.isClosed ? new THREE.LineLoop(geo, mat) : new THREE.Line(geo, mat);
        line.userData = { isContour: true, elevation: elev, isMajor };
        
        this.group.add(line);
        this.lineObjects.push({ line, elev, baseY: elev });
      }
    }
  }

  public updateExaggeration(exaggeration: number) {
    this.options.verticalExaggeration = exaggeration;
    for (const item of this.lineObjects) {
      const posAttr = item.line.geometry.attributes.position;
      const count = posAttr.count;
      for (let i = 0; i < count; i++) {
        posAttr.setY(i, item.baseY * exaggeration + 0.05);
      }
      posAttr.needsUpdate = true;
    }
  }

  public setVisible(visible: boolean) {
    this.options.visible = visible;
    this.group.visible = visible;
  }

  public dispose() {
    for (const item of this.lineObjects) {
      item.line.geometry.dispose();
    }
  }
}
