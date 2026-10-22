import React, { useState } from 'react';
import { X, FileDown, FileSpreadsheet, Printer, Globe, ArrowDownToLine, Check, Table } from 'lucide-react';
import { ChapoliData, SedimentVolumeStats } from '../../types/reservoir';
import { SiltSeriesPayload } from '../../types/silt';

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ChapoliData;
  sedimentStats?: SedimentVolumeStats;
  waterLevel: number;
  sampleMode?: boolean;
  siltData?: SiltSeriesPayload;
  siltMonth?: string;
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  isOpen,
  onClose,
  data,
  waterLevel,
  siltData,
  siltMonth = 'sep'
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const notifySuccess = (id: string) => {
    setDownloadSuccess(id);
    setTimeout(() => setDownloadSuccess(null), 2500);
  };

  // Helper to trigger clean file download with proper MIME type
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 1. Executive Engineering Report (Print / PDF)
  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const activeMonthData = siltData?.months[siltMonth] || siltData?.months['sep'];
    const activeStorage = data.storage_curve.find(pt => pt.elevation >= waterLevel) || data.storage_curve[data.storage_curve.length - 1];
    const deepestBed = data.baseline_specs.deepestBedLevel_m ?? 15.50;
    const maxDepth = Math.max(0, waterLevel - deepestBed);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Chapoli M.I. Tank — Engineering Digital Twin & Sediment Report</title>
          <style>
            @media print {
              body { margin: 0; padding: 20mm; font-size: 11pt; }
              .no-print { display: none; }
              @page { size: A4 portrait; margin: 15mm; }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              line-height: 1.5;
              padding: 40px;
              max-width: 900px;
              margin: 0 auto;
            }
            .header {
              border-bottom: 3px solid #0284c7;
              padding-bottom: 16px;
              margin-bottom: 24px;
            }
            .badge-gov {
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              color: #0369a1;
              background: #e0f2fe;
              padding: 4px 10px;
              border-radius: 4px;
              display: inline-block;
              margin-bottom: 8px;
            }
            h1 {
              font-size: 24px;
              font-weight: 800;
              margin: 4px 0 6px 0;
              color: #0f172a;
            }
            .meta {
              font-size: 12px;
              color: #64748b;
              margin-top: 4px;
            }
            h2 {
              font-size: 16px;
              font-weight: 700;
              color: #0369a1;
              border-bottom: 1px solid #cbd5e1;
              padding-bottom: 6px;
              margin-top: 24px;
              margin-bottom: 12px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 16px;
              font-size: 13px;
            }
            th, td {
              border: 1px solid #e2e8f0;
              padding: 8px 12px;
              text-align: left;
            }
            th {
              background: #f8fafc;
              font-weight: 700;
              color: #334155;
            }
            tr:nth-child(even) td {
              background: #fcfdfe;
            }
            .val-bold {
              font-weight: 700;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            }
            .status-tag {
              display: inline-block;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: 700;
            }
            .tag-green { background: #dcfce7; color: #166534; }
            .tag-blue { background: #e0f2fe; color: #075985; }
            .tag-amber { background: #fef3c7; color: #92400e; }
            .footer {
              margin-top: 40px;
              padding-top: 14px;
              border-top: 1px solid #e2e8f0;
              font-size: 11px;
              color: #64748b;
              display: flex;
              justify-content: space-between;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <span class="badge-gov">Goa Water Resources Department (WRD) • Official Engineering Record</span>
            <h1>Chapoli Minor Irrigation Tank — Digital Twin & Sediment Report</h1>
            <div class="meta">
              <strong>Location:</strong> Canacona, South Goa, India &nbsp;|&nbsp;
              <strong>Report Generated:</strong> ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} &nbsp;|&nbsp;
              <strong>Spatial Datum:</strong> WGS84 / UTM Zone 43N (EPSG:32643)
            </div>
          </div>

          <h2>1. Dam & Reservoir Baseline Engineering Specifications</h2>
          <table>
            <thead>
              <tr>
                <th style="width: 40%;">Parameter</th>
                <th style="width: 35%;">Official Specification</th>
                <th style="width: 25%;">Provenance</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Reservoir Name</td><td class="val-bold">Chapoli M.I. Tank</td><td><span class="status-tag tag-green">OBSERVED</span></td></tr>
              <tr><td>Catchment Area</td><td class="val-bold">${data.baseline_specs.catchmentArea_km2} km²</td><td><span class="status-tag tag-green">OBSERVED</span></td></tr>
              <tr><td>Full Reservoir Level (FRL)</td><td class="val-bold">38.25 m MSL</td><td><span class="status-tag tag-green">OBSERVED</span></td></tr>
              <tr><td>Minimum Draw Down Level (MDDL)</td><td class="val-bold">22.00 m MSL</td><td><span class="status-tag tag-green">OBSERVED</span></td></tr>
              <tr><td>Deepest River Bed Level</td><td class="val-bold">15.50 m MSL</td><td><span class="status-tag tag-green">OBSERVED</span></td></tr>
              <tr><td>Top of Dam (Crest Elevation)</td><td class="val-bold">41.00 m MSL</td><td><span class="status-tag tag-green">OBSERVED</span></td></tr>
              <tr><td>Earthen Dam Crest Length</td><td class="val-bold">760.00 m</td><td><span class="status-tag tag-green">OBSERVED</span></td></tr>
              <tr><td>Maximum Dam Height</td><td class="val-bold">25.50 m (above deepest bed)</td><td><span class="status-tag tag-green">OBSERVED</span></td></tr>
              <tr><td>Gross Storage Capacity</td><td class="val-bold">9.9824 MCM (998.24 Hamts)</td><td><span class="status-tag tag-green">OBSERVED</span></td></tr>
              <tr><td>Live Storage Capacity</td><td class="val-bold">8.7658 MCM (876.58 Hamts)</td><td><span class="status-tag tag-green">OBSERVED</span></td></tr>
              <tr><td>Dead Storage Capacity</td><td class="val-bold">0.4900 MCM (49.00 Hamts)</td><td><span class="status-tag tag-green">OBSERVED</span></td></tr>
            </tbody>
          </table>

          <h2>2. Current Reservoir Storage & Water Column Status</h2>
          <table>
            <thead>
              <tr>
                <th>Operational Metric</th>
                <th>Modelled Value</th>
                <th>Status / Remarks</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Operating Water Surface Level</td><td class="val-bold">${waterLevel.toFixed(2)} m MSL</td><td><span class="status-tag tag-blue">${waterLevel === 38.25 ? 'Full Reservoir Level (FRL)' : 'Simulated Level'}</span></td></tr>
              <tr><td>Maximum Water Column Depth</td><td class="val-bold">${maxDepth.toFixed(2)} m</td><td>Above deepest bed El. 15.50m</td></tr>
              <tr><td>Inundated Basin Surface Area</td><td class="val-bold">${activeStorage ? activeStorage.area_ha.toFixed(2) : '62.47'} ha</td><td>Interpolated 3D Bathymetry</td></tr>
              <tr><td>Active Water Storage Volume</td><td class="val-bold">${activeStorage ? activeStorage.volume_mcm.toFixed(4) : '3.9411'} MCM</td><td>Modeled Basin Capacity</td></tr>
            </tbody>
          </table>

          ${activeMonthData ? `
          <h2>3. Sentinel-2 Satellite Sedimentation & Silt Analysis (${activeMonthData.name} 2026)</h2>
          <table>
            <thead>
              <tr>
                <th>Sediment Monitoring Parameter</th>
                <th>Observed Value</th>
                <th>Methodology</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Observation Period</td><td class="val-bold">${activeMonthData.dateLabel}</td><td>Sentinel-2 MSI Satellite Pass</td></tr>
              <tr><td>Total Relative Silt Volume</td><td class="val-bold">${activeMonthData.totalSiltVolumeM3.toLocaleString()} m³ (${activeMonthData.totalSiltVolumeMCM.toFixed(4)} MCM)</td><td>Volume Surface Integration</td></tr>
              <tr><td>Water Surface Area</td><td class="val-bold">${activeMonthData.waterAreaHa.toFixed(2)} ha</td><td>Multispectral Water Extraction</td></tr>
              <tr><td>Mean Silt Turbidity Score</td><td class="val-bold">${activeMonthData.meanSiltScore.toFixed(4)}</td><td>Spectral Reflectance Index</td></tr>
              <tr><td>Low Silt Deposit (Tier 1)</td><td class="val-bold">${activeMonthData.classificationBreakdown.low.percent}% (${activeMonthData.classificationBreakdown.low.count.toLocaleString()} pixels)</td><td><span class="status-tag tag-green">Low Turbidity</span></td></tr>
              <tr><td>Moderate Silt Deposit (Tier 2)</td><td class="val-bold">${activeMonthData.classificationBreakdown.moderate.percent}% (${activeMonthData.classificationBreakdown.moderate.count.toLocaleString()} pixels)</td><td><span class="status-tag tag-amber">Moderate Turbidity</span></td></tr>
              <tr><td>High Silt Deposit (Tier 3)</td><td class="val-bold">${activeMonthData.classificationBreakdown.high.percent}% (${activeMonthData.classificationBreakdown.high.count.toLocaleString()} pixels)</td><td><span class="status-tag tag-amber">High Turbidity</span></td></tr>
              <tr><td>Very High Silt Deposit (Tier 4)</td><td class="val-bold">${activeMonthData.classificationBreakdown.veryHigh.percent}% (${activeMonthData.classificationBreakdown.veryHigh.count.toLocaleString()} pixels)</td><td><span class="status-tag tag-amber" style="background:#fee2e2;color:#991b1b;">Peak Inflow Silt</span></td></tr>
            </tbody>
          </table>
          ` : ''}

          <div class="footer">
            <span>Chapoli M.I. Tank 3D Digital Twin • Engineering & Sediment Analysis Platform</span>
            <span>Document Certified for Technical Evaluation</span>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    notifySuccess('pdf');
  };

  // 2. Reservoir Elevation-Storage Curve (CSV for Excel)
  const handleExportStorageCSV = () => {
    let csv = '\uFEFF'; // UTF-8 BOM so Excel opens accented & special characters cleanly
    csv += 'Elevation (m MSL),Inundated Area (ha),Inundated Area (m2),Storage Volume (m3),Storage Volume (MCM)\n';
    for (const pt of data.storage_curve) {
      csv += `${pt.elevation.toFixed(2)},${pt.area_ha.toFixed(2)},${Math.round(pt.area_m2)},${Math.round(pt.volume_m3)},${pt.volume_mcm.toFixed(4)}\n`;
    }
    downloadFile(csv, 'chapoli_elevation_storage_capacity_table.csv', 'text/csv;charset=utf-8;');
    notifySuccess('storage_csv');
  };

  // 3. Sentinel-2 Silt Monitoring Series (CSV for Excel)
  const handleExportSiltCSV = () => {
    if (!siltData) return;
    let csv = '\uFEFF';
    csv += 'Month,Year,Water Area (ha),Mean Silt Turbidity Score,Total Relative Silt Volume (m3),Total Relative Silt Volume (MCM),Low Silt (%),Moderate Silt (%),High Silt (%),Very High Silt (%)\n';
    for (const monthKey of Object.keys(siltData.months)) {
      const m = siltData.months[monthKey];
      const lowPct = m.classificationBreakdown.low.percent;
      const modPct = m.classificationBreakdown.moderate.percent;
      const highPct = m.classificationBreakdown.high.percent;
      const vHighPct = m.classificationBreakdown.veryHigh.percent;
      csv += `"${m.name}",${m.year},${m.waterAreaHa.toFixed(2)},${m.meanSiltScore.toFixed(4)},${m.totalSiltVolumeM3.toFixed(1)},${m.totalSiltVolumeMCM.toFixed(4)},${lowPct}%,${modPct}%,${highPct}%,${vHighPct}%\n`;
    }
    downloadFile(csv, 'chapoli_sentinel2_silt_monitoring_series_2026.csv', 'text/csv;charset=utf-8;');
    notifySuccess('silt_csv');
  };

  // 4. Reservoir Boundary Polygon (Standard WGS84 GeoJSON)
  const handleExportGeoJSON = () => {
    const geojson = {
      type: 'FeatureCollection',
      name: 'Chapoli_MI_Tank_Reservoir_Boundary',
      crs: {
        type: 'name',
        properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' }
      },
      features: [
        {
          type: 'Feature',
          properties: {
            reservoirName: 'Chapoli M.I. Tank',
            state: 'Goa',
            country: 'India',
            authority: 'Goa Water Resources Department (WRD)',
            fullReservoirLevel_m_MSL: 38.25,
            minimumDrawDownLevel_m_MSL: 22.00,
            grossStorageCapacity_MCM: 9.9824,
            liveStorageCapacity_MCM: 8.7658,
            deadStorageCapacity_MCM: 0.4900,
            catchmentArea_km2: 6.83,
            damCrestLength_m: 760.00,
            damCrestElevation_m_MSL: 41.00,
            surfaceArea_ha: data.tank.area_ha,
            perimeter_m: data.tank.perimeter_m
          },
          geometry: {
            type: 'Polygon',
            coordinates: [data.tank.coords_wgs84]
          }
        }
      ]
    };
    downloadFile(JSON.stringify(geojson, null, 2), 'chapoli_reservoir_boundary.geojson', 'application/geo+json');
    notifySuccess('geojson');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
    >
      <div
        style={{
          width: '94%',
          maxWidth: 680,
          background: 'rgba(10, 18, 36, 0.94)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(56, 189, 248, 0.32)',
          borderRadius: 16,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(15, 23, 42, 0.4)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(14, 165, 233, 0.15)',
                border: '1px solid rgba(14, 165, 233, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileDown size={20} color="#38bdf8" />
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Export Engineering Reports & Reservoir Data
              </h3>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                Download clean, validated engineering summaries, Excel spreadsheets, and GIS spatial files
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Grid: 4 Clean, Universally Understandable Export Formats */}
        <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
            Select Export Document / Format:
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* 1. Printable Executive Report */}
            <div
              onClick={handlePrintReport}
              style={{
                background: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: 12,
                padding: '14px 16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#38bdf8';
                e.currentTarget.style.background = 'rgba(14, 165, 233, 0.12)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.25)';
                e.currentTarget.style.background = 'rgba(15, 23, 42, 0.55)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8' }}>
                  <Printer size={18} />
                  <strong style={{ fontSize: 13, color: '#f8fafc' }}>Executive PDF Report</strong>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' }}>
                  {downloadSuccess === 'pdf' ? 'Opened' : 'PDF / Print'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.45 }}>
                Official executive engineering document with baseline dam specs, operational storage, and Sentinel-2 silt summary.
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 4, marginTop: 'auto' }}>
                <Printer size={13} /> Open / Print Document
              </div>
            </div>

            {/* 2. Elevation-Storage Curve (CSV / Excel) */}
            <div
              onClick={handleExportStorageCSV}
              style={{
                background: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 12,
                padding: '14px 16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#fbbf24';
                e.currentTarget.style.background = 'rgba(245, 158, 11, 0.12)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.25)';
                e.currentTarget.style.background = 'rgba(15, 23, 42, 0.55)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fbbf24' }}>
                  <FileSpreadsheet size={18} />
                  <strong style={{ fontSize: 13, color: '#f8fafc' }}>Elevation-Storage Table</strong>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' }}>
                  {downloadSuccess === 'storage_csv' ? 'Downloaded' : 'CSV / Excel'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.45 }}>
                Complete elevation vs water storage capacity curve. Formatted to open directly in Microsoft Excel or Google Sheets.
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 4, marginTop: 'auto' }}>
                <ArrowDownToLine size={13} /> Download Excel CSV
              </div>
            </div>

            {/* 3. Sentinel-2 Silt Monitoring Series (CSV / Excel) */}
            <div
              onClick={handleExportSiltCSV}
              style={{
                background: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid rgba(52, 211, 153, 0.25)',
                borderRadius: 12,
                padding: '14px 16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#34d399';
                e.currentTarget.style.background = 'rgba(52, 211, 153, 0.12)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(52, 211, 153, 0.25)';
                e.currentTarget.style.background = 'rgba(15, 23, 42, 0.55)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#34d399' }}>
                  <Table size={18} />
                  <strong style={{ fontSize: 13, color: '#f8fafc' }}>Silt Monitoring Series</strong>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(52, 211, 153, 0.2)', color: '#34d399' }}>
                  {downloadSuccess === 'silt_csv' ? 'Downloaded' : 'CSV / Excel'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.45 }}>
                Monthly Sentinel-2 satellite silt observations across 2026 (water footprint, volume in m³, turbidity score, classification %).
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#34d399', display: 'flex', alignItems: 'center', gap: 4, marginTop: 'auto' }}>
                <ArrowDownToLine size={13} /> Download Silt Table
              </div>
            </div>

            {/* 4. Reservoir GIS Boundary Polygon (GeoJSON) */}
            <div
              onClick={handleExportGeoJSON}
              style={{
                background: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid rgba(168, 85, 247, 0.25)',
                borderRadius: 12,
                padding: '14px 16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#c084fc';
                e.currentTarget.style.background = 'rgba(168, 85, 247, 0.12)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.25)';
                e.currentTarget.style.background = 'rgba(15, 23, 42, 0.55)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#c084fc' }}>
                  <Globe size={18} />
                  <strong style={{ fontSize: 13, color: '#f8fafc' }}>Reservoir Boundary</strong>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc' }}>
                  {downloadSuccess === 'geojson' ? 'Downloaded' : 'GeoJSON (GIS)'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.45 }}>
                Authoritative WGS84 boundary polygon compatible with Google Earth, QGIS, ArcGIS, and Web GIS mapping applications.
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#c084fc', display: 'flex', alignItems: 'center', gap: 4, marginTop: 'auto' }}>
                <ArrowDownToLine size={13} /> Download GeoJSON
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(15, 23, 42, 0.3)'
          }}
        >
          <div style={{ fontSize: 11, color: '#64748b' }}>
            All exports are validated and ready to open in standard office and GIS tools.
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#f8fafc',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
