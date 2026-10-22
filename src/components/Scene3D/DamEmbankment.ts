import * as THREE from 'three';
import { ChapoliData, DamGeometry } from '../../types/reservoir';
import { SedimentAnalysisEngine } from '../../utils/sedimentAnalysis';

export interface DamEmbankmentOptions {
  verticalExaggeration: number;
  visible: boolean;
  showAnnotations?: boolean;
}

export class DamEmbankment {
  public group: THREE.Group;
  private data: ChapoliData;
  private damGeom: DamGeometry;
  private options: DamEmbankmentOptions;
  private engine: SedimentAnalysisEngine;

  private crestMesh: THREE.Mesh | null = null;
  private upstreamMesh: THREE.Mesh | null = null;
  private downstreamMesh: THREE.Mesh | null = null;
  private spillwayMesh: THREE.Mesh | null = null;
  private caliperGroup: THREE.Group | null = null;
  private annotationGroup: THREE.Group | null = null;

  constructor(data: ChapoliData, options: DamEmbankmentOptions, engine: SedimentAnalysisEngine) {
    this.data = data;
    this.options = options;
    this.engine = engine;
    this.group = new THREE.Group();
    this.group.name = 'DamEmbankmentStructure';

    // Use verified geometry from Goa WRD or fallback defaults
    this.damGeom = data.dam_geometry || {
      name: 'Chapoli Earthen Dam',
      type: 'Earthen dam with ungated chute spillway',
      topOfDam_m: 41.00,
      crestLength_m: 760.0,
      calculatedCrestLength_m: 764.8,
      crestWidth_m: 6.0,
      structuralHeight_m: 25.50,
      deepestBedLevel_m: 15.50,
      spillwayCrest_m: 38.25,
      spillwayType: 'Chute un-gated type',
      maxHeadOverSpillway_m: 0.50,
      maxWaterLevel_m: 38.75,
      fullReservoirLevel_m: 38.25,
      minDrawdownLevel_m: 22.00,
      northAbutmentLocal: [-468.0, -411.6],
      southAbutmentLocal: [-389.8, 353.2],
      upstreamSlope: 2.5,
      downstreamSlope: 2.0,
      status: 'VERIFIED_OFFICIAL_WRD'
    };

    this.buildDam();
    this.group.visible = this.options.visible;
  }

  public buildDam() {
    // Clear previous objects
    while (this.group.children.length > 0) {
      const obj = this.group.children[0];
      this.group.remove(obj);
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    }

    const {
      topOfDam_m,
      crestWidth_m,
      upstreamSlope,
      downstreamSlope,
      northAbutmentLocal,
      southAbutmentLocal,
      spillwayCrest_m
    } = this.damGeom;

    const vEx = this.options.verticalExaggeration;

    // Vector along dam axis from North Abutment to South Abutment
    const pN = new THREE.Vector2(northAbutmentLocal[0], northAbutmentLocal[1]);
    const pS = new THREE.Vector2(southAbutmentLocal[0], southAbutmentLocal[1]);
    const axisVec = new THREE.Vector2().subVectors(pS, pN);
    const totalAxisLength = axisVec.length();
    const axisDir = axisVec.clone().normalize();

    // Normal vector pointing UPSTREAM (East, into reservoir basin)
    // In our coordinate system: +X is East, +Z is South.
    // axisDir points roughly South (+Z). A 90 deg CCW rotation gives (+X, 0) pointing East.
    // Upstream normal: (-axisDir.y, axisDir.x)
    let upNormal = new THREE.Vector2(-axisDir.y, axisDir.x);
    if (upNormal.x < 0) {
      upNormal.negate(); // Ensure pointing towards East (+X) into reservoir
    }
    const downNormal = upNormal.clone().negate(); // Points West (-X) downstream

    // Discretize dam axis into slices (e.g. 60 segments along the 760m length)
    const numSegments = 60;
    const halfWidth = crestWidth_m / 2;

    // Spillway station: from 70% to 75% along axis (~40m wide chute)
    const spillwayStartT = 0.68;
    const spillwayEndT = 0.74;

    // Geometries for Crest, Upstream slope, Downstream slope
    const crestVerts: number[] = [];
    const crestIndices: number[] = [];
    const crestColors: number[] = [];

    const upVerts: number[] = [];
    const upIndices: number[] = [];
    const upColors: number[] = [];

    const downVerts: number[] = [];
    const downIndices: number[] = [];
    const downColors: number[] = [];

    const spillVerts: number[] = [];
    const spillIndices: number[] = [];

    for (let i = 0; i <= numSegments; i++) {
      const t = i / numSegments;
      const center2D = new THREE.Vector2().lerpVectors(pN, pS, t);

      // Check if in spillway section
      const isSpillway = t >= spillwayStartT && t <= spillwayEndT;
      const crestElev = isSpillway ? spillwayCrest_m : topOfDam_m;

      // Sample underlying ground elevation at dam centerline and toes
      const groundAtCenter = this.engine.getPresentBedElevation(center2D.x, center2D.y).elevation ?? 30.0;
      
      // Crest upstream & downstream edges
      const crestUpX = center2D.x + upNormal.x * halfWidth;
      const crestUpZ = center2D.y + upNormal.y * halfWidth;
      const crestDownX = center2D.x + downNormal.x * halfWidth;
      const crestDownZ = center2D.y + downNormal.y * halfWidth;

      // Upstream toe: slope 1:2.5 down to ground
      const upGroundElev = Math.min(crestElev - 1.0, this.engine.getPresentBedElevation(crestUpX + upNormal.x * 20, crestUpZ + upNormal.y * 20).elevation ?? 25.0);
      const upHeight = Math.max(1.0, crestElev - upGroundElev);
      const upToeDist = halfWidth + upHeight * upstreamSlope;
      const toeUpX = center2D.x + upNormal.x * upToeDist;
      const toeUpZ = center2D.y + upNormal.y * upToeDist;

      // Downstream toe: slope 1:2.0 down to ground
      const downGroundElev = Math.min(crestElev - 1.0, this.engine.getPresentBedElevation(crestDownX + downNormal.x * 20, crestDownZ + downNormal.y * 20).elevation ?? 22.0);
      const downHeight = Math.max(1.0, crestElev - downGroundElev);
      const downToeDist = halfWidth + downHeight * downstreamSlope;
      const toeDownX = center2D.x + downNormal.x * downToeDist;
      const toeDownZ = center2D.y + downNormal.y * downToeDist;

      // 1. Crest Roadway vertices (left: down edge, right: up edge)
      crestVerts.push(crestDownX, crestElev * vEx, crestDownZ);
      crestVerts.push(crestUpX, crestElev * vEx, crestUpZ);

      // Road coloring: dark asphalt with edge curb marking
      if (isSpillway) {
        crestColors.push(0.75, 0.78, 0.82); // Concrete spillway crest
        crestColors.push(0.75, 0.78, 0.82);
      } else {
        crestColors.push(0.22, 0.24, 0.28); // Asphalt roadway
        crestColors.push(0.22, 0.24, 0.28);
      }

      // 2. Upstream Face: from crestUp to toeUp
      upVerts.push(crestUpX, crestElev * vEx, crestUpZ);
      upVerts.push(toeUpX, upGroundElev * vEx, toeUpZ);
      // Upstream coloring: Rip-rap stone armor (rocky slate/granite)
      upColors.push(0.32, 0.35, 0.38);
      upColors.push(0.25, 0.28, 0.30);

      // 3. Downstream Face: from crestDown to toeDown
      downVerts.push(crestDownX, crestElev * vEx, crestDownZ);
      downVerts.push(toeDownX, downGroundElev * vEx, toeDownZ);
      // Downstream coloring: Engineered turf embankment (compacted earth & grass)
      downColors.push(0.28, 0.38, 0.24);
      downColors.push(0.24, 0.32, 0.20);

      // Triangulation between consecutive slices
      if (i > 0) {
        const v0 = (i - 1) * 2;
        const v1 = v0 + 1;
        const v2 = i * 2;
        const v3 = v2 + 1;

        // Crest quad
        crestIndices.push(v0, v1, v2);
        crestIndices.push(v2, v1, v3);

        // Upstream quad
        upIndices.push(v0, v1, v2);
        upIndices.push(v2, v1, v3);

        // Downstream quad
        downIndices.push(v0, v2, v1);
        downIndices.push(v2, v3, v1);
      }
    }

    // Build Crest Mesh
    const crestGeo = new THREE.BufferGeometry();
    crestGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(crestVerts), 3));
    crestGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(crestColors), 3));
    crestGeo.setIndex(crestIndices);
    crestGeo.computeVertexNormals();
    const crestMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    this.crestMesh = new THREE.Mesh(crestGeo, crestMat);
    this.crestMesh.castShadow = true;
    this.crestMesh.receiveShadow = true;
    this.crestMesh.userData = { isDam: true, component: 'crest' };
    this.group.add(this.crestMesh);

    // Build Upstream Embankment Mesh
    const upGeo = new THREE.BufferGeometry();
    upGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(upVerts), 3));
    upGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(upColors), 3));
    upGeo.setIndex(upIndices);
    upGeo.computeVertexNormals();
    const upMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.05,
      side: THREE.DoubleSide
    });
    this.upstreamMesh = new THREE.Mesh(upGeo, upMat);
    this.upstreamMesh.castShadow = true;
    this.upstreamMesh.receiveShadow = true;
    this.upstreamMesh.userData = { isDam: true, component: 'upstream_face' };
    this.group.add(this.upstreamMesh);

    // Build Downstream Embankment Mesh
    const downGeo = new THREE.BufferGeometry();
    downGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(downVerts), 3));
    downGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(downColors), 3));
    downGeo.setIndex(downIndices);
    downGeo.computeVertexNormals();
    const downMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.02,
      side: THREE.DoubleSide
    });
    this.downstreamMesh = new THREE.Mesh(downGeo, downMat);
    this.downstreamMesh.castShadow = true;
    this.downstreamMesh.receiveShadow = true;
    this.downstreamMesh.userData = { isDam: true, component: 'downstream_face' };
    this.group.add(this.downstreamMesh);

    // Add Dam Axis Centerline (Yellow dashed road line)
    const linePts: THREE.Vector3[] = [];
    for (let i = 0; i <= numSegments; i++) {
      const t = i / numSegments;
      const center2D = new THREE.Vector2().lerpVectors(pN, pS, t);
      const isSpillway = t >= spillwayStartT && t <= spillwayEndT;
      const elev = isSpillway ? spillwayCrest_m : topOfDam_m;
      linePts.push(new THREE.Vector3(center2D.x, elev * vEx + 0.1, center2D.y));
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 2 });
    const centerline = new THREE.Line(lineGeo, lineMat);
    centerline.name = 'DamAxisCenterline';
    this.group.add(centerline);

    // Add Parapet walls / edge safety curbs along crest
    const curbLeftPts: THREE.Vector3[] = [];
    const curbRightPts: THREE.Vector3[] = [];
    for (let i = 0; i <= numSegments; i++) {
      const t = i / numSegments;
      const center2D = new THREE.Vector2().lerpVectors(pN, pS, t);
      const isSpillway = t >= spillwayStartT && t <= spillwayEndT;
      const elev = isSpillway ? spillwayCrest_m : topOfDam_m;

      const downX = center2D.x + downNormal.x * halfWidth;
      const downZ = center2D.y + downNormal.y * halfWidth;
      const upX = center2D.x + upNormal.x * halfWidth;
      const upZ = center2D.y + upNormal.y * halfWidth;

      curbLeftPts.push(new THREE.Vector3(downX, elev * vEx + 0.25, downZ));
      curbRightPts.push(new THREE.Vector3(upX, elev * vEx + 0.25, upZ));
    }
    const curbMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, linewidth: 1.5 });
    this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curbLeftPts), curbMat));
    this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curbRightPts), curbMat));

    // Add Structural Height Caliper (41.00m Crest to 15.50m Deepest Bed)
    this.addStructuralCaliper(vEx);
  }

  /**
   * Engineering measurement caliper connecting Crest (41.00m) to Deepest Bed (15.50m)
   */
  private addStructuralCaliper(vEx: number) {
    if (this.caliperGroup) {
      this.group.remove(this.caliperGroup);
    }
    const caliper = new THREE.Group();
    caliper.name = 'StructuralHeightCaliper';

    // Position at mid-span of dam where gorge is deepest
    const pN = new THREE.Vector2(this.damGeom.northAbutmentLocal[0], this.damGeom.northAbutmentLocal[1]);
    const pS = new THREE.Vector2(this.damGeom.southAbutmentLocal[0], this.damGeom.southAbutmentLocal[1]);
    const midDam = new THREE.Vector2().lerpVectors(pN, pS, 0.45);

    const topElev = this.damGeom.topOfDam_m; // 41.00 m
    const bedElev = this.damGeom.deepestBedLevel_m; // 15.50 m
    const topY = topElev * vEx;
    const bedY = bedElev * vEx;

    // Caliper vertical bar
    const calGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(midDam.x, bedY, midDam.y),
      new THREE.Vector3(midDam.x, topY, midDam.y)
    ]);
    const calMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 3 });
    caliper.add(new THREE.Line(calGeo, calMat));

    // End caps
    const capSize = 8;
    const capTopGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(midDam.x - capSize, topY, midDam.y),
      new THREE.Vector3(midDam.x + capSize, topY, midDam.y)
    ]);
    const capBedGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(midDam.x - capSize, bedY, midDam.y),
      new THREE.Vector3(midDam.x + capSize, bedY, midDam.y)
    ]);
    caliper.add(new THREE.Line(capTopGeo, calMat));
    caliper.add(new THREE.Line(capBedGeo, calMat));

    // Top Crest Marker Sphere
    const sphereGeo = new THREE.SphereGeometry(2.5, 16, 16);
    const sphereMatTop = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const topSphere = new THREE.Mesh(sphereGeo, sphereMatTop);
    topSphere.position.set(midDam.x, topY, midDam.y);
    caliper.add(topSphere);

    // Bed Foundation Marker Sphere
    const sphereMatBed = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const bedSphere = new THREE.Mesh(sphereGeo, sphereMatBed);
    bedSphere.position.set(midDam.x, bedY, midDam.y);
    caliper.add(bedSphere);

    this.caliperGroup = caliper;
    this.group.add(caliper);
  }

  public updateExaggeration(exaggeration: number) {
    this.options.verticalExaggeration = exaggeration;
    this.buildDam();
  }

  public setVisible(visible: boolean) {
    this.options.visible = visible;
    this.group.visible = visible;
  }

  public getGeometry(): DamGeometry {
    return this.damGeom;
  }

  public dispose() {
    while (this.group.children.length > 0) {
      const obj = this.group.children[0];
      this.group.remove(obj);
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    }
  }
}
