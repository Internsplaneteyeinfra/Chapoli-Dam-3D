import React from 'react';
import { Droplet, AlertTriangle } from 'lucide-react';
import { BaselineSpecs } from '../../types/reservoir';

interface WaterLevelControlProps {
  waterLevel: number;
  onWaterLevelChange: (val: number) => void;
  submergedAreaHa: number;
  submergedVolumeMCM: number;
  liveLevel?: number;
  specs?: BaselineSpecs;
}

const DEEPEST_BED = 15.5;
const FULL_LEVEL = 38.25;
const MAX_FLOOD = 38.75;
const DAM_TOP = 41.0;

export const WaterLevelControl: React.FC<WaterLevelControlProps> = ({
  waterLevel,
  onWaterLevelChange,
  submergedAreaHa,
  submergedVolumeMCM,
  liveLevel = 35.47,
  specs
}) => {
  const bed = specs?.deepestBedLevel_m ?? DEEPEST_BED;
  const fullLevel = specs?.frl_m ?? FULL_LEVEL;
  const floodLevel = specs?.mwl_m ?? MAX_FLOOD;
  const damTop = specs ? specs.topOfDam_m : DAM_TOP;
  const hasDam = damTop !== undefined;
  const sliderMin = bed;
  const sliderMax = hasDam ? damTop : fullLevel + 1.5;
  const drawdown = specs?.mddl_m ?? 22;

  const presets = hasDam
    ? [
        { label: 'Minimum', level: drawdown, title: 'Lowest level water is drawn down to' },
        { label: 'Today', level: liveLevel, title: 'Current level from the gauge' },
        { label: 'Full', level: fullLevel, title: 'Full reservoir level (spillway starts overflowing)' },
        { label: 'Max flood', level: floodLevel, title: 'Highest design flood level' },
        { label: 'Dam top', level: damTop, isStructural: true, title: 'Top of the dam' }
      ]
    : [
        { label: 'Low', level: bed, title: 'Lowest modelled bed' },
        { label: 'Full', level: fullLevel, title: 'Shoreline water surface' },
        { label: 'High', level: Math.round((fullLevel + 1) * 100) / 100, title: 'Above the shoreline' }
      ];

  const overSpillway = waterLevel > fullLevel;
  const atDamTop = hasDam && waterLevel >= damTop - 0.5;

  return (
    <div className="glass-panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Droplet size={16} color="var(--accent-water)" />
          <h3 style={{ fontSize: 13, fontWeight: 700 }}>Try a water level</h3>
        </div>
        <span style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)', color: atDamTop ? '#f43f5e' : 'var(--accent-cyan)' }}>
          {waterLevel.toFixed(2)} m
        </span>
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -6 }}>
        Drag to see how much water the {hasDam ? 'dam holds' : 'lake covers'} at any level.
      </span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <input
          type="range"
          min={sliderMin}
          max={sliderMax}
          step={0.05}
          value={waterLevel}
          onChange={(e) => onWaterLevelChange(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: atDamTop ? '#f43f5e' : 'var(--accent-cyan)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
          <span>{hasDam ? `Empty (${bed.toFixed(1)} m)` : `Bed (${bed.toFixed(1)} m)`}</span>
          <span>{hasDam ? `Dam top (${damTop.toFixed(1)} m)` : `High (${sliderMax.toFixed(1)} m)`}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${presets.length}, 1fr)`, gap: 5 }}>
        {presets.map((p) => {
          const isActive = Math.abs(waterLevel - p.level) < 0.05;
          return (
            <button
              key={p.label}
              onClick={() => onWaterLevelChange(p.level)}
              style={{
                background: isActive
                  ? (p.isStructural ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.25)')
                  : 'rgba(255, 255, 255, 0.04)',
                border: isActive
                  ? (p.isStructural ? '1px solid #ef4444' : '1px solid var(--accent-cyan)')
                  : '1px solid var(--border-dim)',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                borderRadius: 6,
                padding: '6px 2px',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease'
              }}
              title={p.title}
            >
              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.label}</div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', opacity: 0.85 }}>{p.level.toFixed(2)} m</div>
            </button>
          );
        })}
      </div>

      {overSpillway && (
        <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: 6, padding: '6px 10px', fontSize: 11, color: '#fcd34d', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} color="#f59e0b" style={{ flexShrink: 0 }} />
          <span>{atDamTop ? 'Water at the dam top: not possible in practice.' : hasDam ? 'Above full level: water spills over the spillway.' : 'Above the shoreline: water spreads onto the banks.'}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, background: 'rgba(15, 23, 42, 0.6)', padding: '10px 12px', borderRadius: 8, fontSize: 11 }}>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Water covers</span>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#ffffff', marginTop: 2 }}>
            {submergedAreaHa.toFixed(1)} ha
          </div>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Water stored</span>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--accent-cyan)', marginTop: 2 }}>
            {submergedVolumeMCM.toFixed(2)} M m³
          </div>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Deepest point</span>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#ffffff', marginTop: 2 }}>
            {Math.max(0, waterLevel - bed).toFixed(1)} m
          </div>
        </div>
      </div>
    </div>
  );
};
