import React from 'react';
import { Waves, Mountain, Layers, FileDown, Upload, Activity, ShieldCheck, AlertTriangle, Compass, Radio } from 'lucide-react';
import { DEMSummary, LiveTelemetry } from '../../types/reservoir';

interface HeaderProps {
  sampleMode: boolean;
  onToggleSampleMode: (enabled: boolean) => void;
  onOpenCrossSection: () => void;
  onOpenVolumeStats: () => void;
  onOpenImport: () => void;
  onOpenExport: () => void;
  onOpenDamProfile?: () => void;
  liveTelemetry?: LiveTelemetry;
  onSyncLiveLevel?: (level: number) => void;
  activeTool: 'inspect' | 'transect' | 'measure' | null;
  setActiveTool: (tool: 'inspect' | 'transect' | 'measure' | null) => void;
  dem?: DEMSummary;
  tankAreaHa?: number;
}

export const Header: React.FC<HeaderProps> = ({
  sampleMode,
  onToggleSampleMode,
  onOpenCrossSection,
  onOpenVolumeStats,
  onOpenImport,
  onOpenExport,
  onOpenDamProfile,
  liveTelemetry,
  onSyncLiveLevel,
  activeTool,
  setActiveTool,
  dem,
  tankAreaHa = 77.24
}) => {
  return (
    <header
      style={{
        height: 64,
        background: 'rgba(8, 14, 28, 0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 50,
        position: 'relative'
      }}
    >
      {/* Title & Metadata */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(56, 189, 248, 0.3)'
          }}
        >
          <Waves size={22} color="#ffffff" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: '#f8fafc' }}>
              Chapoli M.I. Tank
            </h1>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>|</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-cyan)' }}>
              3D Sediment Measurement Digital Twin
            </span>
            <span className="badge badge-observed" title="Official Goa WRD Earthen Dam: Top 41.00m, Length 760m, Height 25.50m">
              760m Dam Axis
            </span>
            <span className="badge badge-observed" title="Goa WRD Automatic Water Level Monitoring System">
              Goa WRD SCADA
            </span>
            {liveTelemetry && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#34d399',
                  cursor: onSyncLiveLevel ? 'pointer' : 'default'
                }}
                onClick={() => onSyncLiveLevel?.(liveTelemetry.reportedLevel_m)}
                title={`Live SCADA Level: ${liveTelemetry.reportedLevel_m}m | Storage: ${liveTelemetry.reportedStorage_Hamts} Hamts. Click to sync simulation.`}
              >
                <Radio size={11} className="pulse" />
                Live: {liveTelemetry.reportedLevel_m}m ({liveTelemetry.reportedStorage_Hamts} Hamts)
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 2, fontSize: 11, color: 'var(--text-secondary)' }}>
            <span>CRS: <strong style={{ color: '#38bdf8' }}>EPSG:32643 (UTM 43N)</strong></span>
            <span>•</span>
            <span>Area: <strong style={{ color: '#e2e8f0' }}>{tankAreaHa.toFixed(2)} ha</strong></span>
            <span>•</span>
            <span>DTM: <strong style={{ color: '#e2e8f0' }}>XYZ 9m ({dem ? dem.rawDemValidCells.toLocaleString() : '62,366'} pts, 2.3×2.2 km)</strong></span>
            <span>•</span>
            <span>Bed: <strong style={{ color: '#38bdf8' }}>{dem ? `${dem.minElevation.toFixed(1)}m – ${dem.maxElevation.toFixed(1)}m` : '15.5m – 169.5m'}</strong></span>
            <span>•</span>
            <span>Contours: <strong style={{ color: '#e2e8f0' }}>32m – 38.25m</strong></span>
          </div>
        </div>
      </div>

      {/* Mode Switch & Engineering Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Sample / Simulated vs Observed Mode Switch */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 10px',
            borderRadius: 8,
            background: sampleMode ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
            border: sampleMode ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(16, 185, 129, 0.35)'
          }}
        >
          {sampleMode ? <AlertTriangle size={15} color="#f59e0b" /> : <ShieldCheck size={15} color="#10b981" />}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: sampleMode ? '#fbbf24' : '#34d399', textTransform: 'uppercase' }}>
              {sampleMode ? 'Sample Sediment Model (Simulated)' : 'Surveyed Bed Only (Observed)'}
            </span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
              {sampleMode ? 'Pre-impoundment baseline modeled' : 'No pre-impoundment baseline in source'}
            </span>
          </div>
          <button
            onClick={() => onToggleSampleMode(!sampleMode)}
            style={{
              background: sampleMode ? '#d97706' : '#059669',
              color: '#ffffff',
              border: 'none',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
              marginLeft: 4
            }}
          >
            {sampleMode ? 'Switch to Observed' : 'Enable Sample Model'}
          </button>
        </div>

        {/* Tool selector */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(15, 23, 42, 0.6)', padding: 3, borderRadius: 8, border: '1px solid var(--border-dim)' }}>
          <button
            className={`btn-icon ${activeTool === 'inspect' ? 'active' : ''}`}
            onClick={() => setActiveTool(activeTool === 'inspect' ? null : 'inspect')}
            title="Point Inspection Tool (Click bed or dam to measure depth, elevation & coordinates)"
          >
            <Activity size={16} />
          </button>
          <button
            className={`btn-icon ${activeTool === 'transect' ? 'active' : ''}`}
            onClick={() => setActiveTool(activeTool === 'transect' ? null : 'transect')}
            title="Draw Interactive Cross-Section Transect"
          >
            <Layers size={16} />
          </button>
        </div>

        {/* Modal Triggers */}
        {onOpenDamProfile && (
          <button className="btn-secondary" onClick={onOpenDamProfile} style={{ padding: '6px 11px', fontSize: 12 }}>
            <Compass size={14} />
            Dam Profile & Caliper
          </button>
        )}

        <button className="btn-secondary" onClick={onOpenCrossSection} style={{ padding: '6px 11px', fontSize: 12 }}>
          <Layers size={14} />
          Cross-Section
        </button>

        <button className="btn-amber" onClick={onOpenVolumeStats} style={{ padding: '6px 11px', fontSize: 12 }}>
          <Mountain size={14} />
          Sediment Volume
        </button>

        <button className="btn-secondary" onClick={onOpenImport} style={{ padding: '6px 11px', fontSize: 12 }}>
          <Upload size={14} />
          Import
        </button>

        <button className="btn-primary" onClick={onOpenExport} style={{ padding: '6px 11px', fontSize: 12 }}>
          <FileDown size={14} />
          Export
        </button>
      </div>
    </header>
  );
};
