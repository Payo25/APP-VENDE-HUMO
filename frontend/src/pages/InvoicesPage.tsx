import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = '/api';

interface LineItem {
  description: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
}

interface Invoice {
  id: number;
  invoiceNumber: number;
  invoiceDate: string;
  dueDate: string;
  healthCenterName: string;
  healthCenterAddress: string;
  lineItems: LineItem[];
  notes: string;
  subtotal: number;
  total: number;
  status: string;
  createdByUserId: number;
  createdAt: string;
  lastModified: string;
}

interface HealthCenter {
  id: number;
  name: string;
  address: string;
}

const emptyLine: LineItem = { description: '', qty: 1, unitPrice: 0, totalPrice: 0 };

const InvoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const userRole = localStorage.getItem('role');
  const userId = localStorage.getItem('userId');

  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'view'>('list');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [healthCenters, setHealthCenters] = useState<HealthCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState(1);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [healthCenterName, setHealthCenterName] = useState('');
  const [healthCenterAddress, setHealthCenterAddress] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...emptyLine }]);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('Pending');

  // View state
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  // Filter state
  const [filterStatus, setFilterStatus] = useState('');
  const [filterHealthCenter, setFilterHealthCenter] = useState('');

  // Email state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (userRole !== 'Business Assistant' && userRole !== 'Admin') {
      navigate('/dashboard');
      return;
    }
    fetchInvoices();
    fetchHealthCenters();
  }, [userRole, navigate]);

  const fetchInvoices = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/invoices`);
      const data = await res.json();
      setInvoices(data);
    } catch {
      setError('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const fetchHealthCenters = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/health-centers`);
      const data = await res.json();
      setHealthCenters(data);
    } catch { /* ignore */ }
  };

  const fetchNextNumber = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/invoices/next-number`);
      const data = await res.json();
      setInvoiceNumber(data.nextNumber);
    } catch { /* ignore */ }
  };

  const resetForm = () => {
    setEditing(null);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setDueDate('');
    setHealthCenterName('');
    setHealthCenterAddress('');
    setLineItems([{ ...emptyLine }]);
    setNotes('');
    setStatus('Pending');
    fetchNextNumber();
  };

  const openCreate = () => {
    resetForm();
    setActiveTab('create');
  };

  const openEdit = (inv: Invoice) => {
    setEditing(inv);
    setInvoiceNumber(inv.invoiceNumber);
    setInvoiceDate(inv.invoiceDate || '');
    setDueDate(inv.dueDate || '');
    setHealthCenterName(inv.healthCenterName || '');
    setHealthCenterAddress(inv.healthCenterAddress || '');
    setLineItems(inv.lineItems && inv.lineItems.length > 0 ? inv.lineItems : [{ ...emptyLine }]);
    setNotes(inv.notes || '');
    setStatus(inv.status || 'Pending');
    setActiveTab('create');
  };

  const openView = (inv: Invoice) => {
    setViewInvoice(inv);
    setActiveTab('view');
  };

  const handleHealthCenterSelect = (name: string) => {
    setHealthCenterName(name);
    const hc = healthCenters.find(h => h.name === name);
    setHealthCenterAddress(hc?.address || '');
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems];
    (updated[index] as any)[field] = value;
    if (field === 'qty' || field === 'unitPrice') {
      updated[index].totalPrice = Number((updated[index].qty * updated[index].unitPrice).toFixed(2));
    }
    setLineItems(updated);
  };

  const addLineItem = () => setLineItems([...lineItems, { ...emptyLine }]);

  const removeLineItem = (index: number) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const calcSubtotal = () => lineItems.reduce((sum, li) => sum + (li.totalPrice || 0), 0);
  const calcTotal = () => calcSubtotal();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!healthCenterName.trim()) {
      setError('Health center is required');
      return;
    }
    if (lineItems.every(li => !li.description.trim())) {
      setError('At least one line item is required');
      return;
    }

    const body = {
      invoiceNumber,
      invoiceDate,
      dueDate: dueDate || null,
      healthCenterName,
      healthCenterAddress,
      lineItems: lineItems.filter(li => li.description.trim()),
      notes,
      subtotal: calcSubtotal(),
      total: calcTotal(),
      status,
      createdByUserId: userId ? parseInt(userId) : null
    };

    const method = editing ? 'PUT' : 'POST';
    const url = editing ? `${API_BASE_URL}/invoices/${editing.id}` : `${API_BASE_URL}/invoices`;

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setSuccess(editing ? 'Invoice updated!' : 'Invoice created!');
        setActiveTab('list');
        fetchInvoices();
        resetForm();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save invoice');
      }
    } catch {
      setError('Network error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this invoice?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/invoices/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccess('Invoice deleted');
        fetchInvoices();
      } else {
        setError('Failed to delete invoice');
      }
    } catch {
      setError('Network error');
    }
  };

  const handlePrint = () => window.print();

  const handleSendEmail = async () => {
    if (!recipientEmail.trim() || !viewInvoice) return;
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_BASE_URL}/invoices/${viewInvoice.id}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || 'Invoice sent!');
        setShowEmailModal(false);
        setRecipientEmail('');
        fetchInvoices();
      } else {
        setError(data.error || 'Failed to send email');
      }
    } catch {
      setError('Network error');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (d: string) => {
    if (!d) return '';
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  const formatCurrency = (n: number | string) => `$${(parseFloat(String(n)) || 0).toFixed(2)}`;

  const filteredInvoices = invoices.filter(inv => {
    if (filterStatus && inv.status !== filterStatus) return false;
    if (filterHealthCenter && inv.healthCenterName !== filterHealthCenter) return false;
    return true;
  });

  const uniqueHCs = Array.from(new Set(invoices.map(inv => inv.healthCenterName).filter(Boolean))).sort();

  // ======== VIEW / PRINT INVOICE ========
  if (activeTab === 'view' && viewInvoice) {
    return (
      <div style={{ maxWidth: 800, margin: '40px auto', padding: 20 }}>
        <style>{`@media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .invoice-view { box-shadow: none !important; border: none !important; }
        }`}</style>
        <div className="no-print" style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
          <button onClick={() => { setActiveTab('list'); setViewInvoice(null); }} style={{ padding: '10px 20px', background: 'linear-gradient(90deg, #667eea 0%, #5a67d8 100%)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>← Back to Invoices</button>
          <button onClick={handlePrint} style={{ padding: '10px 20px', background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>🖨️ Print</button>
          <button onClick={() => setShowEmailModal(true)} style={{ padding: '10px 20px', background: 'linear-gradient(90deg, #e91e63 0%, #c2185b 100%)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>📧 Send Email</button>
        </div>
        {error && <div style={{ background: '#ffe0e0', color: '#c00', padding: 12, borderRadius: 8, marginBottom: 12 }}>{error}</div>}
        {success && <div style={{ background: '#e0ffe0', color: '#080', padding: 12, borderRadius: 8, marginBottom: 12 }}>{success}</div>}
        {showEmailModal && (
          <div style={{ background: '#f5f7ff', padding: 20, borderRadius: 10, marginBottom: 16, border: '1px solid #d0d5dd' }}>
            <h3 style={{ margin: '0 0 12px', color: '#1a237e' }}>Send Invoice #{viewInvoice.invoiceNumber} via Email</h3>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="email" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} placeholder="Recipient email address" style={{ flex: 1, minWidth: 200, padding: '10px 12px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: 15 }} />
              <button onClick={handleSendEmail} disabled={sending || !recipientEmail.trim()} style={{ padding: '10px 20px', background: sending ? '#ccc' : 'linear-gradient(90deg, #e91e63 0%, #c2185b 100%)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: sending ? 'default' : 'pointer' }}>{sending ? 'Sending...' : 'Send'}</button>
              <button onClick={() => { setShowEmailModal(false); setRecipientEmail(''); }} style={{ padding: '10px 20px', background: '#757575', color: '#fff', border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}
        <div className="invoice-view" style={{ background: '#fff', padding: 40, borderRadius: 10, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 30, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#1a237e' }}>Proassisting Inc.</h1>
              <p style={{ margin: '4px 0', color: '#555', fontSize: 14 }}>18761 Chestnut Ct</p>
              <p style={{ margin: '2px 0', color: '#555', fontSize: 14 }}>Mokena, IL 60448</p>
              <p style={{ margin: '2px 0', color: '#555', fontSize: 14 }}>(786) 448-9020</p>
              <p style={{ margin: '2px 0', color: '#555', fontSize: 14 }}>info@proassisting.net</p>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <img src={process.env.PUBLIC_URL + '/logo.jpg'} alt="ProAssisting Logo" style={{ height: 80, marginBottom: 10 }} />
              <table style={{ borderCollapse: 'collapse', border: '1px solid #333' }}>
                <thead>
                  <tr><th style={{ padding: '6px 24px', border: '1px solid #333', fontSize: 14, fontWeight: 700, background: '#f5f5f5' }}>Invoice #</th></tr>
                </thead>
                <tbody>
                  <tr><td style={{ padding: '6px 24px', border: '1px solid #333', fontSize: 16, fontWeight: 600, textAlign: 'center' }}>{viewInvoice.invoiceNumber}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Invoice Title + Date */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#1a237e' }}>Invoice</h2>
            <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 600, color: '#e91e63' }}>Submitted on {formatDate(viewInvoice.invoiceDate)}</p>
          </div>

          {/* Bill To */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 30, flexWrap: 'wrap', gap: 20 }}>
            <div style={{ background: '#f5f7ff', padding: '16px 20px', borderRadius: 8, flex: 1, minWidth: 200 }}>
              <p style={{ margin: 0, fontWeight: 700, color: '#1a237e', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Invoice For</p>
              <p style={{ margin: '8px 0 2px', fontWeight: 600, fontSize: 16 }}>{viewInvoice.healthCenterName}</p>
              {viewInvoice.healthCenterAddress && (
                <p style={{ margin: '2px 0', color: '#555', fontSize: 14, whiteSpace: 'pre-line' }}>{viewInvoice.healthCenterAddress}</p>
              )}
            </div>
            <div style={{ textAlign: 'right', minWidth: 150 }}>
              {viewInvoice.dueDate && (
                <div>
                  <p style={{ margin: 0, fontWeight: 700, color: '#1a237e', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>Due Date</p>
                  <p style={{ margin: '8px 0', fontSize: 16, fontWeight: 600 }}>{formatDate(viewInvoice.dueDate)}</p>
                </div>
              )}
              <p style={{ margin: '8px 0 0', fontSize: 13 }}>
                Status: <span style={{ fontWeight: 700, color: viewInvoice.status === 'Paid' ? '#2e7d32' : viewInvoice.status === 'Overdue' ? '#c62828' : '#e65100' }}>{viewInvoice.status}</span>
              </p>
            </div>
          </div>

          {/* Line Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
            <thead>
              <tr style={{ background: '#1a237e', color: '#fff' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>Description</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 700, width: 70 }}>Qty</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700, width: 120 }}>Unit Price</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700, width: 120 }}>Total Price</th>
              </tr>
            </thead>
            <tbody>
              {(viewInvoice.lineItems || []).map((li, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e0e0e0', background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                  <td style={{ padding: '10px 16px', fontSize: 14 }}>{li.description}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 14 }}>{li.qty}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 14 }}>{formatCurrency(li.unitPrice)}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 14, fontWeight: 600 }}>{formatCurrency(li.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Notes + Totals */}
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              {viewInvoice.notes && (
                <div style={{ background: '#f5f7ff', padding: '12px 16px', borderRadius: 8 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: '#1a237e', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Notes</p>
                  <p style={{ margin: 0, fontSize: 14, color: '#555', whiteSpace: 'pre-line' }}>{viewInvoice.notes}</p>
                </div>
              )}
            </div>
            <div style={{ minWidth: 200 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e0e0e0' }}>
                <span style={{ fontWeight: 600, color: '#555' }}>Subtotal:</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(viewInvoice.subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', background: '#1a237e', color: '#fff', borderRadius: 6, marginTop: 8, paddingLeft: 12, paddingRight: 12 }}>
                <span style={{ fontWeight: 800, fontSize: 16 }}>TOTAL:</span>
                <span style={{ fontWeight: 800, fontSize: 16 }}>{formatCurrency(viewInvoice.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ======== CREATE / EDIT FORM ========
  if (activeTab === 'create') {
    return (
      <div className="responsive-card" style={{ maxWidth: 850, margin: '40px auto', width: '100%' }}>
        <button onClick={() => { setActiveTab('list'); resetForm(); }} style={{ width: '100%', padding: '12px 0', background: 'linear-gradient(90deg, #667eea 0%, #5a67d8 100%)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, fontWeight: 600, cursor: 'pointer', marginBottom: 24 }}>← Back to Invoices</button>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <img src={process.env.PUBLIC_URL + '/logo.jpg'} alt="App Logo" className="page-logo" />
        </div>
        <h2>{editing ? 'Edit Invoice' : 'Create Invoice'}</h2>
        {error && <div style={{ background: '#ffe0e0', color: '#c00', padding: 12, borderRadius: 8, marginBottom: 16 }}>{error}</div>}
        {success && <div style={{ background: '#e0ffe0', color: '#080', padding: 12, borderRadius: 8, marginBottom: 16 }}>{success}</div>}

        <form onSubmit={handleSubmit}>
          {/* Invoice Header Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 4 }}>Invoice #</label>
              <input type="number" value={invoiceNumber} onChange={e => setInvoiceNumber(parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: 15, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 4 }}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: 15, boxSizing: 'border-box' }}>
                <option value="Pending">Pending</option>
                <option value="Sent">Sent</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 4 }}>Invoice Date</label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: 15, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 4 }}>Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: 15, boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Health Center Selection */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 4 }}>Health Center *</label>
            <select value={healthCenterName} onChange={e => handleHealthCenterSelect(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: 15, boxSizing: 'border-box', marginBottom: 8 }}>
              <option value="">-- Select Health Center --</option>
              {healthCenters.map(hc => (
                <option key={hc.id} value={hc.name}>{hc.name}</option>
              ))}
            </select>
            <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 4 }}>Address</label>
            <textarea value={healthCenterAddress} onChange={e => setHealthCenterAddress(e.target.value)} rows={2} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: 15, boxSizing: 'border-box', resize: 'vertical' }} />
          </div>

          {/* Line Items */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label style={{ fontWeight: 700, fontSize: 16, color: '#1a237e' }}>Line Items</label>
              <button type="button" onClick={addLineItem} style={{ padding: '6px 16px', background: '#43cea2', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>+ Add Line</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#1a237e', color: '#fff' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 13 }}>Description</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13, width: 80 }}>Qty</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, width: 120 }}>Unit Price</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, width: 120 }}>Total</th>
                    <th style={{ padding: '10px 12px', width: 50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((li, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e0e0e0' }}>
                      <td style={{ padding: '6px 8px' }}>
                        <input type="text" value={li.description} onChange={e => updateLineItem(i, 'description', e.target.value)} placeholder="Service description" style={{ width: '100%', padding: '8px 10px', border: '1px solid #d0d5dd', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input type="number" min="0" value={li.qty} onChange={e => updateLineItem(i, 'qty', parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '8px 6px', border: '1px solid #d0d5dd', borderRadius: 4, fontSize: 14, textAlign: 'center', boxSizing: 'border-box' }} />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input type="number" min="0" step="0.01" value={li.unitPrice} onChange={e => updateLineItem(i, 'unitPrice', parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '8px 6px', border: '1px solid #d0d5dd', borderRadius: 4, fontSize: 14, textAlign: 'right', boxSizing: 'border-box' }} />
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, fontSize: 14 }}>
                        {formatCurrency(li.totalPrice)}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        {lineItems.length > 1 && (
                          <button type="button" onClick={() => removeLineItem(i)} style={{ background: '#e53935', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 13 }}>✕</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 4 }}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Additional notes..." style={{ width: '100%', padding: '10px 12px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: 15, boxSizing: 'border-box', resize: 'vertical' }} />
          </div>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <div style={{ minWidth: 220 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e0e0e0' }}>
                <span style={{ fontWeight: 600, color: '#555' }}>Subtotal:</span>
                <span style={{ fontWeight: 700 }}>{formatCurrency(calcSubtotal())}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', background: '#1a237e', color: '#fff', borderRadius: 6, marginTop: 8, paddingLeft: 12, paddingRight: 12 }}>
                <span style={{ fontWeight: 800, fontSize: 16 }}>TOTAL:</span>
                <span style={{ fontWeight: 800, fontSize: 16 }}>{formatCurrency(calcTotal())}</span>
              </div>
            </div>
          </div>

          <button type="submit" style={{ width: '100%', padding: '14px 0', background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(67,206,162,0.15)' }}>
            {editing ? '💾 Update Invoice' : '📄 Create Invoice'}
          </button>
        </form>
      </div>
    );
  }

  // ======== LIST VIEW ========
  return (
    <div className="responsive-card" style={{ maxWidth: 950, margin: '40px auto', width: '100%' }}>
      <button onClick={() => navigate('/dashboard')} style={{ width: '100%', padding: '12px 0', background: 'linear-gradient(90deg, #667eea 0%, #5a67d8 100%)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, fontWeight: 600, cursor: 'pointer', marginBottom: 24 }}>← Back to Dashboard</button>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
        <img src={process.env.PUBLIC_URL + '/logo.jpg'} alt="App Logo" className="page-logo" />
      </div>
      <h2>Invoices</h2>
      {error && <div style={{ background: '#ffe0e0', color: '#c00', padding: 12, borderRadius: 8, marginBottom: 16 }}>{error}</div>}
      {success && <div style={{ background: '#e0ffe0', color: '#080', padding: 12, borderRadius: 8, marginBottom: 16 }}>{success}</div>}

      {/* Filters + Create Button */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={openCreate} style={{ padding: '10px 20px', background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>+ Create Invoice</button>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '10px 12px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: 14 }}>
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Sent">Sent</option>
          <option value="Paid">Paid</option>
          <option value="Overdue">Overdue</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <select value={filterHealthCenter} onChange={e => setFilterHealthCenter(e.target.value)} style={{ padding: '10px 12px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: 14 }}>
          <option value="">All Health Centers</option>
          {uniqueHCs.map(hc => <option key={hc} value={hc}>{hc}</option>)}
        </select>
        {(filterStatus || filterHealthCenter) && (
          <button onClick={() => { setFilterStatus(''); setFilterHealthCenter(''); }} style={{ padding: '10px 16px', background: '#e53935', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
        )}
      </div>

      {loading ? <p>Loading...</p> : filteredInvoices.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#888', padding: 40 }}>No invoices found. Click "Create Invoice" to get started.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#1a237e', color: '#fff' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 13 }}>Invoice #</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 13 }}>Date</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 13 }}>Health Center</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13 }}>Total</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 13 }}>Status</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 13 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv, i) => (
                <tr key={inv.id} style={{ borderBottom: '1px solid #e0e0e0', background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>#{inv.invoiceNumber}</td>
                  <td style={{ padding: '10px 14px', fontSize: 14 }}>{formatDate(inv.invoiceDate)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 14 }}>{inv.healthCenterName}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(inv.total)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                      background: inv.status === 'Paid' ? '#e8f5e9' : inv.status === 'Overdue' ? '#ffebee' : inv.status === 'Sent' ? '#e3f2fd' : inv.status === 'Cancelled' ? '#f5f5f5' : '#fff3e0',
                      color: inv.status === 'Paid' ? '#2e7d32' : inv.status === 'Overdue' ? '#c62828' : inv.status === 'Sent' ? '#1565c0' : inv.status === 'Cancelled' ? '#757575' : '#e65100'
                    }}>{inv.status}</span>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button onClick={() => openView(inv)} style={{ padding: '5px 10px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>View</button>
                      <button onClick={() => openEdit(inv)} style={{ padding: '5px 10px', background: '#ff9800', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => handleDelete(inv.id)} style={{ padding: '5px 10px', background: '#e53935', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InvoicesPage;
