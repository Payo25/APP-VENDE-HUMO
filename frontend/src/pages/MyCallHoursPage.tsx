import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/api';

const API_BASE_URL = '/api';
const CALL_HOURS_URL = `${API_BASE_URL}/call-hours`;
const FORMS_URL = `${API_BASE_URL}/forms`;

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const getDateString = (year: number, month: number, day: number) => {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const getDaysInMonth = (month: number, year: number) => new Date(year, month, 0).getDate();

interface DayRow {
  date: Date;
  dateKey: string;
  hours: number;
  shiftLT3: number;
  shiftGT3: number;
  voluntary: number;
  cancelled: number;
}

interface WeekData {
  label: string;
  rows: DayRow[];
  totalHours: number;
  totalShiftLT3: number;
  totalShiftGT3: number;
  totalVoluntary: number;
  totalCancelled: number;
}

const MyCallHoursPage: React.FC = () => {
  const navigate = useNavigate();
  const userId = localStorage.getItem('userId');
  const userFullName = localStorage.getItem('fullName');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [assignments, setAssignments] = useState<any>({});
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      authFetch(`${CALL_HOURS_URL}?month=${month}&year=${year}`)
        .then(res => res.ok ? res.json() : {})
        .catch(() => ({})),
      authFetch(FORMS_URL)
        .then(res => res.ok ? res.json() : [])
        .catch(() => [])
    ]).then(([callData, formsData]) => {
      setAssignments(callData);
      setForms(formsData);
      setLoading(false);
    });
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

  // Get form counts for this user on a specific date
  const getFormCounts = (dateKey: string) => {
    const dayForms = forms.filter(f => {
      if (!f.createdByUserId || String(f.createdByUserId) !== String(userId)) return false;
      if (!f.date) return false;
      const formDateStr = f.date.split('T')[0];
      return formDateStr === dateKey;
    });
    return {
      shiftLT3: dayForms.filter(f => f.caseType === 'Shift<3').length,
      shiftGT3: dayForms.filter(f => f.caseType === 'Shift>3').length,
      voluntary: dayForms.filter(f => f.caseType === 'Voluntary').length,
      cancelled: dayForms.filter(f => f.caseType === 'Cancelled').length,
    };
  };

  // Build daily rows for the month
  const daysInMonth = getDaysInMonth(month, year);
  const dailyRows: DayRow[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dateKey = getDateString(year, month, d);
    const counts = getFormCounts(dateKey);
    dailyRows.push({ date, dateKey, hours: getMyHours(dateKey, date), ...counts });
  }

  // Group into weeks (Sun–Sat)
  const weeks: WeekData[] = [];
  let currentWeek: DayRow[] = [];
  let weekStart = '';
  for (const row of dailyRows) {
    if (currentWeek.length === 0) weekStart = `${String(month).padStart(2, '0')}/${String(row.date.getDate()).padStart(2, '0')}`;
    currentWeek.push(row);
    if (row.date.getDay() === 6 || row === dailyRows[dailyRows.length - 1]) {
      const weekEnd = `${String(month).padStart(2, '0')}/${String(row.date.getDate()).padStart(2, '0')}`;
      weeks.push({
        label: `${weekStart} - ${weekEnd}`,
        rows: currentWeek,
        totalHours: currentWeek.reduce((sum, r) => sum + r.hours, 0),
        totalShiftLT3: currentWeek.reduce((sum, r) => sum + r.shiftLT3, 0),
        totalShiftGT3: currentWeek.reduce((sum, r) => sum + r.shiftGT3, 0),
        totalVoluntary: currentWeek.reduce((sum, r) => sum + r.voluntary, 0),
        totalCancelled: currentWeek.reduce((sum, r) => sum + r.cancelled, 0),
      });
      currentWeek = [];
    }
  }

  const monthTotalHours = dailyRows.reduce((sum, r) => sum + r.hours, 0);
  const monthTotalShiftLT3 = dailyRows.reduce((sum, r) => sum + r.shiftLT3, 0);
  const monthTotalShiftGT3 = dailyRows.reduce((sum, r) => sum + r.shiftGT3, 0);
  const monthTotalVoluntary = dailyRows.reduce((sum, r) => sum + r.voluntary, 0);
  const monthTotalCancelled = dailyRows.reduce((sum, r) => sum + r.cancelled, 0);

  const btnStyle: React.CSSProperties = {
    width: '100%', padding: '12px 0',
    background: 'linear-gradient(90deg, #667eea 0%, #5a67d8 100%)',
    color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, fontWeight: 600,
    cursor: 'pointer', boxShadow: '0 2px 8px rgba(90,103,216,0.08)', marginBottom: 16
  };

  const thStyle: React.CSSProperties = { padding: 8, border: '1px solid #cbd5e1', textAlign: 'center', fontSize: 13 };
  const tdCenter: React.CSSProperties = { padding: 8, border: '1px solid #cbd5e1', textAlign: 'center' };

  const renderVal = (val: number, color: string) => (
    <td style={{ ...tdCenter, fontWeight: val > 0 ? 700 : 400, color: val > 0 ? color : '#999' }}>
      {val > 0 ? val : '-'}
    </td>
  );

  const renderHours = (val: number) => (
    <td style={{ ...tdCenter, fontWeight: val > 0 ? 700 : 400, color: val > 0 ? '#15803d' : '#999' }}>
      {val > 0 ? val.toFixed(2) : '-'}
    </td>
  );

  return (
    <div className="responsive-card" style={{ marginTop: 40, maxWidth: 1100, width: '100%' }}>
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
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: '#f8fafc', minWidth: 650 }}>
                  <thead>
                    <tr style={{ background: '#e2e8f0' }}>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Date</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Day</th>
                      <th style={thStyle}>Call Hour</th>
                      <th style={{ ...thStyle, color: '#b45309' }}>Shift&lt;3</th>
                      <th style={{ ...thStyle, color: '#9333ea' }}>Shift&gt;3</th>
                      <th style={{ ...thStyle, color: '#0369a1' }}>Voluntary</th>
                      <th style={{ ...thStyle, color: '#dc2626' }}>Cancelled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {week.rows.map((row, ri) => {
                      const hasActivity = row.hours > 0 || row.shiftLT3 > 0 || row.shiftGT3 > 0 || row.voluntary > 0 || row.cancelled > 0;
                      return (
                        <tr key={ri} style={{ background: hasActivity ? '#f0fdf4' : '#fff' }}>
                          <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>
                            {String(month).padStart(2, '0')}/{String(row.date.getDate()).padStart(2, '0')}/{year}
                          </td>
                          <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>{dayNames[row.date.getDay()]}</td>
                          {renderHours(row.hours)}
                          {renderVal(row.shiftLT3, '#b45309')}
                          {renderVal(row.shiftGT3, '#9333ea')}
                          {renderVal(row.voluntary, '#0369a1')}
                          {renderVal(row.cancelled, '#dc2626')}
                        </tr>
                      );
                    })}
                    <tr style={{ background: '#d1fae5', fontWeight: 700 }}>
                      <td colSpan={2} style={{ padding: 8, border: '1px solid #cbd5e1' }}>Week Total</td>
                      <td style={{ ...tdCenter, color: '#15803d' }}>{week.totalHours.toFixed(2)}</td>
                      <td style={{ ...tdCenter, color: '#b45309' }}>{week.totalShiftLT3 || '-'}</td>
                      <td style={{ ...tdCenter, color: '#9333ea' }}>{week.totalShiftGT3 || '-'}</td>
                      <td style={{ ...tdCenter, color: '#0369a1' }}>{week.totalVoluntary || '-'}</td>
                      <td style={{ ...tdCenter, color: '#dc2626' }}>{week.totalCancelled || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Month total */}
          <div style={{ background: '#bbf7d0', padding: 16, borderRadius: 8, fontWeight: 700, fontSize: 16, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
              <thead>
                <tr>
                  <th style={{ padding: 8, textAlign: 'left' }}>Total for {monthNames[month - 1]}</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>Call Hour</th>
                  <th style={{ padding: 8, textAlign: 'center', color: '#b45309' }}>Shift&lt;3</th>
                  <th style={{ padding: 8, textAlign: 'center', color: '#9333ea' }}>Shift&gt;3</th>
                  <th style={{ padding: 8, textAlign: 'center', color: '#0369a1' }}>Voluntary</th>
                  <th style={{ padding: 8, textAlign: 'center', color: '#dc2626' }}>Cancelled</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: 8 }}></td>
                  <td style={{ padding: 8, textAlign: 'center' }}>{monthTotalHours.toFixed(2)}</td>
                  <td style={{ padding: 8, textAlign: 'center', color: '#b45309' }}>{monthTotalShiftLT3 || '-'}</td>
                  <td style={{ padding: 8, textAlign: 'center', color: '#9333ea' }}>{monthTotalShiftGT3 || '-'}</td>
                  <td style={{ padding: 8, textAlign: 'center', color: '#0369a1' }}>{monthTotalVoluntary || '-'}</td>
                  <td style={{ padding: 8, textAlign: 'center', color: '#dc2626' }}>{monthTotalCancelled || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default MyCallHoursPage;
