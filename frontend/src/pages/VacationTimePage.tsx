import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/api';

const API_BASE_URL = '/api';

interface VacationEntry {
  id: number;
  user_id: number;
  user_name: string;
  vacation_date: string;
  hours: number;
  vacation_type: string;
  notes: string | null;
}

interface User {
  id: number;
  fullName: string;
  role: string;
  hourlyRate?: number;
}

const VACATION_TYPES = ['Vacation', 'PTO', 'Sick', 'Personal Day', 'Holiday'];
const ACCRUAL_RATE_PER_PERIOD = 1.54; // hours earned per 40-hour pay period (biweekly)

const VacationTimePage: React.FC = () => {
  const navigate = useNavigate();
  const userRole = localStorage.getItem('role');

  const [entries, setEntries] = useState<VacationEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formUserId, setFormUserId] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formHours, setFormHours] = useState('8');
  const [formType, setFormType] = useState('Vacation');
  const [formNotes, setFormNotes] = useState('');

  // Filter state
  const [filterUserId, setFilterUserId] = useState('');

  // Calculator state
  const [calcUserId, setCalcUserId] = useState('');
  const [startDate, setStartDate] = useState('');

  useEffect(() => {
    if (userRole !== 'Business Assistant' && userRole !== 'Team Leader' && userRole !== 'Scheduler') return;
    Promise.all([
      authFetch(`${API_BASE_URL}/vacation-time`).then(res => res.ok ? res.json() : []),
      authFetch(`${API_BASE_URL}/users`).then(res => res.ok ? res.json() : [])
    ]).then(([vacData, usersData]) => {
      setEntries(vacData);
      setUsers(usersData.filter((u: User) => u.role === 'Registered Surgical Assistant' || u.role === 'Team Leader'));
      setLoading(false);
    }).catch(() => {
      setError('Failed to load data');
      setLoading(false);
    });
  }, [userRole]);

  const fetchEntries = async () => {
    const url = filterUserId
      ? `${API_BASE_URL}/vacation-time?user_id=${filterUserId}`
      : `${API_BASE_URL}/vacation-time`;
    const res = await authFetch(url);
    if (res.ok) setEntries(await res.json());
  };

  const resetForm = () => {
    setEditId(null);
    setFormUserId('');
    setFormDate('');
    setFormHours('8');
    setFormType('Vacation');
    setFormNotes('');
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!formUserId || !formDate) {
      setError('Please select an RSA and date');
      return;
    }
    setError('');
    const body = {
      user_id: Number(formUserId),
      vacation_date: formDate,
      hours: parseFloat(formHours) || 8,
      vacation_type: formType,
      notes: formNotes || null
    };

    let res;
    if (editId) {
      res = await authFetch(`${API_BASE_URL}/vacation-time/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } else {
      res = await authFetch(`${API_BASE_URL}/vacation-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    }

    if (res.ok) {
      resetForm();
      await fetchEntries();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Failed to save');
    }
  };

  const handleEdit = (entry: VacationEntry) => {
    setEditId(entry.id);
    setFormUserId(String(entry.user_id));
    setFormDate(entry.vacation_date?.split('T')[0] || '');
    setFormHours(String(entry.hours));
    setFormType(entry.vacation_type);
    setFormNotes(entry.notes || '');
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this vacation entry?')) return;
    const res = await authFetch(`${API_BASE_URL}/vacation-time/${id}`, { method: 'DELETE' });
    if (res.ok) await fetchEntries();
  };

  // Vacation calculator
  const getCalcData = () => {
    if (!calcUserId || !startDate) return null;
    const today = new Date();
    const start = new Date(startDate + 'T00:00:00');
    if (isNaN(start.getTime())) return null;

    // Count biweekly periods from start date to today
    const msPerDay = 86400000;
    const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / msPerDay);
    if (daysSinceStart < 0) return { periodsWorked: 0, hoursEarned: 0, hoursUsed: 0, hoursRemaining: 0, daysUsed: 0, daysRemaining: 0 };

    const periodsWorked = Math.floor(daysSinceStart / 14);
    const hoursEarned = Number((periodsWorked * ACCRUAL_RATE_PER_PERIOD).toFixed(2));

    // Hours used from vacation entries for this user
    const hoursUsed = entries
      .filter(e => String(e.user_id) === calcUserId)
      .reduce((sum, e) => sum + (parseFloat(String(e.hours)) || 0), 0);

    const hoursRemaining = Number((hoursEarned - hoursUsed).toFixed(2));
    const daysUsed = Number((hoursUsed / 8).toFixed(1));
    const daysRemaining = Number((hoursRemaining / 8).toFixed(1));

    return { periodsWorked, hoursEarned, hoursUsed: Number(hoursUsed.toFixed(2)), hoursRemaining, daysUsed, daysRemaining };
  };

  const calcData = getCalcData();

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: 15, boxSizing: 'border-box' };
  const btnStyle: React.CSSProperties = { width: '100%', padding: '12px 0', background: 'linear-gradient(90deg, #667eea 0%, #5a67d8 100%)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(90,103,216,0.08)', transition: 'background 0.2s', marginBottom: 16 };

  if (userRole !== 'Business Assistant' && userRole !== 'Team Leader' && userRole !== 'Scheduler') {
    return (
      <div className="responsive-card" style={{ marginTop: 40 }}>
        <h2>Vacation Time</h2>
        <div style={{ color: 'red', marginBottom: 24 }}>Access denied.</div>
        <button onClick={() => navigate('/dashboard')} style={btnStyle}>← Back to Dashboard</button>
      </div>
    );
  }

  const filteredEntries = filterUserId
    ? entries.filter(e => String(e.user_id) === filterUserId)
    : entries;

  return (
    <div className="responsive-card" style={{ marginTop: 40, maxWidth: 1100, width: '100%' }}>
      <button onClick={() => navigate('/dashboard')} style={btnStyle}>← Back to Dashboard</button>
      <h2>Vacation Time Manager</h2>

      {error && <p style={{ color: 'red', marginBottom: 12 }}>{error}</p>}

      {/* Vacation Calculator */}
      <div style={{ background: '#f0fdf4', padding: 20, borderRadius: 10, marginBottom: 24, border: '1px solid #bbf7d0' }}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Vacation Calculator</h3>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontWeight: 600, fontSize: 13 }}>RSA</label>
            <select value={calcUserId} onChange={e => setCalcUserId(e.target.value)} style={inputStyle}>
              <option value="">Select RSA...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontWeight: 600, fontSize: 13 }}>Employment Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
          </div>
        </div>
        {calcData && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ background: '#fff', padding: '12px 20px', borderRadius: 8, flex: 1, minWidth: 140, textAlign: 'center', border: '1px solid #d1fae5' }}>
              <div style={{ fontSize: 13, color: '#666' }}>Periods Worked</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#1a237e' }}>{calcData.periodsWorked}</div>
            </div>
            <div style={{ background: '#fff', padding: '12px 20px', borderRadius: 8, flex: 1, minWidth: 140, textAlign: 'center', border: '1px solid #d1fae5' }}>
              <div style={{ fontSize: 13, color: '#666' }}>Hours Earned</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#15803d' }}>{calcData.hoursEarned}</div>
            </div>
            <div style={{ background: '#fff', padding: '12px 20px', borderRadius: 8, flex: 1, minWidth: 140, textAlign: 'center', border: '1px solid #d1fae5' }}>
              <div style={{ fontSize: 13, color: '#666' }}>Hours Used</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#dc2626' }}>{calcData.hoursUsed}</div>
            </div>
            <div style={{ background: '#fff', padding: '12px 20px', borderRadius: 8, flex: 1, minWidth: 140, textAlign: 'center', border: '1px solid #d1fae5' }}>
              <div style={{ fontSize: 13, color: '#666' }}>Hours Remaining</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: calcData.hoursRemaining >= 0 ? '#15803d' : '#dc2626' }}>{calcData.hoursRemaining}</div>
            </div>
            <div style={{ background: '#fff', padding: '12px 20px', borderRadius: 8, flex: 1, minWidth: 140, textAlign: 'center', border: '1px solid #d1fae5' }}>
              <div style={{ fontSize: 13, color: '#666' }}>Days Remaining</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: calcData.daysRemaining >= 0 ? '#15803d' : '#dc2626' }}>{calcData.daysRemaining}</div>
            </div>
          </div>
        )}
        <p style={{ fontSize: 12, color: '#888', marginTop: 8, marginBottom: 0 }}>
          Accrual rate: {ACCRUAL_RATE_PER_PERIOD} hours per biweekly pay period (~40 hours/year = 5 days)
        </p>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 200 }}>
          <label style={{ fontWeight: 600, fontSize: 13 }}>Filter by RSA</label>
          <select value={filterUserId} onChange={e => { setFilterUserId(e.target.value); }} style={inputStyle}>
            <option value="">All RSAs</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: '10px 24px', background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
          + Add Vacation
        </button>
      </div>

      {/* Re-fetch when filter changes */}
      {filterUserId !== '' && (
        <button onClick={fetchEntries} style={{ padding: '6px 16px', border: '1px solid #d0d5dd', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, marginBottom: 12 }}>
          Refresh
        </button>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <div style={{ background: '#f8fafc', padding: 20, borderRadius: 10, marginBottom: 24, border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginTop: 0 }}>{editId ? 'Edit Vacation Entry' : 'Add Vacation Entry'}</h3>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={{ fontWeight: 600, fontSize: 13 }}>RSA *</label>
              <select value={formUserId} onChange={e => setFormUserId(e.target.value)} style={inputStyle}>
                <option value="">Select RSA...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={{ fontWeight: 600, fontSize: 13 }}>Date *</label>
              <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={{ fontWeight: 600, fontSize: 13 }}>Hours</label>
              <input type="number" min="0" max="24" step="0.5" value={formHours} onChange={e => setFormHours(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ fontWeight: 600, fontSize: 13 }}>Type</label>
              <select value={formType} onChange={e => setFormType(e.target.value)} style={inputStyle}>
                {VACATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontWeight: 600, fontSize: 13 }}>Notes</label>
            <input value={formNotes} onChange={e => setFormNotes(e.target.value)} style={inputStyle} placeholder="Optional notes..." />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleSave} style={{ padding: '10px 28px', background: '#15803d', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
              {editId ? 'Update' : 'Add'}
            </button>
            <button onClick={resetForm} style={{ padding: '10px 28px', background: '#e2e8f0', color: '#333', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Entries Table */}
      {loading ? <p>Loading...</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'left' }}>RSA</th>
                <th style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'left' }}>Date</th>
                <th style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>Hours</th>
                <th style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'left' }}>Type</th>
                <th style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'left' }}>Notes</th>
                <th style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#888' }}>No vacation entries found</td></tr>
              ) : filteredEntries.map(entry => (
                <tr key={entry.id}>
                  <td style={{ padding: 10, border: '1px solid #e2e8f0' }}>{entry.user_name}</td>
                  <td style={{ padding: 10, border: '1px solid #e2e8f0' }}>{entry.vacation_date?.split('T')[0]}</td>
                  <td style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>{entry.hours}</td>
                  <td style={{ padding: 10, border: '1px solid #e2e8f0' }}>{entry.vacation_type}</td>
                  <td style={{ padding: 10, border: '1px solid #e2e8f0' }}>{entry.notes || ''}</td>
                  <td style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <button onClick={() => handleEdit(entry)} style={{ padding: '4px 12px', marginRight: 6, background: '#667eea', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>Edit</button>
                    <button onClick={() => handleDelete(entry.id)} style={{ padding: '4px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredEntries.length > 0 && (
            <div style={{ marginTop: 12, padding: 12, background: '#f0fdf4', borderRadius: 8, fontWeight: 600 }}>
              Total vacation hours: {filteredEntries.reduce((sum, e) => sum + (parseFloat(String(e.hours)) || 0), 0).toFixed(1)} hrs
              ({(filteredEntries.reduce((sum, e) => sum + (parseFloat(String(e.hours)) || 0), 0) / 8).toFixed(1)} days)
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VacationTimePage;
