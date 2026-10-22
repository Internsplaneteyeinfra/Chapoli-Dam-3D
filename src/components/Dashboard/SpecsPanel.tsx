import React from 'react';
import { Database, Droplets, Layers } from 'lucide-react';
import { BaselineSpecs, LiveTelemetry } from '../../types/reservoir';
import { WaterDepthPayload } from '../../types/waterDepth';
import { SiltMonthRecord } from '../../types/silt';

interface SpecsPanelProps {
  specs: BaselineSpecs;
  liveTelemetry?: LiveTelemetry;
  waterDepthData?: WaterDepthPayload;
  siltRecord?: SiltMonthRecord;
}

const Row: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = '#f8fafc' }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, padding: '3px 0' }}>
    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
    <strong style={{ fontFamily: 'var(--font-mono)', color }}>{value}</strong>
  </div>
);

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-dim)', borderRadius: 8, padding: '10px 12px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      {icon}
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#e2e8f0' }}>{title}</span>
    </div>
    {children}
  </div>
);

/** Key facts only: dam depth, current water and the selected month's silt. */
export const SpecsPanel: React.FC<SpecsPanelProps> = ({ specs, liveTelemetry, waterDepthData, siltRecord }) => {
  const deepestBed = specs.deepestBedLevel_m ?? 15.5;
  const topOfDam = specs.topOfDam_m ?? 41.0;
  const liveLevel = liveTelemetry?.reportedLevel_m;
  const bd = siltRecord?.classificationBreakdown;
  const classes = bd ? [bd.low, bd.moderate, bd.high, bd.veryHigh] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Section icon={<Database size={14} color="var(--accent-cyan)" />} title="Dam depth">
        <Row label="Top of dam" value={`${topOfDam.toFixed(2)} m`} />
        <Row label="Full reservoir level" value={`${specs.frl_m.toFixed(2)} m`} color="#38bdf8" />
        <Row label="Deepest bed" value={`${deepestBed.toFixed(2)} m`} color="#fbbf24" />
        <Row label="Dam height" value={`${(specs.damHeight_m ?? topOfDam - deepestBed).toFixed(2)} m`} />
        <Row label="Max depth at FRL" value={`${(specs.frl_m - deepestBed).toFixed(2)} m`} color="#38bdf8" />
      </Section>

      <Section icon={<Droplets size={14} color="#38bdf8" />} title="Water now">
        {liveLevel !== undefined && (
          <>
            <Row label="Water level (SCADA)" value={`${liveLevel.toFixed(2)} m`} color="#34d399" />
            <Row label="Depth above deepest bed" value={`${Math.max(0, liveLevel - deepestBed).toFixed(2)} m`} color="#38bdf8" />
          </>
        )}
        {waterDepthData && (
          <>
            <Row label="Water area (satellite)" value={`${waterDepthData.water.waterAreaHa.toFixed(1)} ha`} />
            <Row label="Mean / max depth" value={`${waterDepthData.depth.meanDepthM.toFixed(1)} / ${waterDepthData.depth.maxDepthM.toFixed(1)} m`} />
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              Sentinel {waterDepthData.depth.imageDate} · relative depth estimate
            </div>
          </>
        )}
      </Section>

      {siltRecord && (
        <Section icon={<Layers size={14} color="#f59e0b" />} title={`Silt · ${siltRecord.dateLabel}`}>
          <Row label="Relative silt volume" value={`${siltRecord.totalSiltVolumeM3.toLocaleString()} m³`} color="#fbbf24" />
          <Row label="Mean silt score" value={siltRecord.meanSiltScore.toFixed(3)} />
          <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', margin: '8px 0 6px', background: '#1e293b' }}>
            {classes.map(c => <div key={c.label} style={{ width: `${c.percent}%`, background: c.color }} />)}
          </div>
          {classes.map(c => (
            <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '1px 0' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
                {c.label}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', color: '#e2e8f0' }}>{c.percent}%</span>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
};
