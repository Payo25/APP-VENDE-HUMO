import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SurgicalForm } from '../types/SurgicalForm';
import { authFetch } from '../utils/api';

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
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        formData.append(key, value as string);
      });
      if (selectedFile) {
        formData.append('surgeryFormFile', selectedFile);
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
              <input type="text" name="patientName" value={form.patientName} onChange={handleChange} required style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Date of Birth</label>
              <input type="date" name="dob" value={form.dob} onChange={handleChange} required style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Insurance Company Name</label>
              <input type="text" name="insuranceCompany" value={form.insuranceCompany} onChange={handleChange} required style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
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
              <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Update Surgery Form (Image or PDF)</label>
              <input type="file" accept="image/*,.pdf,application/pdf" onChange={e => setSelectedFile(e.target.files ? e.target.files[0] : null)} />
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
