import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/api';

interface VacationRequest {
  id: number;
  user_id: number;
  user_name: string;
  request_type: string;
  request_date: string;
  hours: number;
  notes: string;
  status: string;
  reviewer_name: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  createdat: string;
}

const VacationRequestsPage: React.FC = () => {
  const userRole = localStorage.getItem('role');
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('Pending');
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (userRole !== 'Scheduler' && userRole !== 'Business Assistant') {
      navigate('/dashboard');
    }
  }, [userRole, navigate]);

  const fetchRequests = React.useCallback(() => {
    setLoading(true);
    const url = filter ? `/api/vacation-requests?status=${filter}` : '/api/vacation-requests';
    authFetch(url)
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setRequests(data); setLoading(false); })
      .catch(() => { setRequests([]); setLoading(false); });
  }, [filter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleReview = async (id: number, status: 'Approved' | 'Denied') => {
    setProcessing(true);
    try {
      const res = await authFetch(`/api/vacation-requests/${id}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, review_notes: reviewNotes }),
      });
      if (res.ok) {
        setReviewingId(null);
        setReviewNotes('');
        fetchRequests();
      }
    } catch {}
    setProcessing(false);
  };

  const statusColors: Record<string, string> = { Pending: '#f59e0b', Approved: '#22c55e', Denied: '#ef4444' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="responsive-card" style={{ maxWidth: 1100, width: '100%' }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            width: '100%', padding: '12px 0',
            background: 'linear-gradient(90deg, #667eea 0%, #5a67d8 100%)',
            color: '#fff', border: 'none', borderRadius: 6, fontSize: 16,
            fontWeight: 600, cursor: 'pointer', marginBottom: 24
          }}
        >
          ← Back to Dashboard
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>📋 Vacation & PTO Requests</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {['Pending', 'Approved', 'Denied', ''].map(f => (
              <button key={f || 'all'} onClick={() => setFilter(f)}
                style={{
                  padding: '6px 16px', borderRadius: 20, border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  background: filter === f ? '#667eea' : '#e5e7eb', color: filter === f ? '#fff' : '#374151'
                }}>
                {f || 'All'}
              </button>
            ))}
          </div>
        </div>

        {loading ? <p>Loading...</p> : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666', fontSize: 16, background: '#f9fafb', borderRadius: 8 }}>
            No {filter || ''} vacation requests found.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f6f8fa' }}>
                <th style={{ padding: 10, textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>RSA</th>
                <th style={{ padding: 10, textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Type</th>
                <th style={{ padding: 10, textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Date</th>
                <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #e2e8f0' }}>Hours</th>
                <th style={{ padding: 10, textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Notes</th>
                <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #e2e8f0' }}>Status</th>
                <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #e2e8f0' }}>Submitted</th>
                <th style={{ padding: 10, textAlign: 'center', borderBottom: '2px solid #e2e8f0' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <React.Fragment key={r.id}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: 10, fontWeight: 600 }}>{r.user_name}</td>
                    <td style={{ padding: 10 }}>{r.request_type === 'PTO' ? '📋 PTO' : '🌴 Vacation'}</td>
                    <td style={{ padding: 10 }}>{r.request_date}</td>
                    <td style={{ padding: 10, textAlign: 'center' }}>{r.hours}</td>
                    <td style={{ padding: 10, fontSize: 12 }}>
                      {r.notes || '-'}
                      {r.review_notes && <div style={{ color: '#6b7280', fontStyle: 'italic', marginTop: 2 }}>Review: {r.review_notes}</div>}
                      {r.reviewer_name && <div style={{ color: '#6b7280', fontSize: 11 }}>By: {r.reviewer_name}</div>}
                    </td>
                    <td style={{ padding: 10, textAlign: 'center' }}>
                      <span style={{ padding: '3px 12px', borderRadius: 12, background: statusColors[r.status] || '#999', color: '#fff', fontWeight: 700, fontSize: 12 }}>{r.status}</span>
                    </td>
                    <td style={{ padding: 10, textAlign: 'center', fontSize: 12 }}>{new Date(r.createdat).toLocaleDateString()}</td>
                    <td style={{ padding: 10, textAlign: 'center' }}>
                      {r.status === 'Pending' && (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          {reviewingId !== r.id ? (
                            <button onClick={() => setReviewingId(r.id)} style={{ padding: '5px 14px', borderRadius: 6, background: '#667eea', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Review</button>
                          ) : (
                            <>
                              <button onClick={() => handleReview(r.id, 'Approved')} disabled={processing} style={{ padding: '5px 12px', borderRadius: 6, background: '#22c55e', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>✅ Approve</button>
                              <button onClick={() => handleReview(r.id, 'Denied')} disabled={processing} style={{ padding: '5px 12px', borderRadius: 6, background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>❌ Deny</button>
                              <button onClick={() => { setReviewingId(null); setReviewNotes(''); }} style={{ padding: '5px 10px', borderRadius: 6, background: '#e5e7eb', border: 'none', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                  {reviewingId === r.id && (
                    <tr>
                      <td colSpan={8} style={{ padding: '8px 10px', background: '#f0f9ff', borderBottom: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <label style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>Review Notes:</label>
                          <input type="text" value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} placeholder="Optional notes for the RSA..." style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default VacationRequestsPage;
