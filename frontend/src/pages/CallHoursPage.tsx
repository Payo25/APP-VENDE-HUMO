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

const CallHoursPage: React.FC = () => {
  const userRole = localStorage.getItem('role');
  const userId = localStorage.getItem('user');
  const [users, setUsers] = useState<any[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  // Change assignments to store array of objects: { id: string, shift: 'F' | 'H' }
  const [assignments, setAssignments] = useState<{ [day: string]: { id: string, shift: 'F' | 'H' }[] }>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [exportingPDF, setExportingPDF] = useState(false);
  const navigate = useNavigate();

  // Fetch all RSAs for BA, or just self for RSA
  useEffect(() => {
    // Both BA and RSA fetch all RSAs for display
    fetch(USERS_API_URL)
      .then(res => res.json())
      .then(data => setUsers(data.filter((u: any) => u.role === 'Registered Surgical Assistant')));
  }, [userRole, userId]);

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

  const handleAddRSA = (day: number, rsaId: string) => {
    const dateKey = getDateString(year, month, day);
    setAssignments(prev => {
      const prevList = prev[dateKey] || [];
      const rsaIdStr = String(rsaId);
      if (prevList.some((a: any) => a.id === rsaIdStr)) return prev;
      return { ...prev, [dateKey]: [...prevList, { id: rsaIdStr, shift: 'F' }] };
    });
  };
  const handleRemoveRSA = (day: number, rsaId: string) => {
    const dateKey = getDateString(year, month, day);
    setAssignments(prev => {
      const prevList = prev[dateKey] || [];
      const rsaIdStr = String(rsaId);
      return { ...prev, [dateKey]: prevList.filter((a: any) => a.id !== rsaIdStr) };
    });
  };
  const handleToggleShift = (day: number, rsaId: string) => {
    const dateKey = getDateString(year, month, day);
    setAssignments(prev => {
      const prevList = prev[dateKey] || [];
      return {
        ...prev,
        [dateKey]: prevList.map((a: any) =>
          a.id === String(rsaId) ? { ...a, shift: a.shift === 'F' ? 'H' : 'F' } : a
        ),
      };
    });
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        month,
        year,
        assignments,
        actorRole: userRole
      })
    });
    if (res.ok) setSuccess('Planner saved!');
    else setError('Failed to save planner.');
  };

  const handleDownloadPDF = async () => {
    setExportingPDF(true);
    await new Promise(r => setTimeout(r, 50)); // allow re-render
    const planner = document.getElementById('planner-table');
    if (!planner) { setExportingPDF(false); return; }
    const canvas = await html2canvas(planner, { scale: 2, backgroundColor: '#fff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 60;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.setFontSize(20);
    pdf.text(`${monthNames[month-1]} ${year}`, pageWidth / 2, 40, { align: 'center' });
    pdf.addImage(imgData, 'PNG', 30, 60, imgWidth, Math.min(imgHeight, pageHeight - 80));
    pdf.save(`call-hours-planner-${monthNames[month-1]}-${year}.pdf`);
    setExportingPDF(false);
  };

  const daysInMonth = getDaysInMonth(month, year);

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
        <h2>Call Hours Monthly Planner</h2>
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
            aria-label="Download Planner as PDF"
          >
            Download PDF
          </button>
        </div>
        {/* Month/Year controls and info visible in UI, hidden in PDF */}
        {!exportingPDF && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <label>Month:
              <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ marginLeft: 8 }}>
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
            </label>
            <label>Year:
              <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 80, marginLeft: 8 }} />
            </label>
          </div>
        )}
        <div id="planner-table">
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
                        cells.push(<td key={d} style={{ padding: 8, minHeight: 80, background: '#f6f8fa' }} />);
                      } else {
                        const thisDay = day;
                        const dateKey = getDateString(year, month, thisDay);
                        const assigned = assignments[dateKey] || [];
                        cells.push(
                          <td key={d} style={{ padding: 8, minHeight: 80, border: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>{thisDay}</div>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                              {(assignments[dateKey] || []).map((a: any) => {
                                const rsa = users.find(u => String(u.id) === String(a.id));
                                if (!rsa) return null;
                                const isFull = a.shift === 'F';
                                return (
                                  <li key={a.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                                    <span
                                      onClick={userRole === 'Business Assistant' && !exportingPDF ? () => handleToggleShift(thisDay, a.id) : undefined}
                                      style={{
                                        cursor: userRole === 'Business Assistant' && !exportingPDF ? 'pointer' : 'default',
                                        fontWeight: 700,
                                        fontSize: 14,
                                        color: isFull ? '#185a9d' : '#05a117', // blue for Full, green for Half
                                        background: userRole === 'Business Assistant' && !exportingPDF ? 'rgba(24,90,157,0.07)' : 'none',
                                        borderRadius: 4,
                                        padding: '2px 3px',
                                        marginRight: 2,
                                        transition: 'color 0.2s, background 0.2s',
                                        userSelect: 'none',
                                      }}
                                      aria-label={`Toggle shift for ${rsa.fullName}`}
                                      tabIndex={userRole === 'Business Assistant' && !exportingPDF ? 0 : -1}
                                    >
                                      {rsa.fullName || rsa.username}
                                    </span>
                                    {userRole === 'Business Assistant' && !exportingPDF && (
                                      <button
                                        onClick={() => handleRemoveRSA(thisDay, a.id)}
                                        style={{
                                          marginLeft: 6,
                                          color: '#e74c3c',
                                          background: 'none',
                                          border: 'none',
                                          cursor: 'pointer',
                                          fontWeight: 700,
                                          fontSize: 16,
                                        }}
                                        aria-label={`Remove ${rsa.fullName}`}
                                      >
                                        ×
                                      </button>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                            {/* Only BAs (and not exporting PDF) see the +Add RSA dropdown */}
                            {userRole === 'Business Assistant' && !exportingPDF && (
                              <select
                                value=""
                                onChange={e => { if (e.target.value) handleAddRSA(thisDay, e.target.value); }}
                                style={{ width: '100%', marginTop: 4 }}
                              >
                                <option value="">+ Add RSA</option>
                                {users.filter(u => !((assignments[dateKey] || []).some((a: any) => a.id === u.id))).map(u => (
                                  <option key={u.id} value={u.id}>{u.fullName || u.username}</option>
                                ))}
                              </select>
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
        {userRole === 'Business Assistant' && (
          <button
            onClick={handleSave}
            style={{ marginTop: 24, padding: '10px 32px', borderRadius: 6, background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}
          >
            Save Planner
          </button>
        )}
        {success && <div style={{ color: '#43cea2', marginTop: 12 }}>{success}</div>}
        {error && <div style={{ color: '#e74c3c', marginTop: 12 }}>{error}</div>}
        {/* Shift type legend */}
        <div style={{
          marginTop: 32,
          padding: '12px 0 0 0',
          borderTop: '1px solid #e2e8f0',
          fontSize: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <span style={{ fontWeight: 600 }}>Shift type:</span>
          <span>
            <span style={{ color: '#185a9d', fontWeight: 700, fontSize: 16 }}>Full</span> (24 hours on weekends, and 16 hours on weekdays),
            <span style={{ marginLeft: 2 }}>
              <span style={{ color: '#05a117', fontWeight: 700, fontSize: 16 }}>Half</span> (12 hours on weekends, and 8 hours on weekdays).
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default CallHoursPage;
