import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SurgicalForm } from '../types/SurgicalForm';
import { authFetch } from '../utils/api';
import jsPDF from 'jspdf';
import { processScannedImage, ScanFilter } from '../utils/scannerProcess';

const API_BASE_URL = '/api';
const API_URL = `${API_BASE_URL}/forms`;
const AUDIT_ACTION_URL = `${API_BASE_URL}/audit-action`;

const EditFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<SurgicalForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [healthCenters, setHealthCenters] = useState<any[]>([]);
  const [editScanMode, setEditScanMode] = useState<'scan' | 'upload'>('scan');
  const [editScannedPages, setEditScannedPages] = useState<string[]>([]);
  const [editScanFilter, setEditScanFilter] = useState<ScanFilter>('auto');
  const [editProcessing, setEditProcessing] = useState(false);
  const editScanInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const userRole = localStorage.getItem('role') || 'Registered Surgical Assistant';

  useEffect(() => {
    authFetch(`${API_URL}/${id}`)
      .then(res => res.json())
      .then(data => {
        setForm(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load form.');
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    authFetch('/api/health-centers')
      .then(res => res.json())
      .then(setHealthCenters)
      .catch(() => setHealthCenters([]));
  }, []);

  // HIPAA: Clear scanned PHI images from memory on unmount
  useEffect(() => {
    return () => {
      setEditScannedPages([]);
    };
  }, []);

  // Accept <select> as well for handleChange
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!form) return;
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form) return;
    try {
      let fileToUpload = selectedFile;
      // If scan mode has pages, convert to PDF
      if (editScanMode === 'scan' && editScannedPages.length > 0) {
        fileToUpload = await convertEditPagesToPDF(editScannedPages);
      }
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        formData.append(key, value as string);
      });
      if (fileToUpload) {
        formData.append('surgeryFormFile', fileToUpload);
      }
      const res = await authFetch(`${API_URL}/${id}`, {
        method: 'PUT',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to update form');
      setSuccess('Form updated successfully!');
      // Audit log: edit sensitive form
      await authFetch(AUDIT_ACTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actor: localStorage.getItem('user'),
          action: 'EDIT_FORM',
          details: { formId: id }
        })
      });
      setTimeout(() => navigate(`/forms/${id}`), 1000);
    } catch {
      setError('Failed to update form.');
    }
  };

  const convertEditPagesToPDF = async (pages: string[]): Promise<File> => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    for (let i = 0; i < pages.length; i++) {
      if (i > 0) pdf.addPage();
      const img = new Image();
      img.src = pages[i];
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        if (img.complete) resolve();
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageW / img.width, pageH / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      const x = (pageW - w) / 2;
      const y = (pageH - h) / 2;
      pdf.addImage(pages[i], 'JPEG', x, y, w, h);
    }
    const blob = pdf.output('blob');
    return new File([blob], 'scanned-document.pdf', { type: 'application/pdf' });
  };

  const handleEditScanCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setEditProcessing(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target!.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });
        const processed = await processScannedImage(dataUrl, editScanFilter);
        setEditScannedPages(prev => [...prev, processed]);
      }
    } finally {
      setEditProcessing(false);
    }
    e.target.value = '';
  };

  if (userRole !== 'Registered Surgical Assistant' && userRole !== 'Business Assistant') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)' }}>
        <div style={{ background: '#fff', padding: '2.5rem 2rem', borderRadius: '1rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', minWidth: 320, maxWidth: 600, width: '100%', textAlign: 'center' }}>
          <a href="/dashboard" style={{ display: 'inline-block', marginBottom: 24, padding: '12px 0', background: 'linear-gradient(90deg, #667eea 0%, #5a67d8 100%)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, fontWeight: 600, textDecoration: 'none', boxShadow: '0 2px 8px rgba(90,103,216,0.08)', transition: 'background 0.2s', width: '100%' }}>← Back to Dashboard</a>
          <div style={{ color: '#e74c3c', marginBottom: 24 }}>
            Only Registered Surgical Assistants and Business Assistants can edit surgical forms.
            {userRole === 'Scheduler' && ' Schedulers can manage Health Centers and Call Hours.'}
          </div>
        </div>
      </div>
    );
  }

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
        <h2 style={{ color: '#2d3a4b', marginBottom: 16 }}>Edit Surgical Form</h2>
        {loading && <p>Loading...</p>}
        {error && <p style={{ color: '#e74c3c' }}>{error}</p>}
        {form && (
          <form onSubmit={handleSubmit} style={{ maxWidth: 400, margin: '0 auto', textAlign: 'left' }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Patient Name</label>
              <input type="text" name="patientName" value={form.patientName} onChange={handleChange} required autoComplete="off" style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Date of Birth</label>
              <input type="date" name="dob" value={form.dob} onChange={handleChange} required autoComplete="off" style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Insurance Company Name</label>
              <input type="text" name="insuranceCompany" value={form.insuranceCompany} onChange={handleChange} required autoComplete="off" style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Health Center Name</label>
              <select
                name="healthCenterName"
                value={form.healthCenterName}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }}
              >
                <option value="">Select Health Center</option>
                {healthCenters.map((hc: any) => (
                  <option key={hc.id} value={hc.name}>{hc.name}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Time In</label>
              <input type="time" name="timeIn" value={form.timeIn} onChange={handleChange} required style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Time Out</label>
              <input type="time" name="timeOut" value={form.timeOut} onChange={handleChange} required style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Doctor's Name</label>
              <input type="text" name="doctorName" value={form.doctorName} onChange={handleChange} required style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Procedure</label>
              <textarea name="procedure" value={form.procedure} onChange={handleChange} required rows={4} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Assistant Type</label>
              <select name="assistantType" value={form.assistantType || '1st Assistant'} onChange={handleChange} required style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }}>
                <option value="1st Assistant">1st Assistant</option>
                <option value="2nd Assistant">2nd Assistant</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Case Type</label>
              <select name="caseType" value={form.caseType} onChange={handleChange} required style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }}>
                <option value="Regular">Regular</option>
                <option value="Shift<3">Shift&lt;3</option>
                <option value="Shift>3">Shift&gt;3</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Status</label>
              <input type="text" name="status" value={form.status} onChange={handleChange} required style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }} disabled={userRole === 'Registered Surgical Assistant'} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Surgery Date</label>
              <input type="date" name="date" value={form.date} onChange={handleChange} required style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {form.surgeryFormFileUrl && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Uploaded Image</label>
                <img src={`${form.surgeryFormFileUrl}`} alt="Surgery Form" style={{ maxWidth: '100%', borderRadius: 8 }} />
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Update Surgery Form (Scan or Upload)</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button type="button" onClick={() => { setEditScanMode('scan'); setSelectedFile(null); }} style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: editScanMode === 'scan' ? '2px solid #667eea' : '1px solid #bfc9d9', background: editScanMode === 'scan' ? '#f0f0ff' : '#fff', color: editScanMode === 'scan' ? '#667eea' : '#666', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>📷 Scan Document</button>
                <button type="button" onClick={() => { setEditScanMode('upload'); setEditScannedPages([]); }} style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: editScanMode === 'upload' ? '2px solid #667eea' : '1px solid #bfc9d9', background: editScanMode === 'upload' ? '#f0f0ff' : '#fff', color: editScanMode === 'upload' ? '#667eea' : '#666', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>📁 Upload File</button>
              </div>
              {editScanMode === 'scan' ? (
                <div>
                  <input ref={editScanInputRef} type="file" accept="image/*" capture="environment" onChange={handleEditScanCapture} style={{ display: 'none' }} />
                  <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                    {([['auto', 'Auto'], ['bw', 'B&W'], ['color', 'Color'], ['original', 'Original']] as [ScanFilter, string][]).map(([key, label]) => (
                      <button key={key} type="button" onClick={() => setEditScanFilter(key)} style={{ flex: 1, padding: '6px 0', borderRadius: 5, border: editScanFilter === key ? '2px solid #667eea' : '1px solid #d0d5dd', background: editScanFilter === key ? '#eef0ff' : '#fff', color: editScanFilter === key ? '#667eea' : '#888', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>{label}</button>
                    ))}
                  </div>
                  <button type="button" onClick={() => editScanInputRef.current?.click()} disabled={editProcessing} style={{ width: '100%', padding: '14px 0', borderRadius: 6, border: '2px dashed #667eea', background: editProcessing ? '#e8e8f0' : '#f8f9ff', color: '#667eea', fontWeight: 600, cursor: editProcessing ? 'wait' : 'pointer', fontSize: 15, marginBottom: 8 }}>
                    {editProcessing ? '⏳ Processing...' : (editScannedPages.length === 0 ? '📷 Scan Document' : '📷 + Scan Another Page')}
                  </button>
                  <div style={{ fontSize: 11, color: '#999', marginBottom: 6, textAlign: 'center' }}>Uses your phone camera as a document scanner</div>
                  {editScannedPages.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>{editScannedPages.length} page{editScannedPages.length > 1 ? 's' : ''} scanned — will replace current file</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {editScannedPages.map((page, idx) => (
                          <div key={idx} style={{ position: 'relative', border: '1px solid #d0d5dd', borderRadius: 6, overflow: 'hidden', width: 90, height: 116 }}>
                            <img src={page} alt={`Page ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button type="button" onClick={() => setEditScannedPages(prev => prev.filter((_, i) => i !== idx))} style={{ position: 'absolute', top: 2, right: 2, background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, fontSize: 13, cursor: 'pointer', lineHeight: '20px', fontWeight: 700 }}>×</button>
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, textAlign: 'center', padding: '2px 0' }}>Page {idx + 1}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <input type="file" accept="image/*,.pdf,application/pdf" onChange={e => setSelectedFile(e.target.files ? e.target.files[0] : null)} style={{ width: '100%', padding: '10px 0', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
              )}
            </div>
            <p style={{ color: '#888', fontSize: 13 }}><b>Created By:</b> {form.createdByFullName || form.createdBy}</p>
            <p style={{ color: '#888', fontSize: 13 }}><b>Created By Email:</b> {form.createdByEmail || ''}</p>
            {error && <div style={{ color: '#e74c3c', marginBottom: 12, textAlign: 'center' }}>{error}</div>}
            {success && <div style={{ color: '#43cea2', marginBottom: 12, textAlign: 'center' }}>{success}</div>}
            <button type="submit"
              style={{
                width: '100%',
                padding: '12px 0',
                background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(67,206,162,0.08)',
                transition: 'background 0.2s'
              }}
              tabIndex={0}
              aria-label="Save changes to surgical form"
            >
              Save Changes
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default EditFormPage;
