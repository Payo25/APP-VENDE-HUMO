import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/api';

const API_BASE_URL = '/api';
const RSA_EMAILS_URL = `${API_BASE_URL}/rsa-emails`;

interface RsaEmail {
  id: number;
  rsa_name: string;
  email: string;
  phone: string;
  notes: string;
}

const RsaEmailsPage: React.FC = () => {
  const navigate = useNavigate();
  const userRole = localStorage.getItem('role');
  const [rsaEmails, setRsaEmails] = useState<RsaEmail[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<RsaEmail | null>(null);
  const [formData, setFormData] = useState({ rsaName: '', email: '', phone: '', notes: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userRole !== 'Business Assistant' && userRole !== 'Scheduler') {
      navigate('/dashboard');
      return;
    }
    fetchEmails();
  }, [userRole, navigate]);

  const fetchEmails = async () => {
    try {
      const res = await authFetch(RSA_EMAILS_URL);
      const data = await res.json();
      setRsaEmails(data);
    } catch (err) {
      setError('Failed to load RSA emails');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.rsaName.trim() || !formData.email.trim()) {
      setError('Name and email are required');
      return;
    }

    const method = editing ? 'PUT' : 'POST';
    const url = editing ? `${RSA_EMAILS_URL}/${editing.id}` : RSA_EMAILS_URL;

    try {
      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setSuccess(editing ? 'Email updated successfully!' : 'Email added successfully!');
        closeModal();
        fetchEmails();
      } else {
        const data = await res.json();
        setError(data.error || 'Operation failed');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const handleEdit = (item: RsaEmail) => {
    setEditing(item);
    setFormData({
      rsaName: item.rsa_name,
      email: item.email,
      phone: item.phone || '',
      notes: item.notes || ''
    });
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this email?')) return;
    try {
      const res = await authFetch(`${RSA_EMAILS_URL}/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccess('Email deleted successfully!');
        fetchEmails();
      } else {
        setError('Failed to delete email');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const openAddModal = () => {
    setEditing(null);
    setFormData({ rsaName: '', email: '', phone: '', notes: '' });
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setFormData({ rsaName: '', email: '', phone: '', notes: '' });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>
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
            boxShadow: '0 2px 8px rgba(90,103,216,0.08)',
            marginBottom: 24
          }}
        >
          ← Back to Dashboard
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>📧 RSA Emails</h2>
          <button
            onClick={openAddModal}
            style={{
              padding: '10px 24px',
              background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            + Add Email
          </button>
        </div>

        {success && <div style={{ color: '#43cea2', marginBottom: 12, fontWeight: 600 }}>{success}</div>}
        {error && <div style={{ color: '#e74c3c', marginBottom: 12, fontWeight: 600 }}>{error}</div>}

        {loading ? (
          <p>Loading...</p>
        ) : rsaEmails.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666', background: '#f9fafb', borderRadius: 8 }}>
            No RSA emails added yet. Click "+ Add Email" to get started.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
              <thead>
                <tr style={{ background: '#f6f8fa' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: 14 }}>RSA Name</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: 14 }}>Email</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: 14 }}>Phone</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: 14 }}>Notes</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontSize: 14, width: 140 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rsaEmails.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{item.rsa_name}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <a href={`mailto:${item.email}`} style={{ color: '#1976d2', textDecoration: 'none' }}>{item.email}</a>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#555' }}>{item.phone || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#666', fontSize: 13 }}>{item.notes || '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button
                          onClick={() => handleEdit(item)}
                          style={{
                            padding: '6px 14px',
                            background: '#667eea',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          style={{
                            padding: '6px 14px',
                            background: '#e74c3c',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add/Edit Modal */}
        {showModal && (
          <div
            style={{
              position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
              background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
            }}
            onClick={closeModal}
          >
            <div
              style={{ background: '#fff', borderRadius: 12, padding: 32, maxWidth: 500, width: '90%', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ marginTop: 0, marginBottom: 24 }}>
                {editing ? '✏️ Edit RSA Email' : '➕ Add RSA Email'}
              </h3>
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>RSA Name *</label>
                  <input
                    type="text"
                    value={formData.rsaName}
                    onChange={(e) => setFormData({ ...formData, rsaName: e.target.value })}
                    placeholder="e.g. John Doe"
                    required
                    style={{ width: '100%', padding: '10px 12px', fontSize: 15, border: '2px solid #e5e7eb', borderRadius: 6, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. john@example.com"
                    required
                    style={{ width: '100%', padding: '10px 12px', fontSize: 15, border: '2px solid #e5e7eb', borderRadius: 6, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. (809) 555-1234"
                    style={{ width: '100%', padding: '10px 12px', fontSize: 15, border: '2px solid #e5e7eb', borderRadius: 6, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    placeholder="Optional notes..."
                    style={{ width: '100%', padding: '10px 12px', fontSize: 15, border: '2px solid #e5e7eb', borderRadius: 6, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    type="submit"
                    style={{
                      flex: 1, padding: '12px 24px', borderRadius: 6,
                      background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
                      color: '#fff', border: 'none', fontWeight: 600, fontSize: 16, cursor: 'pointer'
                    }}
                  >
                    💾 Save
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    style={{
                      flex: 1, padding: '12px 24px', borderRadius: 6,
                      background: '#e5e7eb', color: '#374151', border: 'none', fontWeight: 600, fontSize: 16, cursor: 'pointer'
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

export default RsaEmailsPage;
