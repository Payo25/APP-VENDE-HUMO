import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { authFetch } from '../utils/api';

const API_BASE_URL = '/api';
const PERSONAL_SCHEDULES_URL = `${API_BASE_URL}/personal-schedules`;

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const getDaysInMonth = (month: number, year: number) => {
  return new Date(year, month, 0).getDate();
};

const getDateString = (year: number, month: number, day: number) => {
  const mm = month.toString().padStart(2, '0');
  const dd = day.toString().padStart(2, '0');
  return `${year}-${mm}-${dd}`;
};

const formatTime12 = (time24: string) => {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${m.toString().padStart(2, '0')} ${ampm}`;
};

interface ScheduleEntry {
  id: number;
  user_id: number;
  schedule_date: string;
  hours: number;
  minutes: number;
  start_time: string;
  end_time: string;
  notes: string;
  physician_name: string;
  health_center_name: string;
}

interface VacationRequest {
  id: number;
  user_id: number;
  request_type: string;
  request_date: string;
  hours: number;
  notes: string;
  status: string;
  reviewer_name: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  createdat: string;
}

const MySchedulePage: React.FC = () => {
  const userRole = localStorage.getItem('role');
  const userId = localStorage.getItem('userId');
  const userFullName = localStorage.getItem('fullName');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestDate, setRequestDate] = useState('');
  const [requestType, setRequestType] = useState('Vacation');
  const [requestHours, setRequestHours] = useState(8);
  const [requestNotes, setRequestNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  // Redirect if not RSA or Team Leader
  useEffect(() => {
    if (userRole !== 'Registered Surgical Assistant' && userRole !== 'Team Leader') {
      navigate('/dashboard');
    }
  }, [userRole, navigate]);

  // Fetch personal schedules for the month
  useEffect(() => {
    setLoading(true);
    authFetch(`${PERSONAL_SCHEDULES_URL}?userId=${userId}&month=${month}&year=${year}`)
      .then(res => res.json())
      .then(data => {
        setSchedules(data);
        setLoading(false);
      })
      .catch(() => {
        setSchedules([]);
        setLoading(false);
      });
  }, [month, year, userId]);

  // Fetch vacation requests
  const fetchVacationRequests = () => {
    authFetch(`${API_BASE_URL}/vacation-requests/mine`)
      .then(res => res.json())
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

  const handleDownloadPDF = async () => {
    setExportingPDF(true);
    await new Promise(r => setTimeout(r, 50));
    const planner = document.getElementById('my-schedule-calendar');
    if (!planner) { setExportingPDF(false); return; }
    const canvas = await html2canvas(planner, { scale: 2, backgroundColor: '#fff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 60;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.setFontSize(20);
    pdf.text(`My Schedule - ${monthNames[month-1]} ${year}`, pageWidth / 2, 40, { align: 'center' });
    pdf.addImage(imgData, 'PNG', 30, 60, imgWidth, Math.min(imgHeight, pageHeight - 80));
    pdf.save(`my-schedule-${monthNames[month-1]}-${year}.pdf`);
    setExportingPDF(false);
  };

  const daysInMonth = getDaysInMonth(month, year);

  // Create a map of schedules by date (multiple entries per day)
  const schedulesByDate = schedules.reduce((acc, schedule) => {
    const key = schedule.schedule_date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(schedule);
    return acc;
  }, {} as { [date: string]: ScheduleEntry[] });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="responsive-card" style={{ maxWidth: 1300, width: '100%' }}>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>📅 My Schedule</h2>
          <span style={{ 
            padding: '6px 12px', 
            borderRadius: 6, 
            background: '#e3f2fd', 
            color: '#1565c0', 
            fontSize: 14, 
            fontWeight: 600 
          }}>
            {userFullName || 'My Schedule'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginBottom: 8 }}>
          <button
            onClick={() => setShowRequestModal(true)}
            style={{
              padding: '8px 20px',
              borderRadius: 6,
              background: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
              marginBottom: 0
            }}
          >
            🏖️ Request Vacation / PTO
          </button>
          <button
            onClick={handleDownloadPDF}
            style={{
              padding: '8px 20px',
              borderRadius: 6,
              background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
              marginBottom: 0
            }}
            tabIndex={0}
            aria-label="Download My Schedule as PDF"
          >
            Download PDF
          </button>
        </div>
        {!exportingPDF && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <label>Month:
              <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ marginLeft: 8 }}>
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>{monthNames[i]}</option>
                ))}
              </select>
            </label>
            <label>Year:
              <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 80, marginLeft: 8 }} />
            </label>
          </div>
        )}
        <div id="my-schedule-calendar">
          {loading ? <p>Loading...</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16, tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: '#f6f8fa' }}>
                  {[...Array(7)].map((_, i) => (
                    <th key={i} style={{ padding: 8, borderBottom: '1px solid #e2e8f0', width: 78 }}>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const rows: React.JSX.Element[] = [];
                  const firstDay = new Date(year, month - 1, 1).getDay();
                  let day = 1;
                  for (let week = 0; week < 6 && day <= daysInMonth; week++) {
                    const cells: React.JSX.Element[] = [];
                    for (let d = 0; d < 7; d++) {
                      if ((week === 0 && d < firstDay) || day > daysInMonth) {
                        cells.push(<td key={d} style={{ padding: 8, minHeight: 120, background: '#f6f8fa' }} />);
                      } else {
                        const thisDay = day;
                        const dateKey = getDateString(year, month, thisDay);
                        const dayEntries = schedulesByDate[dateKey] || [];
                        const dayVacReqs = vacReqByDate[dateKey] || [];
                        
                        cells.push(
                          <td key={d} style={{ 
                            padding: 6, 
                            minHeight: 120, 
                            border: '1px solid #e2e8f0', 
                            verticalAlign: 'top',
                            background: dayVacReqs.some(r => r.status === 'Approved') ? '#dcfce7' : dayVacReqs.some(r => r.status === 'Pending') ? '#fef9c3' : dayEntries.length > 0 ? '#e3f2fd' : 'transparent'
                          }}>
                            <div style={{ fontWeight: 600, marginBottom: 6, color: dayEntries.length > 0 ? '#1565c0' : 'inherit', fontSize: 13 }}>{thisDay}</div>
                            {dayVacReqs.map((vr) => {
                              const colors: Record<string, {bg:string,fg:string}> = {
                                Pending: { bg: '#fbbf24', fg: '#78350f' },
                                Approved: { bg: '#22c55e', fg: '#fff' },
                                Denied: { bg: '#ef4444', fg: '#fff' },
                              };
                              const c = colors[vr.status] || colors.Pending;
                              return (
                                <div key={`vr-${vr.id}`} style={{ marginBottom: 4, padding: '3px 6px', background: c.bg, color: c.fg, borderRadius: 4, fontSize: 10, fontWeight: 700, textAlign: 'center', cursor: vr.status === 'Pending' ? 'pointer' : 'default' }}
                                  onClick={() => vr.status === 'Pending' && handleCancelRequest(vr.id)}>
                                  {vr.request_type === 'PTO' ? '📋' : '🌴'} {vr.request_type} - {vr.status}
                                  {vr.status === 'Pending' && <span style={{ fontSize: 9, display: 'block' }}>click to cancel</span>}
                                </div>
                              );
                            })}
                            {dayEntries.map((entry, idx) => (
                              <div key={entry.id} style={{ 
                                marginBottom: 5, 
                                padding: '5px 6px', 
                                background: idx % 2 === 0 ? '#e3f2fd' : '#e8f5e9', 
                                borderRadius: 6, 
                                border: '1px solid #e0e0e0' 
                              }}>
                                {entry.start_time && entry.end_time ? (
                                  <div style={{ 
                                    background: idx % 2 === 0 ? '#1976d2' : '#4caf50', 
                                    color: '#fff', 
                                    padding: '4px 6px', 
                                    borderRadius: 4, 
                                    fontSize: 11,
                                    fontWeight: 700,
                                    marginBottom: 4,
                                    textAlign: 'center'
                                  }}>
                                    🕐 {formatTime12(entry.start_time)} - {formatTime12(entry.end_time)}
                                  </div>
                                ) : entry.hours > 0 || entry.minutes > 0 ? (
                                  <div style={{ 
                                    background: idx % 2 === 0 ? '#1976d2' : '#4caf50', 
                                    color: '#fff', 
                                    padding: '4px 6px', 
                                    borderRadius: 4, 
                                    fontSize: 11,
                                    fontWeight: 700,
                                    marginBottom: 4,
                                    textAlign: 'center'
                                  }}>
                                    ✓ {entry.hours}h {entry.minutes > 0 ? `${entry.minutes}m` : ''}
                                  </div>
                                ) : null}
                                {entry.physician_name && (
                                  <div style={{ fontSize: 11, color: '#1565c0', marginBottom: 2, wordBreak: 'break-word', fontWeight: 600 }}>
                                    🩺 {entry.physician_name}
                                  </div>
                                )}
                                {entry.health_center_name && (
                                  <div style={{ fontSize: 11, color: '#388e3c', marginBottom: 2, wordBreak: 'break-word', fontWeight: 600 }}>
                                    🏥 {entry.health_center_name}
                                  </div>
                                )}
                                {entry.notes && (
                                  <div style={{ fontSize: 10, color: '#666', wordBreak: 'break-word' }}>
                                    {entry.notes}
                                  </div>
                                )}
                              </div>
                            ))}
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
          )}
        </div>
        {schedules.length === 0 && !loading && (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px 20px', 
            color: '#666', 
            fontSize: 16,
            background: '#f9fafb',
            borderRadius: 8,
            marginTop: 16
          }}>
            No schedule entries for {monthNames[month-1]} {year}. Your scheduler will assign your schedule.
          </div>
        )}

        {/* My Vacation Requests */}
        {vacationRequests.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ margin: '0 0 12px 0' }}>🏖️ My Vacation / PTO Requests</h3>
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
    </div>
  );
};

export default MySchedulePage;
