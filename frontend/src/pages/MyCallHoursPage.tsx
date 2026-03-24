import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/api';

const API_BASE_URL = '/api';
const CALL_HOURS_URL = `${API_BASE_URL}/call-hours`;

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const getDateString = (year: number, month: number, day: number) => {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const getDaysInMonth = (month: number, year: number) => new Date(year, month, 0).getDate();

const MyCallHoursPage: React.FC = () => {
  const navigate = useNavigate();
  const userId = localStorage.getItem('userId');
  const userFullName = localStorage.getItem('fullName');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [assignments, setAssignments] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    authFetch(`${CALL_HOURS_URL}?month=${month}&year=${year}`)
      .then(res => res.ok ? res.json() : {})
      .then(data => { setAssignments(data); setLoading(false); })
      .catch(() => { setAssignments({}); setLoading(false); });
  }, [month, year]);

  // Get call hours for this user on a specific date
  const getMyHours = (dateKey: string, date: Date): number => {
    const assigned = assignments[dateKey] || [];
    if (assigned.length === 0) return 0;
    const dayOfWeek = date.getDay();
    if (typeof assigned[0] === 'object' && assigned[0] !== null && 'shift' in assigned[0]) {
      const entry: any = assigned.find((a: any) => String(a.id) === String(userId));
      if (!entry) return 0;
      if (entry.hours !== undefined) return (entry.hours || 0) + ((entry.minutes || 0) / 60);
      if (entry.shift === 'F') return (dayOfWeek === 0 || dayOfWeek === 6) ? 24 : 16;
      if (entry.shift === 'H') return (dayOfWeek === 0 || dayOfWeek === 6) ? 12 : 8;
      return 0;
    } else {
      if (!assigned.map((id: any) => String(id)).includes(String(userId))) return 0;
      return (dayOfWeek === 0 || dayOfWeek === 6) ? 24 : 16;
    }
  };

  // Build daily rows for the month
  const daysInMonth = getDaysInMonth(month, year);
  const dailyRows: { date: Date; dateKey: string; hours: number }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dateKey = getDateString(year, month, d);
    dailyRows.push({ date, dateKey, hours: getMyHours(dateKey, date) });
  }

  // Group into weeks (Sun–Sat)
  const weeks: { label: string; rows: typeof dailyRows; total: number }[] = [];
  let currentWeek: typeof dailyRows = [];
  let weekStart = '';
  for (const row of dailyRows) {
    if (currentWeek.length === 0) weekStart = `${String(month).padStart(2, '0')}/${String(row.date.getDate()).padStart(2, '0')}`;
    currentWeek.push(row);
    if (row.date.getDay() === 6 || row === dailyRows[dailyRows.length - 1]) {
      const weekEnd = `${String(month).padStart(2, '0')}/${String(row.date.getDate()).padStart(2, '0')}`;
      weeks.push({
        label: `${weekStart} - ${weekEnd}`,
        rows: currentWeek,
        total: currentWeek.reduce((sum, r) => sum + r.hours, 0)
      });
      currentWeek = [];
    }
  }

  const monthTotal = dailyRows.reduce((sum, r) => sum + r.hours, 0);

  const btnStyle: React.CSSProperties = {
    width: '100%', padding: '12px 0',
    background: 'linear-gradient(90deg, #667eea 0%, #5a67d8 100%)',
    color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, fontWeight: 600,
    cursor: 'pointer', boxShadow: '0 2px 8px rgba(90,103,216,0.08)', marginBottom: 16
  };

  return (
    <div className="responsive-card" style={{ marginTop: 40, maxWidth: 900, width: '100%' }}>
      <button onClick={() => navigate('/dashboard')} style={btnStyle}>← Back to Dashboard</button>
      <h2 style={{ marginBottom: 4 }}>📊 My On-Call Hours</h2>
      <p style={{ color: '#555', marginBottom: 16 }}>{userFullName}</p>

      {/* Month/Year selector */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <button onClick={() => { if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1); }}
          style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #d0d5dd', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>◀</button>
        <span style={{ fontWeight: 700, fontSize: 18 }}>{monthNames[month - 1]} {year}</span>
        <button onClick={() => { if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1); }}
          style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #d0d5dd', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>▶</button>
      </div>

      {loading ? <p>Loading...</p> : (
        <>
          {/* Weekly breakdown */}
          {weeks.map((week, wi) => (
            <div key={wi} style={{ marginBottom: 24 }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#4338ca' }}>Week: {week.label}</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#f8fafc' }}>
                <thead>
                  <tr style={{ background: '#e2e8f0' }}>
                    <th style={{ padding: 8, border: '1px solid #cbd5e1', textAlign: 'left' }}>Date</th>
                    <th style={{ padding: 8, border: '1px solid #cbd5e1', textAlign: 'left' }}>Day</th>
                    <th style={{ padding: 8, border: '1px solid #cbd5e1', textAlign: 'center' }}>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {week.rows.map((row, ri) => (
                    <tr key={ri} style={{ background: row.hours > 0 ? '#f0fdf4' : '#fff' }}>
                      <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
                        {String(month).padStart(2, '0')}/{String(row.date.getDate()).padStart(2, '0')}/{year}
                      </td>
                      <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>{dayNames[row.date.getDay()]}</td>
                      <td style={{ padding: 8, border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: row.hours > 0 ? 700 : 400, color: row.hours > 0 ? '#15803d' : '#999' }}>
                        {row.hours > 0 ? row.hours.toFixed(2) : '-'}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: '#d1fae5', fontWeight: 700 }}>
                    <td colSpan={2} style={{ padding: 8, border: '1px solid #cbd5e1' }}>Week Total</td>
                    <td style={{ padding: 8, border: '1px solid #cbd5e1', textAlign: 'center', color: '#15803d' }}>{week.total.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}

          {/* Month total */}
          <div style={{ background: '#bbf7d0', padding: 16, borderRadius: 8, textAlign: 'center', fontWeight: 700, fontSize: 18 }}>
            Total for {monthNames[month - 1]}: {monthTotal.toFixed(2)} hours
          </div>
        </>
      )}
    </div>
  );
};

export default MyCallHoursPage;
