import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ChapoliData, InspectionResult, DataProvenance, DtmSurfaceMode } from '../../types/reservoir';
import { GeoTransform } from '../../utils/coordinates';
import { SedimentAnalysisEngine } from '../../utils/sedimentAnalysis';
import { TerrainMesh } from './TerrainMesh';
import { WaterSurface } from './WaterSurface';
import { ContourLines } from './ContourLines';
import { SedimentLayer } from './SedimentLayer';
import { DamEmbankment } from './DamEmbankment';
import { InspectionMarker } from './InspectionMarker';
import { TransectLineVisual } from './TransectLine';
import { SiltLayer } from './SiltLayer';
import { SiltVisualMode, SiltSeriesPayload } from '../../types/silt';
import { CompassWidget } from './CompassWidget';
import { ScaleBar } from './ScaleBar';

export interface ReservoirCanvasProps {
  data: ChapoliData;
  waterLevel: number;
  verticalExaggeration: number;
  terrainVisible: boolean;
  waterVisible: boolean;
  waterOpacity: number;
  bedVisible: boolean;
  damVisible?: boolean;
  sedimentVisible: boolean;
  sedimentOpacity: number;
  contoursVisible: boolean;
  wireframe: boolean;
  hillshade: boolean;
  sampleMode: boolean;
  dtmMode?: DtmSurfaceMode;
  sectionCutX: number | null; // null or clipping distance
  transectPoints: { start: [number, number]; end: [number, number] } | null;
  onPointInspected: (result: InspectionResult | null) => void;
  activeTool: 'inspect' | 'transect' | 'measure' | null;
  onTransectDrawn?: (start: [number, number], end: [number, number]) => void;
  siltData?: SiltSeriesPayload;
  siltVisible?: boolean;
  siltMonth?: string;
  siltVisualMode?: SiltVisualMode;
  siltOpacity?: number;
  siltThicknessMultiplier?: number;
}

export const ReservoirCanvas: React.FC<ReservoirCanvasProps> = ({
  data,
  waterLevel,
  verticalExaggeration,
  terrainVisible,
  waterVisible,
  waterOpacity,
  bedVisible,
  damVisible = true,
  sedimentVisible,
  sedimentOpacity,
  contoursVisible,
  wireframe,
  hillshade,
  sampleMode,
  dtmMode = 'bathymetric',
  sectionCutX,
  transectPoints,
  onPointInspected,
  activeTool,
  onTransectDrawn,
  siltData,
  siltVisible = true,
  siltMonth = 'sep',
  siltVisualMode = 'classification',
  siltOpacity = 0.85,
  siltThicknessMultiplier = 1.0
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const terrainRef = useRef<TerrainMesh | null>(null);
  const waterRef = useRef<WaterSurface | null>(null);
  const damRef = useRef<DamEmbankment | null>(null);
  const contoursRef = useRef<ContourLines | null>(null);
  const sedimentRef = useRef<SedimentLayer | null>(null);
  const siltRef = useRef<SiltLayer | null>(null);
  const markerRef = useRef<InspectionMarker | null>(null);
  const transectVisualRef = useRef<TransectLineVisual | null>(null);

  const engineRef = useRef<SedimentAnalysisEngine>(new SedimentAnalysisEngine(data));
  const geoRef = useRef<GeoTransform>(new GeoTransform(data.origin));

  const [cameraDistance, setCameraDistance] = useState<number>(1400);
  const [cameraRotationY, setCameraRotationY] = useState<number>(0);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; text: string } | null>(null);

  // Cross-section interactive click-to-draw state
  const transectClickState = useRef<{ firstPoint: [number, number] | null }>({ firstPoint: null });

  // Initialize Scene, Camera, Renderer, Controls
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene with atmospheric horizon
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1526); // Atmospheric twilight mountain horizon
    scene.fog = new THREE.FogExp2(0x0a1526, 0.00032); // Soft distance haze
    sceneRef.current = scene;

    // 2. Camera: Elevated three-quarter perspective framing reservoir, surrounding hills and earthen dam
    const camera = new THREE.PerspectiveCamera(40, width / height, 1, 18000);
    camera.position.set(-680, 420, 680);
    camera.lookAt(-80, 32, -20);
    cameraRef.current = camera;

    // 3. Renderer with local clipping enabled for Section Cuts
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls centered on reservoir basin
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.03; // Keep above ground plane
    controls.minDistance = 50;
    controls.maxDistance = 6000;
    controls.target.set(-80, 32, -20);
    controlsRef.current = controls;

    // 5. Lighting: Sun + Sky Hemisphere + Soft Ambient
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.42);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e3a1e, 0.65);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.45);
    dirLight.position.set(750, 1300, 650);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 100;
    dirLight.shadow.camera.far = 4000;
    const d = 1200;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    // 6. Build Layers
    const terrain = new TerrainMesh(data, {
      verticalExaggeration,
      wireframe,
      hillshade,
      dtmMode
    });
    scene.add(terrain.group);
    terrainRef.current = terrain;

    const water = new WaterSurface(data, {
      waterLevel,
      verticalExaggeration,
      opacity: waterOpacity,
      visible: waterVisible
    });
    scene.add(water.group);
    waterRef.current = water;

    const dam = new DamEmbankment(data, {
      verticalExaggeration,
      visible: damVisible
    }, engineRef.current);
    scene.add(dam.group);
    damRef.current = dam;

    const contours = new ContourLines(data, {
      verticalExaggeration,
      visible: contoursVisible,
      majorInterval: 5
    });
    scene.add(contours.group);
    contoursRef.current = contours;

    const sediment = new SedimentLayer(data, {
      verticalExaggeration,
      sampleMode,
      visible: sedimentVisible,
      opacity: sedimentOpacity
    }, engineRef.current);
    scene.add(sediment.group);
    sedimentRef.current = sediment;

    if (siltData) {
      const silt = new SiltLayer(data, siltData, {
        visible: siltVisible,
        activeMonth: siltMonth,
        visualMode: siltVisualMode,
        opacity: siltOpacity,
        verticalExaggeration,
        thicknessMultiplier: siltThicknessMultiplier
      });
      scene.add(silt.group);
      siltRef.current = silt;
    }

    const marker = new InspectionMarker();
    scene.add(marker.group);
    markerRef.current = marker;

    const transectVisual = new TransectLineVisual();
    scene.add(transectVisual.group);
    transectVisualRef.current = transectVisual;

    // 7. Animation Loop
    const clock = new THREE.Clock();
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();

      water.animate(clock);
      marker.animate(clock);

      const dist = camera.position.distanceTo(controls.target);
      setCameraDistance(dist);
      setCameraRotationY(controls.getAzimuthalAngle());

      renderer.render(scene, camera);
    };
    animate();

    // 8. Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      terrain.dispose();
      water.dispose();
      dam.dispose();
      contours.dispose();
      sediment.dispose();
      siltRef.current?.dispose();
      marker.dispose();
      transectVisual.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [data, siltData]);

  // Handle Layer Updates
  useEffect(() => {
    terrainRef.current?.updateExaggeration(verticalExaggeration);
    waterRef.current?.updateExaggeration(verticalExaggeration);
    damRef.current?.updateExaggeration(verticalExaggeration);
    contoursRef.current?.updateExaggeration(verticalExaggeration);
    sedimentRef.current?.updateExaggeration(verticalExaggeration);
    siltRef.current?.updateExaggeration(verticalExaggeration);
  }, [verticalExaggeration]);

  useEffect(() => {
    siltRef.current?.setVisible(siltVisible);
  }, [siltVisible]);

  useEffect(() => {
    siltRef.current?.setActiveMonth(siltMonth);
  }, [siltMonth]);

  useEffect(() => {
    siltRef.current?.setVisualMode(siltVisualMode);
  }, [siltVisualMode]);

  useEffect(() => {
    siltRef.current?.setOpacity(siltOpacity);
  }, [siltOpacity]);

  useEffect(() => {
    siltRef.current?.setThicknessMultiplier(siltThicknessMultiplier);
  }, [siltThicknessMultiplier]);

  useEffect(() => {
    damRef.current?.setVisible(damVisible);
  }, [damVisible]);

  useEffect(() => {
    waterRef.current?.setWaterLevel(waterLevel);
  }, [waterLevel]);

  useEffect(() => {
    waterRef.current?.setVisible(waterVisible);
    waterRef.current?.setOpacity(waterOpacity);
  }, [waterVisible, waterOpacity]);

  useEffect(() => {
    terrainRef.current?.setTerrainVisible(terrainVisible);
    terrainRef.current?.setBedVisible(bedVisible);
    terrainRef.current?.setWireframe(wireframe);
    terrainRef.current?.setHillshade(hillshade);
  }, [terrainVisible, bedVisible, wireframe, hillshade]);

  useEffect(() => {
    terrainRef.current?.setDtmMode(dtmMode);
  }, [dtmMode]);

  useEffect(() => {
    contoursRef.current?.setVisible(contoursVisible);
  }, [contoursVisible]);

  useEffect(() => {
    sedimentRef.current?.setVisible(sedimentVisible);
    sedimentRef.current?.setOpacity(sedimentOpacity);
    sedimentRef.current?.setSampleMode(sampleMode);
  }, [sedimentVisible, sedimentOpacity, sampleMode]);

  // Section cut clipping plane
  useEffect(() => {
    if (!rendererRef.current) return;
    if (sectionCutX !== null) {
      const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -sectionCutX);
      rendererRef.current.clippingPlanes = [plane];
    } else {
      rendererRef.current.clippingPlanes = [];
    }
  }, [sectionCutX]);

  // Update Transect Visual Line when transect points change
  useEffect(() => {
    if (!transectVisualRef.current) return;
    if (transectPoints) {
      const { elevation: elevStart } = engineRef.current.getPresentBedElevation(transectPoints.start[0], transectPoints.start[1]);
      const { elevation: elevEnd } = engineRef.current.getPresentBedElevation(transectPoints.end[0], transectPoints.end[1]);
      transectVisualRef.current.setPoints(
        transectPoints.start,
        transectPoints.end,
        elevStart ?? 35,
        elevEnd ?? 35,
        verticalExaggeration
      );
    } else {
      transectVisualRef.current.hide();
    }
  }, [transectPoints, verticalExaggeration]);

  // Click Raycaster: Point Inspection & Interactive Transect Drawing
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    // Intersect with terrain, water surface, dam structure, or silt layer
    const intersects = raycaster.intersectObjects(sceneRef.current.children, true);
    const validHit = intersects.find(hit => hit.object.userData?.isTerrain || hit.object.userData?.isWater || hit.object.userData?.isDam || hit.object.userData?.isSiltLayer);

    if (validHit) {
      const hitPt = validHit.point;
      const localX = hitPt.x;
      const localZ = hitPt.z;

      // Check if user clicked directly on the Earthen Dam Embankment structure
      if (validHit.object.userData?.isDam) {
        const [easting, northing] = geoRef.current.localToUTM(localX, localZ);
        const [lon, lat] = geoRef.current.localToWGS84(localX, localZ);
        const isCrest = validHit.object.userData?.component === 'crest';
        const damElev = isCrest ? 41.00 : hitPt.y / verticalExaggeration;

        markerRef.current?.setPosition(
          localX,
          hitPt.y,
          localZ,
          null,
          verticalExaggeration
        );

        const inspection: InspectionResult = {
          x: localX,
          z: localZ,
          easting: Math.round(easting * 10) / 10,
          northing: Math.round(northing * 10) / 10,
          lon: Number(lon.toFixed(6)),
          lat: Number(lat.toFixed(6)),
          elevation: Math.round(damElev * 100) / 100,
          waterLevel,
          waterDepth: 0,
          originalBedElev: 15.50, // Reference to deepest bed foundation
          sedimentThickness: null,
          inTank: false,
          provenance: 'OBSERVED',
          qualityNote: `Official Goa WRD Earthen Dam: Top of Dam El. 41.00m, Crest Length 760m, Dam Height 25.50m above deepest bed (El. 15.50m). ${isCrest ? 'Station on Crest Roadway.' : 'Station on Embankment Slope.'}`
        };

        onPointInspected(inspection);
        return;
      }

      // Handle Transect Drawing tool
      if (activeTool === 'transect') {
        if (!transectClickState.current.firstPoint) {
          transectClickState.current.firstPoint = [localX, localZ];
          // Temporarily show beacon A
          markerRef.current?.setPosition(localX, hitPt.y, localZ, null, verticalExaggeration);
        } else {
          const ptA = transectClickState.current.firstPoint;
          const ptB: [number, number] = [localX, localZ];
          transectClickState.current.firstPoint = null;
          markerRef.current?.hide();
          onTransectDrawn?.(ptA, ptB);
        }
        return;
      }

      // Point Inspection Tool & Measurement
      const [easting, northing] = geoRef.current.localToUTM(localX, localZ);
      const [lon, lat] = geoRef.current.localToWGS84(localX, localZ);
      const { elevation: presBedElev, isValid } = engineRef.current.getPresentBedElevation(localX, localZ);
      const inTank = engineRef.current.isInsideTank(localX, localZ);
      const origBedElev = isValid && presBedElev !== null ? engineRef.current.getOriginalBedElevation(localX, localZ, sampleMode) : null;

      const isSubmerged = inTank && isValid && presBedElev !== null && presBedElev < waterLevel;
      const waterDepth = isSubmerged && presBedElev !== null
        ? Math.round((waterLevel - presBedElev) * 100) / 100 
        : 0;

      let sedimentThickness: number | null = null;
      let provenance: DataProvenance = isValid ? 'OBSERVED' : 'UNAVAILABLE';
      let qualityNote = isValid ? 'Valid survey elevation sample' : 'Outside survey bounds / NoData cell';

      // Sentinel-2 Silt Classification & Volume sampling
      let siltClass: 'Low' | 'Moderate' | 'High' | 'Very High' | undefined = undefined;
      let siltClassColor: string | undefined = undefined;
      let siltVolumeScore: number | undefined = undefined;
      let siltThicknessM: number | undefined = undefined;
      let siltMonthName: string | undefined = undefined;

      if (siltData && inTank) {
        const monthRecord = siltData.months[siltMonth] || siltData.months['sep'];
        siltMonthName = monthRecord.name;
        const bbox = siltData.bbox.local;
        if (localX >= bbox.minX && localX <= bbox.maxX && localZ >= bbox.minZ && localZ <= bbox.maxZ) {
          const u = (localX - bbox.minX) / bbox.width;
          const v = (localZ - bbox.minZ) / bbox.depth;
          const col = Math.min(monthRecord.gridDimensions.width - 1, Math.max(0, Math.floor(u * monthRecord.gridDimensions.width)));
          const row = Math.min(monthRecord.gridDimensions.height - 1, Math.max(0, Math.floor(v * monthRecord.gridDimensions.height)));
          const classVal = monthRecord.classGrid[row]?.[col] ?? 0;
          const thickVal = monthRecord.thicknessGrid[row]?.[col] ?? 0;

          if (classVal > 0) {
            const classMap: Record<number, { name: 'Low' | 'Moderate' | 'High' | 'Very High'; color: string }> = {
              1: { name: 'Low', color: '#00FF00' },
              2: { name: 'Moderate', color: '#FFFF00' },
              3: { name: 'High', color: '#FFA500' },
              4: { name: 'Very High', color: '#FF0000' }
            };
            siltClass = classMap[classVal]?.name;
            siltClassColor = classMap[classVal]?.color;
            siltVolumeScore = Math.round(thickVal * 100 * 100) / 100;
            siltThicknessM = Math.round(thickVal * 100) / 100;
          }
        }
      }

      if (!isSubmerged) {
        // Point is on dry ground above current waterline or outside reservoir
        sedimentThickness = null;
        qualityNote = inTank
          ? 'Dry shoreline ground above current water level (no underwater sediment deposit)'
          : 'Dry surrounding terrain outside reservoir boundary';
      } else if (siltClass && !sampleMode) {
        sedimentThickness = siltThicknessM ?? null;
        provenance = 'OBSERVED';
        qualityNote = `Observed Sentinel-2 Silt (${siltMonthName}): ${siltClass} Class, ${siltVolumeScore?.toFixed(1)} m³/100m²`;
      } else if (sampleMode && origBedElev !== null && presBedElev !== null && origBedElev < presBedElev) {
        sedimentThickness = Math.round((presBedElev - origBedElev) * 100) / 100;
        provenance = 'SIMULATED';
        qualityNote = 'Simulated sedimentation deposit against modeled pre-impoundment thalweg';
      } else if (!sampleMode && inTank) {
        qualityNote = 'Measured present bed. Pre-impoundment baseline surface unavailable in source files.';
      }

      // Update 3D Marker: only draw vertical caliper if submerged with sediment thickness
      markerRef.current?.setPosition(
        localX,
        (presBedElev ?? 34) * verticalExaggeration,
        localZ,
        isSubmerged && sedimentThickness !== null ? origBedElev : null,
        verticalExaggeration
      );

      const inspection: InspectionResult = {
        x: localX,
        z: localZ,
        easting: Math.round(easting * 10) / 10,
        northing: Math.round(northing * 10) / 10,
        lon: Number(lon.toFixed(6)),
        lat: Number(lat.toFixed(6)),
        elevation: presBedElev,
        waterLevel,
        waterDepth,
        originalBedElev: isSubmerged ? origBedElev : null,
        sedimentThickness,
        inTank,
        provenance,
        qualityNote,
        siltClass,
        siltClassColor,
        siltVolumeScore,
        siltThicknessM,
        siltMonthName
      };

      onPointInspected(inspection);
    }
  }, [activeTool, waterLevel, verticalExaggeration, sampleMode, onPointInspected, onTransectDrawn, siltData, siltMonth]);

  // Hover Raycaster for Quick Tooltip
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    const intersects = raycaster.intersectObjects(sceneRef.current.children, true);
    const validHit = intersects.find(hit => hit.object.userData?.isTerrain || hit.object.userData?.isWater || hit.object.userData?.isDam || hit.object.userData?.isSiltLayer);

    if (validHit) {
      const localX = validHit.point.x;
      const localZ = validHit.point.z;
      const [lon, lat] = geoRef.current.localToWGS84(localX, localZ);

      let tooltipText = '';
      if (validHit.object.userData?.isDam) {
        const isCrest = validHit.object.userData?.component === 'crest';
        tooltipText = `Chapoli Dam Embankment | Elev: ${isCrest ? '41.00m (Crest Road)' : (validHit.point.y / verticalExaggeration).toFixed(1) + 'm (Slope)'} | 760m Axis`;
      } else if (validHit.object.userData?.isSiltLayer) {
        tooltipText = `Sentinel-2 Silt Layer (${siltMonth.toUpperCase()}) | ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`;
      } else {
        const { elevation } = engineRef.current.getPresentBedElevation(localX, localZ);
        tooltipText = `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E | Elev: ${elevation !== null ? elevation.toFixed(1) + 'm' : 'NoData'}`;
      }

      setHoverInfo({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        text: tooltipText
      });
    } else {
      setHoverInfo(null);
    }
  }, []);

  // View Preset Helpers
  const setTopView = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(-80, 1400, -9.8);
    controlsRef.current.target.set(-80, 32, -10);
    cameraRef.current.lookAt(-80, 32, -10);
    controlsRef.current.update();
  };

  const setSideView = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    // Elevated Western Side Profile looking eastward across the 760m Dam Embankment and reservoir basin
    cameraRef.current.position.set(-1050, 200, 0);
    controlsRef.current.target.set(-80, 35, 0);
    cameraRef.current.lookAt(-80, 35, 0);
    controlsRef.current.update();
  };

  const setPerspectiveView = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    // Elevated three-quarter perspective framing reservoir, surrounding hills and earthen dam
    cameraRef.current.position.set(-680, 420, 680);
    controlsRef.current.target.set(-80, 32, -20);
    cameraRef.current.lookAt(-80, 32, -20);
    controlsRef.current.update();
  };

  const setLowObliqueView = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    // Dam Abutment perspective inspecting the deep intake basin and upstream reservoir pool
    cameraRef.current.position.set(-540, 160, -380);
    controlsRef.current.target.set(-200, 25, 40);
    cameraRef.current.lookAt(-200, 25, 40);
    controlsRef.current.update();
  };

  const resetNorth = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(-680, 420, 680);
    controlsRef.current.target.set(-80, 32, -20);
    cameraRef.current.lookAt(-80, 32, -20);
    controlsRef.current.update();
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        cursor: activeTool === 'inspect' ? 'crosshair' : activeTool === 'transect' ? 'copy' : 'default'
      }}
      onClick={handleCanvasClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverInfo(null)}
    >
      {/* 3D Compass Widget */}
      <CompassWidget rotationY={cameraRotationY} onResetNorth={resetNorth} />

      {/* Dynamic Metric Scale Bar */}
      <ScaleBar cameraDistance={cameraDistance} />

      {/* Viewport Presets Control HUD */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          display: 'flex',
          gap: 6,
          zIndex: 40,
          background: 'rgba(10, 18, 36, 0.85)',
          padding: 6,
          borderRadius: 8,
          border: '1px solid rgba(56, 189, 248, 0.25)',
          backdropFilter: 'blur(10px)'
        }}
      >
        <button
          className="btn-secondary"
          onClick={setPerspectiveView}
          style={{ padding: '4px 10px', fontSize: 11 }}
          title="3D Natural Oblique Perspective View"
        >
          Perspective
        </button>
        <button
          className="btn-secondary"
          onClick={setTopView}
          style={{ padding: '4px 10px', fontSize: 11 }}
          title="Orthogonal Top Plan View (Checking KML Boundary)"
        >
          Top Plan
        </button>
        <button
          className="btn-secondary"
          onClick={setLowObliqueView}
          style={{ padding: '4px 10px', fontSize: 11 }}
          title="Low Oblique View (Inspecting Basin Depth)"
        >
          Basin Depth
        </button>
        <button
          className="btn-secondary"
          onClick={setSideView}
          style={{ padding: '4px 10px', fontSize: 11 }}
          title="Side Profile View (Dam Embankment)"
        >
          Side Profile
        </button>
        <button
          className="btn-secondary"
          onClick={setPerspectiveView}
          style={{ padding: '4px 8px', fontSize: 11, color: 'var(--accent-cyan)' }}
          title="Reset Camera to Default Perspective"
        >
          Reset
        </button>
      </div>

      {/* Hover Floating Tooltip */}
      {hoverInfo && (
        <div
          style={{
            position: 'absolute',
            left: hoverInfo.x + 15,
            top: hoverInfo.y - 10,
            background: 'rgba(6, 11, 23, 0.92)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            borderRadius: 5,
            padding: '4px 8px',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: '#e2e8f0',
            pointerEvents: 'none',
            zIndex: 60,
            boxShadow: '0 4px 12px rgba(0,0,0,0.6)'
          }}
        >
          {hoverInfo.text}
        </div>
      )}
    </div>
  );
};
