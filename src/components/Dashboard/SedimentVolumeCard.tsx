import React from 'react';
import { X, Mountain } from 'lucide-react';
import { SiltSeriesPayload } from '../../types/silt';

interface SedimentVolumeModalProps {
  isOpen: boolean;
  onClose: () => void;
  siltData: SiltSeriesPayload;
  siltMonth: string;
  onSelectMonth: (monthKey: string) => void;
}

/**
 * Silt report from the Sentinel-2 monthly series (the only sediment data available:
 * there is no pre-impoundment survey, so no absolute deposit volume is shown).
 */
export const SedimentVolumeModal: React.FC<SedimentVolumeModalProps> = ({
  isOpen,
  onClose,
  siltData,
  siltMonth,
  onSelectMonth
}) => {
  if (!isOpen) return null;

  const record = siltData.months[siltMonth] || siltData.months[siltData.activeDefaultMonth];
  const bd = record.classificationBreakdown;
  const classes = [bd.low, bd.moderate, bd.high, bd.veryHigh];
  const timeline = siltData.timeline;
  const maxVol = Math.max(...timeline.map(m => m.volumeM3), 1);
  const isPeak = timeline.some(m => m.key === record.key && m.isPeak);

  const card = (label: string, value: string, color = '#f8fafc') => (
    <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-dim)', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color, marginTop: 2 }}>{value}</div>
    </div>
  );

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
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: 640,
          maxWidth: '95vw',
          maxHeight: '92vh',
          overflowY: 'auto',
          background: 'rgba(8, 14, 28, 0.98)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 12,
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 14
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-dim)', paddingBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Mountain size={20} color="#f59e0b" />
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>Silt report</h3>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Sentinel-2 satellite, {siltData.year}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Selected month */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ fontSize: 13, color: '#fbbf24' }}>{record.dateLabel}</strong>
          {isPeak && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#ef4444', color: '#ffffff' }}>
              HIGHEST SILT
            </span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {card('Silt amount', `${Math.round(record.totalSiltVolumeM3).toLocaleString()} m³`, '#fbbf24')}
          {card('Silt score (0–1)', record.meanSiltScore.toFixed(2))}
          {card('Water area', `${record.waterAreaHa.toFixed(1)} ha`, '#38bdf8')}
        </div>

        {/* Class breakdown */}
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-dim)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Share of water area by silt class</div>
          <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: '#1e293b' }}>
            {classes.map(c => <div key={c.label} style={{ width: `${c.percent}%`, background: c.color }} title={`${c.label}: ${c.percent}%`} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 8, fontSize: 11 }}>
            {classes.map(c => (
              <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: c.color }} />
                <span style={{ color: 'var(--text-secondary)' }}>{c.label.replace(' Silt', '')}</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: '#e2e8f0', marginLeft: 'auto' }}>{c.percent}%</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly trend (click a month to select it) */}
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-dim)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Silt amount by month</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
            {timeline.map(m => {
              const selected = m.key === record.key;
              return (
                <button
                  key={m.key}
                  onClick={() => onSelectMonth(m.key)}
                  title={`${m.fullName}: ${Math.round(m.volumeM3).toLocaleString()} m³`}
                  style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: selected ? '#fbbf24' : 'var(--text-muted)' }}>
                    {Math.round(m.volumeM3 / 1000)}k
                  </span>
                  <div
                    style={{
                      width: '100%',
                      height: `${(m.volumeM3 / maxVol) * 80}%`,
                      borderRadius: '4px 4px 0 0',
                      background: selected ? '#f59e0b' : m.isPeak ? 'rgba(239, 68, 68, 0.6)' : 'rgba(245, 158, 11, 0.35)'
                    }}
                  />
                  <span style={{ fontSize: 10, fontWeight: selected ? 700 : 500, color: selected ? '#ffffff' : 'var(--text-secondary)' }}>{m.month}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Relative estimate from satellite images, not a ground survey.
        </div>
      </div>
    </div>
  );
};
