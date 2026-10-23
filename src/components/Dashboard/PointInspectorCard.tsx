import React from 'react';
import { MapPin, X, ArrowDown, ShieldCheck, AlertCircle } from 'lucide-react';
import { InspectionResult } from '../../types/reservoir';
import { GeoTransform } from '../../utils/coordinates';

interface PointInspectorCardProps {
  inspection: InspectionResult;
  onClose: () => void;
}

export const PointInspectorCard: React.FC<PointInspectorCardProps> = ({ inspection, onClose }) => {
  const latDd = GeoTransform.toDD(inspection.lat, true);
  const lonDd = GeoTransform.toDD(inspection.lon, false);

  return (
    <div
      className="glass-panel"
      style={{
        position: 'absolute',
        bottom: 24,
        left: 24,
        width: 340,
        padding: 16,
        zIndex: 50,
        boxShadow: 'var(--shadow-lg)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-dim)', paddingBottom: 8, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={16} color="var(--accent-cyan)" />
          <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Point Inspection & Bed Measurement
          </h4>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
        >
          <X size={15} />
        </button>
      </div>

      {/* Coordinates */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
          <span style={{ color: 'var(--text-secondary)' }}>GPS Location (decimal degrees):</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#f8fafc' }}>
            {latDd}, {lonDd}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Map Grid (UTM 43N):</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            E {inspection.easting.toLocaleString()} m, N {inspection.northing.toLocaleString()} m
          </span>
        </div>

        {/* Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Hydrological Status:</span>
          {inspection.waterDepth !== null && inspection.waterDepth > 0 ? (
            <span style={{ 
              fontSize: 10, 
              fontWeight: 700, 
              padding: '2px 8px', 
              borderRadius: 4, 
              background: 'rgba(2, 132, 199, 0.25)', 
              color: '#38bdf8', 
              border: '1px solid rgba(2, 132, 199, 0.5)',
              letterSpacing: '0.04em'
            }}>
              SUBMERGED BASIN
            </span>
          ) : (
            <span style={{ 
              fontSize: 10, 
              fontWeight: 700, 
              padding: '2px 8px', 
              borderRadius: 4, 
              background: 'rgba(100, 116, 139, 0.2)', 
              color: '#94a3b8', 
              border: '1px solid rgba(100, 116, 139, 0.4)',
              letterSpacing: '0.04em'
            }}>
              DRY GROUND
            </span>
          )}
        </div>

        {/* Elevations */}
        <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: 8, padding: 10, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              {inspection.waterDepth && inspection.waterDepth > 0 ? 'DTM Bed Elevation:' : 'Ground Surface Elevation:'}
            </span>
            <strong style={{ fontFamily: 'var(--font-mono)', color: inspection.elevation !== null ? 'var(--accent-cyan)' : '#f43f5e' }}>
              {inspection.elevation !== null ? `${inspection.elevation.toFixed(2)} m MSL` : 'NoData / Void'}
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Operating Water Level:</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8', fontWeight: 600 }}>
              {inspection.waterLevel.toFixed(2)} m MSL
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              title={inspection.waterDepthSource === 'satellite-relative'
                ? 'Updated Sentinel-2 relative depth estimate at this point'
                : 'Operating water level minus the inspected bed elevation'}
              style={{ color: 'var(--text-secondary)' }}
            >
              {inspection.waterDepthSource === 'satellite-relative' ? 'Satellite Relative Depth:' : 'Water Column Depth:'}
            </span>
            <strong style={{ fontFamily: 'var(--font-mono)', color: inspection.waterDepth !== null && inspection.waterDepth > 0 ? '#38bdf8' : 'var(--text-muted)' }}>
              {inspection.waterDepth !== null && inspection.waterDepth > 0 ? `${inspection.waterDepth.toFixed(2)} m` : '0.00 m (Above Waterline)'}
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Pre-Impoundment Bed:</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: inspection.originalBedElev !== null ? '#f59e0b' : 'var(--text-muted)' }}>
              {inspection.originalBedElev !== null 
                ? `${inspection.originalBedElev.toFixed(2)} m MSL` 
                : (inspection.waterDepth && inspection.waterDepth > 0 ? 'UNAVAILABLE' : 'N/A (Dry Ground)')}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Sediment Thickness:</span>
            <strong style={{ fontFamily: 'var(--font-mono)', color: inspection.sedimentThickness !== null ? '#f59e0b' : 'var(--text-muted)' }}>
              {inspection.sedimentThickness !== null 
                ? `${inspection.sedimentThickness.toFixed(2)} m` 
                : (inspection.waterDepth && inspection.waterDepth > 0 ? 'UNAVAILABLE' : '0.00 m (Dry Ground)')}
            </strong>
          </div>
        </div>

        {/* Sentinel-2 Silt Classification & Observed Silt Layer */}
        {inspection.siltClass && (
          <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase' }}>
                Sentinel-2 Silt ({inspection.siltMonthName || '2026'}):
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: inspection.siltClassColor || '#f59e0b', color: '#000000' }}>
                {inspection.siltClass}
              </span>
            </div>
            {inspection.siltVolumeScore !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Pixel Volume Score:</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: '#fbbf24' }}>
                  {inspection.siltVolumeScore.toFixed(1)} m³ / 100m²
                </strong>
              </div>
            )}
            {inspection.siltThicknessM !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Estimated Silt Layer:</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                  {inspection.siltThicknessM.toFixed(2)} m
                </strong>
              </div>
            )}
          </div>
        )}

        {/* Quality status & note */}
        <div style={{ marginTop: 6, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--text-muted)' }}>Provenance:</span>
            <span className={`badge badge-${inspection.provenance.toLowerCase()}`}>
              {inspection.provenance}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.3 }}>
            {inspection.qualityNote}
          </div>
        </div>
      </div>
    </div>
  );
};
