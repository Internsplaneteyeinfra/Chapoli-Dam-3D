import React from 'react';
import { X, Mountain, AlertTriangle, ShieldCheck, CheckCircle2, TrendingDown } from 'lucide-react';
import { SedimentVolumeStats, BaselineSpecs } from '../../types/reservoir';

interface SedimentVolumeModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: SedimentVolumeStats;
  specs: BaselineSpecs;
  sampleMode: boolean;
  onEnableSampleMode: () => void;
}

export const SedimentVolumeModal: React.FC<SedimentVolumeModalProps> = ({
  isOpen,
  onClose,
  stats,
  specs,
  sampleMode,
  onEnableSampleMode
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '90%',
          maxWidth: 680,
          background: 'rgba(10, 18, 36, 0.95)',
          padding: 24,
          borderRadius: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-dim)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Mountain size={20} color="var(--accent-amber)" />
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                Reservoir Sediment Volume & Capacity Loss Analysis
              </h3>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Rigorous spatial cell integration over validated Chapoli M.I. Tank terrain
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ width: 32, height: 32 }}>
            <X size={18} />
          </button>
        </div>

        {/* Mode Status Warning / Banner */}
        {!sampleMode ? (
          <div style={{ padding: 14, borderRadius: 8, background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', display: 'flex', gap: 12 }}>
            <AlertTriangle size={20} color="#fb7185" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, lineHeight: 1.4 }}>
              <strong style={{ color: '#fb7185' }}>Data Integrity Notice: Pre-Impoundment Survey Unavailable</strong>
              <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                The provided files contain the current DEM raster and 1m bathymetric contours, but do not contain a historical pre-impoundment bathymetry survey.
                In accordance with scientific engineering guidelines, measured sediment volume is reported as <strong>UNAVAILABLE</strong> rather than presenting fabricated estimates.
              </div>
              <button
                onClick={onEnableSampleMode}
                className="btn-amber"
                style={{ marginTop: 10, padding: '5px 12px', fontSize: 11 }}
              >
                Switch to Simulated Sample Model
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: 12, borderRadius: 8, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', gap: 10 }}>
            <AlertTriangle size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              <strong style={{ color: '#fbbf24' }}>Simulated Sample Model Active:</strong> Pre-impoundment original bed is modeled based on natural thalweg sloping toward MDDL 22.0m outlet.
              Use for conceptual sedimentation planning and workflow validation.
            </div>
          </div>
        )}

        {/* Key Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <div className="glass-panel-subtle" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Accumulated Sediment Volume</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: sampleMode ? 'var(--accent-amber)' : 'var(--text-muted)', marginTop: 4 }}>
              {sampleMode ? `${stats.volumeMCM.toFixed(4)} MCM` : 'UNAVAILABLE'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              {sampleMode ? `${stats.volumeM3.toLocaleString()} m³` : 'Pending baseline survey'}
            </div>
          </div>

          <div className="glass-panel-subtle" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Estimated Capacity Loss</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: sampleMode ? '#f59e0b' : 'var(--text-muted)' }}>
                {sampleMode ? `${stats.capacityLossPercent.toFixed(2)}%` : 'UNAVAILABLE'}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>of Gross Storage (9.9824 MCM)</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              {sampleMode ? `${((stats.volumeMCM / specs.deadStorage_MCM) * 100).toFixed(1)}% of Dead Storage (${specs.deadStorage_MCM} MCM)` : 'Requires baseline comparison'}
            </div>
          </div>

          <div className="glass-panel-subtle" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mean Sediment Thickness</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#ffffff', marginTop: 4 }}>
              {sampleMode ? `${stats.meanThicknessM.toFixed(2)} m` : 'UNAVAILABLE'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              Maximum Local Thickness: <strong style={{ color: 'var(--accent-cyan)' }}>{sampleMode ? `${stats.maxThicknessM.toFixed(2)} m` : '-'}</strong>
            </div>
          </div>

          <div className="glass-panel-subtle" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Surveyed Footprint & Coverage</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#ffffff', marginTop: 4 }}>
              {stats.surveyedAreaHa.toFixed(2)} ha
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              Spatial Coverage: <strong style={{ color: '#34d399' }}>{stats.coveragePercent.toFixed(1)}%</strong> (837 valid DEM cells)
            </div>
          </div>
        </div>

        {/* Exclusions & Accounting */}
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: 12, borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontWeight: 600, color: '#e2e8f0' }}>Uncertainty & Spatial Exclusions:</div>
          <div>• 458 NoData cells outside the reservoir boundary strictly excluded from volume computations.</div>
          <div>• Baseline capacity figures preserved as supplied: Gross 9.9824 MCM ({specs.grossStorage_Hamts} Hamts).</div>
          <div>• All volumes calculated using true metric cell area (dx = 30.55m, dy = 30.48m; ~931.2 m² per cell).</div>
        </div>
      </div>
    </div>
  );
};
