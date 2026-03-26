import React, { useEffect, useState } from 'react';
import { policyAPI } from '../utils/api';

const initialForm = {
  holderName: '', holderEmail: '', insuranceType: 'HEALTH',
  coverageAmount: '', startDate: '', endDate: '',
  riskLevel: 'MEDIUM', age: 30, claimsHistory: 0
};

export default function Policies() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [alert, setAlert] = useState(null);
  const [preview, setPreview] = useState(null);

  const load = async () => {
    try {
      const res = await policyAPI.getAll();
      setPolicies(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const calculatePreview = async () => {
    if (!form.coverageAmount || !form.insuranceType) return;
    try {
      const res = await policyAPI.calculatePremium({
        insuranceType: form.insuranceType,
        coverageAmount: Number(form.coverageAmount),
        riskLevel: form.riskLevel,
        age: form.age,
        claimsHistory: form.claimsHistory
      });
      setPreview(res.data.data);
    } catch (e) { console.error(e); }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setAlert(null);
    try {
      const res = await policyAPI.create({
        ...form,
        coverageAmount: Number(form.coverageAmount)
      });
      setResult(res.data);
      setAlert({ type: 'success', msg: `Policy ${res.data.data.policyId} created! Block #${res.data.blockchain.blockIndex} mined.` });
      setShowModal(false);
      setForm(initialForm);
      setPreview(null);
      load();
    } catch (e) {
      setAlert({ type: 'error', msg: e.response?.data?.message || 'Failed to create policy' });
    } finally { setSubmitting(false); }
  };

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  return (
    <div>
      <div className="page-header">
        <h2 className="page-header-title">📋 Policy Management</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>⊕ New Policy</button>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type === 'success' ? 'success' : 'error'}`}>
          {alert.msg}
        </div>
      )}

      {result && (
        <div className="card mb-6">
          <div className="card-title">📦 Last Blockchain Transaction</div>
          <div className="grid-3" style={{ gap: 12 }}>
            <div><div className="stat-label">Block Index</div><div className="monospace text-cyan" style={{ fontSize: 20 }}>#{result.blockchain?.blockIndex}</div></div>
            <div><div className="stat-label">Block Hash</div><div className="hash-text">{result.blockchain?.blockHash}</div></div>
            <div><div className="stat-label">Nonce (PoW)</div><div className="monospace text-orange" style={{ fontSize: 20 }}>{result.blockchain?.nonce}</div></div>
            <div><div className="stat-label">Monthly Premium</div><div className="text-green monospace" style={{ fontSize: 18 }}>${result.premiumCalculation?.monthlyPremium}</div></div>
            <div><div className="stat-label">Annual Premium</div><div className="monospace" style={{ fontSize: 18 }}>${result.premiumCalculation?.annualPremium}</div></div>
            <div><div className="stat-label">Risk Score</div><div className="text-orange monospace" style={{ fontSize: 18 }}>{result.premiumCalculation?.riskScore}/100</div></div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-container">
          {loading ? <div className="loading">Loading policies</div> : (
            <table>
              <thead>
                <tr>
                  <th>Policy ID</th><th>Holder</th><th>Type</th><th>Premium/mo</th>
                  <th>Coverage</th><th>Risk</th><th>Status</th><th>Block Hash</th>
                </tr>
              </thead>
              <tbody>
                {policies.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                    No policies found. Click "New Policy" to get started.
                  </td></tr>
                ) : policies.map(p => (
                  <tr key={p.policyId}>
                    <td><span className="monospace text-cyan" style={{ fontSize: 12 }}>{p.policyId}</span></td>
                    <td>
                      <div>{p.holderName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.holderEmail}</div>
                    </td>
                    <td><span className="badge badge-info">{p.insuranceType}</span></td>
                    <td className="text-green monospace">${p.premium?.toFixed(2)}</td>
                    <td className="monospace">${p.coverageAmount?.toLocaleString()}</td>
                    <td>
                      <span className={`badge ${p.riskLevel === 'LOW' ? 'badge-active' : p.riskLevel === 'HIGH' ? 'badge-rejected' : 'badge-pending'}`}>
                        {p.riskLevel}
                      </span>
                    </td>
                    <td><span className={`badge badge-${p.status === 'ACTIVE' ? 'active' : 'expired'}`}>{p.status}</span></td>
                    <td><span className="hash-text" style={{ fontSize: 9 }}>{p.blockchainHash?.slice(0, 20)}...</span></td>
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
            <div className="modal-title">⊕ Issue New Policy</div>
            <div className="form-grid mb-4">
              <div className="form-group">
                <label className="form-label">Holder Name</label>
                <input className="form-input" name="holderName" value={form.holderName} onChange={handleChange} placeholder="John Doe" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" name="holderEmail" type="email" value={form.holderEmail} onChange={handleChange} placeholder="john@email.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Insurance Type</label>
                <select className="form-select" name="insuranceType" value={form.insuranceType} onChange={handleChange}>
                  {['HEALTH','AUTO','LIFE','PROPERTY','TRAVEL'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Coverage Amount ($)</label>
                <input className="form-input" name="coverageAmount" type="number" value={form.coverageAmount} onChange={handleChange} placeholder="100000" />
              </div>
              <div className="form-group">
                <label className="form-label">Risk Level</label>
                <select className="form-select" name="riskLevel" value={form.riskLevel} onChange={handleChange}>
                  {['LOW','MEDIUM','HIGH','VERY_HIGH'].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Age</label>
                <input className="form-input" name="age" type="number" value={form.age} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input className="form-input" name="startDate" type="date" value={form.startDate} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input className="form-input" name="endDate" type="date" value={form.endDate} onChange={handleChange} />
              </div>
            </div>

            <button className="btn btn-outline mb-4" onClick={calculatePreview} style={{ width: '100%' }}>
              🧮 Calculate Premium (Smart Contract)
            </button>

            {preview && (
              <div className="alert alert-info mb-4">
                <strong>Premium Estimate:</strong> ${preview.monthlyPremium}/mo | Annual: ${preview.annualPremium} | Risk Score: {preview.riskScore}/100
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => { setShowModal(false); setPreview(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Mining Block...' : '⬡ Issue Policy on Blockchain'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}