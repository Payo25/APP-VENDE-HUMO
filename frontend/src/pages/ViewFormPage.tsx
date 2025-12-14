import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SurgicalForm } from '../types/SurgicalForm';
import { formatDate } from '../utils/dateFormat';

const API_BASE_URL = '/api';
const API_URL = `${API_BASE_URL}/forms`;
const AUDIT_ACTION_URL = `${API_BASE_URL}/audit-action`;

const ViewFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<SurgicalForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_URL}/${id}`)
      .then(res => res.json())
      .then(data => {
        setForm(data);
        setLoading(false);
        // Audit log: view sensitive form
        fetch(AUDIT_ACTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actor: localStorage.getItem('user'),
            action: 'VIEW_FORM',
            details: { formId: id }
          })
        });
      })
      .catch(() => {
        setError('Failed to load form.');
        setLoading(false);
      });
  }, [id]);

  // Close lightbox on Escape key
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.2, 3));
      if (e.key === '-') setZoom(z => Math.max(z - 0.2, 0.5));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen]);

  // Reset zoom when closing lightbox
  useEffect(() => {
    if (!lightboxOpen) setZoom(1);
  }, [lightboxOpen]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff',
        padding: '2.5rem 2rem',
        borderRadius: '1rem',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        minWidth: 320,
        maxWidth: 600,
        width: '100%',
        textAlign: 'center',
      }}>
        <a
          href="/forms"
          style={{
            display: 'inline-block',
            marginBottom: 24,
            padding: '12px 0',
            background: 'linear-gradient(90deg, #667eea 0%, #5a67d8 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 16,
            fontWeight: 600,
            textDecoration: 'none',
            boxShadow: '0 2px 8px rgba(90,103,216,0.08)',
            transition: 'background 0.2s',
            width: '100%'
          }}
        >
          ← Back to Forms
        </a>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <img src={process.env.PUBLIC_URL + '/logo.jpg'} alt="App Logo" className="page-logo" />
        </div>
        <h2 style={{ color: '#2d3a4b', marginBottom: 16 }}>Surgical Form Details</h2>
        {loading && <p>Loading...</p>}
        {error && <p style={{ color: '#e74c3c' }}>{error}</p>}
        {form && (
          <div style={{ textAlign: 'left', maxWidth: 400, margin: '0 auto' }}>
            <p><b>Patient Name:</b> {form.patientName}</p>
            <p><b>Date of Birth:</b> {formatDate(form.dob)}</p>
            <p><b>Insurance Company:</b> {form.insuranceCompany}</p>
            <p><b>Health Center Name:</b> {form.healthCenterName}</p>
            <p><b>Surgery Date:</b> {formatDate(form.date)}</p>
            <p><b>Time In:</b> {form.timeIn}</p>
            <p><b>Time Out:</b> {form.timeOut}</p>
            <p><b>Doctor's Name:</b> {form.doctorName}</p>
            <p><b>Procedure:</b> {form.procedure}</p>
            <p><b>Assistant Type:</b> {form.assistantType || 'N/A'}</p>
            <p><b>Case Type:</b> {form.caseType}</p>
            <p><b>Status:</b> {form.status}</p>
            <p><b>Created By:</b> {form.createdByFullName || form.createdBy}</p>
            <p><b>Created By Email:</b> {form.createdByEmail || ''}</p>
            <p style={{ color: '#888', fontSize: 13 }}><b>Created At:</b> {form.createdAt ? new Date(form.createdAt).toLocaleString() : ''}</p>
            {form.lastModified && <p style={{ color: '#888', fontSize: 13 }}><b>Last Modified:</b> {new Date(form.lastModified).toLocaleString()}</p>}
            {form.surgeryFormFileUrl && (
              <div style={{ margin: '12px 0' }}>
                <b>Surgery Form Image:</b><br />
                <img
                  src={`${form.surgeryFormFileUrl}`}
                  alt="Surgery Form"
                  style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8, marginTop: 8, cursor: 'zoom-in' }}
                  onClick={() => setLightboxOpen(true)}
                  tabIndex={0}
                  aria-label="View surgery form image fullscreen"
                />
                {lightboxOpen && (
                  <div
                    onClick={() => setLightboxOpen(false)}
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      width: '100vw',
                      height: '100vh',
                      background: 'rgba(0,0,0,0.85)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 9999,
                      cursor: 'zoom-out',
                      flexDirection: 'column'
                    }}
                    aria-modal="true"
                    role="dialog"
                    tabIndex={-1}
                  >
                    <div style={{ position: 'relative', marginBottom: 24 }} onClick={e => e.stopPropagation()}>
                      <img
                        src={`${form.surgeryFormFileUrl}`}
                        alt="Surgery Form Fullscreen"
                        style={{
                          maxWidth: '90vw',
                          maxHeight: '90vh',
                          borderRadius: 12,
                          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                          transform: `scale(${zoom})`,
                          transition: 'transform 0.2s',
                          background: '#fff',
                          outline: '2px solid #fff'
                        }}
                      />
                      <div style={{
                        position: 'absolute',
                        bottom: 12,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        gap: 12
                      }}>
                        <button
                          onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))}
                          style={{
                            padding: '8px 16px',
                            borderRadius: 6,
                            background: '#fff',
                            color: '#2d3a4b',
                            border: 'none',
                            fontWeight: 600,
                            fontSize: 18,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                          }}
                          tabIndex={0}
                          aria-label="Zoom out"
                        >
                          −
                        </button>
                        <span style={{ color: '#fff', fontWeight: 600, fontSize: 16, minWidth: 48, textAlign: 'center', userSelect: 'none' }}>{Math.round(zoom * 100)}%</span>
                        <button
                          onClick={() => setZoom(z => Math.min(z + 0.2, 3))}
                          style={{
                            padding: '8px 16px',
                            borderRadius: 6,
                            background: '#fff',
                            color: '#2d3a4b',
                            border: 'none',
                            fontWeight: 600,
                            fontSize: 18,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                          }}
                          tabIndex={0}
                          aria-label="Zoom in"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => setLightboxOpen(false)}
                      style={{
                        position: 'absolute',
                        top: 32,
                        right: 48,
                        padding: '8px 20px',
                        borderRadius: 6,
                        background: '#fff',
                        color: '#2d3a4b',
                        border: 'none',
                        fontWeight: 600,
                        fontSize: 18,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                      }}
                      tabIndex={0}
                      aria-label="Close fullscreen image"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => navigate(`/forms/${form.id}/edit`)}
              style={{
                width: '100%',
                padding: '12px 0',
                background: 'linear-gradient(90deg, #667eea 0%, #5a67d8 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(90,103,216,0.08)',
                transition: 'background 0.2s',
                marginTop: 16
              }}
              tabIndex={0}
              aria-label={`Edit form for ${form.patientName}`}
            >
              Edit
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewFormPage;
