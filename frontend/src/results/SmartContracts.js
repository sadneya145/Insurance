import React, { useState } from 'react';
import { policyAPI } from '../utils/api';

// ---- Local simulations of smart contracts (for frontend demo) ----
function runFraudCheck({ claimAmount, claimsThisYear, daysSincePolicy }) {
  let score = 0; const flags = [];
  if (daysSincePolicy < 30 && claimAmount > 10000) { score += 35; flags.push('EARLY_LARGE_CLAIM'); }
  if (claimsThisYear >= 3) { score += 20; flags.push('RAPID_CLAIMS'); }
  if (claimAmount % 1000 === 0 && claimAmount > 5000) { score += 10; flags.push('ROUND_AMOUNT_PATTERN'); }
  score = Math.min(score, 100);
  return { fraudScore: score, riskLevel: score > 60 ? 'HIGH' : score > 30 ? 'MEDIUM' : 'LOW', flags,
    recommendation: score > 60 ? 'REJECT_AND_INVESTIGATE' : score > 30 ? 'MANUAL_REVIEW' : 'PROCEED' };
}

function runAutoClaimCheck({ claimAmount, policyStatus, fraudScore }) {
  if (policyStatus !== 'ACTIVE') return { decision: 'REJECTED', reason: 'Policy inactive', code: 'POLICY_INACTIVE' };
  if (fraudScore > 75) return { decision: 'REJECTED', reason: 'High fraud risk', code: 'FRAUD_RISK' };
  if (claimAmount <= 5000) return { decision: 'AUTO_APPROVED', approvedAmount: claimAmount, reason: 'Within $5,000 auto-approval threshold', code: 'AUTO_APPROVED' };
  return { decision: 'MANUAL_REVIEW_REQUIRED', reason: 'Exceeds smart contract threshold', code: 'MANUAL_REVIEW' };
}

function runReinsurance({ singleRiskAmount, totalExposure }) {
  const retention = 500000;
  const catastrophe = 5000000;
  const exceedance = Math.max(0, singleRiskAmount - retention);
  return {
    requiresReinsurance: exceedance > 0 || totalExposure > catastrophe,
    retainedAmount: Math.min(singleRiskAmount, retention),
    cededAmount: exceedance,
    catastropheTriggered: totalExposure > catastrophe,
    reinsuranceType: totalExposure > catastrophe ? 'CATASTROPHE_XL' : exceedance > 0 ? 'EXCESS_OF_LOSS' : 'NONE'
  };
}

const CONTRACT_DEFS = [
  {
    id: 'CONTRACT_AUTO_CLAIM_001',
    name: 'Auto Claim Settlement',
    type: 'AUTO_CLAIM_SETTLEMENT',
    icon: '⚡',
    color: '#00d4ff',
    description: 'Automatically approves claims under $5,000 threshold. Checks fraud score and policy status before settlement.',
    terms: { autoApproveLimit: 5000, requireEvidenceAbove: 1000, fraudCheckThreshold: 10000 },
    fields: [
      { key: 'claimAmount', label: 'Claim Amount ($)', type: 'number', default: 3000 },
      { key: 'policyStatus', label: 'Policy Status', type: 'select', options: ['ACTIVE', 'EXPIRED', 'CANCELLED'], default: 'ACTIVE' },
      { key: 'fraudScore', label: 'Fraud Score (0-100)', type: 'number', default: 10 }
    ],
    run: (inputs) => runAutoClaimCheck(inputs)
  },
  {
    id: 'CONTRACT_FRAUD_001',
    name: 'Fraud Detection',
    type: 'FRAUD_DETECTION',
    icon: '🛡️',
    color: '#9b59ff',
    description: 'Analyzes claim patterns to detect potential fraud. Scores 0-100 based on amount anomalies, timing, and claim frequency.',
    terms: { maxClaimsPerYear: 3, suspiciousAmountMultiple: 5 },
    fields: [
      { key: 'claimAmount', label: 'Claim Amount ($)', type: 'number', default: 15000 },
      { key: 'claimsThisYear', label: 'Claims This Year', type: 'number', default: 2 },
      { key: 'daysSincePolicy', label: 'Days Since Policy Start', type: 'number', default: 20 }
    ],
    run: (inputs) => runFraudCheck(inputs)
  },
  {
    id: 'CONTRACT_PREMIUM_CALC_001',
    name: 'Premium Calculator',
    type: 'PREMIUM_CALCULATOR',
    icon: '🧮',
    color: '#00ff9d',
    description: 'Calculates risk-adjusted premiums using base rates, age modifiers, and historical claims data.',
    terms: { baseRates: { HEALTH: '4%', AUTO: '3.5%', LIFE: '2.5%', PROPERTY: '1.5%' } },
    fields: [
      { key: 'insuranceType', label: 'Insurance Type', type: 'select', options: ['HEALTH', 'AUTO', 'LIFE', 'PROPERTY', 'TRAVEL'], default: 'HEALTH' },
      { key: 'coverageAmount', label: 'Coverage Amount ($)', type: 'number', default: 100000 },
      { key: 'riskLevel', label: 'Risk Level', type: 'select', options: ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'], default: 'MEDIUM' },
      { key: 'age', label: 'Age', type: 'number', default: 35 },
      { key: 'claimsHistory', label: 'Prior Claims', type: 'number', default: 0 }
    ],
    run: async (inputs) => {
      const res = await policyAPI.calculatePremium(inputs);
      return res.data.data;
    }
  },
  {
    id: 'CONTRACT_REINSURANCE_001',
    name: 'Reinsurance Trigger',
    type: 'REINSURANCE_TRIGGER',
    icon: '🏛️',
    color: '#ff8c42',
    description: 'Evaluates if a risk exceeds retention limits and triggers reinsurance. Handles both excess-of-loss and catastrophe programs.',
    terms: { retentionLimit: '$500,000', catastropheThreshold: '$5,000,000' },
    fields: [
      { key: 'singleRiskAmount', label: 'Single Risk Amount ($)', type: 'number', default: 750000 },
      { key: 'totalExposure', label: 'Total Portfolio Exposure ($)', type: 'number', default: 3000000 }
    ],
    run: (inputs) => runReinsurance(inputs)
  }
];

function ContractTester({ contract }) {
  const [inputs, setInputs] = useState(
    contract.fields.reduce((acc, f) => ({ ...acc, [f.key]: f.default }), {})
  );
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [gasUsed] = useState(Math.floor(Math.random() * 800) + 400);

  const execute = async () => {
    setRunning(true);
    await new Promise(r => setTimeout(r, 600)); // simulate mining delay
    try {
      const out = await contract.run(inputs);
      setResult(out);
    } catch (e) { console.error(e); }
    finally { setRunning(false); }
  };

  return (
    <div className="contract-card">
      <div className="flex-between mb-4">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>{contract.icon}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: contract.color }}>{contract.name}</span>
          </div>
          <div className="contract-id">{contract.id}</div>
        </div>
        <span className="badge badge-info">{contract.type.replace(/_/g, ' ')}</span>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
        {contract.description}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="stat-label" style={{ marginBottom: 10 }}>Contract Terms</div>
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: 12 }}>
          {Object.entries(contract.terms).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
              <span className="monospace" style={{ color: contract.color }}>{typeof v === 'object' ? JSON.stringify(v) : v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="form-grid" style={{ marginBottom: 16 }}>
        {contract.fields.map(f => (
          <div className="form-group" key={f.key}>
            <label className="form-label">{f.label}</label>
            {f.type === 'select' ? (
              <select className="form-select" value={inputs[f.key]} onChange={e => setInputs(i => ({ ...i, [f.key]: e.target.value }))}>
                {f.options.map(o => <option key={o}>{o}</option>)}
              </select>
            ) : (
              <input className="form-input" type="number" value={inputs[f.key]}
                onChange={e => setInputs(i => ({ ...i, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))} />
            )}
          </div>
        ))}
      </div>

      <button className="btn" style={{ background: contract.color, color: '#060a0f', width: '100%', justifyContent: 'center', marginBottom: 16 }}
        onClick={execute} disabled={running}>
        {running ? '⛏ Mining execution block...' : `▶ Execute ${contract.name}`}
      </button>

      {result && (
        <div style={{ background: 'var(--bg-primary)', border: `1px solid ${contract.color}44`, borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: contract.color, letterSpacing: 1 }}>EXECUTION RESULT</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Space Mono' }}>gas: {gasUsed}</span>
          </div>
          <pre style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: 11,
            color: '#e8f4f8',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            lineHeight: 1.7,
            margin: 0
          }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function SmartContracts() {
  return (
    <div>
      <div className="page-header">
        <h2 className="page-header-title">📜 Smart Contracts</h2>
        <span className="badge badge-info">Solidity-inspired Logic • On-Chain Execution</span>
      </div>

      <div className="alert alert-info mb-6">
        ⚡ These smart contracts execute automatically on the InsureChain blockchain. Each execution writes an immutable block to the chain with full audit trail.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 20 }}>
        {CONTRACT_DEFS.map(contract => (
          <ContractTester key={contract.id} contract={contract} />
        ))}
      </div>

      <div className="card" style={{ marginTop: 28 }}>
        <div className="card-title">How Smart Contracts Work in InsureChain</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
          {[
            { step: '01', title: 'Trigger', desc: 'A policy creation, claim submission, or payment triggers a smart contract automatically.' },
            { step: '02', title: 'Logic', desc: 'The contract evaluates rules: fraud scores, thresholds, risk levels, and policy terms.' },
            { step: '03', title: 'Mine Block', desc: 'The result is encoded in a new block with Proof of Work and a unique SHA-256 hash.' },
            { step: '04', title: 'Immutable', desc: 'The decision is permanently on-chain — tamper-proof, auditable, and transparent.' },
          ].map(item => (
            <div key={item.step} style={{ padding: 16, background: 'var(--bg-primary)', borderRadius: 6, border: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'Space Mono', fontSize: 28, color: 'var(--accent-cyan)', opacity: 0.3, marginBottom: 8 }}>{item.step}</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: 'var(--text-primary)' }}>{item.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}