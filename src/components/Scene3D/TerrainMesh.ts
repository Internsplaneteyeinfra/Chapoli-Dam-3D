import * as THREE from 'three';
import { ChapoliData, DtmSurfaceMode } from '../../types/reservoir';

export interface TerrainMeshOptions {
  verticalExaggeration: number;
  wireframe: boolean;
  hillshade: boolean;
  terrainVisible?: boolean;
  bedVisible?: boolean;
  dtmMode?: DtmSurfaceMode;
}

/**
 * TerrainMesh: Manages the two distinct terrestrial surfaces:
 * 1. Natural Terrain: Surrounding landscape of hills, valleys, and forests outside the reservoir boundary.
 * 2. Reservoir Bed: Geological bed inside the reservoir boundary (surveyed 1m contours & calibrated thalweg).
 * 
 * Features:
 * - NO artificial vertical black walls or skirts along the boundary.
 * - Real elevations with adjustable vertical exaggeration.
 * - Distinct, independent layer controls for Natural Terrain (Layer A) and Reservoir Bed (Layer C).
 */
export class TerrainMesh {
  public group: THREE.Group;
  private data: ChapoliData;
  private options: TerrainMeshOptions;

  // Natural Terrain Mesh (Outside reservoir boundary)
  private terrainGeometry: THREE.BufferGeometry;
  private terrainMaterial: THREE.MeshStandardMaterial;
  private terrainMesh: THREE.Mesh;

  // Reservoir Bed Mesh (Inside reservoir boundary)
  private bedGeometry: THREE.BufferGeometry;
  private bedMaterial: THREE.MeshStandardMaterial;
  private bedMesh: THREE.Mesh;

  // Base elevation buffers
  private basePositions: Float32Array;
  private bathyPositions: Float32Array;
  private bathyTerrainColors: Float32Array;
  private bathyBedColors: Float32Array;
  private rawPositions: Float32Array | null = null;
  private rawTerrainColors: Float32Array | null = null;
  private f30Positions: Float32Array | null = null;
  private f30TerrainColors: Float32Array | null = null;
  private currentMode: DtmSurfaceMode;

  constructor(data: ChapoliData, options: TerrainMeshOptions) {
    this.data = data;
    this.options = options;
    this.currentMode = options.dtmMode || 'bathymetric';
    this.group = new THREE.Group();
    this.group.name = 'TerrainAndBasinGroup';

    const { vertices } = this.data.mesh_data;
    const numVerts = vertices.length / 3;
    this.bathyPositions = new Float32Array(vertices);

    // 1. Generate specialized color buffers:
    // - Terrain Colors: Lush Western Ghats vegetation, forests, and valley greens
    // - Bed Colors: Authentic geological lakebed alluvial silt, sediment, and bedrock
    this.bathyTerrainColors = new Float32Array(vertices.length);
    this.bathyBedColors = new Float32Array(vertices.length);

    for (let i = 0; i < numVerts; i++) {
      const cell = this.data.cells[i];
      const elev = cell?.elevation ?? vertices[i * 3 + 1];

      // Terrain color: Western Ghats ecological ramp
      const tColor = this.getVegetationColor(elev);
      this.bathyTerrainColors[i * 3] = tColor[0];
      this.bathyTerrainColors[i * 3 + 1] = tColor[1];
      this.bathyTerrainColors[i * 3 + 2] = tColor[2];

      // Bed color: Geological lakebed alluvial sand, silt & bedrock strata
      const bColor = this.getGeologicalBedColor(elev);
      this.bathyBedColors[i * 3] = bColor[0];
      this.bathyBedColors[i * 3 + 1] = bColor[1];
      this.bathyBedColors[i * 3 + 2] = bColor[2];
    }

    if (this.data.raw_mesh_data) {
      this.rawPositions = new Float32Array(this.data.raw_mesh_data.vertices);
      this.rawTerrainColors = new Float32Array(this.data.raw_mesh_data.colors);
    }

    if (this.data.f30_mesh_data) {
      this.f30Positions = new Float32Array(this.data.f30_mesh_data.vertices);
      this.f30TerrainColors = new Float32Array(this.data.f30_mesh_data.colors);
    }

    let activeBase = this.bathyPositions;
    if (this.currentMode === 'raw_fabdem' && this.rawPositions) {
      activeBase = this.rawPositions;
    } else if (this.currentMode === 'f30_dtm' && this.f30Positions) {
      activeBase = this.f30Positions;
    }
    this.basePositions = activeBase;

    // Apply initial vertical exaggeration to Y coordinates
    const scaledVertices = new Float32Array(activeBase.length);
    for (let i = 0; i < activeBase.length; i += 3) {
      scaledVertices[i] = activeBase[i]; // X
      scaledVertices[i + 1] = activeBase[i + 1] * this.options.verticalExaggeration; // Y
      scaledVertices[i + 2] = activeBase[i + 2]; // Z
    }

    // 2. Separate triangles into Natural Terrain (outside) and Reservoir Bed (inside)
    const w = this.data.dem.width;
    const h = this.data.dem.height;
    const terrainIndices: number[] = [];
    const bedIndices: number[] = [];

    for (let r = 0; r < h - 1; r++) {
      for (let c = 0; c < w - 1; c++) {
        const i00 = r * w + c;
        const i10 = r * w + (c + 1);
        const i01 = (r + 1) * w + c;
        const i11 = (r + 1) * w + (c + 1);

        const c00 = this.data.cells[i00];
        const c10 = this.data.cells[i10];
        const c01 = this.data.cells[i01];
        const c11 = this.data.cells[i11];

        if (c00 && c10 && c01 && c11 && c00.isValid && c10.isValid && c01.isValid && c11.isValid) {
          // A quad is inside the reservoir bed if all 4 corners are inside the tank
          const isBedQuad = c00.inTank && c10.inTank && c01.inTank && c11.inTank;

          if (isBedQuad) {
            // Belongs to the Reservoir Bed surface
            bedIndices.push(i00, i01, i10);
            bedIndices.push(i10, i01, i11);
          } else {
            // Belongs to the Natural Surrounding Terrain & hillsides
            terrainIndices.push(i00, i01, i10);
            terrainIndices.push(i10, i01, i11);
          }
        }
      }
    }

    // 3. Build Natural Terrain Geometry & Mesh
    this.terrainGeometry = new THREE.BufferGeometry();
    this.terrainGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(scaledVertices), 3));
    this.terrainGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.bathyTerrainColors), 3));
    this.terrainGeometry.setIndex(terrainIndices);
    this.terrainGeometry.computeVertexNormals();

    this.terrainMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: this.options.hillshade ? 0.74 : 0.95,
      metalness: 0.06,
      wireframe: this.options.wireframe,
      flatShading: false,
      side: THREE.DoubleSide
    });

    this.terrainMesh = new THREE.Mesh(this.terrainGeometry, this.terrainMaterial);
    this.terrainMesh.name = 'NaturalTerrainMesh';
    this.terrainMesh.castShadow = true;
    this.terrainMesh.receiveShadow = true;
    this.terrainMesh.userData = { isTerrain: true, surface: 'terrain' };
    this.terrainMesh.visible = this.options.terrainVisible !== false;
    this.group.add(this.terrainMesh);

    // 4. Build Reservoir Bed Geometry & Mesh
    this.bedGeometry = new THREE.BufferGeometry();
    this.bedGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(scaledVertices), 3));
    this.bedGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.bathyBedColors), 3));
    this.bedGeometry.setIndex(bedIndices);
    this.bedGeometry.computeVertexNormals();

    this.bedMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.10,
      wireframe: this.options.wireframe,
      flatShading: false,
      side: THREE.DoubleSide
    });

    this.bedMesh = new THREE.Mesh(this.bedGeometry, this.bedMaterial);
    this.bedMesh.name = 'ReservoirBedMesh';
    this.bedMesh.castShadow = true;
    this.bedMesh.receiveShadow = true;
    this.bedMesh.userData = { isTerrain: true, surface: 'bed' };
    this.bedMesh.visible = this.options.bedVisible !== false;
    this.group.add(this.bedMesh);

    // 5. Authoritative Reservoir Shoreline (853 vertices from Chapoli M.I. Tank .kml)
    this.addBoundaryOutline();
  }

  private getVegetationColor(val: number): [number, number, number] {
    if (val <= 35.0) {
      // Downstream lush river valley, riparian grass, palm groves
      const t = Math.max(0.0, Math.min(1.0, (val - 15.0) / 20.0));
      return [0.20 + 0.04 * t, 0.44 + 0.04 * t, 0.18 + 0.04 * t];
    } else if (val <= 60.0) {
      // Moist deciduous forest canopy & hillsides
      const t = (val - 35.0) / 25.0;
      return [0.16 + 0.04 * (1 - t), 0.46 + 0.04 * (1 - t), 0.16 + 0.02 * (1 - t)];
    } else if (val <= 95.0) {
      // Dense evergreen mountain canopy
      const t = (val - 60.0) / 35.0;
      return [0.12 + 0.06 * t, 0.40 - 0.04 * t, 0.14 + 0.03 * t];
    } else {
      // High rocky ridges and summits
      const t = Math.min(1.0, (val - 95.0) / 45.0);
      return [0.22 + 0.12 * t, 0.34 + 0.06 * t, 0.20 + 0.08 * t];
    }
  }

  private getGeologicalBedColor(val: number): [number, number, number] {
    if (val <= 22.0) {
      // Deepest thalweg bedrock & gorge channel slate silt
      const t = Math.max(0.0, Math.min(1.0, (val - 15.5) / 6.5));
      return [0.22 + 0.06 * t, 0.24 + 0.06 * t, 0.26 + 0.04 * t];
    } else if (val <= 32.0) {
      // Natural alluvial gravel & sediment lakebed
      const t = (val - 22.0) / 10.0;
      return [0.36 + 0.08 * t, 0.34 + 0.06 * t, 0.28 + 0.06 * t];
    } else if (val <= 38.25) {
      // Upper littoral sand shelf & sediment terrace
      const t = (val - 32.0) / (38.25 - 32.0);
      return [0.44 + 0.06 * t, 0.40 + 0.06 * t, 0.32 + 0.04 * t];
    } else {
      // Shoreline strandline
      return [0.38, 0.44, 0.28];
    }
  }

  private addBoundaryOutline() {
    const coords = this.data.tank.coords_local;
    const pts: THREE.Vector3[] = [];
    for (const [x, z] of coords) {
      // Shoreline sits at FRL (38.25m)
      pts.push(new THREE.Vector3(x, 38.25 * this.options.verticalExaggeration + 0.15, z));
    }
    const boundaryGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const boundaryMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8, // Cyan shoreline glow
      linewidth: 2,
      transparent: true,
      opacity: 0.9
    });
    const line = new THREE.LineLoop(boundaryGeo, boundaryMat);
    line.name = 'AuthoritativeShoreline';
    this.group.add(line);
  }

  public updateExaggeration(exaggeration: number) {
    this.options.verticalExaggeration = exaggeration;

    // Update Natural Terrain vertex positions
    const posAttrTerrain = this.terrainGeometry.attributes.position;
    const count = posAttrTerrain.count;
    for (let i = 0; i < count; i++) {
      const baseY = this.basePositions[i * 3 + 1];
      posAttrTerrain.setY(i, baseY * exaggeration);
    }
    posAttrTerrain.needsUpdate = true;
    this.terrainGeometry.computeVertexNormals();

    // Update Reservoir Bed vertex positions
    const posAttrBed = this.bedGeometry.attributes.position;
    for (let i = 0; i < count; i++) {
      const baseY = this.basePositions[i * 3 + 1];
      posAttrBed.setY(i, baseY * exaggeration);
    }
    posAttrBed.needsUpdate = true;
    this.bedGeometry.computeVertexNormals();

    // Update shoreline line height
    const shoreline = this.group.getObjectByName('AuthoritativeShoreline') as THREE.LineLoop;
    if (shoreline) {
      const shorelinePositions = shoreline.geometry.attributes.position;
      const countS = shorelinePositions.count;
      for (let i = 0; i < countS; i++) {
        shorelinePositions.setY(i, 38.25 * exaggeration + 0.15);
      }
      shorelinePositions.needsUpdate = true;
    }
  }

  public setTerrainVisible(visible: boolean) {
    this.options.terrainVisible = visible;
    this.terrainMesh.visible = visible;
  }

  public setBedVisible(visible: boolean) {
    this.options.bedVisible = visible;
    this.bedMesh.visible = visible;
  }

  public setWireframe(enabled: boolean) {
    this.options.wireframe = enabled;
    this.terrainMaterial.wireframe = enabled;
    this.bedMaterial.wireframe = enabled;
  }

  public setHillshade(enabled: boolean) {
    this.options.hillshade = enabled;
    this.terrainMaterial.roughness = enabled ? 0.74 : 0.95;
    this.terrainMaterial.needsUpdate = true;
  }

  public setDtmMode(mode: DtmSurfaceMode) {
    if (this.currentMode === mode) return;
    this.currentMode = mode;
    this.options.dtmMode = mode;

    let activeBase = this.bathyPositions;
    if (mode === 'raw_fabdem' && this.rawPositions) {
      activeBase = this.rawPositions;
    } else if (mode === 'f30_dtm' && this.f30Positions) {
      activeBase = this.f30Positions;
    }
    this.basePositions = activeBase;

    const posAttrTerrain = this.terrainGeometry.attributes.position;
    const posAttrBed = this.bedGeometry.attributes.position;
    const count = posAttrTerrain.count;

    for (let i = 0; i < count; i++) {
      const y = activeBase[i * 3 + 1] * this.options.verticalExaggeration;
      posAttrTerrain.setXYZ(i, activeBase[i * 3], y, activeBase[i * 3 + 2]);
      posAttrBed.setXYZ(i, activeBase[i * 3], y, activeBase[i * 3 + 2]);
    }

    posAttrTerrain.needsUpdate = true;
    posAttrBed.needsUpdate = true;
    this.terrainGeometry.computeVertexNormals();
    this.bedGeometry.computeVertexNormals();
  }

  public setVisible(visible: boolean) {
    this.group.visible = visible;
  }

  public dispose() {
    this.terrainGeometry.dispose();
    this.terrainMaterial.dispose();
    this.bedGeometry.dispose();
    this.bedMaterial.dispose();
  }
}
