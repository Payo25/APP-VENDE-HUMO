import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/api';

const API_BASE_URL = '/api';
const SCHEDULES_CALENDAR_URL = `${API_BASE_URL}/personal-schedules/calendar`;
const USERS_URL = `${API_BASE_URL}/users`;
const CALL_HOURS_URL = `${API_BASE_URL}/call-hours`;

// ─── Color palettes ────────────────────────────────────────────
// RSA colors (saturated, opaque backgrounds)
const RSA_COLORS: { bg: string; border: string; text: string }[] = [
  { bg: '#4caf50', border: '#388e3c', text: '#fff' },   // green
  { bg: '#2196f3', border: '#1565c0', text: '#fff' },   // blue
  { bg: '#f44336', border: '#c62828', text: '#fff' },   // red
  { bg: '#ff9800', border: '#e65100', text: '#fff' },   // orange
  { bg: '#9c27b0', border: '#6a1b9a', text: '#fff' },   // purple
  { bg: '#00bcd4', border: '#00838f', text: '#fff' },   // cyan
  { bg: '#e91e63', border: '#ad1457', text: '#fff' },   // pink
  { bg: '#795548', border: '#4e342e', text: '#fff' },   // brown
  { bg: '#607d8b', border: '#37474f', text: '#fff' },   // blue-grey
  { bg: '#ff5722', border: '#bf360c', text: '#fff' },   // deep-orange
  { bg: '#8bc34a', border: '#558b2f', text: '#fff' },   // light-green
  { bg: '#673ab7', border: '#4527a0', text: '#fff' },   // deep-purple
];

// Doctor colors (lighter tints to visually distinguish from RSA)
const DOCTOR_COLORS: { bg: string; border: string; text: string }[] = [
  { bg: '#fff9c4', border: '#f9a825', text: '#5d4037' },  // yellow
  { bg: '#f3e5f5', border: '#ab47bc', text: '#4a148c' },  // lavender
  { bg: '#e8f5e9', border: '#66bb6a', text: '#1b5e20' },  // mint
  { bg: '#e3f2fd', border: '#42a5f5', text: '#0d47a1' },  // sky
  { bg: '#fce4ec', border: '#ef5350', text: '#b71c1c' },  // rose
  { bg: '#fff3e0', border: '#ffa726', text: '#e65100' },  // peach
  { bg: '#e0f7fa', border: '#26c6da', text: '#006064' },  // aqua
  { bg: '#f1f8e9', border: '#9ccc65', text: '#33691e' },  // lime
  { bg: '#ede7f6', border: '#7e57c2', text: '#311b92' },  // wisteria
  { bg: '#fbe9e7', border: '#ff7043', text: '#bf360c' },  // coral
];

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
  rsa_name: string;
  rsa_role: string;
}

interface User {
  id: number;
  fullName: string;
  role: string;
}

type ViewMode = 'day' | 'week';

// ─── Helpers ─────────────────────────────────────────────────
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6AM–11PM

function timeToMinutes(time: string): number {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function formatHour(hour: number): string {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h} ${ampm}`;
}

function formatTime12(time24: string): string {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${(m || 0).toString().padStart(2, '0')} ${ampm}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getMonday(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// ─── Component ───────────────────────────────────────────────
const SchedulerDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const userRole = localStorage.getItem('role');

  const [users, setUsers] = useState<User[]>([]);
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [callHoursAssignments, setCallHoursAssignments] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Filter state
  const [selectedRSAs, setSelectedRSAs] = useState<Set<number>>(new Set());
  const [selectedDoctors, setSelectedDoctors] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Computed date range for current view
  const { startDate, endDate, viewDates } = useMemo(() => {
    if (viewMode === 'day') {
      return { startDate: currentDate, endDate: currentDate, viewDates: [currentDate] };
    }
    const mon = getMonday(currentDate);
    const sun = addDays(mon, 6);
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) dates.push(addDays(mon, i));
    return { startDate: mon, endDate: sun, viewDates: dates };
  }, [viewMode, currentDate]);

  // Fetch users
  useEffect(() => {
    authFetch(USERS_URL)
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => {
        const rsas = data.filter((u: User) => u.role === 'Registered Surgical Assistant' || u.role === 'Team Leader');
        setUsers(rsas);
        // Default: all selected
        setSelectedRSAs(new Set(rsas.map((u: User) => u.id)));
      })
      .catch(() => setError('Failed to load users'));
  }, []);

  // Fetch schedules for date range
  const fetchSchedules = useCallback(() => {
    const sd = dateToStr(startDate);
    const ed = dateToStr(endDate);
    setLoading(true);
    setError('');

    const schedulesPromise = authFetch(`${SCHEDULES_CALENDAR_URL}?startDate=${sd}&endDate=${ed}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .catch(() => []);

    // Fetch call hours for months in range
    const monthsToFetch = new Set<string>();
    let d = new Date(startDate);
    while (d <= endDate) {
      monthsToFetch.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
      d = addDays(d, 1);
    }
    const callHoursPromises = Array.from(monthsToFetch).map(key => {
      const [yr, mo] = key.split('-');
      return authFetch(`${CALL_HOURS_URL}?month=${mo}&year=${yr}`)
        .then(res => { if (!res.ok) throw new Error(); return res.json(); })
        .catch(() => ({}));
    });

    Promise.all([schedulesPromise, Promise.all(callHoursPromises)]).then(([sched, chResults]) => {
      setSchedules(sched);
      const merged: Record<string, any[]> = {};
      chResults.forEach(r => Object.assign(merged, r));
      setCallHoursAssignments(merged);
      setLoading(false);
    });
  }, [startDate, endDate]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  // Build color maps
  const rsaColorMap = useMemo(() => {
    const map: Record<number, typeof RSA_COLORS[0]> = {};
    users.forEach((u, i) => { map[u.id] = RSA_COLORS[i % RSA_COLORS.length]; });
    return map;
  }, [users]);

  const allDoctors = useMemo(() => {
    const docs = new Set<string>();
    schedules.forEach(s => { if (s.physician_name) docs.add(s.physician_name); });
    return Array.from(docs).sort();
  }, [schedules]);

  // Init doctor selection
  useEffect(() => {
    if (allDoctors.length > 0 && selectedDoctors.size === 0) {
      setSelectedDoctors(new Set(allDoctors));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDoctors]);

  const doctorColorMap = useMemo(() => {
    const map: Record<string, typeof DOCTOR_COLORS[0]> = {};
    allDoctors.forEach((d, i) => { map[d] = DOCTOR_COLORS[i % DOCTOR_COLORS.length]; });
    return map;
  }, [allDoctors]);

  // Group schedules by date
  const schedulesByDate = useMemo(() => {
    const map: Record<string, ScheduleEntry[]> = {};
    schedules.forEach(s => {
      const dkey = s.schedule_date?.split('T')[0] || '';
      if (!map[dkey]) map[dkey] = [];
      map[dkey].push(s);
    });
    return map;
  }, [schedules]);

  // Navigation
  const goToday = () => setCurrentDate(new Date());
  const goPrev = () => setCurrentDate(prev => addDays(prev, viewMode === 'day' ? -1 : -7));
  const goNext = () => setCurrentDate(prev => addDays(prev, viewMode === 'day' ? 1 : 7));

  // Toggle helpers
  const toggleRSA = (id: number) => {
    setSelectedRSAs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleDoctor = (name: string) => {
    setSelectedDoctors(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };
  const selectAllRSAs = () => setSelectedRSAs(new Set(users.map(u => u.id)));
  const deselectAllRSAs = () => setSelectedRSAs(new Set());
  const selectAllDoctors = () => setSelectedDoctors(new Set(allDoctors));
  const deselectAllDoctors = () => setSelectedDoctors(new Set());

  // Access control
  if (userRole !== 'Scheduler' && userRole !== 'Business Assistant' && userRole !== 'Team Leader' && userRole !== 'Admin') {
    return (
      <div className="responsive-card" style={{ marginTop: 40 }}>
        <h2>Scheduler Calendar</h2>
        <div style={{ color: 'red', marginBottom: 24 }}>Access denied.</div>
        <button onClick={() => navigate('/dashboard')} style={navBtnStyle}>← Back to Dashboard</button>
      </div>
    );
  }

  // ─── Render a single day column ──────────────────────────
  function renderDayColumn(date: Date, columnWidth: string) {
    const dateKey = dateToStr(date);
    const daySchedules = (schedulesByDate[dateKey] || [])
      .filter(s => selectedRSAs.has(s.user_id))
      .filter(s => !s.physician_name || selectedDoctors.has(s.physician_name));

    // Call hours for this date
    const callHourEntries = (callHoursAssignments[dateKey] || [])
      .filter((a: any) => selectedRSAs.has(Number(a.id)));

    const isToday = dateToStr(new Date()) === dateKey;
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    return (
      <div key={dateKey} style={{ flex: columnWidth, minWidth: 0, borderRight: '1px solid #e2e8f0', position: 'relative' }}>
        {/* Day header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 5,
          background: isToday ? '#e3f2fd' : isWeekend ? '#f5f5f5' : '#fff',
          borderBottom: '2px solid #e2e8f0',
          padding: '8px 4px',
          textAlign: 'center',
          fontWeight: 600,
          fontSize: 13,
        }}>
          <div style={{ color: isToday ? '#1565c0' : '#666', fontSize: 11 }}>
            {DAY_NAMES[dayOfWeek]}
          </div>
          <div style={{
            fontSize: 22, fontWeight: 700,
            background: isToday ? '#1565c0' : 'transparent',
            color: isToday ? '#fff' : '#333',
            borderRadius: '50%',
            width: 36, height: 36, lineHeight: '36px',
            margin: '2px auto',
          }}>
            {date.getDate()}
          </div>
        </div>

        {/* Call hours badges at top */}
        {callHourEntries.length > 0 && (
          <div style={{
            padding: '4px 2px', borderBottom: '1px solid #e2e8f0',
            background: '#f8f9fa', display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center'
          }}>
            {callHourEntries.map((a: any) => {
              const color = rsaColorMap[Number(a.id)];
              const user = users.find(u => u.id === Number(a.id));
              if (!color || !user) return null;
              return (
                <span key={a.id} title={`${user.fullName} – On Call ${a.hours || 0}h${a.minutes ? ` ${a.minutes}m` : ''}`} style={{
                  display: 'inline-block',
                  fontSize: 9, fontWeight: 700,
                  background: color.bg + '30',
                  color: color.border,
                  border: `1px solid ${color.border}`,
                  borderRadius: 4,
                  padding: '1px 4px',
                  whiteSpace: 'nowrap',
                }}>
                  📞 {user.fullName.split(' ')[0]} {a.hours || 0}h
                </span>
              );
            })}
          </div>
        )}

        {/* Hour grid */}
        <div style={{ position: 'relative' }}>
          {HOURS.map(hour => (
            <div key={hour} style={{
              height: 60, borderBottom: '1px solid #f0f0f0',
              boxSizing: 'border-box',
            }} />
          ))}

          {/* Schedule blocks */}
          {daySchedules.map(sched => {
            const startMin = timeToMinutes(sched.start_time);
            const endMin = timeToMinutes(sched.end_time);
            if (!startMin && !endMin) return null;

            const startOffset = Math.max(0, startMin - 360); // 360 = 6AM in minutes
            const duration = Math.max(30, endMin - startMin);
            const topPx = (startOffset / 60) * 60;
            const heightPx = (duration / 60) * 60;

            const rsaColor = rsaColorMap[sched.user_id] || RSA_COLORS[0];
            const docColor = sched.physician_name ? (doctorColorMap[sched.physician_name] || DOCTOR_COLORS[0]) : null;

            return (
              <div
                key={sched.id}
                title={[
                  sched.rsa_name,
                  sched.physician_name ? `Dr: ${sched.physician_name}` : '',
                  sched.health_center_name || '',
                  sched.notes || '',
                  `${formatTime12(sched.start_time)} – ${formatTime12(sched.end_time)}`
                ].filter(Boolean).join('\n')}
                style={{
                  position: 'absolute',
                  top: topPx,
                  left: 2,
                  right: 2,
                  height: heightPx - 2,
                  background: rsaColor.bg,
                  color: rsaColor.text,
                  borderRadius: 4,
                  borderLeft: `4px solid ${rsaColor.border}`,
                  padding: '2px 4px',
                  fontSize: 10,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  zIndex: 2,
                  lineHeight: '13px',
                }}
                onClick={() => navigate(`/manage-user-schedule`)}
              >
                <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {sched.rsa_name || 'RSA'}
                </div>
                {sched.physician_name && (
                  <div style={{
                    fontWeight: 600, fontSize: 9, marginTop: 1,
                    background: docColor ? docColor.bg : 'rgba(255,255,255,0.3)',
                    color: docColor ? docColor.text : '#fff',
                    borderRadius: 2, padding: '0 3px',
                    display: 'inline-block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                  }}>
                    Dr. {sched.physician_name}
                  </div>
                )}
                {sched.health_center_name && heightPx > 40 && (
                  <div style={{ fontSize: 9, opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                    {sched.health_center_name}
                  </div>
                )}
                {sched.notes && heightPx > 55 && (
                  <div style={{ fontSize: 9, opacity: 0.8, fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                    {sched.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Main render ─────────────────────────────────────────
  const headerTitle = viewMode === 'day'
    ? `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`
    : `${MONTH_NAMES[viewDates[0].getMonth()]} ${viewDates[0].getDate()} – ${MONTH_NAMES[viewDates[6].getMonth()]} ${viewDates[6].getDate()}, ${viewDates[6].getFullYear()}`;

  return (
    <div style={{ minHeight: '100vh', padding: '12px 8px' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 8, marginBottom: 8, padding: '0 4px',
      }}>
        <button onClick={() => navigate('/dashboard')} style={navBtnStyle}>← Dashboard</button>
        <h2 style={{ margin: 0, fontSize: 18, flex: 1, textAlign: 'center', color: '#2d3a4b', minWidth: 200 }}>
          {headerTitle}
        </h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={goPrev} style={navSmallBtn}>‹</button>
          <button onClick={goToday} style={{ ...navSmallBtn, fontWeight: 600, fontSize: 12 }}>Today</button>
          <button onClick={goNext} style={navSmallBtn}>›</button>
        </div>
      </div>

      {/* View mode toggle + filter button */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, padding: '0 4px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #667eea' }}>
          <button onClick={() => setViewMode('day')} style={{
            padding: '6px 16px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
            background: viewMode === 'day' ? '#667eea' : '#fff',
            color: viewMode === 'day' ? '#fff' : '#667eea',
          }}>Day</button>
          <button onClick={() => setViewMode('week')} style={{
            padding: '6px 16px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
            background: viewMode === 'week' ? '#667eea' : '#fff',
            color: viewMode === 'week' ? '#fff' : '#667eea',
          }}>Week</button>
        </div>

        <button onClick={() => setShowFilters(prev => !prev)} style={{
          padding: '6px 14px', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer',
          background: showFilters ? '#667eea' : '#fff',
          color: showFilters ? '#fff' : '#667eea',
          border: '1px solid #667eea',
        }}>
          {showFilters ? '✕ Hide Filters' : '☰ Filters'}
        </button>

        <button onClick={fetchSchedules} style={{
          padding: '6px 14px', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer',
          background: '#fff', color: '#4caf50', border: '1px solid #4caf50',
        }}>
          ↻ Refresh
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div style={{
          background: '#fff', borderRadius: 8, padding: 12, marginBottom: 8,
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0',
          display: 'flex', gap: 24, flexWrap: 'wrap',
        }}>
          {/* RSA filters */}
          <div style={{ minWidth: 200 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#333' }}>
              RSAs / Team Leaders
              <span style={{ marginLeft: 8 }}>
                <button onClick={selectAllRSAs} style={filterActionBtn}>All</button>
                <button onClick={deselectAllRSAs} style={filterActionBtn}>None</button>
              </span>
            </div>
            {users.map(u => {
              const color = rsaColorMap[u.id];
              return (
                <label key={u.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', cursor: 'pointer', fontSize: 13
                }}>
                  <input type="checkbox" checked={selectedRSAs.has(u.id)} onChange={() => toggleRSA(u.id)} />
                  <span style={{
                    width: 14, height: 14, borderRadius: 3, background: color?.bg || '#ccc',
                    border: `2px solid ${color?.border || '#999'}`, display: 'inline-block', flexShrink: 0,
                  }} />
                  {u.fullName}
                  {u.role === 'Team Leader' && <span style={{ fontSize: 10, color: '#888', marginLeft: 4 }}>(TL)</span>}
                </label>
              );
            })}
          </div>

          {/* Doctor filters */}
          <div style={{ minWidth: 200 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#333' }}>
              Physicians
              <span style={{ marginLeft: 8 }}>
                <button onClick={selectAllDoctors} style={filterActionBtn}>All</button>
                <button onClick={deselectAllDoctors} style={filterActionBtn}>None</button>
              </span>
            </div>
            {allDoctors.length === 0 && <div style={{ fontSize: 12, color: '#999' }}>No physicians in this date range</div>}
            {allDoctors.map(doc => {
              const color = doctorColorMap[doc];
              return (
                <label key={doc} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', cursor: 'pointer', fontSize: 13
                }}>
                  <input type="checkbox" checked={selectedDoctors.has(doc)} onChange={() => toggleDoctor(doc)} />
                  <span style={{
                    width: 14, height: 14, borderRadius: 3, background: color?.bg || '#ccc',
                    border: `2px solid ${color?.border || '#999'}`, display: 'inline-block', flexShrink: 0,
                  }} />
                  Dr. {doc}
                </label>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ minWidth: 160 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#333' }}>Legend</div>
            <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 24, height: 14, borderRadius: 3, background: '#4caf50', display: 'inline-block' }} />
                <span>RSA schedule block</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 24, height: 14, borderRadius: 3, background: '#fff9c4', border: '1px solid #f9a825', display: 'inline-block' }} />
                <span>Physician label</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>📞</span>
                <span>On-call hours</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <div style={{ color: 'red', padding: '8px 12px', marginBottom: 8, background: '#fff3f3', borderRadius: 6 }}>{error}</div>}

      {/* Calendar grid */}
      <div style={{
        background: '#fff', borderRadius: 8, overflow: 'hidden',
        boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
      }}>
        <div style={{
          display: 'flex', overflowX: 'auto',
          maxHeight: 'calc(100vh - 200px)', overflowY: 'auto',
        }}>
          {/* Time gutter */}
          <div style={{ width: 52, flexShrink: 0, borderRight: '1px solid #e2e8f0', background: '#fafbfc' }}>
            <div style={{ height: 55, borderBottom: '2px solid #e2e8f0' }} /> {/* header spacer */}
            {/* Call hours spacer – dynamic height handled per column; use fixed placeholder */}
            {HOURS.map(hour => (
              <div key={hour} style={{
                height: 60, borderBottom: '1px solid #f0f0f0',
                padding: '2px 4px', fontSize: 11, color: '#999', fontWeight: 600,
                textAlign: 'right', boxSizing: 'border-box',
              }}>
                {formatHour(hour)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {viewDates.map(date => renderDayColumn(date, viewMode === 'day' ? '1' : `${100 / 7}%`))}
        </div>
      </div>

      {loading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100,
        }}>
          <div style={{ background: '#fff', padding: '16px 32px', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
            Loading...
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Shared styles ─────────────────────────────────────────
const navBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'linear-gradient(90deg, #667eea 0%, #5a67d8 100%)',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(90,103,216,0.08)',
};

const navSmallBtn: React.CSSProperties = {
  padding: '6px 12px',
  background: '#fff',
  color: '#667eea',
  border: '1px solid #667eea',
  borderRadius: 6,
  fontSize: 16,
  fontWeight: 700,
  cursor: 'pointer',
};

const filterActionBtn: React.CSSProperties = {
  padding: '1px 8px',
  fontSize: 11,
  border: '1px solid #ccc',
  borderRadius: 4,
  background: '#f8f8f8',
  cursor: 'pointer',
  marginRight: 4,
};

export default SchedulerDashboardPage;
