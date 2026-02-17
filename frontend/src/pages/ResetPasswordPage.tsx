import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // Client-side validation
    const errors: string[] = [];
    if (password.length < 8) errors.push('At least 8 characters.');
    if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter.');
    if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter.');
    if (!/[0-9]/.test(password)) errors.push('At least one number.');
    if (errors.length > 0) {
      setError(errors.join(' '));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message || 'Password reset successfully!');
        setDone(true);
      } else {
        setError(data.error || 'Something went wrong.');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  if (!token) {
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
          maxWidth: 380,
          width: '100%',
          textAlign: 'center',
        }}>
          <h2 style={{ color: '#e74c3c', marginBottom: 16 }}>Invalid Reset Link</h2>
          <p style={{ color: '#666', marginBottom: 20 }}>This password reset link is invalid or has expired.</p>
          <Link to="/forgot-password" style={{ color: '#667eea', fontWeight: 600 }}>Request a new reset link</Link>
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
      <form
        onSubmit={handleSubmit}
        style={{
          background: '#fff',
          padding: '2.5rem 2rem',
          borderRadius: '1rem',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          minWidth: 320,
          maxWidth: 380,
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <img src={process.env.PUBLIC_URL + '/logo.jpg'} alt="App Logo" className="page-logo" />
        </div>
        <h2 style={{ textAlign: 'center', marginBottom: 8, color: '#2d3a4b' }}>Reset Password</h2>
        <p style={{ textAlign: 'center', color: '#666', fontSize: 13, marginBottom: 24 }}>
          Must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number.
        </p>

        {!done && (
          <>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>New Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: '1px solid #bfc9d9',
                  fontSize: 16,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: '1px solid #bfc9d9',
                  fontSize: 16,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </>
        )}

        {error && <div style={{ color: '#e74c3c', marginBottom: 12, textAlign: 'center', fontSize: 14 }}>{error}</div>}
        {message && <div style={{ color: '#27ae60', marginBottom: 12, textAlign: 'center', fontSize: 14 }}>{message}</div>}

        {!done ? (
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 0',
              background: loading ? '#a0aec0' : 'linear-gradient(90deg, #667eea 0%, #5a67d8 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? 'default' : 'pointer',
              boxShadow: '0 2px 8px rgba(90,103,216,0.08)',
            }}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        ) : (
          <Link
            to="/"
            style={{
              display: 'block',
              width: '100%',
              padding: '12px 0',
              background: 'linear-gradient(90deg, #667eea 0%, #5a67d8 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 16,
              fontWeight: 600,
              textAlign: 'center',
              textDecoration: 'none',
              boxSizing: 'border-box',
            }}
          >
            Go to Login
          </Link>
        )}
      </form>
    </div>
  );
};

export default ResetPasswordPage;
