import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/api';

const API_BASE_URL = '/api';

interface VacationEntry {
  id: number;
  user_id: number;
  user_name: string;
  vacation_date: string;
  hours: number;
  vacation_type: string;
  notes: string | null;
}

interface VacationProfile {
  id: number;
  user_id: number;
  user_name: string;
  employment_start_date: string;
  accrual_rate: number;
  pto: number;
  notes: string | null;
}

interface User {
  id: number;
  fullName: string;
  role: string;
  hourlyRate?: number;
}

interface RateChange {
  id: number;
  user_id: number;
  old_rate: number;
  new_rate: number;
  effective_date: string;
  changed_by_name: string | null;
  createdat: string;
}

const VACATION_TYPES = ['Vacation', 'PTO', 'Sick', 'Personal Day', 'Holiday'];

const VacationTimePage: React.FC = () => {
  const navigate = useNavigate();
  const userRole = localStorage.getItem('role');

  const [tab, setTab] = useState<'profiles' | 'entries'>('profiles');
  const [entries, setEntries] = useState<VacationEntry[]>([]);
  const [profiles, setProfiles] = useState<VacationProfile[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Entry form state
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [editEntryId, setEditEntryId] = useState<number | null>(null);
  const [formUserId, setFormUserId] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formHours, setFormHours] = useState('8');
  const [formType, setFormType] = useState('Vacation');
  const [formNotes, setFormNotes] = useState('');

  // Profile form state
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [editProfileId, setEditProfileId] = useState<number | null>(null);
  const [profileUserId, setProfileUserId] = useState('');
  const [profileStartDate, setProfileStartDate] = useState('');
  const [profileRate, setProfileRate] = useState('1.54');
  const [profilePto, setProfilePto] = useState('0');
  const [profileNotes, setProfileNotes] = useState('');

  // Filter state
  const [filterUserId, setFilterUserId] = useState('');

  // Inline edit state
  const [inlineEditId, setInlineEditId] = useState<number | null>(null);
  const [inlineStartDate, setInlineStartDate] = useState('');
  const [inlineRate, setInlineRate] = useState('');
  const [inlinePto, setInlinePto] = useState('');
  const [inlineNotes, setInlineNotes] = useState('');

  // Rate changes state
  const [rateChanges, setRateChanges] = useState<RateChange[]>([]);
  const [showEffectiveDateModal, setShowEffectiveDateModal] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState('');
  const [pendingInlineEdit, setPendingInlineEdit] = useState<VacationProfile | null>(null);
  useEffect(() => {
    if (userRole !== 'Business Assistant' && userRole !== 'Team Leader' && userRole !== 'Scheduler') return;
    Promise.all([
      authFetch(`${API_BASE_URL}/vacation-time`).then(res => res.ok ? res.json() : []),
      authFetch(`${API_BASE_URL}/vacation-profiles`).then(res => res.ok ? res.json() : []),
      authFetch(`${API_BASE_URL}/users`).then(res => res.ok ? res.json() : []),
      authFetch(`${API_BASE_URL}/rate-changes`).then(res => res.ok ? res.json() : [])
    ]).then(([vacData, profData, usersData, rcData]) => {
      setEntries(vacData);
      setProfiles(profData);
      setUsers(usersData.filter((u: User) => u.role === 'Registered Surgical Assistant' || u.role === 'Team Leader' || u.role === 'Scheduler'));
      setRateChanges(rcData);
      setLoading(false);
    }).catch(() => {
      setError('Failed to load data');
      setLoading(false);
    });
  }, [userRole]);

  const fetchEntries = async () => {
    const url = filterUserId
      ? `${API_BASE_URL}/vacation-time?user_id=${filterUserId}`
      : `${API_BASE_URL}/vacation-time`;
    const res = await authFetch(url);
    if (res.ok) setEntries(await res.json());
  };

  const fetchProfiles = async () => {
    const res = await authFetch(`${API_BASE_URL}/vacation-profiles`);
    if (res.ok) setProfiles(await res.json());
    const rcRes = await authFetch(`${API_BASE_URL}/rate-changes`);
    if (rcRes.ok) setRateChanges(await rcRes.json());
  };

  // --- Entry form ---
  const resetEntryForm = () => {
    setEditEntryId(null);
    setFormUserId('');
    setFormDate('');
    setFormHours('8');
    setFormType('Vacation');
    setFormNotes('');
    setShowEntryForm(false);
  };

  const handleSaveEntry = async () => {
    if (!formUserId || !formDate) { setError('Please select an Employee and date'); return; }
    setError(''); setSuccess('');
    const body = { user_id: Number(formUserId), vacation_date: formDate, hours: parseFloat(formHours) || 8, vacation_type: formType, notes: formNotes || null };
    let res;
    if (editEntryId) {
      res = await authFetch(`${API_BASE_URL}/vacation-time/${editEntryId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } else {
      res = await authFetch(`${API_BASE_URL}/vacation-time`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    if (res.ok) { resetEntryForm(); await fetchEntries(); setSuccess(editEntryId ? 'Entry updated!' : 'Entry added!'); } 
    else { const data = await res.json().catch(() => ({})); setError(data.error || 'Failed to save'); }
  };

  const handleEditEntry = (entry: VacationEntry) => {
    setEditEntryId(entry.id);
    setFormUserId(String(entry.user_id));
    setFormDate(entry.vacation_date?.split('T')[0] || '');
    setFormHours(String(entry.hours));
    setFormType(entry.vacation_type);
    setFormNotes(entry.notes || '');
    setShowEntryForm(true);
  };

  const handleDeleteEntry = async (id: number) => {
    if (!window.confirm('Delete this vacation entry?')) return;
    const res = await authFetch(`${API_BASE_URL}/vacation-time/${id}`, { method: 'DELETE' });
    if (res.ok) { await fetchEntries(); setSuccess('Entry deleted'); }
  };

  // --- Profile form ---
  const resetProfileForm = () => {
    setEditProfileId(null);
    setProfileUserId('');
    setProfileStartDate('');
    setProfileRate('1.54');
    setProfilePto('0');
    setProfileNotes('');
    setShowProfileForm(false);
  };

  const handleSaveProfile = async () => {
    if (!profileUserId || !profileStartDate) { setError('Please select an Employee and start date'); return; }
    setError(''); setSuccess('');
    const body = { user_id: Number(profileUserId), employment_start_date: profileStartDate, accrual_rate: parseFloat(profileRate) || 1.54, pto: parseFloat(profilePto) || 0, notes: profileNotes || null };
    let res;
    if (editProfileId) {
      res = await authFetch(`${API_BASE_URL}/vacation-profiles/${editProfileId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } else {
      res = await authFetch(`${API_BASE_URL}/vacation-profiles`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    if (res.ok) { resetProfileForm(); await fetchProfiles(); setSuccess(editProfileId ? 'Profile updated!' : 'Profile created!'); }
    else { const data = await res.json().catch(() => ({})); setError(data.error || 'Failed to save profile'); }
  };

  const startInlineEdit = (p: VacationProfile) => {
    setInlineEditId(p.id);
    setInlineStartDate(p.employment_start_date?.split('T')[0] || '');
    setInlineRate(String(p.accrual_rate));
    setInlinePto(String(p.pto || 0));
    setInlineNotes(p.notes || '');
  };

  const cancelInlineEdit = () => setInlineEditId(null);

  const saveInlineEdit = async (p: VacationProfile) => {
    const newRate = parseFloat(inlineRate) || 0;
    const oldRate = p.accrual_rate;
    // If rate changed, prompt for effective date via modal
    if (Math.abs(newRate - oldRate) > 0.001) {
      setPendingInlineEdit(p);
      setEffectiveDate(new Date().toISOString().split('T')[0]);
      setShowEffectiveDateModal(true);
      return;
    }
    await doSaveInlineEdit(p);
  };

  const doSaveInlineEdit = async (p: VacationProfile, rateDateOverride?: string) => {
    setError(''); setSuccess('');
    const body: any = { user_id: p.user_id, employment_start_date: inlineStartDate, accrual_rate: parseFloat(inlineRate) || 0, pto: parseFloat(inlinePto) || 0, notes: inlineNotes || null };
    if (rateDateOverride) {
      body.rate_effective_date = rateDateOverride;
    }
    const res = await authFetch(`${API_BASE_URL}/vacation-profiles/${p.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) { setInlineEditId(null); await fetchProfiles(); setSuccess('Profile updated!'); }
    else { const data = await res.json().catch(() => ({})); setError(data.error || 'Failed to save'); }
  };

  const confirmEffectiveDate = async () => {
    if (!pendingInlineEdit || !effectiveDate) return;
    await doSaveInlineEdit(pendingInlineEdit, effectiveDate);
    setShowEffectiveDateModal(false);
    setPendingInlineEdit(null);
    setEffectiveDate('');
  };

  const handleDeleteProfile = async (id: number) => {
    if (!window.confirm('Delete this vacation profile?')) return;
    const res = await authFetch(`${API_BASE_URL}/vacation-profiles/${id}`, { method: 'DELETE' });
    if (res.ok) { await fetchProfiles(); setSuccess('Profile deleted'); }
  };

  // Compute vacation and PTO balances separately (segmented by rate changes)
  const getBalance = (profile: VacationProfile) => {
    const today = new Date();
    const start = new Date(profile.employment_start_date + 'T00:00:00');
    if (isNaN(start.getTime())) return null;
    const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / 86400000);
    if (daysSinceStart < 0) return { periodsWorked: 0, hoursEarned: 0, vacationUsed: 0, vacationBalance: 0, ptoAllocation: 0, ptoUsed: 0, ptoBalance: 0 };
    const periodsWorked = Math.floor(daysSinceStart / 7);

    // Get rate changes for this user, sorted by effective_date ascending
    const userRateChanges = rateChanges
      .filter(rc => String(rc.user_id) === String(profile.user_id))
      .sort((a, b) => a.effective_date.localeCompare(b.effective_date));

    let hoursEarned = 0;
    if (userRateChanges.length === 0) {
      // No rate changes: simple calculation
      hoursEarned = periodsWorked * profile.accrual_rate;
    } else {
      // Build rate segments: start_date → first_change, first_change → second_change, ..., last_change → today
      // Find the original rate (the old_rate of the first change, or the initial accrual_rate if no changes before employment)
      const segments: { from: Date; to: Date; rate: number }[] = [];
      let segStart = start;
      let segRate = userRateChanges[0].old_rate ?? profile.accrual_rate;

      for (const rc of userRateChanges) {
        const changeDate = new Date(rc.effective_date + 'T00:00:00');
        if (changeDate > segStart) {
          segments.push({ from: segStart, to: changeDate, rate: Number(segRate) });
        }
        segStart = changeDate;
        segRate = rc.new_rate;
      }
      // Last segment: from last change to today
      if (today > segStart) {
        segments.push({ from: segStart, to: today, rate: Number(segRate) });
      }

      for (const seg of segments) {
        const segDays = Math.floor((seg.to.getTime() - seg.from.getTime()) / 86400000);
        const segWeeks = Math.floor(segDays / 7);
        hoursEarned += segWeeks * seg.rate;
      }
    }

    hoursEarned = Number(hoursEarned.toFixed(2));
    const userEntries = entries.filter(e => String(e.user_id) === String(profile.user_id));
    const vacationUsed = Number(userEntries.filter(e => e.vacation_type !== 'PTO').reduce((sum, e) => sum + (parseFloat(String(e.hours)) || 0), 0).toFixed(2));
    const ptoUsed = Number(userEntries.filter(e => e.vacation_type === 'PTO').reduce((sum, e) => sum + (parseFloat(String(e.hours)) || 0), 0).toFixed(2));
    const vacationBalance = Number((hoursEarned - vacationUsed).toFixed(2));
    const ptoAllocation = Number(profile.pto || 0);
    const ptoBalance = Number((ptoAllocation - ptoUsed).toFixed(2));
    return { periodsWorked, hoursEarned, vacationUsed, vacationBalance, ptoAllocation, ptoUsed, ptoBalance };
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: 15, boxSizing: 'border-box' };
  const btnStyle: React.CSSProperties = { width: '100%', padding: '12px 0', background: 'linear-gradient(90deg, #667eea 0%, #5a67d8 100%)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(90,103,216,0.08)', transition: 'background 0.2s', marginBottom: 16 };
  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 28px', border: 'none', borderBottom: active ? '3px solid #667eea' : '3px solid transparent',
    background: active ? '#f0f4ff' : '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer', color: active ? '#667eea' : '#666',
    borderRadius: '6px 6px 0 0', transition: 'all 0.2s'
  });

  if (userRole !== 'Business Assistant' && userRole !== 'Team Leader' && userRole !== 'Scheduler') {
    return (
      <div className="responsive-card" style={{ marginTop: 40 }}>
        <h2>Vacation Time</h2>
        <div style={{ color: 'red', marginBottom: 24 }}>Access denied.</div>
        <button onClick={() => navigate('/dashboard')} style={btnStyle}>← Back to Dashboard</button>
      </div>
    );
  }

  const myUserId = localStorage.getItem('userId');
  const isScheduler = userRole === 'Scheduler';
  const visibleEntries = isScheduler ? entries.filter(e => String(e.user_id) !== String(myUserId)) : entries;
  const filteredEntries = filterUserId ? visibleEntries.filter(e => String(e.user_id) === filterUserId) : visibleEntries;
  const visibleUsers = isScheduler ? users.filter(u => String(u.id) !== String(myUserId)) : users;
  const usersWithoutProfile = visibleUsers.filter(u => !profiles.some(p => String(p.user_id) === String(u.id)));

  return (
    <div className="responsive-card" style={{ marginTop: 40, maxWidth: 1100, width: '100%' }}>
      <button onClick={() => navigate('/dashboard')} style={btnStyle}>← Back to Dashboard</button>
      <h2 style={{ marginBottom: 8 }}>Vacation Time Manager</h2>

      {error && <p style={{ color: 'red', marginBottom: 8 }}>{error}</p>}
      {success && <p style={{ color: '#15803d', marginBottom: 8 }}>{success}</p>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
        <button onClick={() => { setTab('profiles'); setError(''); setSuccess(''); }} style={tabBtnStyle(tab === 'profiles')}>📋 Profiles</button>
        <button onClick={() => { setTab('entries'); setError(''); setSuccess(''); }} style={tabBtnStyle(tab === 'entries')}>📅 Vacation Entries</button>
      </div>

      {loading ? <p>Loading...</p> : tab === 'profiles' ? (
        /* ===== PROFILES TAB ===== */
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ margin: 0, color: '#666', fontSize: 14 }}>
              Create a vacation profile for each Employee to set their employment start date and weekly accrual rate. Vacation hours accrue automatically each week.
            </p>
            <button onClick={() => { resetProfileForm(); setShowProfileForm(true); }} style={{ padding: '10px 24px', background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 15, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              + Create Profile
            </button>
          </div>

          {/* Profile Form */}
          {showProfileForm && (
            <div style={{ background: '#f8fafc', padding: 20, borderRadius: 10, marginBottom: 24, border: '1px solid #e2e8f0' }}>
              <h3 style={{ marginTop: 0 }}>{editProfileId ? 'Edit Profile' : 'Create Vacation Profile'}</h3>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ fontWeight: 600, fontSize: 13 }}>Employee *</label>
                  <select value={profileUserId} onChange={e => setProfileUserId(e.target.value)} style={inputStyle} disabled={!!editProfileId}>
                    <option value="">Select Employee...</option>
                    {(editProfileId ? visibleUsers : usersWithoutProfile).map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ fontWeight: 600, fontSize: 13 }}>Employment Start Date *</label>
                  <input type="date" value={profileStartDate} onChange={e => setProfileStartDate(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={{ fontWeight: 600, fontSize: 13 }}>Accrual Rate (hrs/week)</label>
                  <input type="number" step="0.01" min="0" value={profileRate} onChange={e => setProfileRate(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <label style={{ fontWeight: 600, fontSize: 13 }}>PTO (hrs)</label>
                  <input type="number" step="0.01" min="0" value={profilePto} onChange={e => setProfilePto(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontWeight: 600, fontSize: 13 }}>Notes</label>
                <input value={profileNotes} onChange={e => setProfileNotes(e.target.value)} style={inputStyle} placeholder="Optional notes..." />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={handleSaveProfile} style={{ padding: '10px 28px', background: '#15803d', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
                  {editProfileId ? 'Update' : 'Create'}
                </button>
                <button onClick={resetProfileForm} style={{ padding: '10px 28px', background: '#e2e8f0', color: '#333', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Profiles Table with Balance */}
          {profiles.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#888', padding: 20 }}>No vacation profiles yet. Create one to get started.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'left' }}>Employee</th>
                    <th style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>Start Date</th>
                    <th style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>Rate (hrs/week)</th>
                    <th style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>Weeks Worked</th>
                    <th style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>Vac Earned</th>
                    <th style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>Vac Used</th>
                    <th style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>Vac Balance</th>
                    <th style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>PTO Allocated</th>
                    <th style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>PTO Used</th>
                    <th style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>PTO Balance</th>
                    <th style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'left' }}>Notes</th>
                    <th style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.filter(p => {
                    // Scheduler cannot see their own vacation profile
                    if (isScheduler) {
                      return String(p.user_id) !== String(myUserId);
                    }
                    return true;
                  }).map(p => {
                    const bal = getBalance(p);
                    const isEditing = inlineEditId === p.id;
                    const cellStyle = { padding: 10, border: '1px solid #e2e8f0' };
                    const inlineInput: React.CSSProperties = { padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13, width: '100%', boxSizing: 'border-box' };
                    return (
                      <tr key={p.id}>
                        <td style={{ ...cellStyle, fontWeight: 600 }}>{p.user_name}</td>
                        <td style={{ ...cellStyle, textAlign: 'center' }}>
                          {isEditing ? <input type="date" value={inlineStartDate} onChange={e => setInlineStartDate(e.target.value)} style={inlineInput} />
                            : p.employment_start_date?.split('T')[0]}
                        </td>
                        <td style={{ ...cellStyle, textAlign: 'center' }}>
                          {isEditing ? <input type="number" step="0.01" min="0" value={inlineRate} onChange={e => setInlineRate(e.target.value)} style={{ ...inlineInput, width: 70 }} />
                            : p.accrual_rate}
                        </td>
                        <td style={{ ...cellStyle, textAlign: 'center', color: '#1a237e', fontWeight: 600 }}>{bal?.periodsWorked ?? '-'}</td>
                        <td style={{ ...cellStyle, textAlign: 'center', color: '#15803d', fontWeight: 600 }}>{bal?.hoursEarned ?? '-'}</td>
                        <td style={{ ...cellStyle, textAlign: 'center', color: '#dc2626', fontWeight: 600 }}>{bal?.vacationUsed ?? '-'}</td>
                        <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 700, color: (bal?.vacationBalance ?? 0) >= 0 ? '#15803d' : '#dc2626' }}>
                          {bal?.vacationBalance ?? '-'} hrs
                          <div style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>({((bal?.vacationBalance ?? 0) / 8).toFixed(1)} days)</div>
                        </td>
                        <td style={{ ...cellStyle, textAlign: 'center', color: '#6366f1', fontWeight: 600 }}>
                          {isEditing ? <input type="number" step="0.01" min="0" value={inlinePto} onChange={e => setInlinePto(e.target.value)} style={{ ...inlineInput, width: 70 }} />
                            : bal?.ptoAllocation ?? '-'}
                        </td>
                        <td style={{ ...cellStyle, textAlign: 'center', color: '#dc2626', fontWeight: 600 }}>{bal?.ptoUsed ?? '-'}</td>
                        <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 700, color: (bal?.ptoBalance ?? 0) >= 0 ? '#6366f1' : '#dc2626' }}>
                          {bal?.ptoBalance ?? '-'} hrs
                          <div style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>({((bal?.ptoBalance ?? 0) / 8).toFixed(1)} days)</div>
                        </td>
                        <td style={{ ...cellStyle, fontSize: 13 }}>
                          {isEditing ? <input value={inlineNotes} onChange={e => setInlineNotes(e.target.value)} style={inlineInput} />
                            : p.notes || ''}
                        </td>
                        <td style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {isEditing ? (
                            <>
                              <button onClick={() => saveInlineEdit(p)} style={{ padding: '4px 10px', marginRight: 4, background: '#15803d', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Save</button>
                              <button onClick={cancelInlineEdit} style={{ padding: '4px 10px', background: '#94a3b8', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startInlineEdit(p)} style={{ padding: '4px 12px', marginRight: 6, background: '#667eea', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>Edit</button>
                              <button onClick={() => handleDeleteProfile(p.id)} style={{ padding: '4px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>Delete</button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Rate Change History */}
          {rateChanges.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ marginBottom: 12, color: '#4338ca' }}>📊 Rate Change History</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                  <thead>
                    <tr style={{ background: '#f0f4ff' }}>
                      <th style={{ padding: 8, border: '1px solid #e2e8f0', textAlign: 'left' }}>Employee</th>
                      <th style={{ padding: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>Old Rate</th>
                      <th style={{ padding: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>New Rate</th>
                      <th style={{ padding: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>Effective Date</th>
                      <th style={{ padding: 8, border: '1px solid #e2e8f0', textAlign: 'left' }}>Changed By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rateChanges.map(rc => {
                      const prof = profiles.find(p => String(p.user_id) === String(rc.user_id));
                      return (
                        <tr key={rc.id}>
                          <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>{prof?.user_name || `User #${rc.user_id}`}</td>
                          <td style={{ padding: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>{rc.old_rate} hrs/wk</td>
                          <td style={{ padding: 8, border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 600 }}>{rc.new_rate} hrs/wk</td>
                          <td style={{ padding: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>{rc.effective_date?.split('T')[0]}</td>
                          <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>{rc.changed_by_name || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Effective Date Modal */}
          {showEffectiveDateModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 400, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
                <h3 style={{ margin: '0 0 16px 0', color: '#4338ca' }}>📅 Rate Change Effective Date</h3>
                <p style={{ color: '#555', fontSize: 14, margin: '0 0 16px 0' }}>
                  You are changing the accrual rate from <strong>{pendingInlineEdit?.accrual_rate} hrs/wk</strong> to <strong>{inlineRate} hrs/wk</strong>.
                  <br />Please enter the date from which the new rate should take effect:
                </p>
                <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: 15, boxSizing: 'border-box', marginBottom: 16 }} />
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button onClick={() => { setShowEffectiveDateModal(false); setPendingInlineEdit(null); setEffectiveDate(''); }} style={{ padding: '10px 24px', background: '#e2e8f0', color: '#333', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={confirmEffectiveDate} disabled={!effectiveDate} style={{ padding: '10px 24px', background: effectiveDate ? '#15803d' : '#94a3b8', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Confirm & Save</button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* ===== ENTRIES TAB ===== */
        <>
          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, gap: 16, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 200 }}>
              <label style={{ fontWeight: 600, fontSize: 13 }}>Filter by Employee</label>
              <select value={filterUserId} onChange={e => setFilterUserId(e.target.value)} style={inputStyle}>
                <option value="">All Employees</option>
                {visibleUsers.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </select>
            </div>
            <button onClick={() => { resetEntryForm(); setShowEntryForm(true); }} style={{ padding: '10px 24px', background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
              + Add Vacation
            </button>
          </div>

          {/* Entry Form */}
          {showEntryForm && (
            <div style={{ background: '#f8fafc', padding: 20, borderRadius: 10, marginBottom: 24, border: '1px solid #e2e8f0' }}>
              <h3 style={{ marginTop: 0 }}>{editEntryId ? 'Edit Vacation Entry' : 'Add Vacation Entry'}</h3>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label style={{ fontWeight: 600, fontSize: 13 }}>Employee *</label>
                  <select value={formUserId} onChange={e => setFormUserId(e.target.value)} style={inputStyle}>
                    <option value="">Select Employee...</option>
                    {visibleUsers.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label style={{ fontWeight: 600, fontSize: 13 }}>Date *</label>
                  <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <label style={{ fontWeight: 600, fontSize: 13 }}>Hours</label>
                  <input type="number" min="0" max="24" step="0.5" value={formHours} onChange={e => setFormHours(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={{ fontWeight: 600, fontSize: 13 }}>Type</label>
                  <select value={formType} onChange={e => setFormType(e.target.value)} style={inputStyle}>
                    {VACATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontWeight: 600, fontSize: 13 }}>Notes</label>
                <input value={formNotes} onChange={e => setFormNotes(e.target.value)} style={inputStyle} placeholder="Optional notes..." />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={handleSaveEntry} style={{ padding: '10px 28px', background: '#15803d', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
                  {editEntryId ? 'Update' : 'Add'}
                </button>
                <button onClick={resetEntryForm} style={{ padding: '10px 28px', background: '#e2e8f0', color: '#333', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Entries Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'left' }}>Employee</th>
                  <th style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>Hours</th>
                  <th style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'left' }}>Type</th>
                  <th style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'left' }}>Notes</th>
                  <th style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#888' }}>No vacation entries found</td></tr>
                ) : filteredEntries.map(entry => (
                  <tr key={entry.id}>
                    <td style={{ padding: 10, border: '1px solid #e2e8f0' }}>{entry.user_name}</td>
                    <td style={{ padding: 10, border: '1px solid #e2e8f0' }}>{entry.vacation_date?.split('T')[0]}</td>
                    <td style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>{entry.hours}</td>
                    <td style={{ padding: 10, border: '1px solid #e2e8f0' }}>{entry.vacation_type}</td>
                    <td style={{ padding: 10, border: '1px solid #e2e8f0' }}>{entry.notes || ''}</td>
                    <td style={{ padding: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <button onClick={() => handleEditEntry(entry)} style={{ padding: '4px 12px', marginRight: 6, background: '#667eea', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>Edit</button>
                      <button onClick={() => handleDeleteEntry(entry.id)} style={{ padding: '4px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredEntries.length > 0 && (
              <div style={{ marginTop: 12, padding: 12, background: '#f0fdf4', borderRadius: 8, fontWeight: 600 }}>
                Total vacation hours: {filteredEntries.reduce((sum, e) => sum + (parseFloat(String(e.hours)) || 0), 0).toFixed(1)} hrs
                ({(filteredEntries.reduce((sum, e) => sum + (parseFloat(String(e.hours)) || 0), 0) / 8).toFixed(1)} days)
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default VacationTimePage;
