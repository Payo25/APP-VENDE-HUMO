import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/api';

const API_BASE_URL = '/api';

interface RsaDocument {
  id: number;
  userId: number;
  userFullName: string;
  documentType: string;
  issueDate: string;
  expiryDate: string;
  fileUrl: string;
  originalFileName?: string;
}

const RsaDocumentsPage: React.FC = () => {
  const navigate = useNavigate();
  const role = localStorage.getItem('role');
  const isAdminView = role === 'Business Assistant' || role === 'Scheduler' || role === 'Admin';

  const [documents, setDocuments] = useState<RsaDocument[]>([]);
  const [documentType, setDocumentType] = useState('ID');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sendingReminderId, setSendingReminderId] = useState<number | null>(null);
  const [expiryFilter, setExpiryFilter] = useState<'all' | '30' | '90' | 'expired'>('all');
  const [nameFilter, setNameFilter] = useState('');

  const canAccess =
    role === 'Registered Surgical Assistant' ||
    role === 'Team Leader' ||
    role === 'Business Assistant' ||
    role === 'Scheduler' ||
    role === 'Admin';

  useEffect(() => {
    if (!canAccess) {
      navigate('/dashboard');
      return;
    }
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  const fetchDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch(`${API_BASE_URL}/rsa-documents`);
      if (!res.ok) throw new Error('Failed to load documents');
      const data = await res.json();
      setDocuments(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!documentType || !issueDate || !expiryDate || !documentFile) {
      setError('Document type, issue date, expiry date and file are required.');
      return;
    }

    const formData = new FormData();
    formData.append('documentType', documentType);
    formData.append('issueDate', issueDate);
    formData.append('expiryDate', expiryDate);
    formData.append('documentFile', documentFile);

    setSubmitting(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/rsa-documents`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to upload document');

      setSuccess('Document uploaded successfully.');
      setDocumentFile(null);
      setIssueDate('');
      setExpiryDate('');
      const fileInput = document.getElementById('rsa-document-file') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
      fetchDocuments();
    } catch (err: any) {
      setError(err?.message || 'Failed to upload document');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this document?')) return;
    setError('');
    setSuccess('');
    try {
      const res = await authFetch(`${API_BASE_URL}/rsa-documents/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to delete document');
      }
      setSuccess('Document deleted successfully.');
      fetchDocuments();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete document');
    }
  };

  const getDaysLeft = (expiry: string) => {
    if (!expiry) return null;
    const now = new Date();
    const exp = new Date(`${expiry}T00:00:00`);
    return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const handleSendReminder = async (doc: RsaDocument) => {
    setError('');
    setSuccess('');
    setSendingReminderId(doc.id);
    try {
      const daysLeft = getDaysLeft(doc.expiryDate);
      const notificationType = daysLeft !== null && daysLeft <= 30 ? '1_month' : '3_month';
      const res = await authFetch(`${API_BASE_URL}/rsa-documents/${doc.id}/send-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to send reminder');
      setSuccess(`Reminder sent for ${doc.documentType} (${doc.userFullName}).`);
    } catch (err: any) {
      setError(err?.message || 'Failed to send reminder');
    } finally {
      setSendingReminderId(null);
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    const daysLeft = getDaysLeft(doc.expiryDate);
    if (expiryFilter === 'expired' && (daysLeft === null || daysLeft >= 0)) return false;
    if (expiryFilter === '30' && (daysLeft === null || daysLeft < 0 || daysLeft > 30)) return false;
    if (expiryFilter === '90' && (daysLeft === null || daysLeft < 0 || daysLeft > 90)) return false;
    if (nameFilter.trim() && !String(doc.userFullName || '').toLowerCase().includes(nameFilter.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <div className="responsive-card" style={{ marginTop: 40, maxWidth: 1100, width: '100%' }}>
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
          marginBottom: 16,
        }}
      >
        ← Back to Dashboard
      </button>

      <h2>{isAdminView ? 'RSA Documents' : 'My Documents'}</h2>
      <p style={{ color: '#4a5568', marginBottom: 20 }}>
        {isAdminView
          ? 'View uploaded RSA documents, filter by expiry windows, and send reminders.'
          : 'Upload personal documents (ID, board certificate, etc.) with issue and expiry dates.'}
      </p>

      {error && <p style={{ color: 'red', marginBottom: 12 }}>{error}</p>}
      {success && <p style={{ color: 'green', marginBottom: 12 }}>{success}</p>}

      <form onSubmit={handleSubmit} style={{ marginBottom: 24, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 4 }}>Document Type</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: 14 }}
            >
              <option value="ID">ID</option>
              <option value="Board Certificate">Board Certificate</option>
              <option value="License">License</option>
              <option value="Insurance">Insurance</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 4 }}>Document File</label>
            <input
              id="rsa-document-file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.gif"
              onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 4 }}>Issue Date</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: 14 }}
            />
          </div>
          <div>
            <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 4 }}>Expiry Date</label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: 14 }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '10px 18px',
            background: submitting ? '#94a3b8' : 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Uploading...' : 'Upload Document'}
        </button>
      </form>

      {isAdminView && (
        <div style={{ marginBottom: 16, padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 4 }}>Expiry Filter</label>
              <select
                value={expiryFilter}
                onChange={(e) => setExpiryFilter(e.target.value as 'all' | '30' | '90' | 'expired')}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: 14 }}
              >
                <option value="all">All</option>
                <option value="30">Expiring in 30 days</option>
                <option value="90">Expiring in 90 days</option>
                <option value="expired">Already expired</option>
              </select>
            </div>
            <div>
              <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 4 }}>RSA Name</label>
              <input
                type="text"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="Filter by RSA name"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: 14 }}
              />
            </div>
          </div>
        </div>
      )}

      <h3 style={{ marginBottom: 10 }}>Submitted Documents</h3>
      {loading ? (
        <p>Loading...</p>
      ) : filteredDocuments.length === 0 ? (
        <p style={{ color: '#64748b' }}>No documents submitted yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
            <thead>
              <tr style={{ background: '#1a237e', color: '#fff' }}>
                {isAdminView && <th style={{ padding: 8, textAlign: 'left' }}>RSA</th>}
                <th style={{ padding: 8, textAlign: 'left' }}>Type</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Issue Date</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Expiry Date</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Status</th>
                <th style={{ padding: 8, textAlign: 'left' }}>File</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.map((doc) => {
                const daysLeft = getDaysLeft(doc.expiryDate);
                const statusColor = daysLeft !== null && daysLeft <= 30
                  ? '#dc2626'
                  : daysLeft !== null && daysLeft <= 90
                    ? '#d97706'
                    : '#15803d';
                const statusText = daysLeft === null
                  ? 'Unknown'
                  : daysLeft < 0
                    ? `Expired ${Math.abs(daysLeft)} day(s) ago`
                    : `${daysLeft} day(s) left`;

                return (
                  <tr key={doc.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    {isAdminView && <td style={{ padding: 8, fontWeight: 600 }}>{doc.userFullName}</td>}
                    <td style={{ padding: 8 }}>{doc.documentType}</td>
                    <td style={{ padding: 8 }}>{doc.issueDate}</td>
                    <td style={{ padding: 8 }}>{doc.expiryDate}</td>
                    <td style={{ padding: 8, color: statusColor, fontWeight: 600 }}>{statusText}</td>
                    <td style={{ padding: 8 }}>
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 600 }}>
                        {doc.originalFileName || 'View'}
                      </a>
                    </td>
                    <td style={{ padding: 8 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {isAdminView && (
                          <button
                            onClick={() => handleSendReminder(doc)}
                            disabled={sendingReminderId === doc.id}
                            style={{
                              padding: '6px 10px',
                              background: sendingReminderId === doc.id ? '#94a3b8' : '#2563eb',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              cursor: sendingReminderId === doc.id ? 'not-allowed' : 'pointer',
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {sendingReminderId === doc.id ? 'Sending...' : 'Send Reminder'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(doc.id)}
                          style={{
                            padding: '6px 10px',
                            background: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RsaDocumentsPage;
