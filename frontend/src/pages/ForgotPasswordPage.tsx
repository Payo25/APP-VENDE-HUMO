import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const ForgotPasswordPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message || 'If your account exists and is eligible, a reset link has been sent to your email.');
      } else {
        setError(data.error || 'Something went wrong.');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

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
        <h2 style={{ textAlign: 'center', marginBottom: 8, color: '#2d3a4b' }}>Forgot Password</h2>
        <p style={{ textAlign: 'center', color: '#666', fontSize: 14, marginBottom: 24 }}>
          Enter your email/username and we'll send a reset link to your registered email.
          <br /><span style={{ fontSize: 12, color: '#999' }}>Available for RSA and Team Leader accounts only.</span>
        </p>
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Email / Username</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
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
        {error && <div style={{ color: '#e74c3c', marginBottom: 12, textAlign: 'center', fontSize: 14 }}>{error}</div>}
        {message && <div style={{ color: '#27ae60', marginBottom: 12, textAlign: 'center', fontSize: 14 }}>{message}</div>}
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
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <Link to="/" style={{ color: '#667eea', fontSize: 14, textDecoration: 'none' }}>
            Back to Login
          </Link>
        </div>
      </form>
    </div>
  );
};

export default ForgotPasswordPage;
