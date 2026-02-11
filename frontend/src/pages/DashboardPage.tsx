import React from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = '/api';
const AUDIT_LOGOUT_URL = `${API_BASE_URL}/audit-logout`;

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const userFullName = localStorage.getItem('fullName');

  const handleLogout = async () => {
    const user = localStorage.getItem('user');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    // Audit log logout
    await fetch(AUDIT_LOGOUT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor: user })
    });
    window.location.href = '/';
  };

  return (
    <div
      role="main"
      aria-label="Dashboard Section"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div className="responsive-card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <img src={process.env.PUBLIC_URL + '/logo.jpg'} alt="App Logo" className="page-logo" />
        </div>
        <h2 tabIndex={0}>Dashboard</h2>
        <p style={{ color: '#4a5568', marginBottom: 32 }}>Welcome{userFullName ? `, ${userFullName}!` : '!'}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {localStorage.getItem('role') !== 'Scheduler' && (
            <>
              <a href="/forms" style={{
                display: 'inline-block',
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
              }}
              tabIndex={0}
              aria-label="View Surgical Forms"
              >
                View Surgical Forms
              </a>
              <a href="/forms/create" style={{
                display: 'inline-block',
                padding: '12px 0',
                background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 16,
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(67,206,162,0.08)',
                transition: 'background 0.2s',
              }}
              tabIndex={0}
              aria-label="Create New Surgical Form"
              >
                Create New Surgical Form
              </a>
            </>
          )}
          {localStorage.getItem('role') === 'Admin' && (
            <a href="/users" style={{
              display: 'inline-block',
              padding: '12px 0',
              background: 'linear-gradient(90deg, #ffb347 0%, #ffcc33 100%)',
              color: '#2d3a4b',
              border: 'none',
              borderRadius: 6,
              fontSize: 16,
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(255,204,51,0.08)',
              transition: 'background 0.2s',
            }}
            tabIndex={0}
            aria-label="User Management"
            >
              User Management
            </a>
          )}
          {localStorage.getItem('role') === 'Admin' && (
            <a href="/audit-logs" style={{
              display: 'inline-block',
              padding: '12px 0',
              background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 16,
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(67,206,162,0.08)',
              transition: 'background 0.2s',
            }}
            tabIndex={0}
            aria-label="Audit Logs"
            >
              Audit Logs
            </a>
          )}
          {localStorage.getItem('role') === 'Business Assistant' && (
            <a href="/rsa-report" style={{
              display: 'inline-block',
              padding: '12px 0',
              background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 16,
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(67,206,162,0.08)',
              transition: 'background 0.2s',
            }}
            tabIndex={0}
            aria-label="Payroll"
            >
              Payroll
            </a>
          )}
          {localStorage.getItem('role') === 'Business Assistant' && (
            <a href="/forms-report" style={{
              display: 'inline-block',
              padding: '12px 0',
              background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 16,
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(67,206,162,0.08)',
              transition: 'background 0.2s',
            }}
            tabIndex={0}
            aria-label="Surgical Forms Report"
            >
              Surgical Forms Report
            </a>
          )}
          {(localStorage.getItem('role') === 'Business Assistant' || localStorage.getItem('role') === 'Scheduler') && (
            <a href="/health-centers" style={{
              display: 'inline-block',
              padding: '12px 0',
              background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 16,
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(67,206,162,0.08)',
              transition: 'background 0.2s',
            }}
            tabIndex={0}
            aria-label="Manage Health Centers"
            >
              Manage Health Centers
            </a>
          )}
          {(localStorage.getItem('role') === 'Business Assistant' || localStorage.getItem('role') === 'Scheduler') && (
            <a href="/physicians" style={{
              display: 'inline-block',
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
            }}
            tabIndex={0}
            aria-label="Manage Physicians"
            >
              Manage Physicians
            </a>
          )}
          {(localStorage.getItem('role') === 'Scheduler' || localStorage.getItem('role') === 'Business Assistant') && (
            <a
              href="/rsa-emails"
              style={{
                display: 'block',
                width: '100%',
                padding: '12px 0',
                background: 'linear-gradient(90deg, #e91e63 0%, #c2185b 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 16,
                fontWeight: 600,
                textDecoration: 'none',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(233,30,99,0.08)',
                transition: 'background 0.2s',
                marginBottom: 12
              }}
              tabIndex={0}
              aria-label="Manage RSA Emails"
            >
              📧 RSA Emails
            </a>
          )}
        </div>
        {localStorage.getItem('role') === 'Registered Surgical Assistant' && (
          <button
            onClick={() => navigate('/call-hours-personal')}
            style={{
              width: '100%',
              padding: '12px 0',
              background: 'linear-gradient(90deg, #1976d2 0%, #1565c0 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(25,118,210,0.08)',
              transition: 'background 0.2s',
              marginBottom: 12
            }}
          >
            📅 My Schedule
          </button>
        )}
        {localStorage.getItem('role') === 'Scheduler' && (
          <button
            onClick={() => navigate('/manage-user-schedule')}
            style={{
              width: '100%',
              padding: '12px 0',
              background: 'linear-gradient(90deg, #ff9800 0%, #f57c00 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(255,152,0,0.08)',
              transition: 'background 0.2s',
              marginBottom: 12
            }}
          >
            📝 Create Schedule
          </button>
        )}
        <button
          onClick={() => navigate('/call-hours')}
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
            marginBottom: 16
          }}
        >
          Call Hours
        </button>
        <button
          onClick={handleLogout}
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
          }}
          tabIndex={0}
          aria-label="Logout"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default DashboardPage;
