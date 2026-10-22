import React from 'react';
import { Compass } from 'lucide-react';

interface CompassWidgetProps {
  rotationY: number; // in radians
  onResetNorth: () => void;
}

export const CompassWidget: React.FC<CompassWidgetProps> = ({ rotationY, onResetNorth }) => {
  const deg = (-rotationY * 180) / Math.PI;

  return (
    <div
      onClick={onResetNorth}
      title="Click to Align View to True North"
      style={{
        position: 'absolute',
        top: 20,
        right: 20,
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: 'rgba(10, 18, 36, 0.85)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 50,
        userSelect: 'none',
        backdropFilter: 'blur(8px)',
        transition: 'transform 0.15s ease, border-color 0.15s ease'
      }}
      className="hover:scale-105"
    >
      <div
        style={{
          transform: `rotate(${deg}deg)`,
          transition: 'transform 0.05s linear',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        <div style={{ color: '#f43f5e', fontSize: 10, fontWeight: 800, lineHeight: 1 }}>N</div>
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderBottom: '10px solid #f43f5e'
          }}
        />
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderTop: '10px solid #94a3b8'
          }}
        />
      </div>
    </div>
  );
};
