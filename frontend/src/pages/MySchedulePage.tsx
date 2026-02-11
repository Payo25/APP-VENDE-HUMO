import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

interface ScheduleEntry {
  id: number;
  user_id: number;
  schedule_date: string;
  hours: number;
  minutes: number;
  notes: string;
  physician_name: string;
  health_center_name: string;
}

const MySchedulePage: React.FC = () => {
  const userRole = localStorage.getItem('role');
  const userId = localStorage.getItem('userId');
  const userFullName = localStorage.getItem('fullName');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [editModal, setEditModal] = useState<{ date: string, day: number, entry?: ScheduleEntry } | null>(null);
  const [tempHours, setTempHours] = useState(8);
  const [tempMinutes, setTempMinutes] = useState(0);
  const [tempNotes, setTempNotes] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Redirect if not RSA
  useEffect(() => {
    if (userRole !== 'Registered Surgical Assistant') {
      navigate('/dashboard');
    }
  }, [userRole, navigate]);

  // Fetch personal schedules for the month
  useEffect(() => {
    setLoading(true);
    fetch(`${PERSONAL_SCHEDULES_URL}?userId=${userId}&month=${month}&year=${year}`)
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

  const handleAddOrEdit = async () => {
    if (!editModal) return;
    
    setError('');
    setSuccess('');
    
    try {
      let res;
      if (editModal.entry) {
        // Edit existing entry via PUT
        res = await fetch(`${PERSONAL_SCHEDULES_URL}/${editModal.entry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hours: tempHours,
            minutes: tempMinutes,
            notes: tempNotes
          })
        });
      } else {
        // Add new entry via POST
        res = await fetch(PERSONAL_SCHEDULES_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            scheduleDate: editModal.date,
            hours: tempHours,
            minutes: tempMinutes,
            notes: tempNotes
          })
        });
      }
      
      if (res.ok) {
        setSuccess(editModal.entry ? 'Schedule updated!' : 'Schedule added!');
        setEditModal(null);
        // Refresh schedules
        const refreshRes = await fetch(`${PERSONAL_SCHEDULES_URL}?userId=${userId}&month=${month}&year=${year}`);
        const data = await refreshRes.json();
        setSchedules(data);
      } else {
        setError('Failed to save schedule');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Remove this schedule entry?')) return;
    
    try {
      const res = await fetch(`${PERSONAL_SCHEDULES_URL}/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccess('Schedule removed!');
        // Refresh schedules
        const refreshRes = await fetch(`${PERSONAL_SCHEDULES_URL}?userId=${userId}&month=${month}&year=${year}`);
        const data = await refreshRes.json();
        setSchedules(data);
      } else {
        setError('Failed to delete schedule');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const openEditModal = (date: string, day: number, entry?: ScheduleEntry) => {
    setEditModal({ date, day, entry });
    setTempHours(entry?.hours || 8);
    setTempMinutes(entry?.minutes || 0);
    setTempNotes(entry?.notes || '');
  };

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

  // Create a map of schedules by date for easy lookup (multiple entries per day)
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
        {success && <div style={{ color: '#43cea2', marginTop: 12 }}>{success}</div>}
        {error && <div style={{ color: '#e74c3c', marginTop: 12 }}>{error}</div>}
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
                  const rows = [];
                  const firstDay = new Date(year, month - 1, 1).getDay();
                  let day = 1;
                  for (let week = 0; week < 6 && day <= daysInMonth; week++) {
                    const cells = [];
                    for (let d = 0; d < 7; d++) {
                      if ((week === 0 && d < firstDay) || day > daysInMonth) {
                        cells.push(<td key={d} style={{ padding: 8, minHeight: 120, background: '#f6f8fa' }} />);
                      } else {
                        const thisDay = day;
                        const dateKey = getDateString(year, month, thisDay);
                        const dayEntries = schedulesByDate[dateKey] || [];
                        
                        cells.push(
                          <td key={d} style={{ 
                            padding: 8, 
                            minHeight: 120, 
                            border: '1px solid #e2e8f0', 
                            verticalAlign: 'top',
                            background: dayEntries.length > 0 ? '#e3f2fd' : 'transparent'
                          }}>
                            <div style={{ fontWeight: 600, marginBottom: 8, color: dayEntries.length > 0 ? '#1565c0' : 'inherit' }}>{thisDay}</div>
                            {dayEntries.map((entry, idx) => (
                              <div key={entry.id} style={{ marginBottom: 6, padding: '4px 6px', background: idx % 2 === 0 ? '#e3f2fd' : '#e8f5e9', borderRadius: 4, border: '1px solid #e0e0e0' }}>
                                <div style={{ 
                                  background: idx % 2 === 0 ? '#1976d2' : '#4caf50', 
                                  color: '#fff', 
                                  padding: '4px 6px', 
                                  borderRadius: 4, 
                                  fontSize: 12,
                                  fontWeight: 600,
                                  marginBottom: 4
                                }}>
                                  ✓ {entry.hours}h {entry.minutes > 0 ? `${entry.minutes}m` : ''}
                                </div>
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
                                  <div style={{ fontSize: 10, color: '#666', marginBottom: 4, wordBreak: 'break-word' }}>
                                    {entry.notes}
                                  </div>
                                )}
                                {!exportingPDF && (
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <button
                                      onClick={() => openEditModal(dateKey, thisDay, entry)}
                                      style={{
                                        flex: 1,
                                        padding: '3px',
                                        fontSize: 10,
                                        background: '#667eea',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 4,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDelete(entry.id)}
                                      style={{
                                        flex: 1,
                                        padding: '3px',
                                        fontSize: 10,
                                        background: '#e74c3c',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 4,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      Del
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                            {!exportingPDF && (
                              <button
                                onClick={() => openEditModal(dateKey, thisDay)}
                                style={{
                                  width: '100%',
                                  padding: '4px',
                                  fontSize: 11,
                                  background: '#43cea2',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  marginTop: dayEntries.length > 0 ? 4 : 0
                                }}
                              >
                                + Add
                              </button>
                            )}
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
            No schedule entries for {monthNames[month-1]} {year}. Click "+ Add" on any day to create an entry.
          </div>
        )}
        
        {/* Edit/Add Modal */}
        {editModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
            onClick={() => setEditModal(null)}
          >
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: 32,
                maxWidth: 500,
                width: '90%',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ marginTop: 0, marginBottom: 24, color: '#1f2937' }}>
                {editModal.entry ? '✏️ Edit' : '➕ Add'} Schedule - Day {editModal.day}
              </h3>
              
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151' }}>
                  Hours:
                </label>
                <input
                  type="number"
                  min="0"
                  max="24"
                  value={tempHours}
                  onChange={(e) => setTempHours(Math.min(24, Math.max(0, Number(e.target.value))))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 16,
                    border: '2px solid #e5e7eb',
                    borderRadius: 6,
                    outline: 'none'
                  }}
                />
              </div>
              
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151' }}>
                  Minutes:
                </label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={tempMinutes}
                  onChange={(e) => setTempMinutes(Math.min(59, Math.max(0, Number(e.target.value))))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 16,
                    border: '2px solid #e5e7eb',
                    borderRadius: 6,
                    outline: 'none'
                  }}
                />
              </div>
              
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151' }}>
                  Notes (optional):
                </label>
                <textarea
                  value={tempNotes}
                  onChange={(e) => setTempNotes(e.target.value)}
                  rows={3}
                  placeholder="Add any notes about this schedule..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 16,
                    border: '2px solid #e5e7eb',
                    borderRadius: 6,
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>
              
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                padding: '12px 16px', 
                background: '#f3f4f6', 
                borderRadius: 6,
                marginBottom: 24
              }}>
                <span style={{ fontSize: 14, color: '#6b7280' }}>
                  Total: <strong style={{ color: '#1f2937', fontSize: 16 }}>{tempHours}h {tempMinutes}m</strong>
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={handleAddOrEdit}
                  style={{
                    flex: 1,
                    padding: '12px 24px',
                    borderRadius: 6,
                    background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: 16,
                    cursor: 'pointer'
                  }}
                >
                  💾 Save
                </button>
                <button
                  onClick={() => setEditModal(null)}
                  style={{
                    flex: 1,
                    padding: '12px 24px',
                    borderRadius: 6,
                    background: '#e5e7eb',
                    color: '#374151',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: 16,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MySchedulePage;
