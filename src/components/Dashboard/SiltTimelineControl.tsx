import React, { useEffect, useState, useRef } from 'react';
import { Play, Pause, Calendar, Layers, Activity, ChevronRight, BarChart2 } from 'lucide-react';
import { SiltSeriesPayload, SiltVisualMode, SiltMonthRecord } from '../../types/silt';

interface SiltTimelineControlProps {
  siltData: SiltSeriesPayload;
  activeMonth: string;
  onSelectMonth: (monthKey: string) => void;
  visualMode: SiltVisualMode;
  onToggleVisualMode: (mode: SiltVisualMode) => void;
  siltVisible: boolean;
  onToggleSiltVisible: (visible: boolean) => void;
  /** Rendered inside a parent bottom dock instead of positioning itself */
  docked?: boolean;
}

export const SiltTimelineControl: React.FC<SiltTimelineControlProps> = ({
  siltData,
  activeMonth,
  onSelectMonth,
  visualMode,
  onToggleVisualMode,
  siltVisible,
  onToggleSiltVisible,
  docked = false
}) => {
  const placement: React.CSSProperties = docked
    ? { position: 'relative', zIndex: 40 }
    : { position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 40 };
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const timerRef = useRef<number | null>(null);

  const months = siltData.timeline;
  const currentRecord: SiltMonthRecord = siltData.months[activeMonth] || siltData.months[siltData.activeDefaultMonth];
  const isPeakMonth = months.some(m => m.key === currentRecord.key && m.isPeak);

  // Autoplay through months
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = window.setInterval(() => {
        const currentIndex = months.findIndex(m => m.key === activeMonth);
        const nextIndex = (currentIndex + 1) % months.length;
        onSelectMonth(months[nextIndex].key);
      }, 1600);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, activeMonth, months, onSelectMonth]);

  if (!siltVisible) {
    return (
      <div style={placement}>
        <button
          className="btn-amber"
          onClick={() => onToggleSiltVisible(true)}
          style={{
            padding: '8px 16px',
            borderRadius: 24,
            boxShadow: '0 4px 16px rgba(245, 158, 11, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            fontWeight: 700
          }}
        >
          <Layers size={15} />
          Show 2026 Silt Classification ({months.length} Months)
        </button>
      </div>
    );
  }

  const bd = currentRecord.classificationBreakdown;

  return (
    <div
      style={{
        ...placement,
        width: isExpanded ? (docked ? '100%' : 'min(94%, 780px)') : 'auto',
        boxSizing: 'border-box',
        background: 'rgba(8, 15, 30, 0.90)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        borderRadius: 14,
        padding: isExpanded ? '12px 18px' : '8px 14px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.65), 0 0 16px rgba(245, 158, 11, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'all 0.25s ease'
      }}
    >
      {/* Top Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 8px rgba(245, 158, 11, 0.5)'
            }}
          >
            <Calendar size={15} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                Sentinel-2 Silt Monitoring: {currentRecord.dateLabel}
              </span>
              {isPeakMonth && (
                <span className="badge badge-simulated" style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#f87171', fontSize: 10 }}>
                  Peak Deposition
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 12, marginTop: 2 }}>
              <span>Volume: <strong style={{ color: '#fbbf24' }}>{currentRecord.totalSiltVolumeM3.toLocaleString()} m³</strong> ({currentRecord.totalSiltVolumeMCM} MCM)</span>
              <span>•</span>
              <span>Water Area: <strong style={{ color: '#38bdf8' }}>{currentRecord.waterAreaHa.toFixed(1)} ha</strong></span>
              <span>•</span>
              <span>Mean Silt Score: <strong style={{ color: '#e2e8f0' }}>{currentRecord.meanSiltScore.toFixed(3)}</strong></span>
            </div>
          </div>
        </div>

        {/* Visual Mode Selector & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Mode Pill Toggle */}
          <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.8)', padding: 2, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)' }}>
            <button
              onClick={() => onToggleVisualMode('classification')}
              style={{
                padding: '3px 8px',
                fontSize: 10,
                fontWeight: 600,
                borderRadius: 4,
                border: 'none',
                background: visualMode === 'classification' ? 'var(--accent-amber)' : 'transparent',
                color: visualMode === 'classification' ? '#000000' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
              title="Sentinel-2 4-Tier Silt Classification: Low, Moderate, High, Very High"
            >
              Classification (4-Tier)
            </button>
            <button
              onClick={() => onToggleVisualMode('volume')}
              style={{
                padding: '3px 8px',
                fontSize: 10,
                fontWeight: 600,
                borderRadius: 4,
                border: 'none',
                background: visualMode === 'volume' ? 'var(--accent-amber)' : 'transparent',
                color: visualMode === 'volume' ? '#000000' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
              title="Continuous Silt Volume Heatmap Surface (0 to 96.6 m3 per 10m pixel)"
            >
              Volume Heatmap
            </button>
          </div>

          <button
            onClick={() => onToggleSiltVisible(false)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}
            title="Hide Silt Overlay"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Month Buttons Scrubber with Play/Pause */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            background: isPlaying ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.2)',
            border: isPlaying ? '1px solid #ef4444' : '1px solid var(--accent-cyan)',
            color: isPlaying ? '#f87171' : 'var(--accent-cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          title={isPlaying ? 'Pause Timeline' : 'Auto-Play 2026 Sediment Evolution'}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${months.length}, 1fr)`, gap: 4, flex: 1 }}>
          {months.map(m => {
            const isSelected = m.key === activeMonth;
            return (
              <button
                key={m.key}
                onClick={() => onSelectMonth(m.key)}
                style={{
                  padding: '6px 2px',
                  borderRadius: 6,
                  border: isSelected ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
                  background: isSelected
                    ? 'linear-gradient(180deg, rgba(245, 158, 11, 0.35) 0%, rgba(217, 119, 6, 0.2) 100%)'
                    : m.isPeak
                    ? 'rgba(239, 68, 68, 0.12)'
                    : 'rgba(15, 23, 42, 0.6)',
                  color: isSelected ? '#ffffff' : m.isPeak ? '#f87171' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  transition: 'all 0.15s ease'
                }}
                title={`${m.fullName} | Vol: ${m.volumeM3.toLocaleString()} m3 | Water: ${m.waterAreaHa} ha`}
              >
                <span style={{ fontSize: 11, fontWeight: isSelected ? 700 : 500 }}>
                  {m.month}
                </span>
                <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', opacity: 0.85 }}>
                  {m.volumeM3 > 0 ? `${Math.round(m.volumeM3 / 1000)}k` : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Silt Classification Tier Breakdown Bar */}
      {currentRecord.validPixels > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: '#1e293b' }}>
            <div style={{ width: `${bd.low.percent}%`, background: '#22c55e' }} title={`Low Silt: ${bd.low.percent}%`} />
            <div style={{ width: `${bd.moderate.percent}%`, background: '#eab308' }} title={`Moderate Silt: ${bd.moderate.percent}%`} />
            <div style={{ width: `${bd.high.percent}%`, background: '#f97316' }} title={`High Silt: ${bd.high.percent}%`} />
            <div style={{ width: `${bd.veryHigh.percent}%`, background: '#ef4444' }} title={`Very High Silt: ${bd.veryHigh.percent}%`} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#22c55e' }} />
              Low: {bd.low.percent}%
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#eab308' }} />
              Mod: {bd.moderate.percent}%
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f97316' }} />
              High: {bd.high.percent}%
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444' }} />
              Very High: {bd.veryHigh.percent}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
