import React, { useEffect, useState } from 'react';
import { formatDateForFilename } from '../utils/dateFormat';

const API_BASE_URL = '/api';
const FORMS_API_URL = `${API_BASE_URL}/forms`;

const FormsReportPage: React.FC = () => {
  const userRole = localStorage.getItem('role');
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const formsPerPage = 20;

  useEffect(() => {
    setLoading(true);
    fetch(FORMS_API_URL)
      .then(res => res.json())
      .then(data => {
        setForms(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load forms.');
        setLoading(false);
      });
  }, []);

  // Filter forms by date range
  const filteredForms = forms.filter(form => {
    if (!fromDate && !toDate) return true;
    const formDate = form.date ? new Date(form.date) : null;
    if (!formDate) return false;
    if (fromDate && formDate < new Date(fromDate)) return false;
    if (toDate && formDate > new Date(toDate)) return false;
    return true;
  });

  // Pagination logic
  const indexOfLastForm = currentPage * formsPerPage;
  const indexOfFirstForm = indexOfLastForm - formsPerPage;
  const currentForms = filteredForms.slice(indexOfFirstForm, indexOfLastForm);
  const totalPages = Math.ceil(filteredForms.length / formsPerPage);

  // Download CSV handler
  const handleDownloadCSV = () => {
    if (!filteredForms.length) return;
    const headers = [
      'ID',
      'Patient Name',
      'Date of Birth',
      'Insurance Company',
      'Health Center Name',
      'Surgery Date',
      'Time In',
      'Time Out',
      "Doctor's Name",
      'Procedure',
      'Case Type',
      'Assistant Type',
      'Status',
      'Created By',
      'Created At',
      'Last Modified'
    ];
    const csvRows = [headers.join(',')];
    filteredForms.forEach(form => {
      const row = [
        '"' + (form.id || '') + '"',
        '"' + (form.patientName || '') + '"',
        '"' + (form.dob || '') + '"',
        '"' + (form.insuranceCompany || '') + '"',
        '"' + (form.healthCenterName || '') + '"',
        '"' + (form.date || '') + '"',
        '"' + (form.timeIn || '') + '"',
        '"' + (form.timeOut || '') + '"',
        '"' + (form.doctorName || '') + '"',
        '"' + (form.procedure || '') + '"',
        '"' + (form.caseType || '') + '"',
        '"' + (form.assistantType || '') + '"',
        '"' + (form.status || '') + '"',
        '"' + (form.createdByFullName || form.createdBy || '') + '"',
        '"' + (form.createdAt ? new Date(form.createdAt).toLocaleString() : '') + '"',
        '"' + (form.lastModified ? new Date(form.lastModified).toLocaleString() : '') + '"'
      ];
      csvRows.push(row.join(','));
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `surgical-forms-report-${formatDateForFilename(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (userRole !== 'Business Assistant') {
    return <div style={{ padding: 32, color: '#e74c3c' }}>Access denied. Only Business Assistants can view this report.</div>;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="responsive-card" style={{ maxWidth: 1100, width: '100%' }}>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>Loading forms...</div>
                ) : error ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#e74c3c' }}>{error}</div>
                ) : (
                  <>
                <a
          href="/dashboard"
          style={{
            display: 'inline-block',
            marginBottom: 24,
            padding: '12px 0',
            background: 'linear-gradient(90deg, #667eea 0%, #5a67d8 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 16,
            fontWeight: 600,
            textDecoration: 'none',
            boxShadow: '0 2px 8px rgba(90,103,216,0.08)',
            transition: 'background 0.2s',
            width: '100%'
          }}
          tabIndex={0}
          aria-label="Back to Dashboard"
        >
          ← Back to Dashboard
        </a>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <img src={process.env.PUBLIC_URL + '/logo.jpg'} alt="App Logo" className="page-logo" />
        </div>
        <h2 style={{ color: '#2d3a4b', marginBottom: 16 }}>Surgical Forms Report</h2>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontWeight: 500, color: '#2d3a4b', marginRight: 8 }}>From:</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontWeight: 500, color: '#2d3a4b', marginRight: 8 }}>To:</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={handleDownloadCSV}
            style={{ marginLeft: 'auto', padding: '8px 20px', borderRadius: 6, background: 'linear-gradient(90deg, #667eea 0%, #5a67d8 100%)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
            aria-label="Download Report as CSV"
          >
            Download CSV
          </button>
        </div>
        <div style={{ overflowX: 'auto', marginBottom: 32 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }} aria-label="Surgical Forms Full Report">
            <thead>
              <tr style={{ background: '#f6f8fa' }}>
                <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>ID</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Patient Name</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Procedure</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Case Type</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Doctor</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Time In</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Time Out</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Created By</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Created At</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Assistant Type</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Status</th>
                <th style={{ padding: 8, borderBottom: '1px solid #e2e8f0' }}>Image</th>
              </tr>
            </thead>
            <tbody>
              {currentForms.length === 0 && (
                <tr>
                  <td colSpan={12} style={{ padding: 16, color: '#888' }}>No forms found.</td>
                </tr>
              )}
              {currentForms.map(form => (
                <tr key={form.id}>
                  <td style={{ padding: 8 }}>{form.id}</td>
                  <td style={{ padding: 8 }}>{form.patientName}</td>
                  <td style={{ padding: 8 }}>{form.procedure}</td>
                  <td style={{ padding: 8 }}>{form.caseType}</td>
                  <td style={{ padding: 8 }}>{form.doctorName}</td>
                  <td style={{ padding: 8 }}>{form.timeIn}</td>
                  <td style={{ padding: 8 }}>{form.timeOut}</td>
                  <td style={{ padding: 8 }}>{form.createdByFullName || form.createdBy}</td>
                  <td style={{ padding: 8 }}>{form.createdAt ? new Date(form.createdAt).toLocaleString() : ''}</td>
                  <td style={{ padding: 8 }}>{form.assistantType || ''}</td>
                  <td style={{ padding: 8 }}>{form.status}</td>
                  <td style={{ padding: 8 }}>
                    {form.surgeryFormFileUrl ? (
                      <a href={form.surgeryFormFileUrl} target="_blank" rel="noopener noreferrer">View</a>
                    ) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Pagination Controls */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16, gap: 8 }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #bfc9d9', background: '#f6f8fa', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
            >
              Previous
            </button>
            <span style={{ alignSelf: 'center' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #bfc9d9', background: '#f6f8fa', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
            >
              Next
            </button>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
};

export default FormsReportPage;
