import React from 'react';

const NotFoundPage: React.FC = () => (
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
      maxWidth: 400,
      width: '100%',
      textAlign: 'center',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
        <img src={process.env.PUBLIC_URL + '/logo.jpg'} alt="App Logo" className="page-logo" />
      </div>
      <h2 style={{ color: '#e74c3c', marginBottom: 16 }}>404 - Not Found</h2>
      <p style={{ color: '#4a5568' }}>The page you are looking for does not exist.</p>
    </div>
  </div>
);

export default NotFoundPage;
