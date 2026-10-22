import React, { useState, useMemo } from 'react';
import rawData from './data/chapoli_data.json';
import rawSiltData from './data/silt_series.json';
import { ChapoliData, InspectionResult, ImportedSurvey, DtmSurfaceMode } from './types/reservoir';
import { SiltSeriesPayload, SiltVisualMode } from './types/silt';
import { SedimentAnalysisEngine } from './utils/sedimentAnalysis';
import { ReservoirCanvas } from './components/Scene3D/ReservoirCanvas';
import { Header } from './components/Dashboard/Header';
import { SpecsPanel } from './components/Dashboard/SpecsPanel';
import { WaterLevelControl } from './components/Dashboard/WaterLevelControl';
import { LayerControls } from './components/Dashboard/LayerControls';
import { PointInspectorCard } from './components/Dashboard/PointInspectorCard';
import { SiltTimelineControl } from './components/Dashboard/SiltTimelineControl';
import { CrossSectionModal } from './components/Dashboard/CrossSectionModal';
import { SedimentVolumeModal } from './components/Dashboard/SedimentVolumeCard';
import { SurveyImportModal } from './components/Dashboard/SurveyImportModal';
import { ExportReportModal } from './components/Dashboard/ExportReportModal';
import { DamElevationProfileModal } from './components/Dashboard/DamElevationProfileModal';

export const App: React.FC = () => {
  const data = (rawData as unknown) as ChapoliData;
  const siltData = (rawSiltData as unknown) as SiltSeriesPayload;
  const engine = useMemo(() => new SedimentAnalysisEngine(data), [data]);

  // Operational Simulation State
  const [waterLevel, setWaterLevel] = useState<number>(38.25); // Default to FRL (38.25m)
  const [verticalExaggeration, setVerticalExaggeration] = useState<number>(1.0); // True 1:1 real-world physical vertical scale
  const [sampleMode, setSampleMode] = useState<boolean>(true); // Default to sample model with clear disclaimer
  const [activeTool, setActiveTool] = useState<'inspect' | 'transect' | 'measure' | null>('inspect');
  const [dtmMode, setDtmMode] = useState<DtmSurfaceMode>('bathymetric');

  // Sidebar Tab Switcher
  const [sidebarTab, setSidebarTab] = useState<'specs' | 'simulation' | 'layers'>('specs');

  // 3D Layer Visibility & Rendering
  const [terrainVisible, setTerrainVisible] = useState<boolean>(true);
  const [waterVisible, setWaterVisible] = useState<boolean>(true);
  const [waterOpacity, setWaterOpacity] = useState<number>(0.90);
  const [bedVisible, setBedVisible] = useState<boolean>(true);
  const [damVisible, setDamVisible] = useState<boolean>(true);
  const [sedimentVisible, setSedimentVisible] = useState<boolean>(false); // Default to clean natural bed without Z-fighting
  const [sedimentOpacity, setSedimentOpacity] = useState<number>(0.85);
  const [contoursVisible, setContoursVisible] = useState<boolean>(false); // Turn off contours by default so terrain is not a wireframe mesh
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [hillshade, setHillshade] = useState<boolean>(true);
  const [sectionCutX, setSectionCutX] = useState<number | null>(null);

  // Sentinel-2 Silt Classification & Volume Surface Series
  const [siltVisible, setSiltVisible] = useState<boolean>(true);
  const [siltMonth, setSiltMonth] = useState<string>('sep'); // September 2026 is annual peak sedimentation
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

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top Application Header */}
      <Header
        sampleMode={sampleMode}
        onToggleSampleMode={setSampleMode}
        onOpenDamProfile={() => setIsDamProfileOpen(true)}
        liveTelemetry={data.live_telemetry}
        onSyncLiveLevel={(lvl) => setWaterLevel(lvl)}
        onOpenCrossSection={() => setIsCrossSectionOpen(true)}
        onOpenVolumeStats={() => setIsVolumeModalOpen(true)}
        onOpenImport={() => setIsImportModalOpen(true)}
        onOpenExport={() => setIsExportModalOpen(true)}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        dem={data.dem}
        tankAreaHa={data.tank.area_ha}
      />

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
          />

          {/* Interactive Silt Timeline Scrubber & Seasonal Analytics HUD */}
          <SiltTimelineControl
            siltData={siltData}
            activeMonth={siltMonth}
            onSelectMonth={setSiltMonth}
            visualMode={siltVisualMode}
            onToggleVisualMode={setSiltVisualMode}
            siltVisible={siltVisible}
            onToggleSiltVisible={setSiltVisible}
          />

          {/* Floating Point Inspector Card */}
          {inspectedPoint && (
            <PointInspectorCard
              inspection={inspectedPoint}
              onClose={() => setInspectedPoint(null)}
            />
          )}

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
        </div>

        {/* Right Engineering Control Sidebar */}
        <aside
          style={{
            width: 390,
            height: '100%',
            overflowY: 'auto',
            background: 'rgba(8, 14, 28, 0.95)',
            backdropFilter: 'blur(16px)',
            borderLeft: '1px solid var(--border-dim)',
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            zIndex: 40
          }}
        >
          {/* Sidebar Tab Switcher */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 4,
              background: 'rgba(15, 23, 42, 0.7)',
              padding: 3,
              borderRadius: 8,
              border: '1px solid var(--border-dim)'
            }}
          >
            {(['specs', 'simulation', 'layers'] as const).map((tab) => {
              const labels = {
                specs: 'Specifications',
                simulation: 'Simulation',
                layers: '3D Layers'
              };
              const isActive = sidebarTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  style={{
                    padding: '6px 4px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: 'none',
                    background: isActive ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          {/* Active Tab Panel */}
          {sidebarTab === 'specs' && (
            <SpecsPanel
              specs={data.baseline_specs}
              dem={data.dem}
              waterLevel={waterLevel}
              currentModeledVolumeMCM={waterStorage.volumeMCM}
              submergedAreaHa={waterStorage.areaHa}
              sedimentStats={sedimentStats}
              sampleMode={sampleMode}
            />
          )}

          {sidebarTab === 'simulation' && (
            <WaterLevelControl
              waterLevel={waterLevel}
              onWaterLevelChange={setWaterLevel}
              submergedAreaHa={waterStorage.areaHa}
              submergedVolumeMCM={waterStorage.volumeMCM}
              liveLevel={data.live_telemetry?.reportedLevel_m ?? 35.47}
            />
          )}

          {sidebarTab === 'layers' && (
            <LayerControls
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
              sampleMode={sampleMode}
              dtmMode={dtmMode}
              setDtmMode={setDtmMode}
              siltVisible={siltVisible}
              setSiltVisible={setSiltVisible}
              siltMonth={siltMonth}
              setSiltMonth={setSiltMonth}
              siltVisualMode={siltVisualMode}
              setSiltVisualMode={setSiltVisualMode}
              siltOpacity={siltOpacity}
              setSiltOpacity={setSiltOpacity}
              siltThicknessMultiplier={siltThicknessMultiplier}
              setSiltThicknessMultiplier={setSiltThicknessMultiplier}
            />
          )}
        </aside>
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
        stats={sedimentStats}
        specs={data.baseline_specs}
        sampleMode={sampleMode}
        onEnableSampleMode={() => setSampleMode(true)}
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
      />
    </div>
  );
};

export default App;
