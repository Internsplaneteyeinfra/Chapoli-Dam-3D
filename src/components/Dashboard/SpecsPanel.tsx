import React from 'react';
import { Database, CheckCircle, Info, Droplets, ExternalLink, ShieldCheck, AlertCircle } from 'lucide-react';
import { BaselineSpecs, DataProvenance, SedimentVolumeStats, DEMSummary } from '../../types/reservoir';

interface SpecsPanelProps {
  specs: BaselineSpecs;
  dem?: DEMSummary;
  waterLevel: number;
  currentModeledVolumeMCM: number;
  submergedAreaHa: number;
  sedimentStats: SedimentVolumeStats;
  sampleMode: boolean;
}

export const SpecsPanel: React.FC<SpecsPanelProps> = ({
  specs,
  dem,
  waterLevel,
  currentModeledVolumeMCM,
  submergedAreaHa,
  sedimentStats,
  sampleMode
}) => {
  const getProvenanceBadge = (prov: DataProvenance, label?: string) => {
    switch (prov) {
      case 'OBSERVED':
        return <span className="badge badge-observed">{label || 'OBSERVED'}</span>;
      case 'DERIVED':
        return <span className="badge badge-derived">{label || 'DERIVED'}</span>;
      case 'MODELLED':
        return <span className="badge badge-modelled">{label || 'MODELLED'}</span>;
      case 'SIMULATED':
        return <span className="badge badge-simulated">{label || 'SIMULATED'}</span>;
      default:
        return <span className="badge badge-unavailable">{label || 'UNAVAILABLE'}</span>;
    }
  };

  const deepestBed = specs.deepestBedLevel_m ?? 15.50;
  const currentMaxDepth = Math.max(0, waterLevel - deepestBed);

  return (
    <div
      className="glass-panel"
      style={{
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-dim)', paddingBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Database size={16} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#f8fafc' }}>
            Official Dam & Basin Specifications
          </h2>
        </div>
        <a
          href="https://goawrd.gov.in/project/chapoli-mi-tank"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 10, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}
          title="Open Official Goa WRD Project Webpage"
        >
          Goa WRD <ExternalLink size={10} />
        </a>
      </div>

      {/* Baseline Specifications Table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
        {/* Dam Structure Highlights */}
        <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 6, border: '1px solid rgba(56, 189, 248, 0.15)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>
            Structural Dam Geometry (Goa WRD)
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Dam Type:</span>
            <span style={{ fontWeight: 600, color: '#f8fafc' }}>Earthen Dam (Ungated Chute)</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Dam Crest (Top of Dam):</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <strong style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>41.00 m MSL</strong>
              {getProvenanceBadge('OBSERVED')}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Dam Crest Length:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>760.0 m</span>
              {getProvenanceBadge('OBSERVED')}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Structural Dam Height:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <strong style={{ fontFamily: 'var(--font-mono)', color: '#f59e0b' }}>25.50 m</strong>
              {getProvenanceBadge('OBSERVED')}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Implied Deepest Bed Level:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: '#f59e0b' }}>15.50 m MSL (41.0 - 25.5)</span>
              {getProvenanceBadge('DERIVED', 'CONSISTENCY REF')}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Spillway Crest Level:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>38.25 m MSL</span>
              {getProvenanceBadge('OBSERVED')}
            </div>
          </div>
        </div>

        {/* Reservoir Hydrological Levels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Full Reservoir Level (FRL)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-cyan)' }}>38.25 m</span>
            {getProvenanceBadge('OBSERVED')}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Maximum Water Level (MWL)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#f59e0b' }}>38.75 m</span>
            {getProvenanceBadge('OBSERVED')}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Min Draw Down Level (MDDL)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#f59e0b' }}>22.00 m</span>
            {getProvenanceBadge('OBSERVED')}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Gross Storage Capacity</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>9.9824 MCM / 998.24 Hamts</span>
            {getProvenanceBadge('OBSERVED')}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Live Storage Capacity</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>8.7658 MCM / 876.58 Hamts</span>
            {getProvenanceBadge('OBSERVED')}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Dead Storage Capacity</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>0.49 MCM / 49.00 Hamts</span>
            {getProvenanceBadge('OBSERVED')}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Catchment & Submergence</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>6.83 km² / 110 ha</span>
            {getProvenanceBadge('OBSERVED')}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Drinking Water Supply</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>10.0 MLD</span>
            {getProvenanceBadge('OBSERVED')}
          </div>
        </div>

        {dem && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>DTM Mesh Elevation Range</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#38bdf8' }}>
                {dem.minElevation.toFixed(2)}m – {dem.maxElevation.toFixed(2)}m
              </span>
              {getProvenanceBadge('OBSERVED')}
            </div>
          </div>
        )}
      </div>

      {/* Active Operational & Simulation Metrics */}
      <div style={{ marginTop: 4, paddingTop: 10, borderTop: '1px solid var(--border-dim)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Droplets size={14} color="var(--accent-water)" />
          <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent-cyan)' }}>
            Real-Time Modelled Operational State
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="glass-panel-subtle" style={{ padding: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Simulated Water Level</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', marginTop: 2 }}>
              {waterLevel.toFixed(2)} m
            </div>
            <div style={{ marginTop: 4 }}>{getProvenanceBadge('MODELLED')}</div>
          </div>

          <div className="glass-panel-subtle" style={{ padding: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Max Basin Water Depth</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#38bdf8', marginTop: 2 }}>
              {currentMaxDepth.toFixed(2)} m
            </div>
            <div style={{ marginTop: 4 }}>{getProvenanceBadge('DERIVED', '15.5m REF')}</div>
          </div>

          <div className="glass-panel-subtle" style={{ padding: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Submerged Area</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#ffffff', marginTop: 2 }}>
              {submergedAreaHa.toFixed(2)} ha
            </div>
            <div style={{ marginTop: 4 }}>{getProvenanceBadge('DERIVED')}</div>
          </div>

          <div className="glass-panel-subtle" style={{ padding: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Submerged Volume</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#ffffff', marginTop: 2 }}>
              {currentModeledVolumeMCM.toFixed(3)} MCM
            </div>
            <div style={{ marginTop: 4 }}>{getProvenanceBadge('MODELLED')}</div>
          </div>
        </div>

        {/* Sedimentation Summary Box */}
        <div
          style={{
            padding: 10,
            borderRadius: 8,
            background: sampleMode ? 'rgba(245, 158, 11, 0.08)' : 'rgba(244, 63, 94, 0.08)',
            border: sampleMode ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid rgba(244, 63, 94, 0.25)',
            marginTop: 4
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: sampleMode ? '#fbbf24' : '#fb7185' }}>
              Sediment Volume Analysis
            </span>
            {getProvenanceBadge(sampleMode ? 'SIMULATED' : 'UNAVAILABLE')}
          </div>
          {sampleMode ? (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div>Volume: <strong style={{ color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>{sedimentStats.volumeMCM.toFixed(4)} MCM</strong> ({sedimentStats.volumeM3.toLocaleString()} m³)</div>
              <div>Mean Thickness: <strong style={{ color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>{sedimentStats.meanThicknessM.toFixed(2)} m</strong> (Max: {sedimentStats.maxThicknessM.toFixed(2)} m)</div>
              <div>Estimated Capacity Loss: <strong style={{ color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>{sedimentStats.capacityLossPercent.toFixed(2)}%</strong> of gross storage</div>
            </div>
          ) : (
            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Pre-impoundment baseline bathymetry not included in provided files. Sediment deposits marked UNAVAILABLE until historical pre-construction survey is imported.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
