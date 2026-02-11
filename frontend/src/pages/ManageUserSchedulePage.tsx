import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = '/api';
const PERSONAL_SCHEDULES_URL = `${API_BASE_URL}/personal-schedules`;
const USERS_URL = `${API_BASE_URL}/users`;

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
}

interface User {
  id: number;
  username: string;
  fullName: string;
  role: string;
}

const ManageUserSchedulePage: React.FC = () => {
  const navigate = useNavigate();
  const userRole = localStorage.getItem('role');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModal, setEditModal] = useState<{ date: string, day: number, entry?: ScheduleEntry } | null>(null);
  const [tempHours, setTempHours] = useState(8);
  const [tempMinutes, setTempMinutes] = useState(0);
  const [tempNotes, setTempNotes] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (userRole !== 'Scheduler' && userRole !== 'Business Assistant') {
      navigate('/dashboard');
      return;
    }
    // Fetch RSAs
    fetch(USERS_URL)
      .then(res => res.json())
      .then(data => {
        const rsas = data.filter((u: User) => u.role === 'Registered Surgical Assistant');
        setUsers(rsas);
      });
  }, [userRole, navigate]);

  useEffect(() => {
    if (selectedUserId) {
      const user = users.find(u => u.id === selectedUserId);
      setSelectedUser(user || null);
      fetchSchedules();
    }
  }, [selectedUserId, month, year]);

  const fetchSchedules = () => {
    if (!selectedUserId) return;
    setLoading(true);
    fetch(`${PERSONAL_SCHEDULES_URL}?userId=${selectedUserId}&month=${month}&year=${year}`)
      .then(res => res.json())
      .then(data => {
        setSchedules(data);
        setLoading(false);
      })
      .catch(() => {
        setSchedules([]);
        setLoading(false);
      });
  };

  const handleAddOrEdit = async () => {
    if (!editModal || !selectedUserId) return;
    
    setError('');
    setSuccess('');
    
    try {
      const res = await fetch(PERSONAL_SCHEDULES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          scheduleDate: editModal.date,
          hours: tempHours,
          minutes: tempMinutes,
          notes: tempNotes
        })
      });
      
      if (res.ok) {
        setSuccess(editModal.entry ? 'Schedule updated!' : 'Schedule added!');
        setEditModal(null);
        fetchSchedules();
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
        fetchSchedules();
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

  const daysInMonth = getDaysInMonth(month, year);
  const schedulesByDate = schedules.reduce((acc, schedule) => {
    acc[schedule.schedule_date] = schedule;
    return acc;
  }, {} as { [date: string]: ScheduleEntry });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>
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
            marginBottom: 24
          }}
        >
          ← Back to Dashboard
        </button>

        <h2 style={{ marginBottom: 20 }}>Manage User Schedule</h2>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Select RSA:</label>
          <select
            value={selectedUserId || ''}
            onChange={(e) => setSelectedUserId(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: 16,
              border: '2px solid #e5e7eb',
              borderRadius: 6
            }}
          >
            <option value="">-- Select a user --</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.fullName || user.username}
              </option>
            ))}
          </select>
        </div>

        {selectedUserId && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>📅 Schedule for {selectedUser?.fullName || selectedUser?.username}</h3>
            </div>

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

            {success && <div style={{ color: '#43cea2', marginBottom: 12 }}>{success}</div>}
            {error && <div style={{ color: '#e74c3c', marginBottom: 12 }}>{error}</div>}

            {loading ? <p>Loading...</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16, tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ background: '#f6f8fa' }}>
                    {[...Array(7)].map((_, i) => (
                      <th key={i} style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i]}</th>
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
                          const scheduleEntry = schedulesByDate[dateKey];
                          
                          cells.push(
                            <td key={d} style={{ 
                              padding: 8, 
                              minHeight: 120, 
                              border: '1px solid #e2e8f0', 
                              verticalAlign: 'top',
                              background: scheduleEntry ? '#fff3e0' : 'transparent'
                            }}>
                              <div style={{ fontWeight: 600, marginBottom: 8, color: scheduleEntry ? '#f57c00' : 'inherit' }}>{thisDay}</div>
                              {scheduleEntry ? (
                                <div>
                                  <div style={{ 
                                    background: '#ff9800', 
                                    color: '#fff', 
                                    padding: '6px 8px', 
                                    borderRadius: 4, 
                                    fontSize: 13,
                                    fontWeight: 600,
                                    marginBottom: 6
                                  }}>
                                    ✓ {scheduleEntry.hours}h {scheduleEntry.minutes > 0 ? `${scheduleEntry.minutes}m` : ''}
                                  </div>
                                  {scheduleEntry.notes && (
                                    <div style={{ fontSize: 11, color: '#666', marginBottom: 6, wordBreak: 'break-word' }}>
                                      {scheduleEntry.notes}
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <button
                                      onClick={() => openEditModal(dateKey, thisDay, scheduleEntry)}
                                      style={{
                                        flex: 1,
                                        padding: '4px',
                                        fontSize: 11,
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
                                      onClick={() => handleDelete(scheduleEntry.id)}
                                      style={{
                                        flex: 1,
                                        padding: '4px',
                                        fontSize: 11,
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
                                </div>
                              ) : (
                                <button
                                  onClick={() => openEditModal(dateKey, thisDay)}
                                  style={{
                                    width: '100%',
                                    padding: '6px',
                                    fontSize: 12,
                                    background: '#43cea2',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    fontWeight: 600
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
          </>
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
              <h3 style={{ marginTop: 0, marginBottom: 24 }}>
                {editModal.entry ? '✏️ Edit' : '➕ Add'} Schedule - Day {editModal.day}
              </h3>
              
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Hours:</label>
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
                    borderRadius: 6
                  }}
                />
              </div>
              
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Minutes:</label>
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
                    borderRadius: 6
                  }}
                />
              </div>
              
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Notes:</label>
                <textarea
                  value={tempNotes}
                  onChange={(e) => setTempNotes(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 16,
                    border: '2px solid #e5e7eb',
                    borderRadius: 6,
                    resize: 'vertical'
                  }}
                />
              </div>
              
              <div style={{ 
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

export default ManageUserSchedulePage;
