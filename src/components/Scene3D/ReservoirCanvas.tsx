import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Thermometer, Wind, ArrowUp, Droplets, CloudSun, CloudMoon } from 'lucide-react';
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
import { PermanentWaterLayer } from './PermanentWaterLayer';
import { WaterDepthPayload, sampleWaterDepth, sampleWaterWetness, carveBedToWaterBottom } from '../../types/waterDepth';
import { CompassWidget } from './CompassWidget';
import { SectionCap } from './SectionCap';
import { LiveSky } from './LiveSky';
import { WeatherEffects } from './WeatherEffects';
import {
  fetchLiveWeather, solarPosition, skyPaletteFor, describeWeather, describeForecastSky, rainIntensityFor, LiveWeather, compassLabel
} from '../../utils/liveWeather';
import { ScaleBar } from './ScaleBar';
import rawVegetationData from '../../data/vegetation.json';
import { VegetationLayer } from './VegetationLayer';
import { VegetationPayload } from '../../types/vegetation';

export interface ReservoirCanvasProps {
  data: ChapoliData;
  waterLevel: number;
  verticalExaggeration: number;
  terrainVisible: boolean;
  waterVisible: boolean;
  waterOpacity: number;
  bedVisible: boolean;
  damVisible?: boolean;
  treesVisible?: boolean;
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
  waterDepthData?: WaterDepthPayload;
  permanentWaterVisible?: boolean;
  permanentWaterOpacity?: number;
  /** Observed level (m MSL) the satellite water surface sits at; independent of the simulation slider */
  permanentWaterLevel?: number;
  permanentWaterDepthScale?: number;
  viewPresetTrigger?: { preset: 'perspective' | 'top' | 'depth' | 'side' | 'reset' | 'section'; timestamp: number } | null;
  navigationRightOffset?: number;
}

// Home view shown on load, by Perspective and by Reset: elevated from the west,
// looking east over the dam into the basin (framed for the default 4x exaggeration)
const HOME_CAMERA_POSITION = new THREE.Vector3(-1180, 730, -190);
const HOME_CAMERA_TARGET = new THREE.Vector3(-30, 110, 30);

// Furthest mouse zoom-out (about twice the home view distance, still framing the basin)
const MAX_ZOOM_OUT_DISTANCE = 2600;
// Live sky refresh from Open-Meteo
const LIVE_SKY_REFRESH_MS = 15 * 60 * 1000;

export const ReservoirCanvas: React.FC<ReservoirCanvasProps> = ({
  data,
  waterLevel,
  verticalExaggeration,
  terrainVisible,
  waterVisible,
  waterOpacity,
  bedVisible,
  damVisible = true,
  treesVisible = true,
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
  siltThicknessMultiplier = 1.0,
  waterDepthData,
  permanentWaterVisible = true,
  permanentWaterOpacity = 0.88,
  permanentWaterLevel = 38.25,
  permanentWaterDepthScale = 3,
  viewPresetTrigger,
  navigationRightOffset = 70
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const terrainRef = useRef<TerrainMesh | null>(null);
  const vegetationRef = useRef<VegetationLayer | null>(null);
  const waterRef = useRef<WaterSurface | null>(null);
  const damRef = useRef<DamEmbankment | null>(null);
  const contoursRef = useRef<ContourLines | null>(null);
  const sedimentRef = useRef<SedimentLayer | null>(null);
  const siltRef = useRef<SiltLayer | null>(null);
  const permanentWaterRef = useRef<PermanentWaterLayer | null>(null);
  const sectionCapRef = useRef<SectionCap | null>(null);
  const skyRef = useRef<LiveSky | null>(null);
  const weatherFxRef = useRef<WeatherEffects | null>(null);
  const [liveWeather, setLiveWeather] = useState<LiveWeather | null>(null);
  const nextHourEta = liveWeather?.nextHourForecast
    ? liveWeather.nextHourForecast.minutesUntil < 60
      ? `${liveWeather.nextHourForecast.minutesUntil}m`
      : `${Math.floor(liveWeather.nextHourForecast.minutesUntil / 60)}h${liveWeather.nextHourForecast.minutesUntil % 60 ? ` ${liveWeather.nextHourForecast.minutesUntil % 60}m` : ''}`
    : null;
  const sectionCutRef = useRef<number | null>(sectionCutX);
  sectionCutRef.current = sectionCutX;
  const markerRef = useRef<InspectionMarker | null>(null);
  const transectVisualRef = useRef<TransectLineVisual | null>(null);

  const engineRef = useRef<SedimentAnalysisEngine>(new SedimentAnalysisEngine(data));
  const geoRef = useRef<GeoTransform>(new GeoTransform(data.origin));

  const [activePreset, setActivePreset] = useState<'perspective' | 'top' | 'depth' | 'side'>('perspective');
  const [cameraDistance, setCameraDistance] = useState<number>(1400);
  const [cameraRotationY, setCameraRotationY] = useState<number>(0);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; text: string } | null>(null);

  // Smooth cinematic camera transition state
  const cameraTransitionRef = useRef<{
    isTransitioning: boolean;
    startTime: number;
    duration: number;
    startPos: THREE.Vector3;
    targetPos: THREE.Vector3;
    startLookAt: THREE.Vector3;
    targetLookAt: THREE.Vector3;
  } | null>(null);

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
    // Light haze in the sky's horizon colour (updated by the live sky) so distant terrain stays bright
    scene.background = new THREE.Color(0xbfe0f4);
    scene.fog = new THREE.FogExp2(0xbfe0f4, 0.00011);
    sceneRef.current = scene;

    const sky = new LiveSky();
    scene.add(sky.mesh);
    skyRef.current = sky;

    const weatherFx = new WeatherEffects();
    scene.add(weatherFx.group);
    weatherFxRef.current = weatherFx;
    let lastElapsed = 0;

    // 2. Camera: Elevated three-quarter perspective framing reservoir, surrounding hills and earthen dam
    const camera = new THREE.PerspectiveCamera(40, width / height, 1, 18000);
    camera.position.copy(HOME_CAMERA_POSITION);
    camera.lookAt(HOME_CAMERA_TARGET);
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
    controls.maxDistance = MAX_ZOOM_OUT_DISTANCE;
    controls.target.copy(HOME_CAMERA_TARGET);
    controlsRef.current = controls;

    // 5. Lighting: Sun + Sky Hemisphere + Soft Ambient.
    // Fixed and bright on purpose: the map stays well lit whatever the live sky shows (incl. night).
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x3f5f3a, 0.9);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.6);
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
        thicknessMultiplier: siltThicknessMultiplier,
        depthScale: permanentWaterDepthScale
      });
      scene.add(silt.group);
      siltRef.current = silt;
    }

    const baselineWaterLevel = data.live_telemetry?.reportedLevel_m ?? data.baseline_specs?.frl_m ?? 38.25;

    if (waterDepthData) {
      const permanentWater = new PermanentWaterLayer(waterDepthData, {
        visible: permanentWaterVisible,
        waterLevel: permanentWaterLevel,
        baselineLevel: baselineWaterLevel,
        depthScale: permanentWaterDepthScale,
        verticalExaggeration,
        opacity: permanentWaterOpacity
      });
      scene.add(permanentWater.group);
      permanentWaterRef.current = permanentWater;
    }

    const sectionCap = new SectionCap();
    scene.add(sectionCap.group);
    sectionCapRef.current = sectionCap;

    // 6H. Western Ghats Trees & Natural Forest Vegetation
    const vegetation = new VegetationLayer((rawVegetationData as unknown) as VegetationPayload, {
      visible: treesVisible,
      verticalExaggeration
    });
    scene.add(vegetation.group);
    vegetationRef.current = vegetation;

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

      if (cameraTransitionRef.current?.isTransitioning) {
        const { startTime, duration, startPos, targetPos, startLookAt, targetLookAt } = cameraTransitionRef.current;
        const elapsed = performance.now() - startTime;
        const t = Math.min(1, elapsed / duration);
        // Smooth cubic ease-in-out curve
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        camera.position.lerpVectors(startPos, targetPos, ease);
        controls.target.lerpVectors(startLookAt, targetLookAt, ease);
        controls.update();

        if (t >= 1) {
          cameraTransitionRef.current.isTransitioning = false;
        }
      } else {
        controls.update();
      }

      sky.update(camera, clock.elapsedTime);
      weatherFx.update(clock.elapsedTime - lastElapsed);
      lastElapsed = clock.elapsedTime;
      water.animate(clock);
      permanentWaterRef.current?.animate(clock);
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
      permanentWaterRef.current?.dispose();
      vegetation.dispose();
      sectionCap.dispose();
      sky.dispose();
      weatherFx.dispose();
      marker.dispose();
      transectVisual.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [data, siltData, waterDepthData]);

  // Handle Layer Updates
  useEffect(() => {
    terrainRef.current?.updateExaggeration(verticalExaggeration);
    waterRef.current?.updateExaggeration(verticalExaggeration);
    damRef.current?.updateExaggeration(verticalExaggeration);
    contoursRef.current?.updateExaggeration(verticalExaggeration);
    sedimentRef.current?.updateExaggeration(verticalExaggeration);
    siltRef.current?.updateExaggeration(verticalExaggeration);
    permanentWaterRef.current?.updateExaggeration(verticalExaggeration);
    vegetationRef.current?.setVerticalExaggeration(verticalExaggeration);
  }, [verticalExaggeration]);

  useEffect(() => {
    vegetationRef.current?.setVisible(treesVisible);
  }, [treesVisible]);

  useEffect(() => {
    permanentWaterRef.current?.setVisible(permanentWaterVisible);
    permanentWaterRef.current?.setOpacity(permanentWaterOpacity);
    // Shade the (carved) bed as water while the satellite water is shown
    terrainRef.current?.setBedWaterTint(
      waterDepthData && permanentWaterVisible
        ? (x, z) => sampleWaterWetness(waterDepthData, x, z)
        : null
    );
  }, [permanentWaterVisible, permanentWaterOpacity, waterDepthData]);

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
    permanentWaterRef.current?.setWaterLevel(permanentWaterLevel);
  }, [permanentWaterLevel]);

  useEffect(() => {
    permanentWaterRef.current?.setDepthScale(permanentWaterDepthScale);
    siltRef.current?.setDepthScale(permanentWaterDepthScale);
  }, [permanentWaterDepthScale]);

  // Lower the reservoir bed to the satellite water bottom (with or without the water shown),
  // and drape the silt on that lowered bed - fixed to baseline survey datum so terrain bed does not warp during water level simulation
  useEffect(() => {
    const baseline = data.live_telemetry?.reportedLevel_m ?? data.baseline_specs?.frl_m ?? 38.25;
    const carve = waterDepthData
      ? (x: number, z: number, baseElev: number) =>
          carveBedToWaterBottom(waterDepthData, x, z, baseElev, baseline, permanentWaterDepthScale)
      : null;
    terrainRef.current?.setBedCarve(carve);
    siltRef.current?.setCapLevel(waterDepthData ? baseline : undefined);
    siltRef.current?.setBedElevationFn(carve);
  }, [waterDepthData, data, permanentWaterDepthScale]);

  // Water side walls clutter the solid silt deposit; show them only while silt is off
  useEffect(() => {
    permanentWaterRef.current?.setBodyVisible(!siltVisible);
  }, [siltVisible]);

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

  // Live sky: current weather (Open-Meteo) + real sun position for the reservoir location.
  // Weather refreshes every 15 min; the sun position is recomputed every minute.
  useEffect(() => {
    const [lon, lat] = geoRef.current.localToWGS84(HOME_CAMERA_TARGET.x, HOME_CAMERA_TARGET.z);
    let weather: LiveWeather | null = null;
    let cancelled = false;

    const applySky = () => {
      if (!weather || !skyRef.current || !sceneRef.current) return;
      const palette = skyPaletteFor(weather, solarPosition(new Date(), lat, lon));
      skyRef.current.apply(palette, solarPosition(new Date(), lat, lon));
      const horizon = new THREE.Color().setRGB(...palette.horizon);
      (sceneRef.current.background as THREE.Color).copy(horizon);
      (sceneRef.current.fog as THREE.FogExp2).color.copy(horizon);
    };
    const refresh = async () => {
      const w = await fetchLiveWeather(lat, lon);
      if (cancelled) return;
      weather = w;
      setLiveWeather(w);
      weatherFxRef.current?.setWeather(w);
      const drift = weatherFxRef.current?.windVector;
      if (drift) skyRef.current?.setWind(drift.x, drift.y);
      applySky();
    };

    refresh();
    const weatherTimer = window.setInterval(refresh, LIVE_SKY_REFRESH_MS);
    const sunTimer = window.setInterval(applySky, 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(weatherTimer);
      clearInterval(sunTimer);
    };
  }, [data]);

  // Where raindrops land: the satellite water surface when shown, otherwise the (carved) ground
  useEffect(() => {
    const fx = weatherFxRef.current;
    const terrain = terrainRef.current;
    if (!fx || !terrain) return;
    fx.setSurface((x, z) => {
      if (waterDepthData && permanentWaterVisible && sampleWaterDepth(waterDepthData, x, z) !== null) {
        return { y: permanentWaterLevel * verticalExaggeration, water: true };
      }
      const elev = terrain.sampleSurfaceElevation(x, z);
      return elev === null ? null : { y: elev * verticalExaggeration, water: false };
    });
  }, [waterDepthData, permanentWaterVisible, permanentWaterLevel, permanentWaterDepthScale, verticalExaggeration, dtmMode]);

  // Filled cross-section face (earth / silt band / water) on the clipping plane.
  // Declared after the layer effects so it samples their updated state.
  useEffect(() => {
    const cap = sectionCapRef.current;
    if (!cap || !terrainRef.current) return;
    if (sectionCutX === null) {
      cap.clear();
      return;
    }
    cap.build({
      cutX: sectionCutX,
      verticalExaggeration,
      terrain: terrainRef.current,
      silt: siltRef.current,
      waterDepthData,
      waterVisible: permanentWaterVisible,
      waterLevel: permanentWaterLevel
    });
  }, [sectionCutX, verticalExaggeration, siltVisible, siltMonth, siltVisualMode, siltThicknessMultiplier,
      permanentWaterVisible, permanentWaterLevel, permanentWaterDepthScale, waterDepthData, dtmMode]);

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

  // Satellite water plane is bbox-sized; only count hits on its non-transparent water pixels
  const isPickable = useCallback((hit: THREE.Intersection) => {
    const ud = hit.object.userData;
    if (ud?.isPermanentWater) {
      return !!waterDepthData && !!permanentWaterRef.current?.group.visible
        && sampleWaterDepth(waterDepthData, hit.point.x, hit.point.z) !== null;
    }
    return ud?.isTerrain || ud?.isWater || ud?.isDam || ud?.isSiltLayer;
  }, [waterDepthData]);

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
    const validHit = siltVisible
      ? intersects.find(hit => hit.object.userData?.isSiltLayer) || intersects.find(isPickable)
      : intersects.find(isPickable);

    if (validHit) {
      const hitPt = validHit.point;
      const localX = hitPt.x;
      const localZ = hitPt.z;

      // Preserve the actual clicked surface elevation for dam geometry while
      // continuing through the same coordinate-based inspection pipeline.
      const clickedDam = Boolean(validHit.object.userData?.isDam);
      const clickedSurfaceElevation = hitPt.y / verticalExaggeration;

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
      let siltTextureU: number | undefined = undefined;
      let siltTextureV: number | undefined = undefined;
      let siltVolumeScore: number | undefined = undefined;
      let siltThicknessM: number | undefined = undefined;
      let siltMonthName: string | undefined = undefined;

      if (siltData && inTank) {
        const monthRecord = siltData.months[siltMonth] || siltData.months[siltData.activeDefaultMonth];
        siltMonthName = monthRecord.name;
        const bbox = siltData.bbox.local;
        if (localX >= bbox.minX && localX <= bbox.maxX && localZ >= bbox.minZ && localZ <= bbox.maxZ) {
          const u = (localX - bbox.minX) / bbox.width;
          const v = (localZ - bbox.minZ) / bbox.depth;
          const hitUv = validHit.object.userData?.isSiltLayer ? validHit.uv : undefined;
          const textureU = hitUv ? hitUv.x : u;
          const textureV = hitUv ? 1 - hitUv.y : v;
          siltTextureU = textureU;
          siltTextureV = textureV;
          const col = Math.min(monthRecord.gridDimensions.width - 1, Math.max(0, Math.floor(u * monthRecord.gridDimensions.width)));
          const row = Math.min(monthRecord.gridDimensions.height - 1, Math.max(0, Math.floor(v * monthRecord.gridDimensions.height)));
          const raster = monthRecord.classificationPixelGrid;
          const pixelCol = raster ? Math.min(raster.width - 1, Math.max(0, Math.floor(textureU * raster.width))) : col;
          const pixelRow = raster ? Math.min(raster.height - 1, Math.max(0, Math.floor(textureV * raster.height))) : row;
          const pixelClass = raster ? Number(raster.values[pixelRow * raster.width + pixelCol]) : undefined;
          const classVal = pixelClass ?? monthRecord.classGrid[row]?.[col] ?? 0;
          const thickVal = monthRecord.thicknessGrid[row]?.[col] ?? 0;

          if (classVal > 0) {
            const classMap: Record<number, { name: 'Low' | 'Moderate' | 'High' | 'Very High'; color: string }> = {
              1: { name: 'Low', color: '#22c55e' },
              2: { name: 'Moderate', color: '#eab308' },
              3: { name: 'High', color: '#f97316' },
              4: { name: 'Very High', color: '#ef4444' }
            };
            siltClass = classMap[classVal]?.name;
            siltClassColor = classMap[classVal]?.color;
            siltVolumeScore = Math.round(thickVal * 100 * 100) / 100;
            siltThicknessM = Math.round(thickVal * 100) / 100;
          }
        }
      }

      // Sample the updated raster by location, regardless of which overlapping 3D
      // surface won the raycast (terrain, carved bed, or permanent-water mesh).
      const satelliteDepth = waterDepthData
        ? sampleWaterDepth(waterDepthData, localX, localZ)
        : null;

      if (siltVisible && siltClass) {
        sedimentThickness = siltThicknessM ?? null;
        provenance = 'OBSERVED';
        qualityNote = `Observed Sentinel-2 Silt (${siltMonthName}): ${siltClass} Class, ${siltVolumeScore?.toFixed(1)} m³/100m² pixel volume score`;
      } else if (satelliteDepth !== null && waterDepthData) {
        provenance = 'OBSERVED';
        qualityNote = `Sentinel-1 permanent water (${waterDepthData.water.imageDate}) | Sentinel-2 relative depth ${satelliteDepth.toFixed(2)} m (${waterDepthData.depth.imageDate}, band-ratio estimate, not survey-grade)`;
      } else if (!isSubmerged) {
        // Point is on dry ground above current waterline or outside reservoir
        sedimentThickness = null;
        qualityNote = inTank
          ? 'Dry shoreline ground above current water level (no underwater sediment deposit)'
          : 'Dry surrounding terrain outside reservoir boundary';
      } else if (sampleMode && origBedElev !== null && presBedElev !== null && origBedElev < presBedElev) {
        sedimentThickness = Math.round((presBedElev - origBedElev) * 100) / 100;
        provenance = 'SIMULATED';
        qualityNote = 'Simulated sedimentation deposit against modeled pre-impoundment thalweg';
      } else {
        sedimentThickness = null;
        provenance = 'OBSERVED';
        qualityNote = 'Survey Bathymetry DTM Bed Level';
      }

      // Update 3D Marker: only draw vertical caliper if submerged with sediment thickness and silt is ON
      markerRef.current?.setPosition(
        localX,
        (clickedDam || validHit.object.userData?.isSiltLayer ? hitPt.y / verticalExaggeration : presBedElev ?? 34) * verticalExaggeration,
        localZ,
        isSubmerged && sedimentThickness !== null && siltVisible ? origBedElev : null,
        verticalExaggeration
      );

      const inspection: InspectionResult = {
        x: localX,
        z: localZ,
        easting: Math.round(easting * 10) / 10,
        northing: Math.round(northing * 10) / 10,
        lon: Number(lon.toFixed(6)),
        lat: Number(lat.toFixed(6)),
        elevation: clickedDam ? Math.round(clickedSurfaceElevation * 100) / 100 : presBedElev,
        waterLevel,
        waterDepth: satelliteDepth !== null ? Math.round(satelliteDepth * 100) / 100 : waterDepth,
        waterDepthSource: satelliteDepth !== null ? 'satellite-relative' : 'level-to-bed',
        originalBedElev: isSubmerged ? origBedElev : null,
        sedimentThickness,
        inTank,
        provenance,
        qualityNote,
        siltClass,
        siltClassColor,
        siltTextureU,
        siltTextureV,
        siltVolumeScore,
        siltVolumeM3: siltThicknessM !== undefined && siltData
          ? Math.round(siltThicknessM * (siltData.bbox.local.width / (siltData.months[siltMonth] || siltData.months[siltData.activeDefaultMonth]).gridDimensions.width) * (siltData.bbox.local.depth / (siltData.months[siltMonth] || siltData.months[siltData.activeDefaultMonth]).gridDimensions.height) * 100) / 100
          : undefined,
        siltThicknessM,
        siltMonthName
      };

      onPointInspected(inspection);
    }
  }, [activeTool, waterLevel, verticalExaggeration, sampleMode, siltVisible, onPointInspected, onTransectDrawn, siltData, siltMonth, isPickable, waterDepthData]);

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
    const validHit = intersects.find(isPickable);

    if (validHit) {
      const localX = validHit.point.x;
      const localZ = validHit.point.z;
      const [lon, lat] = geoRef.current.localToWGS84(localX, localZ);

      let tooltipText = '';
      if (validHit.object.userData?.isDam) {
        const isCrest = validHit.object.userData?.component === 'crest';
        tooltipText = `Chapoli Dam Embankment | Elev: ${isCrest ? '41.00m (Crest Road)' : (validHit.point.y / verticalExaggeration).toFixed(1) + 'm (Slope)'} | 760m Axis`;
      } else if (validHit.object.userData?.isPermanentWater && waterDepthData) {
        const depthM = sampleWaterDepth(waterDepthData, localX, localZ);
        tooltipText = `Permanent Water | Depth: ${depthM !== null ? depthM.toFixed(1) + 'm' : 'NoData'} (relative) | ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`;
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
  }, [isPickable, waterDepthData, siltMonth, verticalExaggeration]);

  // Smooth View Preset Transitions
  const smoothTransitionTo = useCallback((targetPos: THREE.Vector3, targetLookAt: THREE.Vector3, duration = 1000) => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraTransitionRef.current = {
      isTransitioning: true,
      startTime: performance.now(),
      duration,
      startPos: cameraRef.current.position.clone(),
      targetPos,
      startLookAt: controlsRef.current.target.clone(),
      targetLookAt
    };
  }, []);

  const setTopView = useCallback(() => {
    smoothTransitionTo(new THREE.Vector3(-80, 1400, -9.8), new THREE.Vector3(-80, 32, -10), 1000);
    setActivePreset('top');
  }, [smoothTransitionTo]);

  const setSideView = useCallback(() => {
    // Elevated Western Side Profile looking eastward across the 760m Dam Embankment and reservoir basin
    smoothTransitionTo(new THREE.Vector3(-1050, 200, 0), new THREE.Vector3(-80, 35, 0), 1000);
    setActivePreset('side');
  }, [smoothTransitionTo]);

  const setPerspectiveView = useCallback(() => {
    // Elevated three-quarter perspective framing reservoir, surrounding hills and earthen dam
    smoothTransitionTo(HOME_CAMERA_POSITION.clone(), HOME_CAMERA_TARGET.clone(), 1000);
    setActivePreset('perspective');
  }, [smoothTransitionTo]);

  const setLowObliqueView = useCallback(() => {
    // Dam Abutment perspective inspecting the deep intake basin and upstream reservoir pool
    smoothTransitionTo(new THREE.Vector3(-540, 160, -380), new THREE.Vector3(-200, 25, 40), 1000);
    setActivePreset('depth');
  }, [smoothTransitionTo]);

  // Looking east, square-on to the east-west cut, so the filled section reads like a survey profile
  const setSectionView = useCallback(() => {
    const cut = sectionCutRef.current ?? 0;
    smoothTransitionTo(new THREE.Vector3(cut - 1250, 330, 60), new THREE.Vector3(cut, 40, 0), 1000);
    setActivePreset('side');
  }, [smoothTransitionTo]);

  const resetNorth = useCallback(() => {
    smoothTransitionTo(HOME_CAMERA_POSITION.clone(), HOME_CAMERA_TARGET.clone(), 1000);
    setActivePreset('perspective');
  }, [smoothTransitionTo]);

  const zoomIn = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const tgt = controlsRef.current.target;
    const dir = new THREE.Vector3().subVectors(tgt, cam.position).normalize();
    const dist = cam.position.distanceTo(tgt);
    const newPos = cam.position.clone().addScaledVector(dir, Math.min(dist * 0.3, 400));
    smoothTransitionTo(newPos, tgt.clone(), 350);
  }, [smoothTransitionTo]);

  const zoomOut = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const tgt = controlsRef.current.target;
    const dir = new THREE.Vector3().subVectors(cam.position, tgt).normalize();
    const dist = cam.position.distanceTo(tgt);
    const newPos = cam.position.clone().addScaledVector(dir, Math.min(dist * 0.4, 600));
    smoothTransitionTo(newPos, tgt.clone(), 350);
  }, [smoothTransitionTo]);

  const zoomFit = useCallback(() => {
    setPerspectiveView();
  }, [setPerspectiveView]);

  // Handle external view preset triggers from toolbar
  useEffect(() => {
    if (!viewPresetTrigger) return;
    switch (viewPresetTrigger.preset) {
      case 'perspective':
        setPerspectiveView();
        break;
      case 'top':
        setTopView();
        break;
      case 'depth':
        setLowObliqueView();
        break;
      case 'side':
        setSideView();
        break;
      case 'reset':
        resetNorth();
        break;
      case 'section':
        setSectionView();
        break;
    }
  }, [viewPresetTrigger, setPerspectiveView, setTopView, setLowObliqueView, setSideView, resetNorth, setSectionView]);

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
      {/* 3D Navigation Controls Stack (Compass + Zoom) */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          right: navigationRightOffset,
          transition: 'right 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          zIndex: 45
        }}
      >
        <CompassWidget rotationY={cameraRotationY} onResetNorth={resetNorth} />

        {/* Zoom Controls */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 38,
            background: 'rgba(8, 14, 28, 0.90)',
            borderRadius: 8,
            border: '1px solid rgba(56, 189, 248, 0.25)',
            overflow: 'hidden',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); zoomIn(); }}
            title="Zoom In"
            style={{
              width: 38,
              height: 32,
              background: 'transparent',
              border: 'none',
              color: '#f8fafc',
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderBottom: '1px solid rgba(255,255,255,0.08)'
            }}
          >
            +
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); zoomOut(); }}
            title="Zoom Out"
            style={{
              width: 38,
              height: 32,
              background: 'transparent',
              border: 'none',
              color: '#f8fafc',
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderBottom: '1px solid rgba(255,255,255,0.08)'
            }}
          >
            −
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); zoomFit(); }}
            title="Fit Entire Reservoir to View"
            style={{
              width: 38,
              height: 32,
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-cyan)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ⛶
          </button>
        </div>
      </div>

      {/* Dynamic Metric Scale Bar */}
      <ScaleBar cameraDistance={cameraDistance} />

      {/* Live sky and rain forecast chip (Open-Meteo model) */}
      {liveWeather && (
        <div
          className="weather-chip"
          style={{
            position: 'absolute',
            zIndex: 40,
            background: 'rgba(8, 14, 28, 0.85)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 11,
            color: 'var(--text-secondary)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}
          title="Weather at Chapoli"
        >
          <Thermometer size={18} color="#fbbf24" />
          <span style={{ fontSize: 25, fontWeight: 700, color: '#f8fafc', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
            {liveWeather.temperatureC !== null ? `${liveWeather.temperatureC.toFixed(1)}°C` : '--°C'}
          </span>
          <span className="weather-details" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3, minWidth: 0 }}>
            <strong style={{ color: '#e2e8f0' }}>{describeWeather(liveWeather.cloudCover, liveWeather.precipitationMm)}</strong>
            <span>
              <span style={{ color: liveWeather.ok ? '#34d399' : '#fbbf24' }}>●</span>{' '}
              {liveWeather.ok
                ? rainIntensityFor(liveWeather.precipitationMm) === 'none'
                  ? `${liveWeather.cloudCover}% cloud`
                  : `${liveWeather.precipitationMm.toFixed(1)} mm in last hour`
                : 'Offline'}
            </span>
            {liveWeather.ok && nextHourEta && liveWeather.nextHourForecast && (
              <span className="weather-next-hour" title={`Next hourly forecast; precipitation probability ${liveWeather.nextHourForecast.probability}%`}>
                {liveWeather.nextHourForecast.amountMm > 0
                  ? <Droplets size={13} />
                  : liveWeather.nextHourForecast.isDay ? <CloudSun size={13} /> : <CloudMoon size={13} />}
                <span>
                  Next hour ({nextHourEta}): {liveWeather.nextHourForecast.amountMm > 0
                    ? `Rain · ${liveWeather.nextHourForecast.amountMm.toFixed(1)} mm (${liveWeather.nextHourForecast.probability}%)`
                    : `${describeForecastSky(liveWeather.nextHourForecast.cloudCover, liveWeather.nextHourForecast.isDay)} · no rain`}
                </span>
              </span>
            )}
          </span>
          {liveWeather.ok && (
            <span
              style={{ display: 'flex', alignItems: 'center', gap: 6, borderLeft: '1px solid rgba(255,255,255,0.12)', paddingLeft: 10 }}
              title={`Wind from ${compassLabel(liveWeather.windDirectionDeg)} (${Math.round(liveWeather.windDirectionDeg)}°); arrow shows where it blows, north up`}
            >
              <Wind size={16} color="#7dd3fc" />
              <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                <strong style={{ color: '#e2e8f0' }}>{liveWeather.windSpeedKmh.toFixed(0)} km/h</strong>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <ArrowUp size={11} style={{ transform: `rotate(${liveWeather.windDirectionDeg + 180}deg)` }} />
                  from {compassLabel(liveWeather.windDirectionDeg)}
                </span>
              </span>
            </span>
          )}
        </div>
      )}

      {/* Viewport Presets Control HUD */}
      <div
        style={{
          position: 'absolute',
          top: 82,
          left: 20,
          display: 'flex',
          gap: 4,
          zIndex: 40,
          background: 'rgba(8, 14, 28, 0.90)',
          padding: '4px 6px',
          borderRadius: 8,
          border: '1px solid rgba(56, 189, 248, 0.25)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 18px rgba(0,0,0,0.5)'
        }}
      >
        {[
          { id: 'perspective' as const, label: 'Perspective', action: setPerspectiveView, title: '3D Natural Oblique Perspective View' },
          { id: 'top' as const, label: 'Top Plan', action: setTopView, title: 'Orthogonal Top Plan View (Checking KML Boundary)' },
          { id: 'depth' as const, label: 'Basin Depth', action: setLowObliqueView, title: 'Low Oblique View (Inspecting Basin Depth)' },
          { id: 'side' as const, label: 'Side Profile', action: setSideView, title: 'Side Profile View (Dam Embankment)' }
        ].map((preset) => {
          const isActive = activePreset === preset.id;
          return (
            <button
              key={preset.id}
              onClick={(e) => { e.stopPropagation(); preset.action(); }}
              title={preset.title}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 5,
                border: 'none',
                background: isActive ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {preset.label}
            </button>
          );
        })}
        <button
          onClick={(e) => { e.stopPropagation(); resetNorth(); }}
          style={{
            padding: '4px 8px',
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 5,
            border: 'none',
            background: 'transparent',
            color: 'var(--accent-cyan)',
            cursor: 'pointer'
          }}
          title="Reset Camera to Default Perspective and True North"
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
