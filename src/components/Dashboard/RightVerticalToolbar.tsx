import React from 'react';
import {
  Database,
  Eye,
  Activity,
  Droplets,
  Layers,
  Compass,
  Sliders,
  X,
  Mountain,
  ChevronRight,
  Radio,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  FileDown,
  Upload
} from 'lucide-react';
import {
  BaselineSpecs,
  DEMSummary,
  LiveTelemetry,
  SedimentVolumeStats,
  DtmSurfaceMode
} from '../../types/reservoir';
import { SiltSeriesPayload, SiltVisualMode } from '../../types/silt';
import { SpecsPanel } from './SpecsPanel';
import { WaterDepthPayload } from '../../types/waterDepth';
import { WaterLevelControl } from './WaterLevelControl';
import { LayerControls } from './LayerControls';

export type RightToolbarTab = 'specs' | 'views' | 'sediment' | 'simulation' | 'layers' | 'settings' | null;

interface RightVerticalToolbarProps {
  activeTab: RightToolbarTab;
  setActiveTab: (tab: RightToolbarTab) => void;
  specs: BaselineSpecs;
  dem?: DEMSummary;
  waterLevel: number;
  setWaterLevel: (v: number) => void;
  submergedAreaHa: number;
  submergedVolumeMCM: number;
  liveTelemetry?: LiveTelemetry;
  sampleMode: boolean;
  setSampleMode: (v: boolean) => void;
  sedimentStats: SedimentVolumeStats;
  siltSeriesData: SiltSeriesPayload;
  waterDepthData?: WaterDepthPayload;
  siltMonth: string;
  setSiltMonth: (m: string) => void;
  siltVisualMode: SiltVisualMode;
  setSiltVisualMode: (m: SiltVisualMode) => void;
  siltVisible: boolean;
  setSiltVisible: (v: boolean) => void;
  siltOpacity: number;
  setSiltOpacity: (v: number) => void;
  siltThicknessMultiplier: number;
  setSiltThicknessMultiplier: (v: number) => void;
  terrainVisible: boolean;
  setTerrainVisible: (v: boolean) => void;
  waterVisible: boolean;
  setWaterVisible: (v: boolean) => void;
  waterOpacity: number;
  setWaterOpacity: (v: number) => void;
  bedVisible: boolean;
  setBedVisible: (v: boolean) => void;
  damVisible?: boolean;
  setDamVisible?: (v: boolean) => void;
  sedimentVisible: boolean;
  setSedimentVisible: (v: boolean) => void;
  sedimentOpacity: number;
  setSedimentOpacity: (v: number) => void;
  contoursVisible: boolean;
  setContoursVisible: (v: boolean) => void;
  wireframe: boolean;
  setWireframe: (v: boolean) => void;
  hillshade: boolean;
  setHillshade: (v: boolean) => void;
  verticalExaggeration: number;
  setVerticalExaggeration: (v: number) => void;
  sectionCutX: number | null;
  setSectionCutX: (v: number | null) => void;
  dtmMode?: DtmSurfaceMode;
  setDtmMode?: (m: DtmSurfaceMode) => void;
  onSelectViewPreset: (preset: 'perspective' | 'top' | 'depth' | 'side' | 'reset') => void;
  onOpenDamProfile: () => void;
  onOpenCrossSection: () => void;
  onOpenVolumeStats: () => void;
  onOpenExport?: () => void;
  onOpenImport?: () => void;
  treesVisible?: boolean;
  setTreesVisible?: (v: boolean) => void;
}

export const RightVerticalToolbar: React.FC<RightVerticalToolbarProps> = ({
  activeTab,
  setActiveTab,
  specs,
  dem,
  waterLevel,
  setWaterLevel,
  submergedAreaHa,
  submergedVolumeMCM,
  liveTelemetry,
  sampleMode,
  setSampleMode,
  sedimentStats,
  siltSeriesData,
  waterDepthData,
  siltMonth,
  setSiltMonth,
  siltVisualMode,
  setSiltVisualMode,
  siltVisible,
  setSiltVisible,
  siltOpacity,
  setSiltOpacity,
  siltThicknessMultiplier,
  setSiltThicknessMultiplier,
  terrainVisible,
  setTerrainVisible,
  waterVisible,
  setWaterVisible,
  waterOpacity,
  setWaterOpacity,
  bedVisible,
  setBedVisible,
  damVisible = true,
  setDamVisible,
  sedimentVisible,
  setSedimentVisible,
  sedimentOpacity,
  setSedimentOpacity,
  contoursVisible,
  setContoursVisible,
  wireframe,
  setWireframe,
  hillshade,
  setHillshade,
  verticalExaggeration,
  setVerticalExaggeration,
  sectionCutX,
  setSectionCutX,
  dtmMode = 'bathymetric',
  setDtmMode,
  onSelectViewPreset,
  onOpenDamProfile,
  onOpenCrossSection,
  onOpenVolumeStats,
  onOpenExport,
  onOpenImport,
  treesVisible = true,
  setTreesVisible
}) => {
  const toggleTab = (tab: RightToolbarTab) => {
    setActiveTab(activeTab === tab ? null : tab);
  };

  const navItems = [
    { id: 'specs' as const, icon: Database, label: 'Dam · Water · Silt', title: 'Dam depth, current water and silt summary' },
    { id: 'views' as const, icon: Eye, label: 'Camera Views', title: '2D / 3D Navigation Camera Views' },
    { id: 'sediment' as const, icon: Mountain, label: 'Sediment & Silt', title: 'Sentinel-2 Silt & Sediment Analysis' },
    { id: 'simulation' as const, icon: Droplets, label: 'Water Level', title: 'Reservoir Operational Water-Level Simulation' },
    { id: 'layers' as const, icon: Layers, label: '3D Layers', title: 'Independent 3D Scene Layer Management' },
    { id: 'settings' as const, icon: Sliders, label: 'Settings', title: 'Visual Scaling & Clipping Controls' }
  ];

  const currentSiltRecord = siltSeriesData.months[siltMonth] || siltSeriesData.months[siltSeriesData.activeDefaultMonth];
  const isSiltPeakMonth = siltSeriesData.timeline.some(m => m.key === currentSiltRecord.key && m.isPeak);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        zIndex: 40,
        pointerEvents: 'none'
      }}
    >
      {/* Sliding Glassmorphic Panel (when a tab is active) */}
      {activeTab && (
        <aside
          style={{
            width: 390,
            height: '100%',
            overflowY: 'auto',
            background: 'rgba(8, 14, 28, 0.94)',
            backdropFilter: 'blur(20px)',
            borderLeft: '1px solid rgba(56, 189, 248, 0.25)',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            pointerEvents: 'auto',
            boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.7)',
            animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Drawer Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 10,
              borderBottom: '1px solid var(--border-dim)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {activeTab === 'specs' && <Database size={16} color="var(--accent-cyan)" />}
              {activeTab === 'views' && <Eye size={16} color="var(--accent-cyan)" />}
              {activeTab === 'sediment' && <Mountain size={16} color="#fbbf24" />}
              {activeTab === 'simulation' && <Droplets size={16} color="#38bdf8" />}
              {activeTab === 'layers' && <Layers size={16} color="var(--accent-cyan)" />}
              {activeTab === 'settings' && <Sliders size={16} color="var(--accent-cyan)" />}
              <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#f8fafc' }}>
                {activeTab === 'specs' && 'Dam · Water · Silt'}
                {activeTab === 'views' && 'Camera views'}
                {activeTab === 'sediment' && 'Silt'}
                {activeTab === 'simulation' && 'Water level'}
                {activeTab === 'layers' && 'Layers'}
                {activeTab === 'settings' && 'Display'}
              </h2>
            </div>
            <button
              onClick={() => setActiveTab(null)}
              title="Close Drawer"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#94a3b8',
                borderRadius: 6,
                padding: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Tab 1: Specifications */}
          {activeTab === 'specs' && (
            <SpecsPanel
              specs={specs}
              liveTelemetry={liveTelemetry}
              waterDepthData={waterDepthData}
            />
          )}

          {/* Tab 2: 2D / 3D Camera Views */}
          {activeTab === 'views' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  {
                    id: 'perspective' as const,
                    name: 'Overview',
                    desc: 'Reservoir, dam and hills together.'
                  },
                  {
                    id: 'top' as const,
                    name: 'Top view',
                    desc: 'Straight down, like a map.'
                  },
                  {
                    id: 'depth' as const,
                    name: 'Basin depth',
                    desc: 'Close look into the deep part of the basin.'
                  },
                  {
                    id: 'side' as const,
                    name: 'Side view',
                    desc: 'From the west, across the dam.'
                  },
                  {
                    id: 'reset' as const,
                    name: 'Reset',
                    desc: 'Back to the starting view.'
                  }
                ].map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSelectViewPreset(item.id)}
                    style={{
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(56, 189, 248, 0.2)',
                      borderRadius: 8,
                      padding: 10,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      transition: 'all 0.15s ease'
                    }}
                    className="hover:border-sky-400"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 12, color: 'var(--accent-cyan)' }}>{item.name}</strong>
                      <ChevronRight size={14} color="#38bdf8" />
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Sediment & Silt */}
          {activeTab === 'sediment' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Active Month Stats Card */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  borderRadius: 8,
                  padding: 10,
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase' }}>
                    {currentSiltRecord.name} 2026
                  </span>
                  {isSiltPeakMonth && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#ef4444', color: '#ffffff' }}>
                      HIGHEST SILT
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Silt amount</span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: '#fbbf24' }}>
                    {Math.round(currentSiltRecord.totalSiltVolumeM3).toLocaleString()} m³
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Water area</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8', fontWeight: 600 }}>
                    {currentSiltRecord.waterAreaHa.toFixed(2)} ha
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Silt score (0 = clear, 1 = heavy)</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#f8fafc' }}>
                    {currentSiltRecord.meanSiltScore.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Month Quick Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Month</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                  {siltSeriesData.timeline.map((m) => {
                    const isSelected = siltMonth === m.key;
                    return (
                      <button
                        key={m.key}
                        onClick={() => setSiltMonth(m.key)}
                        style={{
                          padding: '6px 2px',
                          fontSize: 10,
                          fontWeight: 700,
                          borderRadius: 6,
                          border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                          background: isSelected ? 'rgba(56, 189, 248, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                          color: isSelected ? '#ffffff' : '#94a3b8',
                          cursor: 'pointer'
                        }}
                      >
                        {m.month}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Silt Layer Toggles */}
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Show as</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => setSiltVisualMode('classification')}
                      style={{
                        padding: '3px 8px',
                        fontSize: 10,
                        fontWeight: 600,
                        borderRadius: 4,
                        border: 'none',
                        background: siltVisualMode === 'classification' ? '#0284c7' : 'rgba(255, 255, 255, 0.08)',
                        color: '#ffffff',
                        cursor: 'pointer'
                      }}
                    >
                      Classes
                    </button>
                    <button
                      onClick={() => setSiltVisualMode('volume')}
                      style={{
                        padding: '3px 8px',
                        fontSize: 10,
                        fontWeight: 600,
                        borderRadius: 4,
                        border: 'none',
                        background: siltVisualMode === 'volume' ? '#d97706' : 'rgba(255, 255, 255, 0.08)',
                        color: '#ffffff',
                        cursor: 'pointer'
                      }}
                    >
                      Heatmap
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Opacity</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(siltOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={siltOpacity}
                    onChange={(e) => setSiltOpacity(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Thickness</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{siltThicknessMultiplier.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="5.0"
                    step="0.5"
                    value={siltThicknessMultiplier}
                    onChange={(e) => setSiltThicknessMultiplier(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: '#fbbf24' }}
                  />
                </div>
              </div>

              {/* Open Full Sediment Modal Button */}
              <button
                className="btn-amber"
                onClick={onOpenVolumeStats}
                style={{ padding: '8px 12px', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Mountain size={14} />
                Open silt report
              </button>
            </div>
          )}

          {/* Tab 4: Simulation */}
          {activeTab === 'simulation' && (
            <WaterLevelControl
              waterLevel={waterLevel}
              onWaterLevelChange={setWaterLevel}
              submergedAreaHa={submergedAreaHa}
              submergedVolumeMCM={submergedVolumeMCM}
              liveLevel={liveTelemetry?.reportedLevel_m ?? 35.47}
            />
          )}

          {/* Tab 5: 3D Layers */}
          {activeTab === 'layers' && (
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
              siltTimeline={siltSeriesData.timeline}
              treesVisible={treesVisible}
              setTreesVisible={setTreesVisible}
            />
          )}

          {/* Tab 6: Settings */}
          {activeTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Control 3D spatial scaling, coordinate reference system parameters, and east-west clipping section cut:
              </div>

              {/* Vertical Scale */}
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#f8fafc' }}>Vertical Exaggeration:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-cyan)' }}>
                    {verticalExaggeration.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="4.0"
                  step="0.5"
                  value={verticalExaggeration}
                  onChange={(e) => setVerticalExaggeration(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
                />
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                  Default is 1.0x true real-world physical vertical scale. Elevations and water depths always remain mathematically true.
                </span>
              </div>

              {/* East-West Clipping Section Cut */}
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#f8fafc' }}>East-West Clipping Cut:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: sectionCutX !== null ? '#f59e0b' : '#64748b' }}>
                    {sectionCutX !== null ? `${Math.round(sectionCutX)}m` : 'Off'}
                  </span>
                </div>
                <input
                  type="range"
                  min="-800"
                  max="800"
                  step="20"
                  value={sectionCutX ?? 0}
                  disabled={sectionCutX === null}
                  onChange={(e) => setSectionCutX(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#f59e0b', opacity: sectionCutX === null ? 0.3 : 1 }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
                  <button
                    onClick={() => setSectionCutX(sectionCutX === null ? 0 : null)}
                    style={{
                      background: sectionCutX === null ? 'rgba(56, 189, 248, 0.15)' : 'rgba(239, 68, 68, 0.2)',
                      border: 'none',
                      borderRadius: 4,
                      padding: '3px 8px',
                      fontSize: 10,
                      fontWeight: 600,
                      color: sectionCutX === null ? '#38bdf8' : '#f87171',
                      cursor: 'pointer'
                    }}
                  >
                    {sectionCutX === null ? 'Enable Clipping Plane' : 'Disable Clipping'}
                  </button>
                </div>
              </div>

              {/* Shading toggles */}
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#f8fafc' }}>Terrain Hillshade Lighting:</span>
                  <input
                    type="checkbox"
                    checked={hillshade}
                    onChange={(e) => setHillshade(e.target.checked)}
                    style={{ accentColor: 'var(--accent-cyan)' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#f8fafc' }}>Wireframe Mesh Edges:</span>
                  <input
                    type="checkbox"
                    checked={wireframe}
                    onChange={(e) => setWireframe(e.target.checked)}
                    style={{ accentColor: 'var(--accent-cyan)' }}
                  />
                </div>
              </div>
            </div>
          )}
        </aside>
      )}

      {/* Vertical Icon Toolbar Dock (Always visible on right edge) */}
      <div
        style={{
          width: 52,
          height: '100%',
          background: 'rgba(8, 14, 28, 0.90)',
          backdropFilter: 'blur(16px)',
          borderLeft: '1px solid rgba(56, 189, 248, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 12,
          paddingBottom: 12,
          gap: 6,
          pointerEvents: 'auto',
          boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.5)'
        }}
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => toggleTab(item.id)}
              title={item.title}
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                border: isActive ? '1px solid rgba(56, 189, 248, 0.6)' : '1px solid transparent',
                background: isActive ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.3) 0%, rgba(3, 105, 161, 0.4) 100%)' : 'transparent',
                color: isActive ? '#38bdf8' : '#94a3b8',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 0 12px rgba(56, 189, 248, 0.3)' : 'none'
              }}
              className="hover:text-sky-300 hover:bg-slate-800/40"
            >
              <Icon size={18} />
            </button>
          );
        })}

        <div style={{ width: 24, height: 1, background: 'rgba(255, 255, 255, 0.1)', margin: '4px 0' }} />

        {/* Quick Modal Direct Triggers */}
        <button
          onClick={onOpenDamProfile}
          title="Dam Elevation Profile & Caliper"
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          className="hover:text-sky-300 hover:bg-slate-800/40"
        >
          <Compass size={18} />
        </button>

        <button
          onClick={onOpenCrossSection}
          title="Interactive Reservoir Cross-Section Transect"
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          className="hover:text-sky-300 hover:bg-slate-800/40"
        >
          <Layers size={18} />
        </button>

        {onOpenExport && (
          <button
            onClick={onOpenExport}
            title="Export Digital Twin Report, GeoJSON & CSV Data"
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            className="hover:text-sky-200 hover:bg-sky-500/20"
          >
            <FileDown size={18} />
          </button>
        )}

        {onOpenImport && (
          <button
            onClick={onOpenImport}
            title="Import Bathymetric / Terrain Survey"
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            className="hover:text-sky-300 hover:bg-slate-800/40"
          >
            <Upload size={18} />
          </button>
        )}
      </div>
    </div>
  );
};
