import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/api';

const API_URL = '/api/health-centers';

const HealthCentersPage: React.FC = () => {
  const [healthCenters, setHealthCenters] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [fax, setFax] = useState('');
  const [email, setEmail] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editFax, setEditFax] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editContactPerson, setEditContactPerson] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const navigate = useNavigate();

  useEffect(() => {
    authFetch(API_URL)
      .then(res => res.json())
      .then(setHealthCenters)
      .catch(() => setError('Failed to fetch health centers'));
  }, [success]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!name) {
      setError('Name is required.');
      return;
    }
    const res = await authFetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, address, phone, fax, email, contactPerson })
    });
    if (res.ok) {
      setSuccess('Health center created.');
      setName(''); setAddress(''); setPhone(''); setFax(''); setEmail(''); setContactPerson('');
    } else {
      setError('Failed to create health center.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this health center?')) return;
    const res = await authFetch(`${API_URL}/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setSuccess('Health center deleted.');
    } else {
      setError('Failed to delete health center.');
    }
  };

  const openEdit = (hc: any) => {
    setEditing(hc);
    setEditName(hc.name || '');
    setEditAddress(hc.address || '');
    setEditPhone(hc.phone || '');
    setEditFax(hc.fax || '');
    setEditEmail(hc.email || '');
    setEditContactPerson(hc.contactPerson || '');
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editName) {
      setError('Name is required.');
      return;
    }
    const res = await authFetch(`${API_URL}/${editing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, address: editAddress, phone: editPhone, fax: editFax, email: editEmail, contactPerson: editContactPerson })
    });
    if (res.ok) {
      setSuccess('Health center updated.');
      setEditing(null);
    } else {
      setError('Failed to update health center.');
    }
  };

  return (
    <div className="responsive-card" style={{ maxWidth: 850, margin: '40px auto', width: '100%' }}>
      <button onClick={() => navigate('/dashboard')} style={{ width: '100%', padding: '12px 0', background: 'linear-gradient(90deg, #667eea 0%, #5a67d8 100%)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, fontWeight: 600, cursor: 'pointer', marginBottom: 24 }}>← Back to Dashboard</button>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
        <img src={process.env.PUBLIC_URL + '/logo.jpg'} alt="App Logo" className="page-logo" />
      </div>
      <h2>Manage Health Centers</h2>
      {error && <div style={{ color: '#e74c3c', marginBottom: 12 }}>{error}</div>}
      {success && <div style={{ color: '#43cea2', marginBottom: 12 }}>{success}</div>}
      {/* Tabs */}
      <div style={{ display: 'flex', marginBottom: 24 }}>
        <button
          onClick={() => setActiveTab('list')}
          style={{
            flex: 1,
            padding: '12px 0',
            background: activeTab === 'list'
              ? 'linear-gradient(90deg, #667eea 0%, #5a67d8 100%)'
              : '#f6f8fa',
            color: activeTab === 'list' ? '#fff' : '#2d3a4b',
            border: 'none',
            borderRadius: '6px 0 0 6px',
            fontWeight: 600,
            fontSize: 16,
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
        >
          Health Centers List
        </button>
        <button
          onClick={() => setActiveTab('create')}
          style={{
            flex: 1,
            padding: '12px 0',
            background: activeTab === 'create'
              ? 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)'
              : '#f6f8fa',
            color: activeTab === 'create' ? '#fff' : '#2d3a4b',
            border: 'none',
            borderRadius: '0 6px 6px 0',
            fontWeight: 600,
            fontSize: 16,
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
        >
          Create New Health Center
        </button>
      </div>
      {/* Tab Content */}
      {activeTab === 'list' && (
        <>
          <h3 style={{ marginBottom: 12 }}>Health Centers List</h3>
          <table style={{ width: '100%', fontSize: 14, marginBottom: 16 }}>
            <thead>
              <tr style={{ background: '#f6f8fa' }}>
                <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Name</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Address</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Phone</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Fax</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Email</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Contact Person</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {healthCenters.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 16, color: '#888' }}>No health centers found.</td></tr>
              )}
              {healthCenters.map(hc => (
                <tr key={hc.id}>
                  <td style={{ padding: 8 }}>{hc.name}</td>
                  <td style={{ padding: 8 }}>{hc.address}</td>
                  <td style={{ padding: 8 }}>{hc.phone}</td>
                  <td style={{ padding: 8 }}>{hc.fax}</td>
                  <td style={{ padding: 8 }}>{hc.email}</td>
                  <td style={{ padding: 8 }}>{hc.contactPerson}</td>
                  <td style={{ padding: 8 }}>
                    <button onClick={() => openEdit(hc)} style={{ padding: '6px 16px', borderRadius: 6, background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer', marginRight: 8 }}>✏</button>
                    <button onClick={() => handleDelete(hc.id)} style={{ padding: '6px 16px', borderRadius: 6, background: 'linear-gradient(90deg, #e74c3c 0%, #e67e22 100%)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>❌</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Edit Modal */}
          {editing && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: '#fff', padding: 32, borderRadius: 12, minWidth: 320, maxWidth: 400, width: '100%' }}>
                <h3>Edit Health Center</h3>
                <form onSubmit={handleEdit} style={{ textAlign: 'left' }}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Name *</label>
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Address</label>
                    <input type="text" value={editAddress} onChange={e => setEditAddress(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Phone</label>
                    <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Fax</label>
                    <input type="text" value={editFax} onChange={e => setEditFax(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Email</label>
                    <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Contact Person</label>
                    <input type="text" value={editContactPerson} onChange={e => setEditContactPerson(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button type="button" onClick={() => setEditing(null)} style={{ padding: '8px 20px', borderRadius: 6, background: '#eee', color: '#2d3a4b', border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" style={{ padding: '8px 20px', borderRadius: 6, background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>Save</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
      {activeTab === 'create' && (
        <>
          <h3 style={{ marginBottom: 12, marginTop: 0 }}>Create New Health Center</h3>
          <form onSubmit={handleCreate} style={{ maxWidth: 350, margin: '0 auto', textAlign: 'left' }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Name *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Address</label>
              <input type="text" value={address} onChange={e => setAddress(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Phone</label>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Fax</label>
              <input type="text" value={fax} onChange={e => setFax(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Contact Person</label>
              <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button type="submit" style={{ width: '100%', padding: '12px 0', background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Create Health Center</button>
          </form>
        </>
      )}
    </div>
  );
};

export default HealthCentersPage;
