import React, { useState } from 'react';
import { MapPin, X, ChevronDown, ChevronUp, Layers, Database, Radio, Activity, Sparkles } from 'lucide-react';
import { InspectionResult, BaselineSpecs, LiveTelemetry } from '../../types/reservoir';
import { GeoTransform } from '../../utils/coordinates';

interface ReservoirOverviewAndInspectorPanelProps {
  inspection: InspectionResult | null;
  onClearInspection: () => void;
  specs: BaselineSpecs;
  waterLevel: number;
  submergedAreaHa: number;
  submergedVolumeMCM: number;
  liveTelemetry?: LiveTelemetry;
  activeTool: 'inspect' | 'transect' | 'measure' | null;
  onSelectTool: (tool: 'inspect' | 'transect' | 'measure' | null) => void;
  onOpenDamProfile?: () => void;
  onOpenCrossSection?: () => void;
  siltVisible?: boolean;
  siltMonthName?: string;
}

export const ReservoirOverviewAndInspectorPanel: React.FC<ReservoirOverviewAndInspectorPanelProps> = ({
  inspection,
  onClearInspection,
  specs,
  waterLevel,
  submergedAreaHa,
  submergedVolumeMCM,
  liveTelemetry,
  activeTool,
  onSelectTool,
  onOpenDamProfile,
  onOpenCrossSection,
  siltVisible = false,
  siltMonthName
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const deepestBed = specs.deepestBedLevel_m ?? 15.50;
  const maxWaterDepth = Math.max(0, waterLevel - deepestBed);

  const isCurrentlySubmerged = Boolean(
    inspection &&
    inspection.elevation !== null &&
    inspection.elevation < waterLevel &&
    (inspection.inTank || (inspection.waterDepth !== null && inspection.waterDepth > 0))
  );
  const currentWaterDepth = isCurrentlySubmerged && inspection && inspection.elevation !== null
    ? Math.max(0, Math.round((waterLevel - inspection.elevation) * 100) / 100)
    : 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: 140,
        left: 20,
        width: 400,
        zIndex: 40,
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: 'auto'
      }}
    >
      <div
        style={{
          background: 'rgba(8, 14, 28, 0.42)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          borderRadius: 14,
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Panel Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'rgba(15, 23, 42, 0.35)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {inspection ? (
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: 'rgba(56, 189, 248, 0.2)',
                  border: '1px solid rgba(56, 189, 248, 0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 12px rgba(56, 189, 248, 0.3)'
                }}
              >
                <MapPin size={17} color="#38bdf8" />
              </div>
            ) : (
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: 'rgba(2, 132, 199, 0.25)',
                  border: '1px solid rgba(2, 132, 199, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Database size={17} color="#38bdf8" />
              </div>
            )}
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', lineHeight: 1.2 }}>
                {inspection ? 'Point & Bed Inspection' : 'Reservoir Basin Overview'}
              </h3>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                {inspection ? 'Calibrated Survey Coordinates' : 'Chapoli M.I. Tank (Goa WRD)'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {inspection && (
              <button
                onClick={onClearInspection}
                title="Clear Point Selection"
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.45)',
                  color: '#fca5a5',
                  borderRadius: 6,
                  padding: '4px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <X size={13} />
                Clear
              </button>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? 'Expand Panel' : 'Collapse Panel'}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#cbd5e1',
                borderRadius: 6,
                padding: '5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {isCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </button>
          </div>
        </div>

        {/* Panel Content (Collapsible) */}
        {!isCollapsed && (
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {inspection ? (
              /* --- INSPECTION ACTIVE STATE --- */
              <>
                {/* Coordinates */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#cbd5e1', whiteSpace: 'nowrap' }}>Geographic (WGS84):</span>
                    <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: '#f8fafc', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                      {GeoTransform.toDMS(inspection.lat, true)}, {GeoTransform.toDMS(inspection.lon, false)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#cbd5e1', whiteSpace: 'nowrap' }}>Projected (UTM 43N):</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: '#93c5fd', whiteSpace: 'nowrap' }}>
                      E {inspection.easting.toLocaleString()} m, N {inspection.northing.toLocaleString()} m
                    </span>
                  </div>
                </div>

                {/* Hydrological Status Tag */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>Status:</span>
                  {isCurrentlySubmerged && currentWaterDepth > 0 ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: 5,
                        background: 'rgba(2, 132, 199, 0.3)',
                        color: '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.55)',
                        letterSpacing: '0.04em',
                        boxShadow: '0 0 10px rgba(56, 189, 248, 0.25)'
                      }}
                    >
                      SUBMERGED BASIN
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: 5,
                        background: 'rgba(100, 116, 139, 0.25)',
                        color: '#cbd5e1',
                        border: '1px solid rgba(148, 163, 184, 0.45)',
                        letterSpacing: '0.04em'
                      }}
                    >
                      {inspection.inTank ? 'EXPOSED BED / SHORELINE' : 'DRY SURROUNDING TERRAIN'}
                    </span>
                  )}
                </div>

                {/* Elevation & Depth Metrics (Glassy card, 2x bigger numbers, removed pre-impoundment/sediment rows) */}
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.32)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(56, 189, 248, 0.22)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>
                      {currentWaterDepth > 0 ? 'Reservoir Bed Elevation:' : 'Ground Surface Elevation:'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                      <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: inspection.elevation !== null ? '#38bdf8' : '#f43f5e' }}>
                        {inspection.elevation !== null ? inspection.elevation.toFixed(2) : 'NoData'}
                      </strong>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#7dd3fc' }}>m MSL</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>Operating Water Level:</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                      <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: '#93c5fd' }}>
                        {waterLevel.toFixed(2)}
                      </strong>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#93c5fd' }}>m MSL</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>Water Column Depth:</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                      <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 800, color: currentWaterDepth > 0 ? '#38bdf8' : '#94a3b8' }}>
                        {currentWaterDepth > 0 ? currentWaterDepth.toFixed(2) : '0.00'}
                      </strong>
                      <span style={{ fontSize: 13, fontWeight: 700, color: currentWaterDepth > 0 ? '#38bdf8' : '#94a3b8' }}>
                        {currentWaterDepth > 0 ? 'm' : 'm (Dry / Exposed)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sentinel-2 Silt Metrics (Glassy card, shown ONLY when Silt layer is ON) */}
                {siltVisible && inspection.siltClass && (
                  <div
                    style={{
                      background: 'rgba(245, 158, 11, 0.08)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(245, 158, 11, 0.28)',
                      borderRadius: 10,
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Sentinel-2 Silt ({inspection.siltMonthName || siltMonthName || 'September'}):
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: inspection.siltClassColor || '#f59e0b',
                          color: '#000000',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                        }}
                      >
                        {inspection.siltClass}
                      </span>
                    </div>

                    {inspection.siltVolumeScore !== undefined && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>Pixel Volume Score:</span>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                          <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: '#fbbf24' }}>
                            {inspection.siltVolumeScore.toFixed(1)}
                          </strong>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#fde68a' }}>m³ / 100m²</span>
                        </div>
                      </div>
                    )}

                    {inspection.siltThicknessM !== undefined && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>Estimated Silt Layer:</span>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                          <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: '#38bdf8' }}>
                            {inspection.siltThicknessM.toFixed(2)}
                          </strong>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#7dd3fc' }}>m</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Provenance Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', paddingTop: 2 }}>
                  <span>Provenance: <strong style={{ color: '#34d399' }}>{siltVisible && inspection.siltClass ? 'OBSERVED (Sentinel-2)' : (inspection.provenance || 'OBSERVED')}</strong></span>
                  <span style={{ fontSize: 10, color: '#64748b' }}>Click another point to inspect</span>
                </div>
              </>
            ) : (
              /* --- RESERVOIR DEFAULT OVERVIEW STATE --- */
              <>
                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
                  Real-time 3D spatial engineering model of Chapoli Tank, bounded by natural Western Ghats topography and a 760m earthen dam.
                </div>

                {/* Key Hydrological Benchmarks (Glassy card, 2x bigger numbers) */}
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.32)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(56, 189, 248, 0.22)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>Simulated Water Level:</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                      <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: '#38bdf8' }}>
                        {waterLevel.toFixed(2)}
                      </strong>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#7dd3fc' }}>
                        m MSL {waterLevel === specs.frl_m ? '(FRL)' : ''}
                      </span>
                    </div>
                  </div>

                  {liveTelemetry && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Radio size={12} color="#34d399" />
                        Live SCADA Level:
                      </span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                        <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: '#34d399' }}>
                          {liveTelemetry.reportedLevel_m.toFixed(2)}
                        </strong>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#a7f3d0' }}>m MSL</span>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>Max Basin Water Depth:</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                      <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 800, color: '#93c5fd' }}>
                        {maxWaterDepth.toFixed(2)}
                      </strong>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#93c5fd' }}>m</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>Inundated Basin Area:</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                      <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: '#f8fafc' }}>
                        {submergedAreaHa.toFixed(2)}
                      </strong>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1' }}>ha</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>Modeled Water Volume:</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                      <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: '#38bdf8' }}>
                        {submergedVolumeMCM.toFixed(4)}
                      </strong>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#7dd3fc' }}>MCM</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>Earthen Dam Crest:</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                      <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>
                        41.00
                      </strong>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>m (760m)</span>
                    </div>
                  </div>
                </div>

                {/* Interactive Click Invitation Box */}
                <div
                  style={{
                    background: 'rgba(14, 165, 233, 0.12)',
                    border: '1px solid rgba(14, 165, 233, 0.35)',
                    borderRadius: 8,
                    padding: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8', fontSize: 11, fontWeight: 700 }}>
                    <Activity size={14} />
                    <span>Interactive 3D Point Inspector</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 10, color: '#cbd5e1', lineHeight: 1.4 }}>
                    Click anywhere on the reservoir basin, shoreline, or dam to inspect precise ground elevations, water column depth, and Sentinel-2 sediment data.
                  </p>
                  <button
                    onClick={() => onSelectTool(activeTool === 'inspect' ? null : 'inspect')}
                    style={{
                      marginTop: 2,
                      padding: '5px 10px',
                      background: activeTool === 'inspect' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      borderRadius: 6,
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    <Sparkles size={13} color="#38bdf8" />
                    {activeTool === 'inspect' ? 'Inspector Active (Click Scene)' : 'Activate Point Inspector'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
