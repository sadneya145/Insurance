import React, { useEffect, useState } from 'react';
import { policyAPI } from '../utils/api';
import { useMetaMask } from '../pages/UseMetamask';

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
  const [txStep, setTxStep] = useState(null); // 'metamask' | 'backend' | null

  const { account, isConnected, isCorrectNetwork, connect, sendTransaction, txPending, error: mmError } = useMetaMask();

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
    if (!isConnected) {
      const acc = await connect();
      if (!acc) {
        setAlert({ type: 'error', msg: 'Please connect MetaMask to continue.' });
        return;
      }
    }
    if (!isCorrectNetwork) {
      setAlert({ type: 'error', msg: 'Please switch to Sepolia testnet in MetaMask.' });
      return;
    }

    setSubmitting(true);
    setAlert(null);
    setTxStep('metamask');

    try {
      // Step 1: Send MetaMask transaction on Sepolia for on-chain proof
      const sepoliaPayload = {
        type: 'POLICY_ISSUANCE',
        id: `POLICY-${Date.now()}`,
        amount: '0', // No ETH value — just on-chain data proof
        metadata: {
          holderName: form.holderName,
          insuranceType: form.insuranceType,
          coverageAmount: form.coverageAmount,
          riskLevel: form.riskLevel
        }
      };

      const sepoliaTx = await sendTransaction(sepoliaPayload);

      if (!sepoliaTx) {
        setAlert({ type: 'error', msg: mmError || 'MetaMask transaction was rejected or failed.' });
        setSubmitting(false);
        setTxStep(null);
        return;
      }

      // Step 2: Record on backend blockchain with Sepolia tx proof
      setTxStep('backend');
      const res = await policyAPI.create({
        ...form,
        coverageAmount: Number(form.coverageAmount),
        sepoliaTxHash: sepoliaTx.txHash,
        sepoliaBlockNumber: sepoliaTx.blockNumber,
        walletAddress: account
      });

      setResult({ ...res.data, sepoliaTx });
      setAlert({
        type: 'success',
        msg: `Policy ${res.data.data.policyId} created! Sepolia TX confirmed. Block #${res.data.blockchain?.blockIndex} mined.`
      });
      setShowModal(false);
      setForm(initialForm);
      setPreview(null);
      load();
    } catch (e) {
      setAlert({ type: 'error', msg: e.response?.data?.message || 'Failed to create policy' });
    } finally {
      setSubmitting(false);
      setTxStep(null);
    }
  };

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const shortAddress = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

  return (
    <div>
      <div className="page-header">
        <h2 className="page-header-title">📋 Policy Management</h2>
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
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>⊕ New Policy</button>
        </div>
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

          {/* Sepolia TX Details */}
          {result.sepoliaTx && (
            <div style={{ marginTop: 16, padding: 14, background: 'rgba(246,133,27,0.08)', border: '1px solid rgba(246,133,27,0.3)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#f6851b', fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>
                🦊 SEPOLIA TESTNET CONFIRMATION
              </div>
              <div className="grid-2" style={{ gap: 10, fontSize: 12 }}>
                <div>
                  <div className="stat-label">TX Hash</div>
                  <a
                    href={result.sepoliaTx.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hash-text"
                    style={{ color: '#00d4ff', textDecoration: 'none', fontSize: 11 }}
                  >
                    {result.sepoliaTx.txHash?.slice(0, 30)}... ↗
                  </a>
                </div>
                <div>
                  <div className="stat-label">Sepolia Block</div>
                  <div className="monospace text-cyan">#{result.sepoliaTx.blockNumber}</div>
                </div>
                <div>
                  <div className="stat-label">Status</div>
                  <span className="badge badge-active">{result.sepoliaTx.status?.toUpperCase()}</span>
                </div>
                <div>
                  <div className="stat-label">From Wallet</div>
                  <div className="monospace" style={{ fontSize: 11 }}>{shortAddress(account)}</div>
                </div>
              </div>
            </div>
          )}
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

            {/* MetaMask required notice */}
            {!isConnected && (
              <div className="alert alert-info mb-4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>🦊 MetaMask required to issue policies on Sepolia.</span>
                <button
                  className="btn"
                  style={{ padding: '4px 12px', fontSize: 12, background: '#f6851b', color: '#fff', border: 'none', borderRadius: 6 }}
                  onClick={connect}
                >
                  Connect
                </button>
              </div>
            )}

            {/* TX Step indicator */}
            {txStep && (
              <div className="alert alert-info mb-4" style={{ fontSize: 13 }}>
                {txStep === 'metamask' && '🦊 Waiting for MetaMask confirmation on Sepolia...'}
                {txStep === 'backend' && '⛓️ MetaMask confirmed! Mining internal blockchain block...'}
              </div>
            )}

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

            {/* 2-step TX info */}
            <div className="alert alert-info mb-4" style={{ fontSize: 12 }}>
              <strong>2-Step Blockchain Process:</strong><br />
              1️⃣ <strong>MetaMask</strong> → Sign & broadcast Sepolia testnet transaction<br />
              2️⃣ <strong>Internal PoW</strong> → Mine policy block on internal blockchain
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => { setShowModal(false); setPreview(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || txPending}>
                {txStep === 'metamask' ? '🦊 Awaiting MetaMask...' : txStep === 'backend' ? '⛏️ Mining Block...' : '⬡ Issue Policy on Blockchain'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}