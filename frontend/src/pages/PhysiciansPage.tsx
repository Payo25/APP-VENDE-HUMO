import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = '/api';
const PHYSICIANS_URL = `${API_BASE_URL}/physicians`;

interface Physician {
  id: number;
  name: string;
  specialty: string;
  phone: string;
  email: string;
  fax: string;
}

const PhysiciansPage: React.FC = () => {
  const navigate = useNavigate();
  const userRole = localStorage.getItem('role');
  const [physicians, setPhysicians] = useState<Physician[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPhysician, setEditingPhysician] = useState<Physician | null>(null);
  const [formData, setFormData] = useState({ name: '', specialty: '', phone: '', email: '', fax: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (userRole !== 'Business Assistant' && userRole !== 'Scheduler') {
      navigate('/dashboard');
      return;
    }
    fetchPhysicians();
  }, [userRole, navigate]);

  const fetchPhysicians = async () => {
    try {
      const res = await fetch(PHYSICIANS_URL);
      const data = await res.json();
      setPhysicians(data);
    } catch (err) {
      setError('Failed to load physicians');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const method = editingPhysician ? 'PUT' : 'POST';
    const url = editingPhysician ? `${PHYSICIANS_URL}/${editingPhysician.id}` : PHYSICIANS_URL;

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setSuccess(editingPhysician ? 'Physician updated successfully!' : 'Physician added successfully!');
        setShowModal(false);
        setFormData({ name: '', specialty: '', phone: '', email: '', fax: '' });
        setEditingPhysician(null);
        fetchPhysicians();
      } else {
        const data = await res.json();
        setError(data.error || 'Operation failed');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const handleEdit = (physician: Physician) => {
    setEditingPhysician(physician);
    setFormData({
      name: physician.name,
      specialty: physician.specialty,
      phone: physician.phone,
      email: physician.email,
      fax: physician.fax || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this physician?')) return;

    try {
      const res = await fetch(`${PHYSICIANS_URL}/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccess('Physician deleted successfully!');
        fetchPhysicians();
      } else {
        setError('Failed to delete physician');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const openAddModal = () => {
    setEditingPhysician(null);
    setFormData({ name: '', specialty: '', phone: '', email: '', fax: '' });
    setShowModal(true);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="responsive-card" style={{ maxWidth: 900, width: '100%' }}>
        <button
          onClick={() => navigate('/dashboard')}
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
            marginBottom: 24
          }}
        >
          ← Back to Dashboard
        </button>

        <h2>Manage Physicians</h2>
        
        <button
          onClick={openAddModal}
          style={{
            padding: '10px 24px',
            background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 20
          }}
        >
          + Add Physician
        </button>

        {success && <div style={{ color: '#43cea2', marginBottom: 16 }}>{success}</div>}
        {error && <div style={{ color: '#e74c3c', marginBottom: 16 }}>{error}</div>}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
            <thead>
              <tr style={{ background: '#f6f8fa' }}>
                <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Name</th>
                <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Specialty</th>
                <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Phone</th>
                <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Fax</th>
                <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Email</th>
                <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #e2e8f0' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {physicians.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#666' }}>
                    No physicians found. Click "Add Physician" to get started.
                  </td>
                </tr>
              ) : (
                physicians.map(physician => (
                  <tr key={physician.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: 12 }}>{physician.name}</td>
                    <td style={{ padding: 12 }}>{physician.specialty}</td>
                    <td style={{ padding: 12 }}>{physician.phone}</td>
                    <td style={{ padding: 12 }}>{physician.fax}</td>
                    <td style={{ padding: 12 }}>{physician.email}</td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <button
                        onClick={() => handleEdit(physician)}
                        style={{
                          padding: '6px 12px',
                          background: '#667eea',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          marginRight: 8,
                          fontSize: 14
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(physician.id)}
                        style={{
                          padding: '6px 12px',
                          background: '#e74c3c',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 14
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {showModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
            onClick={() => setShowModal(false)}
          >
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: 32,
                maxWidth: 500,
                width: '90%',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ marginTop: 0, marginBottom: 24 }}>
                {editingPhysician ? 'Edit Physician' : 'Add Physician'}
              </h3>
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                    Name <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 16,
                      border: '2px solid #e5e7eb',
                      borderRadius: 6,
                      outline: 'none'
                    }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                    Specialty <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.specialty}
                    onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 16,
                      border: '2px solid #e5e7eb',
                      borderRadius: 6,
                      outline: 'none'
                    }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 16,
                      border: '2px solid #e5e7eb',
                      borderRadius: 6,
                      outline: 'none'
                    }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                    Fax
                  </label>
                  <input
                    type="tel"
                    value={formData.fax}
                    onChange={(e) => setFormData({ ...formData, fax: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 16,
                      border: '2px solid #e5e7eb',
                      borderRadius: 6,
                      outline: 'none'
                    }}
                  />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 16,
                      border: '2px solid #e5e7eb',
                      borderRadius: 6,
                      outline: 'none'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: '12px 24px',
                      borderRadius: 6,
                      background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 600,
                      fontSize: 16,
                      cursor: 'pointer'
                    }}
                  >
                    {editingPhysician ? 'Update' : 'Add'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    style={{
                      flex: 1,
                      padding: '12px 24px',
                      borderRadius: 6,
                      background: '#e5e7eb',
                      color: '#374151',
                      border: 'none',
                      fontWeight: 600,
                      fontSize: 16,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhysiciansPage;
