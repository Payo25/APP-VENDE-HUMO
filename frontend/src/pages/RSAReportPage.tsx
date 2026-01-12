import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveAs } from 'file-saver';
import { formatDate } from '../utils/dateFormat';

const API_BASE_URL = '/api';
const FORMS_API_URL = `${API_BASE_URL}/forms`;
const USERS_API_URL = `${API_BASE_URL}/users`;
const CALL_HOURS_API_URL = `${API_BASE_URL}/call-hours`;

const getDaysInMonth = (month: number, year: number) => {
  return new Date(year, month, 0).getDate();
};

const getDayName = (date: Date) => {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
};

const PayrollPage: React.FC = () => {
  const userRole = localStorage.getItem('role');
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<{ [day: string]: string[] }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add fromDate and toDate state
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  useEffect(() => {
    if (userRole !== 'Business Assistant') return;
    setLoading(true);
    
    // Fetch users and forms first
    Promise.all([
      fetch(USERS_API_URL).then(res => res.json()),
      fetch(FORMS_API_URL).then(res => res.json())
    ]).then(([usersData, formsData]) => {
      setUsers(usersData.filter((u: any) => u.role === 'Registered Surgical Assistant' || u.role === 'Team Leader'));
      setForms(formsData);
      setLoading(false);
    }).catch(() => {
      setError('Failed to load data.');
      setLoading(false);
    });
  }, [userRole]);

  // Fetch call hours when date range changes
  useEffect(() => {
    if (!fromDate || !toDate || userRole !== 'Business Assistant') return;
    
    const from = parseDate(fromDate);
    const to = parseDate(toDate);
    
    // Get all unique month/year combinations in the date range
    const monthsToFetch = new Set<string>();
    let currentDate = new Date(from);
    while (currentDate <= to) {
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      monthsToFetch.add(`${year}-${month}`);
      currentDate.setMonth(currentDate.getMonth() + 1);
      currentDate.setDate(1); // Reset to first day of month
    }
    
    // Fetch call hours for all relevant months
    const callHoursPromises = Array.from(monthsToFetch).map(key => {
      const [year, month] = key.split('-');
      return fetch(`${CALL_HOURS_API_URL}?month=${month}&year=${year}`)
        .then(res => res.json())
        .catch(() => ({}));
    });
    
    Promise.all(callHoursPromises).then(results => {
      // Merge all assignments into one object
      const mergedAssignments: { [day: string]: string[] } = {};
      results.forEach(result => {
        Object.assign(mergedAssignments, result);
      });
      setAssignments(mergedAssignments);
    }).catch(() => {
      setError('Failed to load call hours data.');
    });
  }, [fromDate, toDate, userRole]);

  // Helper: parse date string to Date object
  const parseDate = (str: string) => {
    const [yyyy, mm, dd] = str.split("-");
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  };

  // Helper: get all dates in range
  const getDatesInRange = (from: Date, to: Date) => {
    const dates = [];
    let d = new Date(from);
    while (d <= to) {
      dates.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  };

  // Compute date range
  let dateRange: Date[] = [];
  let weekRanges: { start: number; end: number; startDate: Date; endDate: Date }[] = [];
  if (fromDate && toDate) {
    const from = parseDate(fromDate);
    const to = parseDate(toDate);
    dateRange = getDatesInRange(from, to);
    // Build week ranges (7 days each)
    let startIdx = 0;
    while (startIdx < dateRange.length) {
      const endIdx = Math.min(startIdx + 6, dateRange.length - 1);
      weekRanges.push({
        start: startIdx,
        end: endIdx,
        startDate: dateRange[startIdx],
        endDate: dateRange[endIdx],
      });
      startIdx = endIdx + 1;
    }
  }

  if (userRole !== 'Business Assistant') {
    return <div className="responsive-card" style={{ marginTop: 40 }}><h2>RSA Bi-Weekly Report</h2><div style={{ color: 'red', marginBottom: 24 }}>Access denied. Only Business Assistants can view this report.</div><button onClick={() => navigate('/dashboard')} style={{ width: '100%', padding: '12px 0', background: 'linear-gradient(90deg, #667eea 0%, #5a67d8 100%)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(90,103,216,0.08)', transition: 'background 0.2s', marginBottom: 16 }}>← Back to Dashboard</button></div>;
  }

  // Helper: get call hour for a day (using ISO date string key)
  function getCallHour(rsaId: string, date: Date) {
    const dateKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    const assigned = assignments[dateKey] || [];
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    // Defensive: support both old (string[]) and new ([{id,shift,hours,minutes}]) formats
    if (assigned.length > 0 && typeof assigned[0] === 'object' && assigned[0] !== null && Object.prototype.hasOwnProperty.call(assigned[0], 'shift')) {
      // New format: array of { id, shift, hours?, minutes? }
      const assignment: any = assigned.find((a: any) => String(a.id) === String(rsaId) || String(a.id) === String(Number(rsaId)));
      if (!assignment) return '';
      
      // If custom hours/minutes are set, use them
      if (assignment.hours !== undefined) {
        const totalHours = (assignment.hours || 0) + ((assignment.minutes || 0) / 60);
        return totalHours.toFixed(2);
      }
      
      // Otherwise use shift type defaults
      if (assignment.shift === 'F') {
        // Full shift: 24 on weekends, 16 on weekdays
        return (dayOfWeek === 0 || dayOfWeek === 6) ? '24' : '16';
      }
      if (assignment.shift === 'H') {
        // Half shift: 12 on weekends, 8 on weekdays
        return (dayOfWeek === 0 || dayOfWeek === 6) ? '12' : '8';
      }
      return '';
    } else {
      // Old format: array of IDs (string[])
      if (!assigned.map((id: any) => String(id)).includes(String(rsaId))) return '';
      // Fallback: 24 for weekends, 16 for weekdays (legacy logic)
      return (dayOfWeek === 0 || dayOfWeek === 6) ? '24' : '16';
    }
  }

  // CSV Export helper
  const handleDownloadCSV = () => {
    if (!fromDate || !toDate) return;
    let csv = 'RSA,Date,Day,Call Hour,Shift<3,Shift>3,Voluntary,Cancelled\n';
    users.forEach(rsa => {
      const from = parseDate(fromDate);
      const to = parseDate(toDate);
      const dateRange = getDatesInRange(from, to);
      let totalCallHour = 0, totalShiftLT3 = 0, totalShiftGT3 = 0, totalVoluntary = 0, totalCancelled = 0;
      dateRange.forEach(date => {
        const dayName = getDayName(date);
        const callHour = getCallHour(rsa.id, date);
        const rsaId = rsa.id;
        // Create date string in YYYY-MM-DD format for comparison
        const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        // Compare date strings directly to avoid timezone issues
        const dayForms = forms.filter(f => {
          if (!f.createdByUserId || f.createdByUserId !== parseInt(rsaId)) return false;
          if (!f.date) return false;
          // Extract just the date part (YYYY-MM-DD) from the form date
          const formDateStr = f.date.split('T')[0];
          return formDateStr === dateStr;
        });
        const shiftLT3 = dayForms.filter(f => f.caseType === 'Shift<3').length;
        const shiftGT3 = dayForms.filter(f => f.caseType === 'Shift>3').length;
        const voluntary = dayForms.filter(f => f.caseType === 'Voluntary').length;
        const cancelled = dayForms.filter(f => f.caseType === 'Cancelled').length;
        totalCallHour += callHour ? parseFloat(callHour) : 0;
        totalShiftLT3 += shiftLT3;
        totalShiftGT3 += shiftGT3;
        totalVoluntary += voluntary;
        totalCancelled += cancelled;
        csv += `"${rsa.fullName || rsa.username}",${formatDate(date)},${dayName},${callHour},${shiftLT3},${shiftGT3},${voluntary},${cancelled}\n`;
      });
      // Add totals row for this RSA
      csv += `"${rsa.fullName || rsa.username}",Total,,${totalCallHour},${totalShiftLT3},${totalShiftGT3},${totalVoluntary},${totalCancelled}\n`;
      // Add payment row for this RSA - use user's hourly rate
      const hourlyRate = rsa.hourlyRate || 3.00;
      const callHourPay = totalCallHour * hourlyRate;
      const shiftLT3Pay = totalShiftLT3 * 100;
      const shiftGT3Pay = totalShiftGT3 * 150;
      const voluntaryPay = totalVoluntary * 150;
      const cancelledPay = totalCancelled * 50;
      csv += `"${rsa.fullName || rsa.username}",Amount to Pay,,$${callHourPay},$${shiftLT3Pay},$${shiftGT3Pay},$${voluntaryPay},$${cancelledPay}\n`;
      // Add total payable row for this RSA
      const totalPay = callHourPay + shiftLT3Pay + shiftGT3Pay + voluntaryPay + cancelledPay;
      csv += `"${rsa.fullName || rsa.username}",Total Payable,,,,,,$${totalPay}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `payroll-report-${fromDate}-to-${toDate}.csv`);
  };

  return (
    <div className="responsive-card" style={{ marginTop: 40, maxWidth: 1200, width: '100%' }}>
      <button onClick={() => navigate('/dashboard')} style={{ width: '100%', padding: '12px 0', background: 'linear-gradient(90deg, #667eea 0%, #5a67d8 100%)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(90,103,216,0.08)', transition: 'background 0.2s', marginBottom: 24 }}>← Back to Dashboard</button>
      <h2>Payroll</h2>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <label>From:
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ marginLeft: 8 }} />
          </label>
          <label>To:
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ marginLeft: 8 }} />
          </label>
        </div>
        <button onClick={handleDownloadCSV} style={{ padding: '6px 18px',
          borderRadius: 6,
          background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
          color: '#fff',
          border: 'none',
          fontWeight: 600,
          fontSize: 15,
          cursor: 'pointer' }}>Download CSV</button>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && users.map(rsa => {
        if (!fromDate || !toDate) return null;
        // Build one table for the full date range
        const from = parseDate(fromDate);
        const to = parseDate(toDate);
        const dateRange = getDatesInRange(from, to);
        const rows = dateRange.map(date => {
          const dayName = getDayName(date);
          const callHour = getCallHour(rsa.id, date);
          // Only count forms for this day and this RSA
          const rsaId = rsa.id;
          // Create date string in YYYY-MM-DD format for comparison
          const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
          // Compare date strings directly to avoid timezone issues
          const dayForms = forms.filter(f => {
            if (!f.createdByUserId || f.createdByUserId !== parseInt(rsaId)) return false;
            if (!f.date) return false;
            // Extract just the date part (YYYY-MM-DD) from the form date
            const formDateStr = f.date.split('T')[0];
            return formDateStr === dateStr;
          });
          const shiftLT3 = dayForms.filter(f => f.caseType === 'Shift<3').length;
          const shiftGT3 = dayForms.filter(f => f.caseType === 'Shift>3').length;
          const voluntary = dayForms.filter(f => f.caseType === 'Voluntary').length;
          const cancelled = dayForms.filter(f => f.caseType === 'Cancelled').length;
          return { date, dayName, callHour, shiftLT3, shiftGT3, voluntary, cancelled, debugForms: dayForms };
        });
        // Totals for the full range
        const totalCallHour = rows.reduce((sum, r) => sum + (r.callHour ? parseFloat(r.callHour) : 0), 0);
        const totalShiftLT3 = rows.reduce((sum, r) => sum + r.shiftLT3, 0);
        const totalShiftGT3 = rows.reduce((sum, r) => sum + r.shiftGT3, 0);
        const totalVoluntary = rows.reduce((sum, r) => sum + r.voluntary, 0);
        const totalCancelled = rows.reduce((sum, r) => sum + r.cancelled, 0);
        // Payment calculations - use user's hourly rate
        const hourlyRate = rsa.hourlyRate || 3.00;
        const callHourPay = totalCallHour * hourlyRate;
        const shiftLT3Pay = totalShiftLT3 * 100;
        const shiftGT3Pay = totalShiftGT3 * 150;
        const voluntaryPay = totalVoluntary * 150;
        const cancelledPay = totalCancelled * 50;
        const totalPay = callHourPay + shiftLT3Pay + shiftGT3Pay + voluntaryPay + cancelledPay;
        return (
          <div key={rsa.id} style={{ marginBottom: 48 }}>
            <h3 style={{ marginBottom: 8 }}>{rsa.fullName || rsa.username}</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24, background: '#f6f8fa' }}>
              <caption style={{ textAlign: 'left', fontWeight: 600, marginBottom: 4 }}>
                {fromDate && toDate ? `${formatDate(from)} - ${formatDate(to)}` : ''}
              </caption>
              <thead>
                <tr>
                  <th style={{ padding: 8, border: '1px solid #e2e8f0' }}>Date</th>
                  <th style={{ padding: 8, border: '1px solid #e2e8f0' }}>Day</th>
                  <th style={{ padding: 8, border: '1px solid #e2e8f0' }}>Call Hour</th>
                  <th style={{ padding: 8, border: '1px solid #e2e8f0' }}>Shift&lt;3</th>
                  <th style={{ padding: 8, border: '1px solid #e2e8f0' }}>Shift&gt;3</th>
                  <th style={{ padding: 8, border: '1px solid #e2e8f0' }}>Voluntary</th>
                  <th style={{ padding: 8, border: '1px solid #e2e8f0' }}>Cancelled</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>{formatDate(row.date)}</td>
                    <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>{row.dayName}</td>
                    <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>{row.callHour}</td>
                    <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>{row.shiftLT3}</td>
                    <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>{row.shiftGT3}</td>
                    <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>{row.voluntary}</td>
                    <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>{row.cancelled}</td>
                  </tr>
                ))}
                {/* Totals row for the full range */}
                <tr style={{ fontWeight: 600, background: '#e2e8f0' }}>
                  <td colSpan={2} style={{ padding: 8, border: '1px solid #e2e8f0' }}>Total</td>
                  <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>{totalCallHour}</td>
                  <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>{totalShiftLT3}</td>
                  <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>{totalShiftGT3}</td>
                  <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>{totalVoluntary}</td>
                  <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>{totalCancelled}</td>
                </tr>
                {/* Payment row for the full range */}
                <tr style={{ fontWeight: 600, background: '#d1fae5' }}>
                  <td colSpan={2} style={{ padding: 8, border: '1px solid #e2e8f0' }}>Amount to Pay</td>
                  <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>${callHourPay}</td>
                  <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>${shiftLT3Pay}</td>
                  <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>${shiftGT3Pay}</td>
                  <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>${voluntaryPay}</td>
                  <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>${cancelledPay}</td>
                </tr>
                <tr style={{ fontWeight: 700, background: '#bbf7d0' }}>
                  <td colSpan={2} style={{ padding: 8, border: '1px solid #e2e8f0' }}>Total Payable</td>
                  <td colSpan={5} style={{ padding: 8, border: '1px solid #e2e8f0' }}>${totalPay}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
};

export default PayrollPage;
