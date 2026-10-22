import React from 'react';
import { Eye, EyeOff, Layers, Scissors, Maximize2, Palette, Calendar } from 'lucide-react';
import { DtmSurfaceMode } from '../../types/reservoir';
import { SiltVisualMode } from '../../types/silt';

interface LayerControlsProps {
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
  sampleMode: boolean;
  dtmMode?: DtmSurfaceMode;
  setDtmMode?: (m: DtmSurfaceMode) => void;
  siltVisible?: boolean;
  setSiltVisible?: (v: boolean) => void;
  siltMonth?: string;
  setSiltMonth?: (m: string) => void;
  siltVisualMode?: SiltVisualMode;
  setSiltVisualMode?: (m: SiltVisualMode) => void;
  siltOpacity?: number;
  setSiltOpacity?: (v: number) => void;
  siltThicknessMultiplier?: number;
  setSiltThicknessMultiplier?: (v: number) => void;
}

export const LayerControls: React.FC<LayerControlsProps> = ({
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
  sampleMode,
  dtmMode = 'bathymetric',
  setDtmMode,
  siltVisible = true,
  setSiltVisible,
  siltMonth = 'sep',
  setSiltMonth,
  siltVisualMode = 'classification',
  setSiltVisualMode,
  siltOpacity = 0.85,
  setSiltOpacity,
  siltThicknessMultiplier = 1.0,
  setSiltThicknessMultiplier
}) => {
  return (
    <div className="glass-panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-dim)', paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={16} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            3D Layers & Visualization
          </h3>
        </div>
      </div>

      {/* Layer Toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
        {/* Layer A: Surrounding Terrain */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Layer A — Terrain & Basin</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className={`btn-icon ${wireframe ? 'active' : ''}`}
                onClick={() => setWireframe(!wireframe)}
                title="Toggle Wireframe Mesh"
                style={{ width: 28, height: 28 }}
              >
                <span style={{ fontSize: 10, fontWeight: 700 }}>WF</span>
              </button>
              <button
                className={`btn-icon ${hillshade ? 'active' : ''}`}
                onClick={() => setHillshade(!hillshade)}
                title="Toggle Hillshade Roughness"
                style={{ width: 28, height: 28 }}
              >
                <span style={{ fontSize: 10, fontWeight: 700 }}>HS</span>
              </button>
              <button
                className={`btn-icon ${terrainVisible ? 'active' : ''}`}
                onClick={() => setTerrainVisible(!terrainVisible)}
                style={{ width: 28, height: 28 }}
              >
                {terrainVisible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>
          </div>

          {/* DTM Surface Selection Pill */}
          {setDtmMode && (
            <div style={{ padding: '6px 8px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>DTM Surface Model:</span>
                <span style={{ fontSize: 9, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                  {dtmMode === 'f30_dtm' ? 'f-30.tif Restored (31m – 50m)' : dtmMode === 'raw_fabdem' ? 'Raw Satellite (38.25m flat)' : 'Reconstructed (15.5m Thalweg)'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <button
                  onClick={() => setDtmMode('bathymetric')}
                  style={{
                    padding: '5px 6px',
                    fontSize: 10,
                    fontWeight: 600,
                    borderRadius: 4,
                    border: dtmMode === 'bathymetric' ? '1px solid var(--accent-cyan)' : '1px solid rgba(255,255,255,0.08)',
                    background: dtmMode === 'bathymetric' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.03)',
                    color: dtmMode === 'bathymetric' ? '#ffffff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="Reconstructed Basin: Surveyed 32-38m contours + 15.50m calibrated thalweg holding continuous water body"
                >
                  Reconstructed Basin
                </button>
                <button
                  onClick={() => setDtmMode('f30_dtm')}
                  style={{
                    padding: '5px 6px',
                    fontSize: 10,
                    fontWeight: 600,
                    borderRadius: 4,
                    border: dtmMode === 'f30_dtm' ? '1px solid var(--accent-cyan)' : '1px solid rgba(255,255,255,0.08)',
                    background: dtmMode === 'f30_dtm' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.03)',
                    color: dtmMode === 'f30_dtm' ? '#ffffff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="f-30.tif (+30m MSL Datum): 837 surveyed points from data_raw/f-30.tif (31m - 50m MSL bed) aligned with 2.3km landscape"
                >
                  f-30.tif (+30m MSL)
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 4 }}>
                <button
                  onClick={() => setDtmMode('raw_fabdem')}
                  style={{
                    padding: '4px 6px',
                    fontSize: 10,
                    fontWeight: 600,
                    borderRadius: 4,
                    border: dtmMode === 'raw_fabdem' ? '1px solid var(--accent-cyan)' : '1px solid rgba(255,255,255,0.08)',
                    background: dtmMode === 'raw_fabdem' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.03)',
                    color: dtmMode === 'raw_fabdem' ? '#ffffff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="Raw XYZ Satellite DTM: 62,366 points from Chapoli_M_I_Tank_XYZ.csv (water flat at 38.25m)"
                >
                  Raw XYZ Satellite DTM (62,366 pts)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Layer B: Reservoir Water */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Layer B — Reservoir Water</span>
            <button
              className={`btn-icon ${waterVisible ? 'active' : ''}`}
              onClick={() => setWaterVisible(!waterVisible)}
              style={{ width: 28, height: 28 }}
            >
              {waterVisible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          </div>
          {waterVisible && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 8 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Opacity:</span>
              <input
                type="range"
                min={0.1}
                max={0.95}
                step={0.05}
                value={waterOpacity}
                onChange={(e) => setWaterOpacity(parseFloat(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', width: 28 }}>{Math.round(waterOpacity * 100)}%</span>
            </div>
          )}
        </div>

        {/* Layer C: Present Reservoir Bed */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Layer C — Present Reservoir Bed</span>
          <button
            className={`btn-icon ${bedVisible ? 'active' : ''}`}
            onClick={() => setBedVisible(!bedVisible)}
            style={{ width: 28, height: 28 }}
          >
            {bedVisible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        </div>

        {/* Layer D: Earthen Dam Structure */}
        {setDamVisible && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Layer D — Earthen Dam (El. 41.00m)</span>
              <span className="badge badge-observed" style={{ fontSize: 9, padding: '1px 5px' }}>760m Axis</span>
            </div>
            <button
              className={`btn-icon ${damVisible ? 'active' : ''}`}
              onClick={() => setDamVisible(!damVisible)}
              style={{ width: 28, height: 28 }}
              title="Toggle 760m Earthen Dam Embankment, Spillway & Height Caliper"
            >
              {damVisible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          </div>
        )}

        {/* Layer E: Sentinel-2 Silt Monitoring & Classification */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0', borderTop: '1px solid var(--border-dim)', paddingTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Layer E — Sentinel-2 Silt</span>
              <span className="badge badge-observed" style={{ fontSize: 9, padding: '1px 5px' }}>10 Months</span>
            </div>
            <button
              className={`btn-icon ${siltVisible ? 'active' : ''}`}
              onClick={() => setSiltVisible?.(!siltVisible)}
              style={{ width: 28, height: 28 }}
              title="Toggle 2026 Monthly Silt Classification & Volume Surface"
            >
              {siltVisible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          </div>

          {siltVisible && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 6 }}>
              {/* Month Selector & Visual Mode */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 6 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Survey Month:</label>
                  <select
                    value={siltMonth}
                    onChange={(e) => setSiltMonth?.(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '4px 6px',
                      fontSize: 11,
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      borderRadius: 4,
                      color: '#f8fafc',
                      outline: 'none'
                    }}
                  >
                    <option value="jan">Jan 2026 (216.8k m³)</option>
                    <option value="feb">Feb 2026 (164.6k m³)</option>
                    <option value="mar">Mar 2026 (206.1k m³)</option>
                    <option value="apr">Apr 2026 (189.3k m³)</option>
                    <option value="may">May 2026 (213.6k m³)</option>
                    <option value="jun">Jun 2026 (199.6k m³)</option>
                    <option value="jul">Jul 2026 (Cloud Mask)</option>
                    <option value="aug">Aug 2026 (223.1k m³)</option>
                    <option value="sep">Sep 2026 (Peak 260.3k m³)</option>
                    <option value="oct">Oct 2026 (179.4k m³)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Silt Mode:</label>
                  <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.6)', padding: 2, borderRadius: 4, border: '1px solid var(--border-dim)' }}>
                    <button
                      onClick={() => setSiltVisualMode?.('classification')}
                      style={{
                        flex: 1,
                        padding: '3px 2px',
                        fontSize: 9,
                        fontWeight: 600,
                        border: 'none',
                        borderRadius: 3,
                        background: siltVisualMode === 'classification' ? 'var(--accent-amber)' : 'transparent',
                        color: siltVisualMode === 'classification' ? '#000000' : 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      4-Class
                    </button>
                    <button
                      onClick={() => setSiltVisualMode?.('volume')}
                      style={{
                        flex: 1,
                        padding: '3px 2px',
                        fontSize: 9,
                        fontWeight: 600,
                        border: 'none',
                        borderRadius: 3,
                        background: siltVisualMode === 'volume' ? 'var(--accent-amber)' : 'transparent',
                        color: siltVisualMode === 'volume' ? '#000000' : 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      Heatmap
                    </button>
                  </div>
                </div>
              </div>

              {/* Opacity Slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Opacity:</span>
                <input
                  type="range"
                  min={0.2}
                  max={1.0}
                  step={0.05}
                  value={siltOpacity}
                  onChange={(e) => setSiltOpacity?.(parseFloat(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', width: 28 }}>{Math.round(siltOpacity * 100)}%</span>
              </div>

              {/* Physical Thickness Extrusion Slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Lift:</span>
                <input
                  type="range"
                  min={0.0}
                  max={3.0}
                  step={0.2}
                  value={siltThicknessMultiplier}
                  onChange={(e) => setSiltThicknessMultiplier?.(parseFloat(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', width: 28 }}>{siltThicknessMultiplier.toFixed(1)}x</span>
              </div>
            </div>
          )}
        </div>

        {/* 1m Contours */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Contour Lines (1m interval)</span>
          <button
            className={`btn-icon ${contoursVisible ? 'active' : ''}`}
            onClick={() => setContoursVisible(!contoursVisible)}
            style={{ width: 28, height: 28 }}
          >
            {contoursVisible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        </div>
      </div>

      {/* Silt Classification & Volume Legend */}
      <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: 10, borderRadius: 8, border: '1px solid var(--border-dim)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600 }}>
            <Palette size={13} color="var(--accent-amber)" />
            <span>{siltVisualMode === 'classification' ? 'Sentinel-2 Silt Classes' : 'Silt Volume Heatmap Scale'}</span>
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {siltVisualMode === 'classification' ? '4 Tiers' : 'm³ / 100m²'}
          </span>
        </div>

        {siltVisualMode === 'classification' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, textAlign: 'center', fontSize: 9 }}>
            <div style={{ background: 'rgba(34, 197, 94, 0.2)', border: '1px solid #22c55e', borderRadius: 4, padding: '3px 2px', color: '#86efac' }}>
              <span style={{ fontWeight: 700, display: 'block' }}>1. Low</span>
              <span style={{ opacity: 0.8 }}>Clear</span>
            </div>
            <div style={{ background: 'rgba(234, 179, 8, 0.2)', border: '1px solid #eab308', borderRadius: 4, padding: '3px 2px', color: '#fde047' }}>
              <span style={{ fontWeight: 700, display: 'block' }}>2. Mod</span>
              <span style={{ opacity: 0.8 }}>Littoral</span>
            </div>
            <div style={{ background: 'rgba(249, 115, 22, 0.2)', border: '1px solid #f97316', borderRadius: 4, padding: '3px 2px', color: '#fdba74' }}>
              <span style={{ fontWeight: 700, display: 'block' }}>3. High</span>
              <span style={{ opacity: 0.8 }}>Inflow</span>
            </div>
            <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', borderRadius: 4, padding: '3px 2px', color: '#fca5a5' }}>
              <span style={{ fontWeight: 700, display: 'block' }}>4. V.High</span>
              <span style={{ opacity: 0.8 }}>Deposition</span>
            </div>
          </div>
        ) : (
          <div>
            <div
              style={{
                height: 10,
                borderRadius: 4,
                background: 'linear-gradient(to right, #ffffe5, #fe9929, #662506)'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 4 }}>
              <span>0.0 m³</span>
              <span>48.3 m³</span>
              <span>96.6 m³</span>
            </div>
          </div>
        )}
      </div>

      {/* Vertical Exaggeration Slider */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
          <span style={{ color: 'var(--text-secondary)' }}>Vertical Exaggeration:</span>
          <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
            {verticalExaggeration.toFixed(1)}x
          </strong>
        </div>
        <input
          type="range"
          min={1.0}
          max={4.0}
          step={0.1}
          value={verticalExaggeration}
          onChange={(e) => setVerticalExaggeration(parseFloat(e.target.value))}
        />
        <span style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.3 }}>
          Visual scaling only. All calculations & coordinate readouts strictly use 1:1 real metrics.
        </span>
      </div>

      {/* Section Cut Tool */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Scissors size={13} color="var(--accent-cyan)" />
            <span style={{ color: 'var(--text-secondary)' }}>Section Cut (East-West):</span>
          </div>
          {sectionCutX !== null ? (
            <button
              onClick={() => setSectionCutX(null)}
              style={{ background: 'none', border: 'none', color: '#f43f5e', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}
            >
              Reset Cut
            </button>
          ) : (
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Off</span>
          )}
        </div>
        <input
          type="range"
          min={-450}
          max={450}
          step={10}
          value={sectionCutX ?? 450}
          onChange={(e) => setSectionCutX(parseFloat(e.target.value))}
        />
      </div>
    </div>
  );
};
