import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/api';

const API_BASE_URL = '/api';

interface VacationProfile {
  id: number;
  user_id: number;
  user_name: string;
  employment_start_date: string;
  accrual_rate: number;
  pto: number;
  notes: string | null;
}

interface VacationEntry {
  id: number;
  user_id: number;
  vacation_date: string;
  hours: number;
  vacation_type: string;
  notes: string | null;
}

const MyVacationPage: React.FC = () => {
  const navigate = useNavigate();
  const userFullName = localStorage.getItem('fullName');
  const [profile, setProfile] = useState<VacationProfile | null>(null);
  const [entries, setEntries] = useState<VacationEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch(`${API_BASE_URL}/my-vacation`)
      .then(res => res.ok ? res.json() : { profile: null, entries: [] })
      .then(data => {
        setProfile(data.profile);
        setEntries(data.entries);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Compute vacation balance
  const getVacationBalance = () => {
    if (!profile) return null;
    const today = new Date();
    const start = new Date(profile.employment_start_date + 'T00:00:00');
    if (isNaN(start.getTime())) return null;
    const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / 86400000);
    if (daysSinceStart < 0) return { weeksWorked: 0, hoursEarned: 0, vacUsed: 0, vacRemaining: 0 };
    const weeksWorked = Math.floor(daysSinceStart / 7);
    const hoursEarned = Number((weeksWorked * profile.accrual_rate).toFixed(2));
    const vacUsed = entries
      .filter(e => e.vacation_type === 'Vacation')
      .reduce((sum, e) => sum + (parseFloat(String(e.hours)) || 0), 0);
    const vacRemaining = Number((hoursEarned - vacUsed).toFixed(2));
    return { weeksWorked, hoursEarned, vacUsed: Number(vacUsed.toFixed(2)), vacRemaining };
  };

  // Compute PTO balance
  const getPtoBalance = () => {
    if (!profile) return null;
    const ptoTotal = profile.pto || 0;
    const ptoUsed = entries
      .filter(e => e.vacation_type === 'PTO')
      .reduce((sum, e) => sum + (parseFloat(String(e.hours)) || 0), 0);
    const ptoRemaining = Number((ptoTotal - ptoUsed).toFixed(2));
    return { ptoTotal, ptoUsed: Number(ptoUsed.toFixed(2)), ptoRemaining };
  };

  const vacBalance = getVacationBalance();
  const ptoBalance = getPtoBalance();

  const btnStyle: React.CSSProperties = {
    width: '100%', padding: '12px 0',
    background: 'linear-gradient(90deg, #667eea 0%, #5a67d8 100%)',
    color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, fontWeight: 600,
    cursor: 'pointer', boxShadow: '0 2px 8px rgba(90,103,216,0.08)', marginBottom: 16
  };

  const cardStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0'
  };

  const statBox = (label: string, value: string, color: string, bg: string): React.ReactNode => (
    <div style={{ flex: 1, textAlign: 'center', padding: 16, borderRadius: 10, background: bg, minWidth: 120 }}>
      <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
    </div>
  );

  return (
    <div className="responsive-card" style={{ marginTop: 40, maxWidth: 900, width: '100%' }}>
      <button onClick={() => navigate('/dashboard')} style={btnStyle}>← Back to Dashboard</button>
      <h2 style={{ marginBottom: 4 }}>🏖️ My Vacation & PTO</h2>
      <p style={{ color: '#555', marginBottom: 20 }}>{userFullName}</p>

      {loading ? <p>Loading...</p> : !profile ? (
        <div style={{ ...cardStyle, textAlign: 'center', color: '#888' }}>
          <p style={{ fontSize: 18 }}>No vacation profile found.</p>
          <p>Please contact your Business Assistant to set up your vacation profile.</p>
        </div>
      ) : (
        <>
          {/* Vacation Balance Card */}
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 16px 0', color: '#15803d' }}>🌴 Vacation Balance</h3>
            {vacBalance && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {statBox('Weeks Worked', String(vacBalance.weeksWorked), '#4338ca', '#f0f4ff')}
                {statBox('Accrual Rate', `${profile.accrual_rate} hrs/wk`, '#6366f1', '#f0f4ff')}
                {statBox('Hours Earned', String(vacBalance.hoursEarned), '#15803d', '#f0fdf4')}
                {statBox('Hours Used', String(vacBalance.vacUsed), '#dc2626', '#fef2f2')}
                {statBox('Remaining', String(vacBalance.vacRemaining), vacBalance.vacRemaining >= 0 ? '#15803d' : '#dc2626', vacBalance.vacRemaining >= 0 ? '#dcfce7' : '#fee2e2')}
              </div>
            )}
          </div>

          {/* PTO Balance Card */}
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 16px 0', color: '#7c3aed' }}>📋 PTO Balance</h3>
            {ptoBalance && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {statBox('PTO Allocated', `${ptoBalance.ptoTotal} hrs`, '#7c3aed', '#f5f3ff')}
                {statBox('PTO Used', `${ptoBalance.ptoUsed} hrs`, '#dc2626', '#fef2f2')}
                {statBox('PTO Remaining', `${ptoBalance.ptoRemaining} hrs`, ptoBalance.ptoRemaining >= 0 ? '#15803d' : '#dc2626', ptoBalance.ptoRemaining >= 0 ? '#dcfce7' : '#fee2e2')}
              </div>
            )}
          </div>

          {/* Usage History */}
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 16px 0', color: '#1e40af' }}>📝 Usage History</h3>
            {entries.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center' }}>No vacation or PTO entries yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 450 }}>
                  <thead>
                    <tr style={{ background: '#e2e8f0' }}>
                      <th style={{ padding: 10, border: '1px solid #cbd5e1', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: 10, border: '1px solid #cbd5e1', textAlign: 'center' }}>Type</th>
                      <th style={{ padding: 10, border: '1px solid #cbd5e1', textAlign: 'center' }}>Hours</th>
                      <th style={{ padding: 10, border: '1px solid #cbd5e1', textAlign: 'left' }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(entry => {
                      const typeColor = entry.vacation_type === 'PTO' ? '#7c3aed' : entry.vacation_type === 'Sick' ? '#dc2626' : '#15803d';
                      const typeBg = entry.vacation_type === 'PTO' ? '#f5f3ff' : entry.vacation_type === 'Sick' ? '#fef2f2' : '#f0fdf4';
                      return (
                        <tr key={entry.id}>
                          <td style={{ padding: 10, border: '1px solid #cbd5e1' }}>
                            {entry.vacation_date?.split('T')[0] || ''}
                          </td>
                          <td style={{ padding: 10, border: '1px solid #cbd5e1', textAlign: 'center' }}>
                            <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 13, fontWeight: 600, color: typeColor, background: typeBg }}>
                              {entry.vacation_type}
                            </span>
                          </td>
                          <td style={{ padding: 10, border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 700 }}>
                            {entry.hours}
                          </td>
                          <td style={{ padding: 10, border: '1px solid #cbd5e1', color: '#666' }}>
                            {entry.notes || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Employment Info */}
          <div style={{ ...cardStyle, background: '#f8fafc' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#475569' }}>ℹ️ Employment Info</h3>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 14, color: '#555' }}>
              <div><strong>Start Date:</strong> {profile.employment_start_date?.split('T')[0]}</div>
              <div><strong>Accrual Rate:</strong> {profile.accrual_rate} hrs/week</div>
              <div><strong>PTO Allocated:</strong> {profile.pto || 0} hrs</div>
            </div>
            {profile.notes && <div style={{ marginTop: 8, fontSize: 14, color: '#666' }}><strong>Notes:</strong> {profile.notes}</div>}
          </div>
        </>
      )}
    </div>
  );
};

export default MyVacationPage;
