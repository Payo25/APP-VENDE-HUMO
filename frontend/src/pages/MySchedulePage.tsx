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

const MySchedulePage: React.FC = () => {
  const userRole = localStorage.getItem('role');
  const userId = localStorage.getItem('userId');
  const userFullName = localStorage.getItem('fullName');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
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
                        
                        cells.push(
                          <td key={d} style={{ 
                            padding: 6, 
                            minHeight: 120, 
                            border: '1px solid #e2e8f0', 
                            verticalAlign: 'top',
                            background: dayEntries.length > 0 ? '#e3f2fd' : 'transparent'
                          }}>
                            <div style={{ fontWeight: 600, marginBottom: 6, color: dayEntries.length > 0 ? '#1565c0' : 'inherit', fontSize: 13 }}>{thisDay}</div>
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
      </div>
    </div>
  );
};

export default MySchedulePage;
