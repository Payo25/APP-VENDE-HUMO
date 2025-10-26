import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Use relative URLs for API endpoints so frontend works both locally and when deployed
const API_BASE_URL = '/api';
const API_URL = `${API_BASE_URL}/users`;

const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Registered Surgical Assistant');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editHourlyRate, setEditHourlyRate] = useState('3.00');
  const [changingPasswordUser, setChangingPasswordUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [retypePassword, setRetypePassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState('');
  const navigate = useNavigate();
  const userRole = localStorage.getItem('role');

  useEffect(() => {
    if (userRole !== 'Admin') return;
    fetch(API_URL)
      .then(res => res.json())
      .then(setUsers)
      .catch(() => setError('Failed to fetch users'));
  }, [userRole, success]);

  if (userRole !== 'Admin') {
    return (
      <div className="responsive-card" style={{ marginTop: 40 }}>
        <h2>User Management</h2>
        <div style={{ color: 'red', marginBottom: 24 }}>Access denied. Only Admins can manage users.</div>
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email || !password || !role || !fullName) {
      setError('All fields are required.');
      return;
    }
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password, role, fullName }),
    });
    if (res.ok) {
      setSuccess('User created successfully.');
      setEmail('');
      setPassword('');
      setRole('Registered Surgical Assistant');
      setFullName('');
    } else {
      setError('Failed to create user.');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setSuccess('User deleted.');
      setUsers(users.filter(u => u.id !== id));
    } else {
      setError('Failed to delete user.');
    }
  };

  const openEditUser = (user: any) => {
    setEditingUser(user);
    setEditFullName(user.fullName || '');
    setEditEmail(user.username || '');
    setEditRole(user.role || '');
    setEditHourlyRate(user.hourlyRate?.toString() || '3.00');
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const res = await fetch(`${API_URL}/${editingUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        role: editRole, 
        fullName: editFullName, 
        username: editEmail, 
        hourlyRate: parseFloat(editHourlyRate) || 3.00,
        actor: localStorage.getItem('user') 
      }),
    });
    if (res.ok) {
      setUsers(users.map(u => u.id === editingUser.id ? { 
        ...u, 
        role: editRole, 
        fullName: editFullName, 
        username: editEmail,
        hourlyRate: parseFloat(editHourlyRate) 
      } : u));
      setEditingUser(null);
    }
  };

  const openChangePassword = (user: any) => {
    setChangingPasswordUser(user);
    setNewPassword('');
    setRetypePassword('');
    setPasswordChangeError('');
    setPasswordChangeSuccess('');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changingPasswordUser || !newPassword) return;
    if (newPassword !== retypePassword) {
      setPasswordChangeError('Passwords do not match.');
      return;
    }
    setPasswordChangeError('');
    setPasswordChangeSuccess('');
    const res = await fetch(`${API_URL}/${changingPasswordUser.id}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword, actor: localStorage.getItem('user') })
    });
    if (res.ok) {
      setPasswordChangeSuccess('Password changed successfully.');
      setTimeout(() => setChangingPasswordUser(null), 1000);
    } else {
      setPasswordChangeError('Failed to change password.');
    }
  };

  return (
    <div
      role="main"
      aria-label="User Management Section"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div className="responsive-card" style={{ maxWidth: 850, width: '100%' }}>
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
          <img src={process.env.PUBLIC_URL + '/logo.jpg'} alt="App Logo" style={{ height: 128, maxWidth: '90%' }} />
        </div>
        <h2>User Management</h2>
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
            User List
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
            Create User
          </button>
        </div>
        {/* Tab Content */}
        {activeTab === 'list' && (
          <div>
            <h3 style={{ marginBottom: 12 }}>User List</h3>
            {error && <div style={{ color: '#e74c3c', marginBottom: 12 }}>{error}</div>}
            <table style={{ width: '100%', fontSize: 14, marginBottom: 16 }}>
              <thead>
                <tr style={{ background: '#f6f8fa' }}>
                  <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Full Name</th>
                  <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Email</th>
                  <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Role</th>
                  <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: 16, color: '#888' }}>No users found.</td>
                  </tr>
                )}
                {users.map((user) => (
                  <tr key={user.id}>
                    <td style={{ padding: 8 }}>{user.fullName || ''}</td>
                    <td style={{ padding: 8 }}>{user.username}</td>
                    <td style={{ padding: 8 }}>{user.role}</td>
                    <td style={{ padding: 8 }}>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        style={{
                          padding: '6px 16px',
                          borderRadius: 6,
                          background: 'linear-gradient(90deg, #e74c3c 0%, #e67e22 100%)',
                          color: '#fff',
                          border: 'none',
                          fontWeight: 600,
                          fontSize: 14,
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(231,76,60,0.08)',
                          transition: 'background 0.2s',
                          marginRight: 8
                        }}
                        aria-label={`Delete user ${user.username}`}
                      >
                        ❌
                      </button>
                      <button
                        onClick={() => openEditUser(user)}
                        style={{
                          padding: '6px 16px',
                          borderRadius: 6,
                          background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
                          color: '#fff',
                          border: 'none',
                          fontWeight: 600,
                          fontSize: 14,
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(67,206,162,0.08)',
                          transition: 'background 0.2s',
                          marginRight: 8
                        }}
                        aria-label={`Edit user ${user.username}`}
                      >
                        ✏
                      </button>
                      <button
                        onClick={() => openChangePassword(user)}
                        style={{
                          padding: '6px 16px',
                          borderRadius: 6,
                          background: 'linear-gradient(90deg, #ffb347 0%, #ffcc33 100%)',
                          color: '#2d3a4b',
                          border: 'none',
                          fontWeight: 600,
                          fontSize: 14,
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(255,204,51,0.08)',
                          transition: 'background 0.2s',
                        }}
                        aria-label={`Change password for ${user.username}`}
                      >
                        🔑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Edit User Modal */}
            {editingUser && (
              <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                <div style={{ background: '#fff', padding: 32, borderRadius: 12, minWidth: 320, maxWidth: 400, width: '100%' }}>
                  <h3>Edit User</h3>
                  <form onSubmit={handleEditUser} style={{ textAlign: 'left' }}>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Full Name</label>
                      <input
                        type="text"
                        value={editFullName}
                        onChange={e => setEditFullName(e.target.value)}
                        required
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Email</label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={e => setEditEmail(e.target.value)}
                        required
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Role</label>
                      <select
                        value={editRole}
                        onChange={e => setEditRole(e.target.value)}
                        required
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }}
                      >
                        <option value="Admin">Admin</option>
                        <option value="Business Assistant">Business Assistant</option>
                        <option value="Registered Surgical Assistant">Registered Surgical Assistant</option>
                      </select>
                    </div>
                    {editRole === 'Registered Surgical Assistant' && (
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Hourly Rate ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editHourlyRate}
                          onChange={e => setEditHourlyRate(e.target.value)}
                          required
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }}
                        />
                        <small style={{ color: '#666', fontSize: 13 }}>Default is $3.00 per hour</small>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button type="button" onClick={() => setEditingUser(null)} style={{ padding: '8px 20px', borderRadius: 6, background: '#eee', color: '#2d3a4b', border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>Cancel</button>
                      <button type="submit" style={{ padding: '8px 20px', borderRadius: 6, background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>Save</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            {/* Change Password Modal */}
            {changingPasswordUser && (
              <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                <div style={{ background: '#fff', padding: 32, borderRadius: 12, minWidth: 320, maxWidth: 400, width: '100%' }}>
                  <h3>Change Password for {changingPasswordUser.fullName || changingPasswordUser.username}</h3>
                  <form onSubmit={handleChangePassword} style={{ textAlign: 'left' }}>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        required
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Retype New Password</label>
                      <input
                        type="password"
                        value={retypePassword}
                        onChange={e => setRetypePassword(e.target.value)}
                        required
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #bfc9d9', fontSize: 16, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    {passwordChangeError && <div style={{ color: '#e74c3c', marginBottom: 12 }}>{passwordChangeError}</div>}
                    {passwordChangeSuccess && <div style={{ color: '#43cea2', marginBottom: 12 }}>{passwordChangeSuccess}</div>}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button type="button" onClick={() => setChangingPasswordUser(null)} style={{ padding: '8px 20px', borderRadius: 6, background: '#eee', color: '#2d3a4b', border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>Cancel</button>
                      <button type="submit" style={{ padding: '8px 20px', borderRadius: 6, background: 'linear-gradient(90deg, #ffb347 0%, #ffcc33 100%)', color: '#2d3a4b', border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>Change</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'create' && (
          <div>
            <h3 style={{ marginBottom: 12 }}>Create User</h3>
            {error && <div style={{ color: '#e74c3c', marginBottom: 12 }}>{error}</div>}
            {success && <div style={{ color: '#43cea2', marginBottom: 12 }}>{success}</div>}
            <form onSubmit={handleCreateUser} style={{ maxWidth: 350, margin: '0 auto', textAlign: 'left' }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1px solid #bfc9d9',
                    fontSize: 16,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1px solid #bfc9d9',
                    fontSize: 16,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Password</label>
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
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', marginBottom: 6, color: '#2d3a4b', fontWeight: 500 }}>Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1px solid #bfc9d9',
                    fontSize: 16,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="Admin">Admin</option>
                  <option value="Business Assistant">Business Assistant</option>
                  <option value="Registered Surgical Assistant">Registered Surgical Assistant</option>
                </select>
              </div>
              <button
                type="submit"
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
                  transition: 'background 0.2s'
                }}
              >
                Create User
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagementPage;
