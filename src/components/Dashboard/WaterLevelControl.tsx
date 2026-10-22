import React from 'react';
import { Droplet, AlertTriangle, ShieldCheck, Radio, Info } from 'lucide-react';

interface WaterLevelControlProps {
  waterLevel: number;
  onWaterLevelChange: (val: number) => void;
  submergedAreaHa: number;
  submergedVolumeMCM: number;
  liveLevel?: number;
}

export const WaterLevelControl: React.FC<WaterLevelControlProps> = ({
  waterLevel,
  onWaterLevelChange,
  submergedAreaHa,
  submergedVolumeMCM,
  liveLevel = 35.47
}) => {
  const presets = [
    { label: 'MDDL', level: 22.00, title: 'Minimum Drawdown Level (Dead Storage: 49 Hamts / 0.49 MCM)' },
    { label: 'Live SCADA', level: liveLevel, title: `Current Goa WRD SCADA Telemetry (${liveLevel}m, 815.74 Hamts)` },
    { label: 'FRL', level: 38.25, title: 'Full Reservoir Level (Spillway Crest El. 38.25m, Live Storage: 876.58 Hamts)' },
    { label: 'MWL', level: 38.75, title: 'Maximum Water Level (Design Flood +0.50m head, Gross Storage: 998.24 Hamts)' },
    { label: 'Top of Dam', level: 41.00, isStructural: true, title: 'Structural Dam Crest Reference (41.00m - Non-Inundation Limit)' }
  ];

  const isOvertopping = waterLevel > 38.75;
  const isAboveSpillway = waterLevel > 38.25 && waterLevel <= 38.75;
  const isCrestReference = waterLevel >= 40.50;

  return (
    <div className="glass-panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Droplet size={16} color="var(--accent-water)" />
          <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Reservoir Water Level Simulation
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)', color: isOvertopping ? '#f43f5e' : 'var(--accent-cyan)' }}>
            {waterLevel.toFixed(2)}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>m MSL</span>
        </div>
      </div>

      {/* Main Slider */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input
          type="range"
          min={15.50}
          max={41.00}
          step={0.05}
          value={waterLevel}
          onChange={(e) => onWaterLevelChange(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: isOvertopping ? '#f43f5e' : 'var(--accent-cyan)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          <span>Bed: 15.5m</span>
          <span>MDDL: 22.0m</span>
          <span style={{ color: '#34d399' }}>Live: {liveLevel}m</span>
          <span style={{ color: 'var(--accent-cyan)' }}>FRL: 38.25m</span>
          <span style={{ color: '#f59e0b' }}>MWL: 38.75m</span>
          <span style={{ color: '#94a3b8' }}>Crest: 41.0m</span>
        </div>
      </div>

      {/* Quick Presets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
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
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', opacity: 0.85 }}>{p.level.toFixed(2)}m</div>
            </button>
          );
        })}
      </div>

      {/* Safety Alert Banners */}
      {isCrestReference && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 6, padding: '6px 10px', fontSize: 10, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} color="#ef4444" style={{ flexShrink: 0 }} />
          <span><strong>Structural Reference Limit:</strong> 41.00m is the physical earthen dam crest elevation. Water cannot safely exceed spillway crest (38.25m).</span>
        </div>
      )}
      {isAboveSpillway && !isCrestReference && (
        <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: 6, padding: '6px 10px', fontSize: 10, color: '#fcd34d', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Info size={14} color="#f59e0b" style={{ flexShrink: 0 }} />
          <span><strong>Spillway Overflow Condition:</strong> Water is above crest (38.25m). Uncontrolled discharge via ungated chute spillway.</span>
        </div>
      )}

      {/* Live Inundation & Volume readout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'rgba(15, 23, 42, 0.6)', padding: '10px 12px', borderRadius: 8, fontSize: 11 }}>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Flooded Basin Area: </span>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#ffffff', marginTop: 2 }}>
            {submergedAreaHa.toFixed(2)} ha
          </div>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Stored Water Volume: </span>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--accent-cyan)', marginTop: 2 }}>
            {submergedVolumeMCM.toFixed(3)} MCM
            <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 4 }}>({(submergedVolumeMCM * 100).toFixed(1)} Hamts)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
