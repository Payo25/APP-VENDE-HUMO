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

interface VacationRequest {
  id: number;
  user_id: number;
  request_type: string;
  request_date: string;
  hours: number;
  notes: string | null;
  status: string;
  review_notes: string | null;
  reviewer_name: string | null;
  created_at: string;
}

interface RateChange {
  id: number;
  user_id: number;
  old_rate: number;
  new_rate: number;
  effective_date: string;
}

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const getDaysInMonth = (m: number, y: number) => new Date(y, m, 0).getDate();
const getDateString = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

const MyVacationPage: React.FC = () => {
  const navigate = useNavigate();
  const userFullName = localStorage.getItem('fullName');
  const [profile, setProfile] = useState<VacationProfile | null>(null);
  const [entries, setEntries] = useState<VacationEntry[]>([]);
  const [rateChanges, setRateChanges] = useState<RateChange[]>([]);
  const [loading, setLoading] = useState(true);

  // Vacation request state
  const now = new Date();
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestType, setRequestType] = useState('Vacation');
  const [requestDate, setRequestDate] = useState('');
  const [requestHours, setRequestHours] = useState(8);
  const [requestNotes, setRequestNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    authFetch(`${API_BASE_URL}/my-vacation`)
      .then(res => res.ok ? res.json() : { profile: null, entries: [], rateChanges: [] })
      .then(data => {
        setProfile(data.profile);
        setEntries(data.entries);
        setRateChanges(data.rateChanges || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Fetch vacation requests
  const fetchVacationRequests = () => {
    authFetch(`${API_BASE_URL}/vacation-requests/mine`)
      .then(res => res.ok ? res.json() : [])
      .then(data => { if (Array.isArray(data)) setVacationRequests(data); })
      .catch(() => {});
  };
  useEffect(() => { fetchVacationRequests(); }, []);

  const handleSubmitRequest = async () => {
    if (!requestDate) return;
    setSubmitting(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/vacation-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_type: requestType, request_date: requestDate, hours: requestHours, notes: requestNotes }),
      });
      if (res.ok) {
        setShowRequestModal(false);
        setRequestDate('');
        setRequestType('Vacation');
        setRequestHours(8);
        setRequestNotes('');
        fetchVacationRequests();
      }
    } catch {}
    setSubmitting(false);
  };

  const handleCancelRequest = async (id: number) => {
    if (!window.confirm('Cancel this request?')) return;
    try {
      await authFetch(`${API_BASE_URL}/vacation-requests/${id}`, { method: 'DELETE' });
      fetchVacationRequests();
    } catch {}
  };

  // Map vacation requests by date for calendar overlay
  const vacReqByDate = vacationRequests.reduce((acc, r) => {
    const key = r.request_date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {} as { [date: string]: VacationRequest[] });

  // Compute vacation balance
  const getVacationBalance = () => {
    if (!profile) return null;
    const today = new Date();
    const start = new Date(profile.employment_start_date + 'T00:00:00');
    if (isNaN(start.getTime())) return null;
    const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / 86400000);
    if (daysSinceStart < 0) return { weeksWorked: 0, hoursEarned: 0, vacUsed: 0, vacRemaining: 0 };
    const weeksWorked = Math.floor(daysSinceStart / 7);

    // Segmented rate calculation using rate changes
    const userRateChanges = rateChanges
      .filter(rc => String(rc.user_id) === String(profile.user_id))
      .sort((a, b) => a.effective_date.localeCompare(b.effective_date));

    let hoursEarned = 0;
    if (userRateChanges.length === 0) {
      hoursEarned = weeksWorked * profile.accrual_rate;
    } else {
      const segments: { from: Date; to: Date; rate: number }[] = [];
      let segStart = start;
      let segRate = userRateChanges[0].old_rate ?? profile.accrual_rate;

      for (const rc of userRateChanges) {
        const changeDate = new Date(rc.effective_date + 'T00:00:00');
        if (changeDate > segStart) {
          segments.push({ from: segStart, to: changeDate, rate: Number(segRate) });
        }
        segStart = changeDate;
        segRate = rc.new_rate;
      }
      if (today > segStart) {
        segments.push({ from: segStart, to: today, rate: Number(segRate) });
      }

      for (const seg of segments) {
        const segTo = seg.to > today ? today : seg.to;
        if (segTo <= seg.from) continue;
        const segDays = Math.floor((segTo.getTime() - seg.from.getTime()) / 86400000);
        const segWeeks = Math.floor(segDays / 7);
        hoursEarned += segWeeks * seg.rate;
      }
    }

    hoursEarned = Number(hoursEarned.toFixed(2));
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

      {/* Request Vacation Calendar Section - always visible */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: '#b45309' }}>📅 Request Vacation / PTO</h3>
          <button
            onClick={() => setShowRequestModal(true)}
            style={{
              padding: '8px 20px', borderRadius: 6,
              background: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
              color: '#fff', border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer'
            }}
          >
            + New Request
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <label>Month:
            <select value={calMonth} onChange={e => setCalMonth(Number(e.target.value))} style={{ marginLeft: 8 }}>
              {monthNames.map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>
          </label>
          <label>Year:
            <input type="number" value={calYear} onChange={e => setCalYear(Number(e.target.value))} style={{ width: 80, marginLeft: 8 }} />
          </label>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: '#f6f8fa' }}>
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                  <th key={d} style={{ padding: 8, borderBottom: '1px solid #e2e8f0', width: 78, fontSize: 13 }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rows: React.JSX.Element[] = [];
                const daysInMonth = getDaysInMonth(calMonth, calYear);
                const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
                let day = 1;
                for (let week = 0; week < 6 && day <= daysInMonth; week++) {
                  const cells: React.JSX.Element[] = [];
                  for (let d = 0; d < 7; d++) {
                    if ((week === 0 && d < firstDay) || day > daysInMonth) {
                      cells.push(<td key={d} style={{ padding: 6, minHeight: 70, background: '#f6f8fa', border: '1px solid #e2e8f0' }} />);
                    } else {
                      const thisDay = day;
                      const dateKey = getDateString(calYear, calMonth, thisDay);
                      const dayVacReqs = vacReqByDate[dateKey] || [];
                      const hasApproved = dayVacReqs.some(r => r.status === 'Approved');
                      const hasPending = dayVacReqs.some(r => r.status === 'Pending');
                      cells.push(
                        <td key={d} style={{
                          padding: 6, minHeight: 70, border: '1px solid #e2e8f0', verticalAlign: 'top',
                          background: hasApproved ? '#dcfce7' : hasPending ? '#fef9c3' : 'transparent',
                          cursor: 'pointer'
                        }}
                        onClick={() => { setRequestDate(dateKey); setShowRequestModal(true); }}
                        >
                          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>{thisDay}</div>
                          {dayVacReqs.map((vr) => {
                            const colors: Record<string, {bg:string,fg:string}> = {
                              Pending: { bg: '#fbbf24', fg: '#78350f' },
                              Approved: { bg: '#22c55e', fg: '#fff' },
                              Denied: { bg: '#ef4444', fg: '#fff' },
                            };
                            const c = colors[vr.status] || colors.Pending;
                            return (
                              <div key={`vr-${vr.id}`} style={{
                                marginBottom: 3, padding: '2px 5px', background: c.bg, color: c.fg,
                                borderRadius: 4, fontSize: 10, fontWeight: 700, textAlign: 'center',
                                cursor: vr.status === 'Pending' ? 'pointer' : 'default'
                              }}
                              onClick={(e) => { e.stopPropagation(); if (vr.status === 'Pending') handleCancelRequest(vr.id); }}>
                                {vr.request_type === 'PTO' ? '📋' : '🌴'} {vr.request_type} - {vr.status}
                                {vr.status === 'Pending' && <span style={{ fontSize: 9, display: 'block' }}>click to cancel</span>}
                              </div>
                            );
                          })}
                        </td>
                      );
                      day++;
                    }
                  }
                  rows.push(<tr key={week}>{cells}</tr>);
                }
                return rows;
              })()}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12 }}>
          <span>🟡 Pending</span>
          <span>🟢 Approved</span>
          <span>🔴 Denied</span>
          <span style={{ color: '#888' }}>Click a date to request</span>
        </div>
      </div>

      {/* My Vacation Requests Table */}
      {vacationRequests.length > 0 && (
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 12px 0', color: '#b45309' }}>🏖️ My Vacation / PTO Requests</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f6f8fa' }}>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Date</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Type</th>
                  <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e2e8f0' }}>Hours</th>
                  <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e2e8f0' }}>Status</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Notes</th>
                  <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e2e8f0' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {vacationRequests.map(r => {
                  const statusColors: Record<string, string> = { Pending: '#f59e0b', Approved: '#22c55e', Denied: '#ef4444' };
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: 8 }}>{r.request_date}</td>
                      <td style={{ padding: 8 }}>{r.request_type === 'PTO' ? '📋 PTO' : '🌴 Vacation'}</td>
                      <td style={{ padding: 8, textAlign: 'center' }}>{r.hours}</td>
                      <td style={{ padding: 8, textAlign: 'center' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 12, background: statusColors[r.status] || '#999', color: '#fff', fontWeight: 700, fontSize: 12 }}>{r.status}</span>
                      </td>
                      <td style={{ padding: 8, fontSize: 12 }}>
                        {r.notes && <div>{r.notes}</div>}
                        {r.review_notes && <div style={{ color: '#6b7280', fontStyle: 'italic' }}>Reviewer: {r.review_notes}</div>}
                        {r.reviewer_name && <div style={{ color: '#6b7280', fontSize: 11 }}>By: {r.reviewer_name}</div>}
                      </td>
                      <td style={{ padding: 8, textAlign: 'center' }}>
                        {r.status === 'Pending' && (
                          <button onClick={() => handleCancelRequest(r.id)} style={{ padding: '4px 12px', borderRadius: 4, background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Cancel</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Request Modal */}
      {showRequestModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, minWidth: 380, maxWidth: 460, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 20px 0' }}>🏖️ Request Vacation / PTO</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Type</label>
              <select value={requestType} onChange={e => setRequestType(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}>
                <option value="Vacation">🌴 Vacation</option>
                <option value="PTO">📋 PTO</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Date</label>
              <input type="date" value={requestDate} onChange={e => setRequestDate(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Hours</label>
              <input type="number" value={requestHours} min={1} max={24} onChange={e => setRequestHours(Number(e.target.value))} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Notes (optional)</label>
              <textarea value={requestNotes} onChange={e => setRequestNotes(e.target.value)} rows={3} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRequestModal(false)} style={{ padding: '8px 20px', borderRadius: 6, background: '#e5e7eb', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSubmitRequest} disabled={submitting || !requestDate} style={{ padding: '8px 20px', borderRadius: 6, background: !requestDate ? '#9ca3af' : 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)', color: '#fff', border: 'none', fontWeight: 600, cursor: requestDate ? 'pointer' : 'default' }}>{submitting ? 'Submitting...' : 'Submit Request'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyVacationPage;
