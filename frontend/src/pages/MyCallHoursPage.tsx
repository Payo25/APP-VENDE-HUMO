import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/api';

const API_BASE_URL = '/api';
const CALL_HOURS_URL = `${API_BASE_URL}/call-hours`;
const FORMS_URL = `${API_BASE_URL}/forms`;

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [assignments, setAssignments] = useState<any>({});
  const [forms, setForms] = useState<any[]>([]);
  const [hourlyRate, setHourlyRate] = useState(3.00);
  const [loading, setLoading] = useState(false);

  // Fetch user's hourly rate and forms once on mount
  useEffect(() => {
    authFetch(`${API_BASE_URL}/me`)
      .then(res => res.ok ? res.json() : {})
      .then((data: any) => { if (data.hourlyRate) setHourlyRate(data.hourlyRate); })
      .catch(() => {});
    authFetch(FORMS_URL)
      .then(res => res.ok ? res.json() : [])
      .then(data => setForms(data))
      .catch(() => {});
  }, []);

  // Fetch call hours for all months in the date range
  useEffect(() => {
    if (!fromDate || !toDate) return;
    setLoading(true);
    const from = parseDate(fromDate);
    const to = parseDate(toDate);
    const monthsToFetch = new Set<string>();
    let cur = new Date(from);
    while (cur <= to) {
      monthsToFetch.add(`${cur.getFullYear()}-${cur.getMonth() + 1}`);
      cur.setMonth(cur.getMonth() + 1);
      cur.setDate(1);
    }
    Promise.all(Array.from(monthsToFetch).map(key => {
      const [y, m] = key.split('-');
      return authFetch(`${CALL_HOURS_URL}?month=${m}&year=${y}`)
        .then(res => res.ok ? res.json() : {})
        .catch(() => ({}));
    })).then(results => {
      const merged: any = {};
      results.forEach(r => Object.assign(merged, r));
      setAssignments(merged);
      setLoading(false);
    });
  }, [fromDate, toDate]);

  const parseDate = (str: string) => {
    const [yyyy, mm, dd] = str.split('-');
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  };

  const formatDateDisplay = (d: Date) =>
    `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;

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
      return f.date.split('T')[0] === dateKey;
    });
    return {
      shiftLT3: dayForms.filter(f => f.caseType === 'Shift<3').length,
      shiftGT3: dayForms.filter(f => f.caseType === 'Shift>3').length,
      voluntary: dayForms.filter(f => f.caseType === 'Voluntary').length,
      cancelled: dayForms.filter(f => f.caseType === 'Cancelled').length,
    };
  };

  // Build daily rows for the date range
  const buildRows = (): DayRow[] => {
    if (!fromDate || !toDate) return [];
    const from = parseDate(fromDate);
    const to = parseDate(toDate);
    const rows: DayRow[] = [];
    let d = new Date(from);
    while (d <= to) {
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const counts = getFormCounts(dateKey);
      rows.push({ date: new Date(d), dateKey, hours: getMyHours(dateKey, d), ...counts });
      d.setDate(d.getDate() + 1);
    }
    return rows;
  };

  const dailyRows = buildRows();

  // Group into weeks (Sun–Sat)
  const weeks: WeekData[] = [];
  let currentWeek: DayRow[] = [];
  let weekStart = '';
  for (const row of dailyRows) {
    if (currentWeek.length === 0) weekStart = formatDateDisplay(row.date);
    currentWeek.push(row);
    if (row.date.getDay() === 6 || row === dailyRows[dailyRows.length - 1]) {
      const weekEnd = formatDateDisplay(row.date);
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

  const totalHours = dailyRows.reduce((sum, r) => sum + r.hours, 0);
  const totalShiftLT3 = dailyRows.reduce((sum, r) => sum + r.shiftLT3, 0);
  const totalShiftGT3 = dailyRows.reduce((sum, r) => sum + r.shiftGT3, 0);
  const totalVoluntary = dailyRows.reduce((sum, r) => sum + r.voluntary, 0);
  const totalCancelled = dailyRows.reduce((sum, r) => sum + r.cancelled, 0);

  const callHourPay = Number((totalHours * hourlyRate).toFixed(2));
  const shiftLT3Pay = totalShiftLT3 * 100;
  const shiftGT3Pay = totalShiftGT3 * 150;
  const voluntaryPay = totalVoluntary * 150;
  const cancelledPay = totalCancelled * 50;
  const totalPay = callHourPay + shiftLT3Pay + shiftGT3Pay + voluntaryPay + cancelledPay;

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

      {/* From / To date range */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <label style={{ fontWeight: 600 }}>From:
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            style={{ marginLeft: 8, padding: '6px 10px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: 15 }} />
        </label>
        <label style={{ fontWeight: 600 }}>To:
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            style={{ marginLeft: 8, padding: '6px 10px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: 15 }} />
        </label>
      </div>

      {!fromDate || !toDate ? (
        <p style={{ color: '#888', textAlign: 'center', padding: 40 }}>Select a date range above to view your on-call hours.</p>
      ) : loading ? <p>Loading...</p> : (
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
                          <td style={{ padding: 8, border: '1px solid #cbd5e1' }}>{formatDateDisplay(row.date)}</td>
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

          {/* Grand totals + Amount Earned */}
          <div style={{ background: '#e2e8f0', padding: 16, borderRadius: 8, fontWeight: 700, fontSize: 15, overflowX: 'auto', marginBottom: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr>
                  <th style={{ padding: 8, textAlign: 'left' }}>Total</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>Call Hours</th>
                  <th style={{ padding: 8, textAlign: 'center', color: '#b45309' }}>Shift&lt;3</th>
                  <th style={{ padding: 8, textAlign: 'center', color: '#9333ea' }}>Shift&gt;3</th>
                  <th style={{ padding: 8, textAlign: 'center', color: '#0369a1' }}>Voluntary</th>
                  <th style={{ padding: 8, textAlign: 'center', color: '#dc2626' }}>Cancelled</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: 8 }}>Count</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>{totalHours.toFixed(2)}</td>
                  <td style={{ padding: 8, textAlign: 'center', color: '#b45309' }}>{totalShiftLT3 || '-'}</td>
                  <td style={{ padding: 8, textAlign: 'center', color: '#9333ea' }}>{totalShiftGT3 || '-'}</td>
                  <td style={{ padding: 8, textAlign: 'center', color: '#0369a1' }}>{totalVoluntary || '-'}</td>
                  <td style={{ padding: 8, textAlign: 'center', color: '#dc2626' }}>{totalCancelled || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ background: '#d1fae5', padding: 16, borderRadius: 8, fontWeight: 700, fontSize: 15, overflowX: 'auto', marginBottom: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <tbody>
                <tr>
                  <td style={{ padding: 8 }}>Amount Earned</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>${callHourPay.toFixed(2)}</td>
                  <td style={{ padding: 8, textAlign: 'center', color: '#b45309' }}>${shiftLT3Pay.toFixed(2)}</td>
                  <td style={{ padding: 8, textAlign: 'center', color: '#9333ea' }}>${shiftGT3Pay.toFixed(2)}</td>
                  <td style={{ padding: 8, textAlign: 'center', color: '#0369a1' }}>${voluntaryPay.toFixed(2)}</td>
                  <td style={{ padding: 8, textAlign: 'center', color: '#dc2626' }}>${cancelledPay.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ background: '#bbf7d0', padding: 16, borderRadius: 8, fontWeight: 700, fontSize: 18, textAlign: 'center' }}>
            💰 Total Earned: ${totalPay.toFixed(2)}
          </div>
        </>
      )}
    </div>
  );
};

export default MyCallHoursPage;
