import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface AuditLog {
  timestamp: string;
  action: string;
  actor: string;
  details: any;
}

const API_BASE_URL = '/api';
const API_URL = `${API_BASE_URL}/audit-logs`;

const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const userRole = localStorage.getItem('role');

  useEffect(() => {
    if (userRole !== 'Admin') return;
    fetch(API_URL)
      .then(res => res.json())
      .then(setLogs)
      .catch(() => setError('Failed to fetch audit logs'));
  }, [userRole]);

  if (userRole !== 'Admin') {
    return (
      <div className="responsive-card" style={{ marginTop: 40 }}>
        <h2>Audit Logs</h2>
        <div style={{ color: 'red', marginBottom: 24 }}>Access denied. Only Admins can view audit logs.</div>
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
            transition: 'background 0.2s',
            marginBottom: 16
          }}
        >
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div
      role="main"
      aria-label="Audit Logs Section"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div className="responsive-card">
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
            transition: 'background 0.2s',
            marginBottom: 24
          }}
        >
          ← Back to Dashboard
        </button>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <img src={process.env.PUBLIC_URL + '/logo.jpg'} alt="App Logo" />
        </div>
        <h2 tabIndex={0}>Audit Logs</h2>
        {error && <div style={{ color: 'red', marginBottom: 12 }} role="alert">{error}</div>}
        <div style={{ maxHeight: 400, overflowY: 'auto', marginTop: 16 }}>
          <button
            onClick={handleExport}
            style={{
              marginBottom: 16,
              padding: '8px 20px',
              borderRadius: 6,
              background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(67,206,162,0.08)',
              transition: 'background 0.2s',
              float: 'right'
            }}
            aria-label="Export Audit Logs as CSV"
          >
            Export CSV
          </button>
          <table style={{ width: '100%', fontSize: 14 }} aria-label="Audit Log List">
            <thead>
              <tr style={{ background: '#f6f8fa' }}>
                <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Timestamp</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Action</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Actor</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 16, color: '#888' }}>No audit logs found.</td>
                </tr>
              )}
              {logs.map((log, idx) => (
                <tr key={idx}>
                  <td style={{ padding: 8 }}>{new Date(log.timestamp).toLocaleString()}</td>
                  <td style={{ padding: 8 }}>{log.action}</td>
                  <td style={{ padding: 8 }}>{log.actor}</td>
                  <td style={{ padding: 8, textAlign: 'left', fontFamily: 'monospace', fontSize: 13 }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(log.details, null, 2)}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  function handleExport() {
    if (!logs.length) return;
    const csvRows = [
      'Timestamp,Action,Actor,Details',
      ...logs.map(log =>
        `"${log.timestamp}","${log.action}","${log.actor}","${JSON.stringify(log.details).replace(/"/g, '""')}"`
      )
    ];
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

export default AuditLogsPage;
