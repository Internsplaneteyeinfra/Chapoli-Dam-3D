import React from 'react';

interface ScaleBarProps {
  cameraDistance: number;
}

export const ScaleBar: React.FC<ScaleBarProps> = ({ cameraDistance }) => {
  // Approximate metric scale based on perspective camera distance
  // At cameraDistance = 1500m, 100px is approximately 150m
  const scaleMeters = Math.max(50, Math.round((cameraDistance / 10) / 50) * 50);
  const barWidthPx = Math.min(140, Math.max(60, (scaleMeters / (cameraDistance / 10)) * 80));

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        right: 24,
        background: 'rgba(10, 18, 36, 0.8)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: 6,
        padding: '6px 12px',
        backdropFilter: 'blur(8px)',
        zIndex: 40,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3
      }}
    >
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
        {scaleMeters} m
      </div>
      <div
        style={{
          width: barWidthPx,
          height: 4,
          border: '1px solid #38bdf8',
          borderTop: 'none',
          display: 'flex'
        }}
      >
        <div style={{ flex: 1, borderRight: '1px solid #38bdf8' }} />
        <div style={{ flex: 1 }} />
      </div>
      <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
        EPSG:32643 Metric Scale (UTM 43N)
      </div>
    </div>
  );
};
