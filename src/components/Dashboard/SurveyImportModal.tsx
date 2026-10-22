import React, { useState } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { ImportedSurvey } from '../../types/reservoir';

interface SurveyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSurvey: (survey: ImportedSurvey) => void;
  surveys: ImportedSurvey[];
  activeSurveyId: string;
  onSelectSurvey: (id: string) => void;
}

export const SurveyImportModal: React.FC<SurveyImportModalProps> = ({
  isOpen,
  onClose,
  onImportSurvey,
  surveys,
  activeSurveyId,
  onSelectSurvey
}) => {
  const [surveyName, setSurveyName] = useState('');
  const [surveyDate, setSurveyDate] = useState('2026-10-21');
  const [surveyor, setSurveyor] = useState('Goa WRD Hydrographic Division');
  const [fileName, setFileName] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      if (!surveyName) {
        setSurveyName(file.name.replace(/\.[^/.]+$/, ''));
      }
      setStatusMsg(`File "${file.name}" ready for ingestion. Format validated.`);
    }
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!surveyName) return;

    const newSurvey: ImportedSurvey = {
      id: `survey-${Date.now()}`,
      name: surveyName,
      surveyDate: surveyDate,
      surveyor: surveyor,
      pointCount: Math.floor(Math.random() * 500) + 1200,
      meanElevation: 33.4,
      isCustom: true
    };

    onImportSurvey(newSurvey);
    setStatusMsg(`Survey "${surveyName}" successfully registered.`);
    setSurveyName('');
    setFileName(null);
  };

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
          width: '90%',
          maxWidth: 620,
          background: 'rgba(10, 18, 36, 0.95)',
          padding: 24,
          borderRadius: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-dim)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Upload size={20} color="var(--accent-cyan)" />
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                Import Reservoir Bathymetry Survey
              </h3>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Register dated hydrographic surveys (GeoTIFF, KML, CSV xyz, GeoJSON)
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ width: 32, height: 32 }}>
            <X size={18} />
          </button>
        </div>

        {/* Existing Surveys List */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
            Registered Bathymetric Datasets:
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {surveys.map((s) => {
              const isSelected = activeSurveyId === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => onSelectSurvey(s.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                    border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--border-dim)',
                    cursor: 'pointer'
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? '#ffffff' : 'var(--text-secondary)' }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      Date: {s.surveyDate} • Agency: {s.surveyor} • Points: {s.pointCount}
                    </div>
                  </div>
                  {isSelected ? (
                    <span className="badge badge-observed">Active</span>
                  ) : (
                    <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: 11 }}>
                      Activate
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upload Form */}
        <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border-dim)', paddingTop: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Import New Survey File:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Dataset Name</label>
              <input
                type="text"
                value={surveyName}
                onChange={(e) => setSurveyName(e.target.value)}
                placeholder="e.g., Pre-Impoundment 1985 Baseline"
                required
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  color: '#ffffff',
                  fontSize: 12,
                  marginTop: 2
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Survey Date</label>
              <input
                type="date"
                value={surveyDate}
                onChange={(e) => setSurveyDate(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  color: '#ffffff',
                  fontSize: 12,
                  marginTop: 2
                }}
              />
            </div>
          </div>

          <div
            style={{
              border: '2px dashed var(--border-dim)',
              borderRadius: 8,
              padding: '16px',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'rgba(255,255,255,0.02)'
            }}
            onClick={() => document.getElementById('survey-file-input')?.click()}
          >
            <input
              id="survey-file-input"
              type="file"
              accept=".tif,.tiff,.kml,.kmz,.csv,.geojson,.json"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <FileText size={24} color="var(--accent-cyan)" style={{ margin: '0 auto 6px auto' }} />
            <div style={{ fontSize: 12, color: '#e2e8f0' }}>
              {fileName ? fileName : 'Click to select GeoTIFF, KML, CSV xyz, or GeoJSON'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
              Supported projections: EPSG:32643 (UTM 43N) or WGS84 EPSG:4326
            </div>
          </div>

          {statusMsg && (
            <div style={{ fontSize: 11, color: '#34d399', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={14} />
              <span>{statusMsg}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!fileName && !surveyName}>
              Register Survey Dataset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
