import React from 'react';
import { Droplets, EyeOff, Layers, Scissors } from 'lucide-react';
import { WaterDepthPayload } from '../../types/waterDepth';

interface TogglePillProps {
  label: string;
  on: boolean;
  onToggle: (on: boolean) => void;
  icon: React.ReactNode;
  accent: string;
  accentDark: string;
  glow: string;
}

/** One-click ON/OFF pill shared by the bottom-dock layer toggles */
const TogglePill: React.FC<TogglePillProps> = ({ label, on, onToggle, icon, accent, accentDark, glow }) => (
  <button
    onClick={() => onToggle(!on)}
    style={{
      padding: '8px 18px',
      borderRadius: 24,
      border: on ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.15)',
      background: on ? `linear-gradient(135deg, ${accent}, ${accentDark})` : 'rgba(15, 23, 42, 0.9)',
      color: on ? '#ffffff' : 'var(--text-secondary)',
      boxShadow: on ? `0 4px 16px ${glow}` : '0 4px 16px rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 12,
      fontWeight: 700,
      cursor: 'pointer',
      whiteSpace: 'nowrap'
    }}
    title={`${on ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
  >
    {on ? icon : <EyeOff size={15} />}
    {label}: {on ? 'ON' : 'OFF'}
  </button>
);

interface WaterToggleControlProps {
  waterDepthData: WaterDepthPayload;
  visible: boolean;
  onToggle: (visible: boolean) => void;
  /** Optional silt ON/OFF pill shown beside the water pill */
  siltVisible?: boolean;
  onToggleSilt?: (visible: boolean) => void;
  /** Filled cross-section through the reservoir (earth / silt band / water) */
  sectionOn?: boolean;
  onToggleSection?: (on: boolean) => void;
  /** Observed level (m MSL) the water surface is drawn at */
  surfaceLevel?: number;
  /** Water body depth exaggeration and its one-click presets */
  depthScale?: number;
  onDepthScale?: (scale: number) => void;
  /** Rendered inside a parent bottom dock instead of positioning itself */
  docked?: boolean;
}

export const WaterToggleControl: React.FC<WaterToggleControlProps> = ({
  waterDepthData,
  visible,
  onToggle,
  siltVisible,
  onToggleSilt,
  sectionOn,
  onToggleSection,
  surfaceLevel,
  depthScale,
  onDepthScale,
  docked = false
}) => {
  const { water, depth } = waterDepthData;

  const placement: React.CSSProperties = docked
    ? { position: 'relative' }
    : { position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)' };

  // Basin depth exaggeration applies to the carved bed too, so it stays available with water off
  const depthSelector = onDepthScale && (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 2 }}
      title="Exaggerate how far the basin and water body extend down (readouts stay in real metres)"
    >
      <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 2 }}>Depth</span>
      {[1, 2, 3, 5].map(s => (
        <button
          key={s}
          onClick={() => onDepthScale(s)}
          style={{
            padding: '2px 6px',
            fontSize: 10,
            fontWeight: 600,
            borderRadius: 4,
            border: 'none',
            cursor: 'pointer',
            background: depthScale === s ? '#0284c7' : 'rgba(255,255,255,0.06)',
            color: depthScale === s ? '#ffffff' : 'var(--text-muted)'
          }}
        >
          ×{s}
        </button>
      ))}
    </div>
  );

  return (
    <div
      style={{
        ...placement,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}
    >
      <TogglePill
        label="Water"
        on={visible}
        onToggle={onToggle}
        icon={<Droplets size={15} />}
        accent="#0284c7"
        accentDark="#0369a1"
        glow="rgba(56, 189, 248, 0.4)"
      />

      {visible && (
        <div
          style={{
            background: 'rgba(8, 15, 30, 0.90)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            borderRadius: 10,
            padding: '6px 12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 11,
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap'
          }}
          title={`S1 water ${water.imageDate} · S2 depth ${depth.imageDate} · relative estimate, not survey bathymetry`}
        >
          <span>
            <strong style={{ color: '#38bdf8' }}>{water.waterAreaHa.toFixed(1)} ha</strong>
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{depth.minDepthM} m</span>
          <div
            style={{
              width: 110,
              height: 8,
              borderRadius: 4,
              background: `linear-gradient(90deg, ${depth.palette.join(', ')})`
            }}
            title="Relative water depth: light blue = shallow, dark blue = deep"
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{depth.maxDepthM} m</span>
          <span>
            Mean <strong style={{ color: '#e2e8f0' }}>{depth.meanDepthM.toFixed(1)} m</strong>
          </span>
          {surfaceLevel !== undefined && (
            <span title="Water surface drawn at the observed SCADA level">
              Level <strong style={{ color: '#e2e8f0' }}>{surfaceLevel.toFixed(2)} m</strong>
            </span>
          )}
          {depthSelector}
        </div>
      )}

      {!visible && depthSelector && (
        <div
          style={{
            background: 'rgba(8, 15, 30, 0.90)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            padding: '6px 10px',
            whiteSpace: 'nowrap'
          }}
        >
          {depthSelector}
        </div>
      )}

      {onToggleSilt && (
        <TogglePill
          label="Silt"
          on={!!siltVisible}
          onToggle={onToggleSilt}
          icon={<Layers size={15} />}
          accent="#f59e0b"
          accentDark="#d97706"
          glow="rgba(245, 158, 11, 0.4)"
        />
      )}

      {onToggleSection && (
        <TogglePill
          label="Section"
          on={!!sectionOn}
          onToggle={onToggleSection}
          icon={<Scissors size={15} />}
          accent="#0d9488"
          accentDark="#0f766e"
          glow="rgba(20, 184, 166, 0.4)"
        />
      )}
    </div>
  );
};
