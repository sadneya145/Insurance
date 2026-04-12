import React, { useEffect, useState } from 'react';
import { claimAPI } from '../utils/api';
import { useMetaMask } from '../pages/UseMetamask';

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
  const [txStep, setTxStep] = useState(null); // 'metamask' | 'backend' | null

  const { account, isConnected, isCorrectNetwork, connect, sendTransaction, txPending, error: mmError } = useMetaMask();

  const load = async () => {
    try {
      const res = await claimAPI.getAll();
      setClaims(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const ensureMetaMask = async () => {
    if (!isConnected) {
      const acc = await connect();
      if (!acc) {
        setAlert({ type: 'error', msg: 'Please connect MetaMask to continue.' });
        return false;
      }
    }
    if (!isCorrectNetwork) {
      setAlert({ type: 'error', msg: 'Please switch to Sepolia testnet in MetaMask.' });
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    const ready = await ensureMetaMask();
    if (!ready) return;

    setSubmitting(true);
    setAlert(null);
    setTxStep('metamask');

    try {
      // Step 1: MetaMask Sepolia transaction for claim submission proof
      const sepoliaTx = await sendTransaction({
        type: 'CLAIM_SUBMITTED',
        id: `CLAIM-${Date.now()}`,
        amount: '0',
        metadata: {
          policyId: form.policyId,
          claimantName: form.claimantName,
          claimAmount: form.claimAmount,
          incidentDate: form.incidentDate
        }
      });

      if (!sepoliaTx) {
        setAlert({ type: 'error', msg: mmError || 'MetaMask transaction rejected.' });
        setSubmitting(false);
        setTxStep(null);
        return;
      }

      // Step 2: Backend claim creation with Sepolia proof
      setTxStep('backend');
      const res = await claimAPI.create({
        ...form,
        claimAmount: Number(form.claimAmount),
        sepoliaTxHash: sepoliaTx.txHash,
        sepoliaBlockNumber: sepoliaTx.blockNumber,
        walletAddress: account
      });

      setLastResult({ ...res.data, sepoliaTx });

      const d = res.data.smartContracts;
      const msg = d?.autoClaim?.decision === 'AUTO_APPROVED'
        ? `✅ AUTO-APPROVED! Sepolia TX confirmed. Claim ${res.data.data.claimId}`
        : d?.fraud?.riskLevel === 'HIGH'
        ? `⚠️ Fraud flagged! Score: ${d.fraud.fraudScore}/100 — Sepolia TX recorded.`
        : `Claim ${res.data.data.claimId} submitted for manual review. Sepolia TX confirmed.`;

      setAlert({ type: d?.autoClaim?.decision === 'AUTO_APPROVED' ? 'success' : 'info', msg });
      setShowModal(false);
      setForm(initForm);
      load();
    } catch (e) {
      setAlert({ type: 'error', msg: e.response?.data?.message || 'Failed to submit claim' });
    } finally {
      setSubmitting(false);
      setTxStep(null);
    }
  };

  const handleDecide = async () => {
    const ready = await ensureMetaMask();
    if (!ready) return;

    setSubmitting(true);
    setTxStep('metamask');

    try {
      // MetaMask TX for claim decision proof
      const sepoliaTx = await sendTransaction({
        type: 'CLAIM_DECISION',
        id: showDecide.claimId,
        amount: '0',
        metadata: {
          decision: decideForm.decision,
          approvedAmount: decideForm.approvedAmount,
          adjusterName: decideForm.adjusterName,
          policyId: showDecide.policyId
        }
      });

      if (!sepoliaTx) {
        setAlert({ type: 'error', msg: mmError || 'MetaMask transaction rejected.' });
        setSubmitting(false);
        setTxStep(null);
        return;
      }

      setTxStep('backend');
      await claimAPI.decide(showDecide.claimId, {
        ...decideForm,
        approvedAmount: Number(decideForm.approvedAmount),
        sepoliaTxHash: sepoliaTx.txHash,
        sepoliaBlockNumber: sepoliaTx.blockNumber,
        walletAddress: account
      });

      setAlert({
        type: 'success',
        msg: `Decision recorded on Sepolia (${sepoliaTx.txHash?.slice(0, 16)}...) and internal blockchain for ${showDecide.claimId}`
      });
      setShowDecide(null);
      load();
    } catch (e) {
      setAlert({ type: 'error', msg: 'Failed to record decision' });
    } finally {
      setSubmitting(false);
      setTxStep(null);
    }
  };

  const statusBadge = s => {
    const map = { PENDING: 'pending', UNDER_REVIEW: 'pending', APPROVED: 'active', REJECTED: 'rejected', AUTO_APPROVED: 'auto', FRAUD_FLAGGED: 'fraud' };
    return <span className={`badge badge-${map[s] || 'info'}`}>{s.replace('_', ' ')}</span>;
  };

  const shortAddress = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

  return (
    <div>
      <div className="page-header">
        <h2 className="page-header-title">⚡ Claims Management</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* MetaMask Status */}
          {isConnected && isCorrectNetwork ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(0,255,157,0.08)',
              border: '1px solid rgba(0,255,157,0.3)',
              borderRadius: 8, padding: '6px 14px', fontSize: 13
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff9d', boxShadow: '0 0 6px #00ff9d' }} />
              <span style={{ color: '#00ff9d', fontFamily: 'monospace', fontSize: 12 }}>{shortAddress(account)}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Sepolia</span>
            </div>
          ) : (
            <button
              className="btn"
              style={{
                padding: '6px 16px', fontSize: 13,
                background: 'linear-gradient(135deg, #f6851b, #e2761b)',
                color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600
              }}
              onClick={connect}
            >
              🦊 Connect MetaMask
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>⊕ Submit Claim</button>
        </div>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {/* Smart Contract + Sepolia TX Result */}
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

          {/* Sepolia TX Details */}
          {lastResult.sepoliaTx && (
            <div style={{ marginTop: 16, padding: 14, background: 'rgba(246,133,27,0.08)', border: '1px solid rgba(246,133,27,0.3)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#f6851b', fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>
                🦊 SEPOLIA TESTNET CONFIRMATION
              </div>
              <div className="grid-2" style={{ gap: 10, fontSize: 12 }}>
                <div>
                  <div className="stat-label">TX Hash</div>
                  <a
                    href={lastResult.sepoliaTx.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#00d4ff', textDecoration: 'none', fontFamily: 'monospace', fontSize: 11 }}
                  >
                    {lastResult.sepoliaTx.txHash?.slice(0, 30)}... ↗
                  </a>
                </div>
                <div>
                  <div className="stat-label">Sepolia Block</div>
                  <div className="monospace text-cyan">#{lastResult.sepoliaTx.blockNumber}</div>
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <span className="stat-label">Internal Block Hash: </span>
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
                    <td>
                      <div><span className="hash-text" style={{ fontSize: 9 }}>#{c.blockIndex} {c.blockchainHash?.slice(0, 12)}...</span></div>
                      {c.sepoliaTxHash && (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${c.sepoliaTxHash}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#f6851b', fontSize: 9, fontFamily: 'monospace', textDecoration: 'none' }}
                        >
                          🦊 {c.sepoliaTxHash?.slice(0, 10)}...↗
                        </a>
                      )}
                    </td>
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

      {/* Submit Claim Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">⚡ Submit New Claim</div>

            {!isConnected && (
              <div className="alert alert-info mb-4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>🦊 MetaMask required to submit claims.</span>
                <button
                  className="btn"
                  style={{ padding: '4px 12px', fontSize: 12, background: '#f6851b', color: '#fff', border: 'none', borderRadius: 6 }}
                  onClick={connect}
                >
                  Connect
                </button>
              </div>
            )}

            {txStep && (
              <div className="alert alert-info mb-4" style={{ fontSize: 13 }}>
                {txStep === 'metamask' && '🦊 Confirm the transaction in MetaMask (Sepolia)...'}
                {txStep === 'backend' && '✅ Sepolia TX confirmed! Processing claim on internal blockchain...'}
              </div>
            )}

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

            <div className="alert alert-info" style={{ fontSize: 12, marginBottom: 12 }}>
              <strong>2-Step Process:</strong><br />
              1️⃣ <strong>MetaMask</strong> → Confirm Sepolia TX (0 ETH, data-only proof)<br />
              2️⃣ <strong>Smart Contracts</strong> → Fraud Detection + Auto-Claim + PoW block
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || txPending}>
                {txStep === 'metamask' ? '🦊 Confirm in MetaMask...' : txStep === 'backend' ? '⛏️ Processing...' : '⬡ Submit on Blockchain'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decision Modal */}
      {showDecide && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDecide(null)}>
          <div className="modal">
            <div className="modal-title">⚖️ Claim Decision — {showDecide.claimId}</div>

            {txStep && (
              <div className="alert alert-info mb-4" style={{ fontSize: 13 }}>
                {txStep === 'metamask' && '🦊 Sign decision on Sepolia via MetaMask...'}
                {txStep === 'backend' && '✅ Sepolia confirmed! Recording decision on internal chain...'}
              </div>
            )}

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
              <button className="btn btn-success" onClick={handleDecide} disabled={submitting || txPending}>
                {txStep === 'metamask' ? '🦊 Confirm in MetaMask...' : txStep === 'backend' ? '⛓️ Recording...' : '⬡ Record on Blockchain'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}