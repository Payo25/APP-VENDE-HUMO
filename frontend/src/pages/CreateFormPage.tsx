import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [healthCenters, setHealthCenters] = useState<any[]>([]);
  const navigate = useNavigate();

  // Get user role from localStorage (simulate for now)
  const userRole = localStorage.getItem('role') || 'Registered Surgical Assistant';

  useEffect(() => {
    fetch('/api/health-centers')
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
      !doctorName || !procedure || !caseType || !assistantType || !surgeryFormFile
    ) {
      setError('All fields are required.');
      return;
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
    formData.append('surgeryFormFile', surgeryFormFile);

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to create form');
      setSuccess('Form created successfully!');
      // Audit log: create sensitive form
      await fetch(AUDIT_ACTION_URL, {
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
            <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Surgery Form (Image or PDF Upload)</label>
            <input
              type="file"
              accept="image/*,.pdf,application/pdf"
              onChange={e => setSurgeryFormFile(e.target.files ? e.target.files[0] : null)}
              required
              style={{ width: '100%', padding: '10px 0', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box', background: '#fff' }}
            />
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
