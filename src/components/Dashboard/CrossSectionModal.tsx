import React, { useEffect, useRef, useState } from 'react';
import { X, Layers, Download, Check } from 'lucide-react';
import { CrossSectionPoint } from '../../types/reservoir';
import { SedimentAnalysisEngine } from '../../utils/sedimentAnalysis';

interface CrossSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: SedimentAnalysisEngine;
  waterLevel: number;
  sampleMode: boolean;
  transectPoints: { start: [number, number]; end: [number, number] };
  onSelectPreset: (start: [number, number], end: [number, number], name: string) => void;
  activePresetName: string;
}

export const CrossSectionModal: React.FC<CrossSectionModalProps> = ({
  isOpen,
  onClose,
  engine,
  waterLevel,
  sampleMode,
  transectPoints,
  onSelectPreset,
  activePresetName
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<CrossSectionPoint[]>([]);

  const presets = [
    {
      name: 'Longitudinal Thalweg (Inflow to Dam)',
      start: [0, -450] as [number, number], // North Inflow
      end: [0, 400] as [number, number]     // South Dam
    },
    {
      name: 'Transverse Mid-Reservoir (West to East)',
      start: [-350, 0] as [number, number], // West Bank
      end: [350, 0] as [number, number]     // East Bank
    },
    {
      name: 'Spillway & Outlet Transect',
      start: [-200, 300] as [number, number],
      end: [250, 200] as [number, number]
    }
  ];

  // Re-generate cross-section data when inputs change
  useEffect(() => {
    if (!isOpen) return;
    const pts = engine.generateCrossSection(
      transectPoints.start,
      transectPoints.end,
      waterLevel,
      sampleMode,
      120
    );
    setPoints(pts);
  }, [isOpen, transectPoints, waterLevel, sampleMode, engine]);

  // Render 2D Engineering Profile onto Canvas
  useEffect(() => {
    if (!isOpen || !canvasRef.current || points.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Padding for axes
    const padLeft = 60;
    const padRight = 30;
    const padTop = 40;
    const padBottom = 50;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Determine min/max distance & elevation
    const maxDist = points[points.length - 1].distanceM || 1;
    let minElev = 20; // Include MDDL (22m)
    let maxElev = 55; // Up to surrounding hills

    // Scales
    const scaleX = (dist: number) => padLeft + (dist / maxDist) * plotW;
    const scaleY = (elev: number) => padTop + plotH - ((elev - minElev) / (maxElev - minElev)) * plotH;

    // Draw Grid & Axes
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';

    // Horizontal elevation grid lines every 5m
    for (let el = minElev; el <= maxElev; el += 5) {
      const y = scaleY(el);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();
      ctx.fillText(`${el}m`, padLeft - 8, y + 4);
    }

    // Vertical distance grid lines every 100m or 200m
    const distStep = maxDist > 1000 ? 200 : 100;
    ctx.textAlign = 'center';
    for (let d = 0; d <= maxDist; d += distStep) {
      const x = scaleX(d);
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, height - padBottom);
      ctx.stroke();
      ctx.fillText(`${d}m`, x, height - padBottom + 16);
    }

    // 1. Draw Water Surface fill and line
    const waterY = scaleY(waterLevel);
    // Find submerged segment
    ctx.fillStyle = 'rgba(14, 165, 233, 0.2)';
    ctx.beginPath();
    let inWater = false;
    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const x = scaleX(pt.distanceM);
      const bedY = pt.presentBed !== null ? scaleY(pt.presentBed) : null;

      if (bedY !== null && pt.presentBed! < waterLevel) {
        if (!inWater) {
          ctx.moveTo(x, waterY);
          inWater = true;
        }
        ctx.lineTo(x, bedY);
      } else if (inWater) {
        ctx.lineTo(scaleX(points[i - 1].distanceM), waterY);
        inWater = false;
      }
    }
    if (inWater) {
      ctx.lineTo(scaleX(points[points.length - 1].distanceM), waterY);
    }
    ctx.closePath();
    ctx.fill();

    // Water level dashed line
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(padLeft, waterY);
    ctx.lineTo(width - padRight, waterY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'left';
    ctx.fillText(`Water Surface: ${waterLevel.toFixed(2)}m MSL`, padLeft + 10, waterY - 6);

    // 2. Draw Sediment Hatch / Fill if available
    if (sampleMode) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
      ctx.beginPath();
      let inSed = false;
      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        if (pt.originalBed !== null && pt.presentBed !== null && pt.presentBed > pt.originalBed) {
          const x = scaleX(pt.distanceM);
          const origY = scaleY(pt.originalBed);
          if (!inSed) {
            ctx.moveTo(x, origY);
            inSed = true;
          } else {
            ctx.lineTo(x, origY);
          }
        }
      }
      for (let i = points.length - 1; i >= 0; i--) {
        const pt = points[i];
        if (pt.originalBed !== null && pt.presentBed !== null && pt.presentBed > pt.originalBed) {
          const x = scaleX(pt.distanceM);
          const presY = scaleY(pt.presentBed);
          ctx.lineTo(x, presY);
        }
      }
      ctx.closePath();
      ctx.fill();
    }

    // 3. Draw Original Bed Profile Line
    if (sampleMode) {
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      for (const pt of points) {
        if (pt.originalBed !== null) {
          const x = scaleX(pt.distanceM);
          const y = scaleY(pt.originalBed);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
    }

    // 4. Draw Current Bed Profile Line
    ctx.strokeStyle = '#34d399'; // Emerald present bed
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let startedBed = false;
    for (const pt of points) {
      if (pt.presentBed !== null) {
        const x = scaleX(pt.distanceM);
        const y = scaleY(pt.presentBed);
        if (!startedBed) {
          ctx.moveTo(x, y);
          startedBed = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
    }
    ctx.stroke();

    // 5. Highlight Survey Sample Points
    for (const pt of points) {
      if (pt.isSurveyed && pt.presentBed !== null) {
        const x = scaleX(pt.distanceM);
        const y = scaleY(pt.presentBed);
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Axis Labels
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Distance Along Transect (Meters)', padLeft + plotW / 2, height - 12);

    ctx.save();
    ctx.translate(16, padTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Elevation (m MSL)', 0, 0);
    ctx.restore();

  }, [isOpen, points, waterLevel, sampleMode]);

  if (!isOpen) return null;

  const validThicknesses = points.map(p => p.sedimentThickness).filter((t): t is number => t !== null && t > 0);
  const maxThickness = validThicknesses.length > 0 ? Math.max(...validThicknesses) : 0;
  const avgThickness = validThicknesses.length > 0 ? validThicknesses.reduce((a, b) => a + b, 0) / validThicknesses.length : 0;

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
    >
      <div
        className="glass-panel"
        style={{
          width: '92%',
          maxWidth: 1050,
          background: 'rgba(10, 18, 36, 0.95)',
          padding: 24,
          borderRadius: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-dim)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Layers size={20} color="var(--accent-cyan)" />
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                Cross-Section Transect Analysis
              </h3>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Synchronized 2D engineering profile with real terrain elevation and sediment strata
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon"
            style={{ width: 32, height: 32 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Transect Preset Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Transects:</span>
          {presets.map((p) => {
            const isSelected = activePresetName === p.name;
            return (
              <button
                key={p.name}
                onClick={() => onSelectPreset(p.start, p.end, p.name)}
                className={isSelected ? 'btn-primary' : 'btn-secondary'}
                style={{ fontSize: 11, padding: '5px 12px' }}
              >
                {isSelected && <Check size={12} />}
                {p.name}
              </button>
            );
          })}
          {activePresetName === 'Custom 3D Cut' && (
            <span className="badge badge-modelled">Custom 3D Cut Active</span>
          )}
        </div>

        {/* Profile Canvas */}
        <div style={{ background: 'rgba(6, 11, 23, 0.9)', borderRadius: 10, border: '1px solid var(--border-dim)', padding: 10, position: 'relative' }}>
          <canvas
            ref={canvasRef}
            width={980}
            height={380}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />

          {/* Legend */}
          <div style={{ position: 'absolute', top: 18, right: 24, display: 'flex', gap: 14, fontSize: 10, background: 'rgba(10, 18, 36, 0.85)', padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-dim)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 14, height: 3, background: '#34d399' }} />
              <span>Present Bed (Surveyed)</span>
            </div>
            {sampleMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 14, height: 3, background: '#d97706' }} />
                <span>Original Bed (Pre-impoundment)</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 14, height: 2, borderTop: '2px dashed #38bdf8' }} />
              <span>Water Level ({waterLevel.toFixed(1)}m)</span>
            </div>
          </div>
        </div>

        {/* Transect Statistics Footer */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, background: 'rgba(15, 23, 42, 0.6)', padding: 12, borderRadius: 8, fontSize: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Transect Total Length</div>
            <strong style={{ fontFamily: 'var(--font-mono)', color: '#ffffff' }}>
              {points.length > 0 ? points[points.length - 1].distanceM : 0} m
            </strong>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Sample Points</div>
            <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
              {points.length} nodes
            </strong>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Max Sediment Depth along Cut</div>
            <strong style={{ fontFamily: 'var(--font-mono)', color: sampleMode ? '#f59e0b' : 'var(--text-muted)' }}>
              {sampleMode ? `${maxThickness.toFixed(2)} m` : 'UNAVAILABLE'}
            </strong>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Mean Sediment Depth</div>
            <strong style={{ fontFamily: 'var(--font-mono)', color: sampleMode ? '#f59e0b' : 'var(--text-muted)' }}>
              {sampleMode ? `${avgThickness.toFixed(2)} m` : 'UNAVAILABLE'}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
};
