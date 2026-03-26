import React, { useEffect, useState } from 'react';
import { claimAPI } from '../utils/api';

const initForm = {
  policyId: '', claimantName: '', claimantEmail: '',
  claimAmount: '', incidentDate: '', description: ''
};

export default function Claims() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDecide, setShowDecide] = useState(null);
  const [form, setForm] = useState(initForm);
  const [decideForm, setDecideForm] = useState({ decision: 'APPROVED', approvedAmount: '', reason: '', adjusterName: '' });
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const load = async () => {
    try {
      const res = await claimAPI.getAll();
      setClaims(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    setAlert(null);
    try {
      const res = await claimAPI.create({ ...form, claimAmount: Number(form.claimAmount) });
      setLastResult(res.data);
      const d = res.data.smartContracts;
      const msg = d.autoClaim.decision === 'AUTO_APPROVED'
        ? `✅ AUTO-APPROVED by Smart Contract! Claim ${res.data.data.claimId}`
        : d.fraud.riskLevel === 'HIGH'
        ? `⚠️ Fraud flagged! Score: ${d.fraud.fraudScore}/100`
        : `Claim ${res.data.data.claimId} submitted for manual review.`;
      setAlert({ type: d.autoClaim.decision === 'AUTO_APPROVED' ? 'success' : 'info', msg });
      setShowModal(false);
      setForm(initForm);
      load();
    } catch (e) {
      setAlert({ type: 'error', msg: e.response?.data?.message || 'Failed to submit claim' });
    } finally { setSubmitting(false); }
  };

  const handleDecide = async () => {
    setSubmitting(true);
    try {
      await claimAPI.decide(showDecide.claimId, { ...decideForm, approvedAmount: Number(decideForm.approvedAmount) });
      setAlert({ type: 'success', msg: `Decision recorded on blockchain for ${showDecide.claimId}` });
      setShowDecide(null);
      load();
    } catch (e) {
      setAlert({ type: 'error', msg: 'Failed to record decision' });
    } finally { setSubmitting(false); }
  };

  const statusBadge = s => {
    const map = { PENDING: 'pending', UNDER_REVIEW: 'pending', APPROVED: 'active', REJECTED: 'rejected', AUTO_APPROVED: 'auto', FRAUD_FLAGGED: 'fraud' };
    return <span className={`badge badge-${map[s] || 'info'}`}>{s.replace('_', ' ')}</span>;
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-header-title">⚡ Claims Management</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>⊕ Submit Claim</button>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {lastResult && (
        <div className="card mb-6">
          <div className="card-title">🤖 Smart Contract Execution Results</div>
          <div className="grid-2" style={{ gap: 20 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--accent-purple)', fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>
                🛡️ FRAUD DETECTION CONTRACT
              </div>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <div className="stat-label">Fraud Score</div>
                  <div className={`monospace ${lastResult.smartContracts?.fraud?.fraudScore > 50 ? 'text-red' : 'text-green'}`} style={{ fontSize: 22 }}>
                    {lastResult.smartContracts?.fraud?.fraudScore}/100
                  </div>
                </div>
                <div>
                  <div className="stat-label">Risk Level</div>
                  <div className={`text-${lastResult.smartContracts?.fraud?.riskLevel === 'HIGH' ? 'red' : lastResult.smartContracts?.fraud?.riskLevel === 'MEDIUM' ? 'orange' : 'green'}`} style={{ fontWeight: 700 }}>
                    {lastResult.smartContracts?.fraud?.riskLevel}
                  </div>
                </div>
              </div>
              {lastResult.smartContracts?.fraud?.flags?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {lastResult.smartContracts.fraud.flags.map(f => (
                    <span key={f} className="badge badge-rejected" style={{ marginRight: 4 }}>{f}</span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--accent-cyan)', fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>
                ⚡ AUTO-CLAIM CONTRACT
              </div>
              <div className="stat-label">Decision</div>
              <div className={`monospace ${lastResult.smartContracts?.autoClaim?.decision === 'AUTO_APPROVED' ? 'text-green' : 'text-orange'}`} style={{ fontSize: 16, fontWeight: 700 }}>
                {lastResult.smartContracts?.autoClaim?.decision}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
                {lastResult.smartContracts?.autoClaim?.reason}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <span className="stat-label">Block Hash: </span>
            <span className="hash-text">{lastResult.blockchain?.claimBlock?.hash}</span>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-container">
          {loading ? <div className="loading">Loading claims</div> : (
            <table>
              <thead>
                <tr>
                  <th>Claim ID</th><th>Policy</th><th>Claimant</th><th>Amount</th>
                  <th>Status</th><th>Fraud Score</th><th>Block</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {claims.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                    No claims submitted yet.
                  </td></tr>
                ) : claims.map(c => (
                  <tr key={c.claimId}>
                    <td><span className="monospace text-cyan" style={{ fontSize: 12 }}>{c.claimId}</span></td>
                    <td><span className="monospace" style={{ fontSize: 12 }}>{c.policyId}</span></td>
                    <td>
                      <div>{c.claimantName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.claimantEmail}</div>
                    </td>
                    <td>
                      <div className="monospace text-orange">${c.claimAmount?.toLocaleString()}</div>
                      {c.approvedAmount && <div className="monospace text-green" style={{ fontSize: 11 }}>✓ ${c.approvedAmount?.toLocaleString()}</div>}
                    </td>
                    <td>{statusBadge(c.status)}</td>
                    <td>
                      {c.fraudScore != null && (
                        <span className={`monospace ${c.fraudScore > 50 ? 'text-red' : c.fraudScore > 25 ? 'text-orange' : 'text-green'}`} style={{ fontSize: 13 }}>
                          {c.fraudScore}/100
                        </span>
                      )}
                    </td>
                    <td><span className="hash-text" style={{ fontSize: 9 }}>#{c.blockIndex} {c.blockchainHash?.slice(0, 12)}...</span></td>
                    <td>
                      {['PENDING', 'UNDER_REVIEW'].includes(c.status) && (
                        <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => { setShowDecide(c); setDecideForm({ decision: 'APPROVED', approvedAmount: c.claimAmount, reason: '', adjusterName: '' }); }}>
                          Decide
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">⚡ Submit New Claim</div>
            <div className="form-grid mb-4">
              <div className="form-group">
                <label className="form-label">Policy ID</label>
                <input className="form-input" name="policyId" value={form.policyId} onChange={e => setForm(f => ({ ...f, policyId: e.target.value }))} placeholder="POL-XXXXXXXX" />
              </div>
              <div className="form-group">
                <label className="form-label">Claimant Name</label>
                <input className="form-input" name="claimantName" value={form.claimantName} onChange={e => setForm(f => ({ ...f, claimantName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.claimantEmail} onChange={e => setForm(f => ({ ...f, claimantEmail: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Claim Amount ($)</label>
                <input className="form-input" type="number" value={form.claimAmount} onChange={e => setForm(f => ({ ...f, claimAmount: e.target.value }))} placeholder="5000" />
              </div>
              <div className="form-group">
                <label className="form-label">Incident Date</label>
                <input className="form-input" type="date" value={form.incidentDate} onChange={e => setForm(f => ({ ...f, incidentDate: e.target.value }))} />
              </div>
            </div>
            <div className="form-group mb-4">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the incident..." />
            </div>
            <div className="alert alert-info" style={{ fontSize: 12 }}>
              ⚡ Smart contracts will automatically run Fraud Detection + Auto-Claim Settlement on submission.
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Processing...' : '⬡ Submit on Blockchain'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDecide && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDecide(null)}>
          <div className="modal">
            <div className="modal-title">⚖️ Claim Decision — {showDecide.claimId}</div>
            <div className="form-grid mb-4">
              <div className="form-group">
                <label className="form-label">Decision</label>
                <select className="form-select" value={decideForm.decision} onChange={e => setDecideForm(f => ({ ...f, decision: e.target.value }))}>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="PARTIAL">Partial</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Approved Amount ($)</label>
                <input className="form-input" type="number" value={decideForm.approvedAmount} onChange={e => setDecideForm(f => ({ ...f, approvedAmount: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Adjuster Name</label>
                <input className="form-input" value={decideForm.adjusterName} onChange={e => setDecideForm(f => ({ ...f, adjusterName: e.target.value }))} />
              </div>
            </div>
            <div className="form-group mb-4">
              <label className="form-label">Reason</label>
              <textarea className="form-textarea" value={decideForm.reason} onChange={e => setDecideForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowDecide(null)}>Cancel</button>
              <button className="btn btn-success" onClick={handleDecide} disabled={submitting}>
                {submitting ? 'Recording...' : '⬡ Record on Blockchain'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}