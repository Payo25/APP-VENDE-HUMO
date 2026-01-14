import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const API_BASE_URL = '/api';
const API_URL = `${API_BASE_URL}/call-hours`;
const USERS_API_URL = `${API_BASE_URL}/users`;

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

const MySchedulePage: React.FC = () => {
  const userRole = localStorage.getItem('role');
  const userId = localStorage.getItem('userId');
  const userFullName = localStorage.getItem('fullName');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [assignments, setAssignments] = useState<{ [day: string]: { id: string, shift: 'F' | 'H', hours?: number, minutes?: number }[] }>({});
  const [loading, setLoading] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const navigate = useNavigate();

  // Redirect if not RSA
  useEffect(() => {
    if (userRole !== 'Registered Surgical Assistant') {
      navigate('/dashboard');
    }
  }, [userRole, navigate]);

  // Fetch assignments for the month
  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}?month=${month}&year=${year}`)
      .then(res => res.json())
      .then(data => {
        setAssignments(data);
        setLoading(false);
      })
      .catch(() => {
        setAssignments({});
        setLoading(false);
      });
  }, [month, year]);

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

  // Filter to only show current user's assignments
  const myAssignments = Object.keys(assignments).reduce((acc, dateKey) => {
    const dayAssignments = assignments[dateKey].filter((a: any) => String(a.id) === String(userId));
    if (dayAssignments.length > 0) {
      acc[dateKey] = dayAssignments;
    }
    return acc;
  }, {} as { [day: string]: { id: string, shift: 'F' | 'H', hours?: number, minutes?: number }[] });

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
                  const rows = [];
                  const firstDay = new Date(year, month - 1, 1).getDay();
                  let day = 1;
                  for (let week = 0; week < 6 && day <= daysInMonth; week++) {
                    const cells = [];
                    for (let d = 0; d < 7; d++) {
                      if ((week === 0 && d < firstDay) || day > daysInMonth) {
                        cells.push(<td key={d} style={{ padding: 8, minHeight: 100, background: '#f6f8fa' }} />);
                      } else {
                        const thisDay = day;
                        const dateKey = getDateString(year, month, thisDay);
                        const hasAssignment = myAssignments[dateKey] && myAssignments[dateKey].length > 0;
                        
                        cells.push(
                          <td key={d} style={{ 
                            padding: 8, 
                            minHeight: 100, 
                            border: '1px solid #e2e8f0', 
                            verticalAlign: 'top',
                            background: hasAssignment ? '#e3f2fd' : 'transparent'
                          }}>
                            <div style={{ fontWeight: 600, marginBottom: 4, color: hasAssignment ? '#1565c0' : 'inherit' }}>{thisDay}</div>
                            {hasAssignment && (
                              <div style={{ marginTop: 8 }}>
                                {myAssignments[dateKey].map((a: any) => (
                                  <div key={a.id} style={{ 
                                    background: '#1976d2', 
                                    color: '#fff', 
                                    padding: '6px 8px', 
                                    borderRadius: 4, 
                                    fontSize: 13,
                                    fontWeight: 600,
                                    marginBottom: 4
                                  }}>
                                    ✓ {a.hours || 24}h {a.minutes > 0 ? `${a.minutes}m` : ''}
                                  </div>
                                ))}
                              </div>
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
        {Object.keys(myAssignments).length === 0 && !loading && (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px 20px', 
            color: '#666', 
            fontSize: 16,
            background: '#f9fafb',
            borderRadius: 8,
            marginTop: 16
          }}>
            No call hours assigned for {monthNames[month-1]} {year}
          </div>
        )}
      </div>
    </div>
  );
};

export default MySchedulePage;
