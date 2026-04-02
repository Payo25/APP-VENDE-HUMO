import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/api';
import jsPDF from 'jspdf';
import { processScannedImage, ScanFilter } from '../utils/scannerProcess';

const API_BASE_URL = '/api';
const API_URL = `${API_BASE_URL}/forms`;
const AUDIT_ACTION_URL = `${API_BASE_URL}/audit-action`;

const caseTypeOptions = [
  "Regular",
  "Shift<3",
  "Shift>3",
  "Voluntary",
  "Cancelled"
];

const assistantTypeOptions = [
  "1st Assistant",
  "2nd Assistant"
];

const CreateFormPage: React.FC = () => {
  const navigate = useNavigate();
  const [patientName, setPatientName] = useState('');
  const [dob, setDob] = useState('');
  const [insuranceCompany, setInsuranceCompany] = useState('');
  const [healthCenterName, setHealthCenterName] = useState('');
  const [date, setDate] = useState('');
  const [timeIn, setTimeIn] = useState('');
  const [timeOut, setTimeOut] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [procedure, setProcedure] = useState('');
  const [caseType, setCaseType] = useState(caseTypeOptions[0]);
  const [assistantType, setAssistantType] = useState(assistantTypeOptions[0]);
  const [surgeryFormFile, setSurgeryFormFile] = useState<File | null>(null);
  const [scannedPages, setScannedPages] = useState<string[]>([]);
  const [scanMode, setScanMode] = useState<'scan' | 'upload'>('scan');
  const [scanFilter, setScanFilter] = useState<ScanFilter>('auto');
  const [processing, setProcessing] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [healthCenters, setHealthCenters] = useState<any[]>([]);

  // Get user role from localStorage (simulate for now)
  const userRole = localStorage.getItem('role') || 'Registered Surgical Assistant';

  useEffect(() => {
    authFetch('/api/health-centers')
      .then(res => res.json())
      .then(setHealthCenters)
      .catch(() => setHealthCenters([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (
      !patientName || !dob || !insuranceCompany ||
      !healthCenterName ||
      !date ||
      (!timeIn && caseType !== 'Cancelled') ||
      (!timeOut && caseType !== 'Cancelled') ||
      !doctorName || !procedure || !caseType || !assistantType ||
      (scanMode === 'upload' && !surgeryFormFile) ||
      (scanMode === 'scan' && scannedPages.length === 0)
    ) {
      setError('All fields are required.' + (scanMode === 'scan' && scannedPages.length === 0 ? ' Please scan at least one page.' : ''));
      return;
    }

    // If scan mode, convert scanned pages to PDF
    let fileToUpload = surgeryFormFile;
    if (scanMode === 'scan' && scannedPages.length > 0) {
      try {
        fileToUpload = await convertPagesToPDF(scannedPages);
      } catch {
        setError('Failed to convert scanned pages to PDF.');
        return;
      }
    }

    // Prepare form data for file upload
    const formData = new FormData();
    formData.append('patientName', patientName);
    formData.append('dob', dob);
    formData.append('insuranceCompany', insuranceCompany);
    formData.append('healthCenterName', healthCenterName);
    formData.append('date', date);
    formData.append('timeIn', timeIn);
    formData.append('timeOut', timeOut);
    formData.append('doctorName', doctorName);
    formData.append('procedure', procedure);
    formData.append('caseType', caseType);
    formData.append('assistantType', assistantType);
    formData.append('status', 'pending');
    // Use user ID for dynamic linking
    const userId = localStorage.getItem('userId');
    if (!userId) {
      setError('User ID not found in localStorage. Please log in again.');
      return;
    }
    formData.append('createdByUserId', userId);
    if (fileToUpload) {
      formData.append('surgeryFormFile', fileToUpload);
    }

    try {
      const res = await authFetch(API_URL, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to create form');
      setSuccess('Form created successfully!');
      // Audit log: create sensitive form
      await authFetch(AUDIT_ACTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actor: localStorage.getItem('user'),
          action: 'CREATE_FORM',
          details: { patientName, date }
        })
      });
      setTimeout(() => navigate('/forms'), 1000);
    } catch {
      setError('Failed to create form.');
    }
  };

  // Block Schedulers from accessing forms
  if (userRole === 'Scheduler') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="responsive-card" style={{ maxWidth: 600, textAlign: 'center' }}>
          <h2>Access Denied</h2>
          <div style={{ color: 'red', marginBottom: 24 }}>Schedulers cannot create surgical forms. You can manage Health Centers and Call Hours.</div>
          <button onClick={() => navigate('/dashboard')} style={{ width: '100%', padding: '12px 0', background: 'linear-gradient(90deg, #667eea 0%, #5a67d8 100%)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>← Back to Dashboard</button>
        </div>
      </div>
    );
  }

  const convertPagesToPDF = async (pages: string[]): Promise<File> => {
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

  const handleScanCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setProcessing(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target!.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });
        const processed = await processScannedImage(dataUrl, scanFilter);
        setScannedPages(prev => [...prev, processed]);
      }
    } finally {
      setProcessing(false);
    }
    // Reset the input so the same file can be re-selected
    e.target.value = '';
  };

  const reprocessPages = async (newFilter: ScanFilter) => {
    // We don't store originals, so re-filter only changes future captures
    setScanFilter(newFilter);
  };

  const removePage = (index: number) => {
    setScannedPages(prev => prev.filter((_, i) => i !== index));
  };

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
          href="/dashboard"
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
          ← Back to Dashboard
        </a>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <img src={process.env.PUBLIC_URL + '/logo.jpg'} alt="App Logo" className="page-logo" />
        </div>
        <h2 style={{ color: '#2d3a4b', marginBottom: 16 }}>Create Surgical Form</h2>
        {userRole !== 'Registered Surgical Assistant' && userRole !== 'Business Assistant' ? (
          <div style={{ color: '#e74c3c', marginBottom: 24 }}>
            Only Registered Surgical Assistants and Business Assistants can create new surgical forms.
          </div>
        ) : (
        <form onSubmit={handleSubmit} style={{ maxWidth: 400, margin: '0 auto', textAlign: 'left' }} encType="multipart/form-data">
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Patient Name</label>
            <input
              type="text"
              value={patientName}
              onChange={e => setPatientName(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Date of Birth</label>
            <input
              type="date"
              value={dob}
              onChange={e => setDob(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Insurance Company Name</label>
            <input
              type="text"
              value={insuranceCompany}
              onChange={e => setInsuranceCompany(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Health Center Name</label>
            <select
              value={healthCenterName}
              onChange={e => setHealthCenterName(e.target.value)}
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
            <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Surgery Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Time In</label>
            <input
              type="time"
              value={timeIn}
              onChange={e => setTimeIn(e.target.value)}
              required={caseType !== 'Cancelled'}
              disabled={caseType === 'Cancelled'}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box', background: caseType === 'Cancelled' ? '#f6f8fa' : '#fff' }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Time Out</label>
            <input
              type="time"
              value={timeOut}
              onChange={e => setTimeOut(e.target.value)}
              required={caseType !== 'Cancelled'}
              disabled={caseType === 'Cancelled'}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box', background: caseType === 'Cancelled' ? '#f6f8fa' : '#fff' }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Doctor's Name</label>
            <input
              type="text"
              value={doctorName}
              onChange={e => setDoctorName(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Procedure</label>
            <input
              type="text"
              value={procedure}
              onChange={e => setProcedure(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Assistant Type</label>
            <select
              value={assistantType}
              onChange={e => setAssistantType(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }}
            >
              {assistantTypeOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Surgery Form (Scan or Upload)</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button type="button" onClick={() => { setScanMode('scan'); setSurgeryFormFile(null); }} style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: scanMode === 'scan' ? '2px solid #667eea' : '1px solid #bfc9d9', background: scanMode === 'scan' ? '#f0f0ff' : '#fff', color: scanMode === 'scan' ? '#667eea' : '#666', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>📷 Scan Document</button>
              <button type="button" onClick={() => { setScanMode('upload'); setScannedPages([]); }} style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: scanMode === 'upload' ? '2px solid #667eea' : '1px solid #bfc9d9', background: scanMode === 'upload' ? '#f0f0ff' : '#fff', color: scanMode === 'upload' ? '#667eea' : '#666', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>📁 Upload File</button>
            </div>

            {scanMode === 'scan' ? (
              <div>
                <input ref={scanInputRef} type="file" accept="image/*" capture="environment" onChange={handleScanCapture} style={{ display: 'none' }} />
                {/* Scan filter selector */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                  {([['auto', 'Auto'], ['bw', 'B&W'], ['color', 'Color'], ['original', 'Original']] as [ScanFilter, string][]).map(([key, label]) => (
                    <button key={key} type="button" onClick={() => reprocessPages(key)} style={{ flex: 1, padding: '6px 0', borderRadius: 5, border: scanFilter === key ? '2px solid #667eea' : '1px solid #d0d5dd', background: scanFilter === key ? '#eef0ff' : '#fff', color: scanFilter === key ? '#667eea' : '#888', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>{label}</button>
                  ))}
                </div>
                <button type="button" onClick={() => scanInputRef.current?.click()} disabled={processing} style={{ width: '100%', padding: '14px 0', borderRadius: 6, border: '2px dashed #667eea', background: processing ? '#e8e8f0' : '#f8f9ff', color: '#667eea', fontWeight: 600, cursor: processing ? 'wait' : 'pointer', fontSize: 15, marginBottom: 8 }}>
                  {processing ? '⏳ Processing...' : (scannedPages.length === 0 ? '📷 Scan Document' : '📷 + Scan Another Page')}
                </button>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 6, textAlign: 'center' }}>Uses your phone camera as a document scanner</div>
                {scannedPages.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>{scannedPages.length} page{scannedPages.length > 1 ? 's' : ''} scanned — will be saved as PDF</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {scannedPages.map((page, idx) => (
                        <div key={idx} style={{ position: 'relative', border: '1px solid #d0d5dd', borderRadius: 6, overflow: 'hidden', width: 90, height: 116 }}>
                          <img src={page} alt={`Page ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button type="button" onClick={() => removePage(idx)} style={{ position: 'absolute', top: 2, right: 2, background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, fontSize: 13, cursor: 'pointer', lineHeight: '20px', fontWeight: 700 }}>×</button>
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, textAlign: 'center', padding: '2px 0' }}>Page {idx + 1}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <input
                type="file"
                accept="image/*,.pdf,application/pdf"
                onChange={e => setSurgeryFormFile(e.target.files ? e.target.files[0] : null)}
                required
                style={{ width: '100%', padding: '10px 0', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box', background: '#fff' }}
              />
            )}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Case Type</label>
            <select
              value={caseType}
              onChange={e => setCaseType(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }}
            >
              {caseTypeOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          {error && <div style={{ color: '#e74c3c', marginBottom: 12, textAlign: 'center' }}>{error}</div>}
          {success && <div style={{ color: '#43cea2', marginBottom: 12, textAlign: 'center' }}>{success}</div>}
          <button
            type="submit"
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
              transition: 'background 0.2s',
            }}
          >
            Create Form
          </button>
        </form>
        )}
      </div>
    </div>
  );
};

export default CreateFormPage;
