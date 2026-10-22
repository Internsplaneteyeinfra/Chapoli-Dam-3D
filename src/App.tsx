import React, { useState, useMemo, useEffect } from 'react';
import rawData from './data/chapoli_data.json';
import rawSiltData from './data/silt_series.json';
import rawWaterDepthData from './data/water_depth.json';
import { WaterDepthPayload } from './types/waterDepth';
import { WaterToggleControl } from './components/Dashboard/WaterToggleControl';
import { ChapoliData, InspectionResult, ImportedSurvey, DtmSurfaceMode } from './types/reservoir';
import { SiltSeriesPayload, SiltVisualMode } from './types/silt';
import { SedimentAnalysisEngine } from './utils/sedimentAnalysis';
import { ReservoirCanvas } from './components/Scene3D/ReservoirCanvas';
import { FileDown } from 'lucide-react';
import { ReservoirOverviewAndInspectorPanel } from './components/Dashboard/ReservoirOverviewAndInspectorPanel';
import { RightVerticalToolbar, RightToolbarTab } from './components/Dashboard/RightVerticalToolbar';
import { SiltTimelineControl } from './components/Dashboard/SiltTimelineControl';
import { CrossSectionModal } from './components/Dashboard/CrossSectionModal';
import { SedimentVolumeModal } from './components/Dashboard/SedimentVolumeCard';
import { SurveyImportModal } from './components/Dashboard/SurveyImportModal';
import { ExportReportModal } from './components/Dashboard/ExportReportModal';
import { DamElevationProfileModal } from './components/Dashboard/DamElevationProfileModal';
import chapoliLogo from './assets/chapoli-logo.png';

export const App: React.FC = () => {
  const data = (rawData as unknown) as ChapoliData;
  const siltData = (rawSiltData as unknown) as SiltSeriesPayload;
  const waterDepthData = (rawWaterDepthData as unknown) as WaterDepthPayload;
  const engine = useMemo(() => new SedimentAnalysisEngine(data), [data]);

  // Operational Simulation State
  const [waterLevel, setWaterLevel] = useState<number>(38.25); // Default to FRL (38.25m)
  const [verticalExaggeration, setVerticalExaggeration] = useState<number>(4.0); // 4x so the hills, dam and carved basin read clearly on load
  const [sampleMode, setSampleMode] = useState<boolean>(false); // Default to false (real observed survey bathymetry & Sentinel-2 silt)
  const [activeTool, setActiveTool] = useState<'inspect' | 'transect' | 'measure' | null>('inspect');
  const [dtmMode, setDtmMode] = useState<DtmSurfaceMode>('bathymetric');

  // Right-side Vertical Toolbar & Drawer State (RIVER.EYE style)
  const [activeRightTab, setActiveRightTab] = useState<RightToolbarTab>(null);
  const [viewPresetTrigger, setViewPresetTrigger] = useState<{ preset: 'perspective' | 'top' | 'depth' | 'side' | 'reset' | 'section'; timestamp: number } | null>(null);

  const handleSelectViewPreset = (preset: 'perspective' | 'top' | 'depth' | 'side' | 'reset' | 'section') => {
    setViewPresetTrigger({ preset, timestamp: performance.now() });
  };

  // 3D Layer Visibility & Rendering
  const [terrainVisible, setTerrainVisible] = useState<boolean>(true);
  // Simulated water-level plane is off by default; the satellite permanent water + depth layer replaces it
  const [waterVisible, setWaterVisible] = useState<boolean>(false);
  const [permanentWaterVisible, setPermanentWaterVisible] = useState<boolean>(true);
  // Satellite water body / basin depth exaggeration (x5 so the 6.5-20 m column reads in 3D)
  const [permanentWaterDepthScale, setPermanentWaterDepthScale] = useState<number>(5);
  // Satellite water surface sits at the observed SCADA level (falls back to FRL)
  const observedWaterLevel = data.live_telemetry?.reportedLevel_m ?? 38.25;
  const [waterOpacity, setWaterOpacity] = useState<number>(0.90);
  const [bedVisible, setBedVisible] = useState<boolean>(true);
  const [damVisible, setDamVisible] = useState<boolean>(true);
  const [sedimentVisible, setSedimentVisible] = useState<boolean>(false); // Default to clean natural bed without Z-fighting
  const [sedimentOpacity, setSedimentOpacity] = useState<number>(0.85);
  const [treesVisible, setTreesVisible] = useState<boolean>(true); // 3D Trees and natural forest vegetation across catchment
  const [contoursVisible, setContoursVisible] = useState<boolean>(false); // Turn off contours by default so terrain is not a wireframe mesh
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [hillshade, setHillshade] = useState<boolean>(true);
  const [sectionCutX, setSectionCutX] = useState<number | null>(null);

  // One-click cross-section through the middle of the reservoir, viewed square-on from the west
  const SECTION_CUT_X = -40;
  const handleToggleSection = (on: boolean) => {
    setSectionCutX(on ? SECTION_CUT_X : null);
    handleSelectViewPreset(on ? 'section' : 'perspective');
  };

  // Sentinel-2 Silt Classification & Volume Surface Series
  const [siltVisible, setSiltVisible] = useState<boolean>(false); // opens on the water view; Silt pill turns it on
  const [siltMonth, setSiltMonth] = useState<string>(siltData.activeDefaultMonth); // peak-volume month from the silt series
  const [siltVisualMode, setSiltVisualMode] = useState<SiltVisualMode>('classification');
  const [siltOpacity, setSiltOpacity] = useState<number>(0.85);
  const [siltThicknessMultiplier, setSiltThicknessMultiplier] = useState<number>(1.0);

  // Inspection & Cross-Section Transect
  const [inspectedPoint, setInspectedPoint] = useState<InspectionResult | null>(null);
  const [transectPoints, setTransectPoints] = useState<{ start: [number, number]; end: [number, number] }>({
    start: [0, -450], // North Inflow
    end: [0, 400]     // South Dam Face
  });
  const [activePresetName, setActivePresetName] = useState<string>('Longitudinal Thalweg (Inflow to Dam)');

  // Modals
  const [isDamProfileOpen, setIsDamProfileOpen] = useState<boolean>(false);
  const [isCrossSectionOpen, setIsCrossSectionOpen] = useState<boolean>(false);
  const [isVolumeModalOpen, setIsVolumeModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Registered Bathymetric Surveys
  const [surveys, setSurveys] = useState<ImportedSurvey[]>([
    {
      id: 'chapoli-fabdem-dtm',
      name: 'FABDEM DTM (Clipped, No Smoothing) & 1m Bathymetry',
      surveyDate: '2026-10-21',
      surveyor: 'Copernicus FABDEM & Goa WRD',
      pointCount: data.dem.rawDemValidCells,
      meanElevation: data.dem.meanElevation,
      isCustom: false
    }
  ]);
  const [activeSurveyId, setActiveSurveyId] = useState<string>('chapoli-fabdem-dtm');

  // Compute live water storage & sediment statistics
  const waterStorage = useMemo(() => engine.calculateWaterStorage(waterLevel), [engine, waterLevel]);
  const sedimentStats = useMemo(() => engine.computeSedimentStats(sampleMode), [engine, sampleMode]);

  // Handle custom interactive transect drawn on 3D canvas
  const handleTransectDrawn = (start: [number, number], end: [number, number]) => {
    setTransectPoints({ start, end });
    setActivePresetName('Custom 3D Cut');
    setIsCrossSectionOpen(true);
    setActiveTool('inspect');
  };

  const handleSelectPreset = (start: [number, number], end: [number, number], name: string) => {
    setTransectPoints({ start, end });
    setActivePresetName(name);
  };

  const handleImportSurvey = (newSurvey: ImportedSurvey) => {
    setSurveys((prev) => [newSurvey, ...prev]);
    setActiveSurveyId(newSurvey.id);
  };

  // Dynamically update inspected point Sentinel-2 silt values when timeline month changes
  useEffect(() => {
    if (!inspectedPoint || !siltData) return;
    const monthRecord = siltData.months[siltMonth] || siltData.months[siltData.activeDefaultMonth];
    if (!monthRecord) return;
    const bbox = siltData.bbox.local;
    const { x: localX, z: localZ } = inspectedPoint;
    if (localX >= bbox.minX && localX <= bbox.maxX && localZ >= bbox.minZ && localZ <= bbox.maxZ) {
      const u = (localX - bbox.minX) / bbox.width;
      const v = (localZ - bbox.minZ) / bbox.depth;
      const col = Math.min(monthRecord.gridDimensions.width - 1, Math.max(0, Math.floor(u * monthRecord.gridDimensions.width)));
      const row = Math.min(monthRecord.gridDimensions.height - 1, Math.max(0, Math.floor(v * monthRecord.gridDimensions.height)));
      const classVal = monthRecord.classGrid[row]?.[col] ?? 0;
      const thickVal = monthRecord.thicknessGrid[row]?.[col] ?? 0;
      const classMap: Record<number, { name: 'Low' | 'Moderate' | 'High' | 'Very High'; color: string }> = {
        1: { name: 'Low', color: '#22c55e' },
        2: { name: 'Moderate', color: '#eab308' },
        3: { name: 'High', color: '#f97316' },
        4: { name: 'Very High', color: '#ef4444' }
      };
      if (classVal > 0) {
        const siltClass = classMap[classVal]?.name;
        const siltClassColor = classMap[classVal]?.color;
        const siltVolumeScore = Math.round(thickVal * 100 * 100) / 100;
        const siltThicknessM = Math.round(thickVal * 100) / 100;
        setInspectedPoint(prev => prev ? ({
          ...prev,
          siltClass,
          siltClassColor,
          siltVolumeScore,
          siltThicknessM,
          siltMonthName: monthRecord.name,
          sedimentThickness: siltVisible ? siltThicknessM : null,
          provenance: 'OBSERVED',
          qualityNote: `Observed Sentinel-2 Silt (${monthRecord.name}): ${siltClass} Class, ${siltVolumeScore.toFixed(1)} m³/100m² pixel volume score`
        }) : null);
      }
    }
  }, [siltMonth, siltData, siltVisible]);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Main Workspace: 3D Viewport + Engineering Sidebars */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
        {/* Three.js Interactive 3D Canvas */}
        <div style={{ flex: 1, height: '100%', position: 'relative' }}>
          <ReservoirCanvas
            data={data}
            waterLevel={waterLevel}
            verticalExaggeration={verticalExaggeration}
            terrainVisible={terrainVisible}
            waterVisible={waterVisible}
            waterOpacity={waterOpacity}
            bedVisible={bedVisible}
            damVisible={damVisible}
            treesVisible={treesVisible}
            sedimentVisible={sedimentVisible}
            sedimentOpacity={sedimentOpacity}
            contoursVisible={contoursVisible}
            wireframe={wireframe}
            hillshade={hillshade}
            sampleMode={sampleMode}
            dtmMode={dtmMode}
            sectionCutX={sectionCutX}
            transectPoints={transectPoints}
            onPointInspected={setInspectedPoint}
            activeTool={activeTool}
            onTransectDrawn={handleTransectDrawn}
            siltData={siltData}
            siltVisible={siltVisible}
            siltMonth={siltMonth}
            siltVisualMode={siltVisualMode}
            siltOpacity={siltOpacity}
            siltThicknessMultiplier={siltThicknessMultiplier}
            waterDepthData={waterDepthData}
            permanentWaterVisible={permanentWaterVisible}
            permanentWaterOpacity={siltVisible ? 0.3 : 0.88} // mostly clear over silt so its colours read from above
            permanentWaterLevel={waterLevel} // live simulated water level, rises and falls with the slider
            permanentWaterDepthScale={permanentWaterDepthScale}
            viewPresetTrigger={viewPresetTrigger}
            navigationRightOffset={activeRightTab ? 450 : 70}
          />

          <img
            src={chapoliLogo}
            alt="Chapoli 3D Sediment Measurement Digital Twin"
            style={{
              position: 'absolute',
              top: 8,
              left: 18,
              width: 128,
              height: 64,
              objectFit: 'contain',
              zIndex: 48,
              pointerEvents: 'none',
              filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.65))'
            }}
          />

          {/* Bottom dock: water on/off toggle above the silt timeline HUD */}
          <div
            style={{
              position: 'absolute',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'min(94%, 780px)',
              zIndex: 40,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              pointerEvents: 'none'
            }}
          >
            <div style={{ pointerEvents: 'auto' }}>
              <WaterToggleControl
                waterDepthData={waterDepthData}
                visible={permanentWaterVisible}
                onToggle={setPermanentWaterVisible}
                siltVisible={siltVisible}
                onToggleSilt={setSiltVisible}
                sectionOn={sectionCutX !== null}
                onToggleSection={handleToggleSection}
                surfaceLevel={waterLevel}
                depthScale={permanentWaterDepthScale}
                onDepthScale={setPermanentWaterDepthScale}
                docked
              />
            </div>
            {/* Timeline only while silt is on; the Silt pill above switches it */}
            {siltVisible && (
              <div style={{ pointerEvents: 'auto', width: '100%' }}>
                <SiltTimelineControl
                  siltData={siltData}
                  activeMonth={siltMonth}
                  onSelectMonth={setSiltMonth}
                  visualMode={siltVisualMode}
                  onToggleVisualMode={setSiltVisualMode}
                  siltVisible={siltVisible}
                  onToggleSiltVisible={setSiltVisible}
                  docked
                />
              </div>
            )}
          </div>

          {/* Floating Left Panel: Reservoir Basin Overview & 3D Point Inspector (RIVER.EYE) */}
          <ReservoirOverviewAndInspectorPanel
            inspection={inspectedPoint}
            onClearInspection={() => setInspectedPoint(null)}
            specs={data.baseline_specs}
            waterLevel={waterLevel}
            submergedAreaHa={waterStorage.areaHa}
            submergedVolumeMCM={waterStorage.volumeMCM}
            liveTelemetry={data.live_telemetry}
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            onOpenDamProfile={() => setIsDamProfileOpen(true)}
            onOpenCrossSection={() => setIsCrossSectionOpen(true)}
            siltVisible={siltVisible}
            siltMonthName={siltData.months[siltMonth]?.name || 'September'}
          />

          {/* Tool Active Instruction Banner */}
          {activeTool === 'transect' && (
            <div
              style={{
                position: 'absolute',
                top: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(14, 165, 233, 0.9)',
                color: '#ffffff',
                padding: '8px 16px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                zIndex: 60,
                pointerEvents: 'none'
              }}
            >
              Click 2 points on the reservoir to cut an interactive 3D cross-section
            </div>
          )}

          {/* Floating Top-Right Export Action Button (Single prominent action remaining from header) */}
          <div
            style={{
              position: 'absolute',
              top: 20,
              right: (activeRightTab ? 450 : 70) + 54,
              transition: 'right 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              zIndex: 45,
              pointerEvents: 'auto'
            }}
          >
            <button
              onClick={() => setIsExportModalOpen(true)}
              title="Export Digital Twin Report, GeoJSON, CSV & Bathymetry Data"
              style={{
                height: 38,
                padding: '0 16px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                border: '1px solid rgba(56, 189, 248, 0.4)',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                cursor: 'pointer',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 4px 18px rgba(0, 0, 0, 0.45), 0 0 12px rgba(56, 189, 248, 0.3)',
                transition: 'all 0.15s ease'
              }}
              className="hover:brightness-110 active:scale-95"
            >
              <FileDown size={15} />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Right-Side Vertical Action Toolbar Dock & Flyout Drawer (RIVER.EYE) */}
        <RightVerticalToolbar
          activeTab={activeRightTab}
          setActiveTab={setActiveRightTab}
          specs={data.baseline_specs}
          dem={data.dem}
          waterLevel={waterLevel}
          setWaterLevel={setWaterLevel}
          submergedAreaHa={waterStorage.areaHa}
          submergedVolumeMCM={waterStorage.volumeMCM}
          liveTelemetry={data.live_telemetry}
          sampleMode={sampleMode}
          setSampleMode={setSampleMode}
          sedimentStats={sedimentStats}
          siltSeriesData={siltData}
          waterDepthData={waterDepthData}
          siltMonth={siltMonth}
          setSiltMonth={setSiltMonth}
          siltVisualMode={siltVisualMode}
          setSiltVisualMode={setSiltVisualMode}
          siltVisible={siltVisible}
          setSiltVisible={setSiltVisible}
          siltOpacity={siltOpacity}
          setSiltOpacity={setSiltOpacity}
          siltThicknessMultiplier={siltThicknessMultiplier}
          setSiltThicknessMultiplier={setSiltThicknessMultiplier}
          terrainVisible={terrainVisible}
          setTerrainVisible={setTerrainVisible}
          waterVisible={waterVisible}
          setWaterVisible={setWaterVisible}
          waterOpacity={waterOpacity}
          setWaterOpacity={setWaterOpacity}
          bedVisible={bedVisible}
          setBedVisible={setBedVisible}
          damVisible={damVisible}
          setDamVisible={setDamVisible}
          sedimentVisible={sedimentVisible}
          setSedimentVisible={setSedimentVisible}
          sedimentOpacity={sedimentOpacity}
          setSedimentOpacity={setSedimentOpacity}
          contoursVisible={contoursVisible}
          setContoursVisible={setContoursVisible}
          wireframe={wireframe}
          setWireframe={setWireframe}
          hillshade={hillshade}
          setHillshade={setHillshade}
          verticalExaggeration={verticalExaggeration}
          setVerticalExaggeration={setVerticalExaggeration}
          sectionCutX={sectionCutX}
          setSectionCutX={setSectionCutX}
          dtmMode={dtmMode}
          setDtmMode={setDtmMode}
          onSelectViewPreset={handleSelectViewPreset}
          onOpenDamProfile={() => setIsDamProfileOpen(true)}
          onOpenCrossSection={() => setIsCrossSectionOpen(true)}
          onOpenVolumeStats={() => setIsVolumeModalOpen(true)}
          onOpenExport={() => setIsExportModalOpen(true)}
          onOpenImport={() => setIsImportModalOpen(true)}
          treesVisible={treesVisible}
          setTreesVisible={setTreesVisible}
        />
      </div>

      {/* Dam Elevation Profile & Caliper Modal */}
      <DamElevationProfileModal
        isOpen={isDamProfileOpen}
        onClose={() => setIsDamProfileOpen(false)}
        damGeom={data.dam_geometry}
        waterLevel={waterLevel}
      />

      {/* Cross-Section Modal */}
      <CrossSectionModal
        isOpen={isCrossSectionOpen}
        onClose={() => setIsCrossSectionOpen(false)}
        engine={engine}
        waterLevel={waterLevel}
        sampleMode={sampleMode}
        transectPoints={transectPoints}
        onSelectPreset={handleSelectPreset}
        activePresetName={activePresetName}
      />

      {/* Sediment Volume Modal */}
      <SedimentVolumeModal
        isOpen={isVolumeModalOpen}
        onClose={() => setIsVolumeModalOpen(false)}
        siltData={siltData}
        siltMonth={siltMonth}
        onSelectMonth={setSiltMonth}
      />

      {/* Survey Import Modal */}
      <SurveyImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSurvey={handleImportSurvey}
        surveys={surveys}
        activeSurveyId={activeSurveyId}
        onSelectSurvey={setActiveSurveyId}
      />

      {/* Export Report Modal */}
      <ExportReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        data={data}
        sedimentStats={sedimentStats}
        waterLevel={waterLevel}
        sampleMode={sampleMode}
        siltData={siltData}
        siltMonth={siltMonth}
      />
    </div>
  );
};

export default App;
