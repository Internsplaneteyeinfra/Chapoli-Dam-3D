import React from 'react';
import { Database, Droplets } from 'lucide-react';
import { BaselineSpecs, LiveTelemetry } from '../../types/reservoir';
import { WaterDepthPayload } from '../../types/waterDepth';

interface SpecsPanelProps {
  specs: BaselineSpecs;
  liveTelemetry?: LiveTelemetry;
  waterDepthData?: WaterDepthPayload;
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

/** Key facts only: dam depth and current water conditions. */
export const SpecsPanel: React.FC<SpecsPanelProps> = ({ specs, liveTelemetry, waterDepthData }) => {
  const deepestBed = specs.deepestBedLevel_m ?? 15.5;
  const topOfDam = specs.topOfDam_m ?? 41.0;
  const liveLevel = liveTelemetry?.reportedLevel_m;

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
    </div>
  );
};
