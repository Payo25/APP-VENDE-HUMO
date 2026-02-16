import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = '/api';
const PERSONAL_SCHEDULES_URL = `${API_BASE_URL}/personal-schedules`;
const USERS_URL = `${API_BASE_URL}/users`;
const PHYSICIANS_URL = `${API_BASE_URL}/physicians`;
const HEALTH_CENTERS_URL = `${API_BASE_URL}/health-centers`;

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

interface User {
  id: number;
  username: string;
  fullName: string;
  role: string;
}

interface Physician {
  id: number;
  name: string;
  specialty: string;
}

interface HealthCenter {
  id: number;
  name: string;
  address: string;
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
  const [physicians, setPhysicians] = useState<Physician[]>([]);
  const [healthCenters, setHealthCenters] = useState<HealthCenter[]>([]);
  const [tempPhysician, setTempPhysician] = useState('');
  const [tempHealthCenter, setTempHealthCenter] = useState('');
  const [tempStartTime, setTempStartTime] = useState('07:00');
  const [tempEndTime, setTempEndTime] = useState('15:00');

  useEffect(() => {
    if (userRole !== 'Scheduler' && userRole !== 'Business Assistant' && userRole !== 'Team Leader') {
      navigate('/dashboard');
      return;
    }
    // Fetch RSAs and Team Leaders
    fetch(USERS_URL)
      .then(res => res.json())
      .then(data => {
        const rsas = data.filter((u: User) => u.role === 'Registered Surgical Assistant' || u.role === 'Team Leader');
        setUsers(rsas);
      });
    // Fetch physicians
    fetch(PHYSICIANS_URL)
      .then(res => res.json())
      .then(data => setPhysicians(data))
      .catch(() => {});
    // Fetch health centers
    fetch(HEALTH_CENTERS_URL)
      .then(res => res.json())
      .then(data => setHealthCenters(data))
      .catch(() => {});
  }, [userRole, navigate]);

  const fetchSchedules = useCallback(() => {
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
  }, [selectedUserId, month, year]);

  useEffect(() => {
    if (selectedUserId) {
      const user = users.find(u => u.id === selectedUserId);
      setSelectedUser(user || null);
      fetchSchedules();
    }
  }, [selectedUserId, month, year, users, fetchSchedules]);

  const handleAddOrEdit = async () => {
    if (!editModal || !selectedUserId) return;
    
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
            notes: tempNotes,
            physicianName: tempPhysician,
            healthCenterName: tempHealthCenter,
            startTime: tempStartTime,
            endTime: tempEndTime
          })
        });
      } else {
        // Add new entry via POST
        res = await fetch(PERSONAL_SCHEDULES_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: selectedUserId,
            scheduleDate: editModal.date,
            hours: tempHours,
            minutes: tempMinutes,
            notes: tempNotes,
            physicianName: tempPhysician,
            healthCenterName: tempHealthCenter,
            startTime: tempStartTime,
            endTime: tempEndTime
          })
        });
      }
      
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
    setTempPhysician(entry?.physician_name || '');
    setTempHealthCenter(entry?.health_center_name || '');
    setTempStartTime(entry?.start_time || '07:00');
    setTempEndTime(entry?.end_time || '15:00');
  };

  const daysInMonth = getDaysInMonth(month, year);
  const schedulesByDate = schedules.reduce((acc, schedule) => {
    const key = schedule.schedule_date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(schedule);
    return acc;
  }, {} as { [date: string]: ScheduleEntry[] });

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
                          const dayEntries = schedulesByDate[dateKey] || [];
                          
                          cells.push(
                            <td key={d} style={{ 
                              padding: 8, 
                              minHeight: 120, 
                              border: '1px solid #e2e8f0', 
                              verticalAlign: 'top',
                              background: dayEntries.length > 0 ? '#fff3e0' : 'transparent'
                            }}>
                              <div style={{ fontWeight: 600, marginBottom: 8, color: dayEntries.length > 0 ? '#f57c00' : 'inherit' }}>{thisDay}</div>
                              {dayEntries.map((entry, idx) => (
                                <div key={entry.id} style={{ marginBottom: 6, padding: '4px 6px', background: idx % 2 === 0 ? '#fff8e1' : '#e8f5e9', borderRadius: 4, border: '1px solid #e0e0e0' }}>
                                  {entry.start_time && entry.end_time ? (
                                    <div style={{ 
                                      background: idx % 2 === 0 ? '#ff9800' : '#4caf50', 
                                      color: '#fff', 
                                      padding: '4px 6px', 
                                      borderRadius: 4, 
                                      fontSize: 11,
                                      fontWeight: 600,
                                      marginBottom: 4
                                    }}>
                                      🕐 {formatTime12(entry.start_time)} - {formatTime12(entry.end_time)}
                                    </div>
                                  ) : (
                                    <div style={{ 
                                      background: idx % 2 === 0 ? '#ff9800' : '#4caf50', 
                                      color: '#fff', 
                                      padding: '4px 6px', 
                                      borderRadius: 4, 
                                      fontSize: 12,
                                      fontWeight: 600,
                                      marginBottom: 4
                                    }}>
                                      ✓ {entry.hours}h {entry.minutes > 0 ? `${entry.minutes}m` : ''}
                                    </div>
                                  )}
                                  {entry.physician_name && (
                                    <div style={{ fontSize: 11, color: '#1976d2', marginBottom: 2, wordBreak: 'break-word', fontWeight: 600 }}>
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
                                </div>
                              ))}
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
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>🩺 Physician:</label>
                <select
                  value={tempPhysician}
                  onChange={(e) => setTempPhysician(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 16,
                    border: '2px solid #e5e7eb',
                    borderRadius: 6
                  }}
                >
                  <option value="">-- Select Physician --</option>
                  {physicians.map(p => (
                    <option key={p.id} value={p.name}>{p.name} ({p.specialty})</option>
                  ))}
                </select>
              </div>
              
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>🏥 Health Center:</label>
                <select
                  value={tempHealthCenter}
                  onChange={(e) => setTempHealthCenter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 16,
                    border: '2px solid #e5e7eb',
                    borderRadius: 6
                  }}
                >
                  <option value="">-- Select Health Center --</option>
                  {healthCenters.map(hc => (
                    <option key={hc.id} value={hc.name}>{hc.name}</option>
                  ))}
                </select>
              </div>
              
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>🕐 Start Time:</label>
                <input
                  type="time"
                  value={tempStartTime}
                  onChange={(e) => setTempStartTime(e.target.value)}
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
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>🕐 End Time:</label>
                <input
                  type="time"
                  value={tempEndTime}
                  onChange={(e) => setTempEndTime(e.target.value)}
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
                  Schedule: <strong style={{ color: '#1f2937', fontSize: 16 }}>{formatTime12(tempStartTime)} - {formatTime12(tempEndTime)}</strong>
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
