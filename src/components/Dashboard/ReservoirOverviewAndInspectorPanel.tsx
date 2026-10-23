import React, { useState } from 'react';
import { MapPin, X, ChevronDown, ChevronUp, Layers, Database, Radio } from 'lucide-react';
import { InspectionResult, BaselineSpecs, LiveTelemetry } from '../../types/reservoir';
import { SiltMonthRecord, SiltSeriesPayload, SiltVisualMode } from '../../types/silt';
import { GeoTransform } from '../../utils/coordinates';

interface ReservoirOverviewAndInspectorPanelProps {
  inspection: InspectionResult | null;
  onClearInspection: () => void;
  specs: BaselineSpecs;
  waterLevel: number;
  submergedAreaHa: number;
  submergedVolumeMCM: number;
  liveTelemetry?: LiveTelemetry;
  onOpenDamProfile?: () => void;
  onOpenCrossSection?: () => void;
  siltVisible?: boolean;
  siltMonthName?: string;
  siltRecord?: SiltMonthRecord;
  siltVolumeLegend?: SiltSeriesPayload['volumeLegend'];
  siltVisualMode?: SiltVisualMode;
}

const SiltVolumeLegend: React.FC<{
  record: SiltMonthRecord;
  volumeLegend: SiltSeriesPayload['volumeLegend'];
  pointValue?: number;
  pointClass?: string;
  visualMode: SiltVisualMode;
}> = ({ record, volumeLegend, pointValue, pointClass, visualMode }) => {
  const palette = volumeLegend.palette;
  const min = volumeLegend.minVal;
  const max = volumeLegend.maxVal;
  const stops = Array.from({ length: 5 }, (_, index) => {
    const t = index / 4;
    const colorIndex = Math.round(t * (palette.length - 1));
    return {
      t,
      color: palette[colorIndex] || '#f59e0b',
      value: min + (max - min) * t
    };
  });
  const activeStop = pointValue === undefined || max <= min
    ? -1
    : Math.round(Math.max(0, Math.min(1, (pointValue - min) / (max - min))) * 4);
  const breakdown = record.classificationBreakdown;
  const classes = [
    { key: 'low', label: 'Low', stat: breakdown.low },
    { key: 'moderate', label: 'Moderate', stat: breakdown.moderate },
    { key: 'high', label: 'High', stat: breakdown.high },
    { key: 'veryHigh', label: 'Very high', stat: breakdown.veryHigh }
  ];
  const pointClassKey: Record<string, string> = { Low: 'low', Moderate: 'moderate', High: 'high', 'Very High': 'veryHigh' };

  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#fde68a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {visualMode === 'volume' ? 'Silt volume scale' : 'Silt classification'} · {record.dateLabel}
        </span>
        <span style={{ fontSize: 9, color: '#cbd5e1' }}>{visualMode === 'volume' ? 'm³ / 100 m²' : 'Basin share'}</span>
      </div>

      {visualMode === 'volume' && (
      <div aria-label={`Silt volume scale from ${min} to ${max} cubic metres per 100 square metres`} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 5 }}>
        {stops.map((stop, index) => (
          <div key={index} style={{ minWidth: 0, textAlign: 'center' }}>
            <div
              style={{
                height: 18,
                borderRadius: 5,
                background: stop.color,
                border: activeStop === index ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.28)',
                boxShadow: activeStop === index ? '0 0 8px rgba(255,255,255,0.65)' : 'none'
              }}
              title={`${stop.value.toFixed(1)} m³ / 100 m²`}
            />
            <div style={{ marginTop: 3, fontSize: 9, fontWeight: 700, lineHeight: 1.2, color: '#e2e8f0' }}>
              {index === 0 ? 'Low' : index === stops.length - 1 ? 'High' : `~${Math.round(stop.value)}`}
            </div>
            {(index === 0 || index === stops.length - 1) && (
              <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.2 }}>{Math.round(stop.value)}</div>
            )}
          </div>
        ))}
      </div>

      )}
      {visualMode === 'classification' && (
        <>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Basin share by silt class
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 10px' }}>
            {classes.map(({ key, label, stat }) => {
              const isPointClass = pointClassKey[pointClass || ''] === key;
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: 10, color: '#cbd5e1', outline: isPointClass ? `1px solid ${stat.color}` : '1px solid transparent', outlineOffset: 2, borderRadius: 3 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: stat.color, flexShrink: 0 }} />
                    <span>{label}</span>
                  </span>
                  <strong style={{ color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>{stat.percent.toFixed(1)}%</strong>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export const ReservoirOverviewAndInspectorPanel: React.FC<ReservoirOverviewAndInspectorPanelProps> = ({
  inspection,
  onClearInspection,
  specs,
  waterLevel,
  submergedAreaHa,
  submergedVolumeMCM,
  liveTelemetry,
  onOpenDamProfile,
  onOpenCrossSection,
  siltVisible = false,
  siltMonthName,
  siltRecord,
  siltVolumeLegend,
  siltVisualMode = 'classification'
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
  const currentWaterDepth = isCurrentlySubmerged && inspection
    ? Math.max(0, inspection.waterDepth ?? (inspection.elevation !== null ? Math.round((waterLevel - inspection.elevation) * 100) / 100 : 0))
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
                {inspection ? (siltVisible ? (siltVisualMode === 'classification' ? 'Silt Classification' : 'Silt Volume') : 'Point & Bed Inspection') : 'Reservoir Basin Overview'}
              </h3>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                {inspection ? (siltVisible ? (siltVisualMode === 'classification' ? 'Class and basin share at selected point' : 'Volume at selected point') : 'Selected point values') : 'Chapoli M.I. Tank (Goa WRD)'}
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
                {!siltVisible && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                </div>}

                {/* Hydrological Status Tag */}
                {!siltVisible && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                </div>}

                {/* Elevation & Depth Metrics (Glassy card, 2x bigger numbers, removed pre-impoundment/sediment rows) */}
                {!siltVisible && <div
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
                      {currentWaterDepth > 0 ? 'DTM Bed Elevation:' : 'Ground Surface Elevation:'}
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
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>
                      Water Depth:
                    </span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                      <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 800, color: currentWaterDepth > 0 ? '#38bdf8' : '#94a3b8' }}>
                        {currentWaterDepth > 0 ? currentWaterDepth.toFixed(2) : '0.00'}
                      </strong>
                      <span style={{ fontSize: 13, fontWeight: 700, color: currentWaterDepth > 0 ? '#38bdf8' : '#94a3b8' }}>
                        {currentWaterDepth > 0 ? 'm' : 'm (Dry / Exposed)'}
                      </span>
                    </div>
                  </div>
                </div>}

                {/* Sentinel-2 Silt Metrics (Glassy card, shown ONLY when Silt layer is ON) */}
                {siltVisible && (
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
                        {siltVisualMode === 'classification' ? 'Silt Classification' : 'Silt Volume'} ({inspection.siltMonthName || siltMonthName || 'September'}):
                      </span>
                      {siltVisualMode === 'classification' && (inspection.siltClass ? <span
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
                      </span> : <span style={{ fontSize: 10, color: '#cbd5e1' }}>No classified pixel</span>)}
                    </div>

                    {siltVisualMode === 'volume' && inspection.siltVolumeM3 !== undefined && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>Point Silt Volume:</span>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                          <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: '#fbbf24' }}>
                            {inspection.siltVolumeM3.toFixed(2)}
                          </strong>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#fde68a' }}>m³</span>
                        </div>
                      </div>
                    )}

                    {siltVisualMode === 'volume' && inspection.siltVolumeM3 === undefined && (
                      <div style={{ fontSize: 12, color: '#cbd5e1' }}>No silt volume at this point.</div>
                    )}

                    {siltVisualMode === 'volume' && inspection.siltThicknessM !== undefined && (
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

                    {siltRecord && siltVolumeLegend && (
                      <SiltVolumeLegend
                        record={siltRecord}
                        volumeLegend={siltVolumeLegend}
                        pointValue={inspection.siltVolumeScore}
                        pointClass={inspection.siltClass}
                        visualMode={siltVisualMode}
                      />
                    )}
                  </div>
                )}

                {/* Provenance Footer */}
                {!siltVisible && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', paddingTop: 2 }}>
                  <span style={{ fontSize: 10, color: '#64748b' }}>Click another point to inspect</span>
                </div>}
              </>
            ) : (
              /* --- RESERVOIR DEFAULT OVERVIEW STATE --- */
              <>
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

              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
