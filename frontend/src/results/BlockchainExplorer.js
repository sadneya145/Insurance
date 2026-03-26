import React, { useEffect, useState } from 'react';
import { blockchainAPI } from '../utils/api';

const TYPE_COLORS = {
  GENESIS: '#00ff9d',
  POLICY_ISSUANCE: '#00d4ff',
  CLAIM_SUBMITTED: '#ff8c42',
  CLAIM_DECISION: '#9b59ff',
  SMART_CONTRACT_EXECUTION: '#ff4757',
  PREMIUM_PAYMENT: '#f1c40f'
};

function BlockCard({ block, onClick, selected }) {
  const color = TYPE_COLORS[block.data?.type] || '#7a9bb5';
  return (
    <div
      className={`chain-block ${block.index === 0 ? 'genesis' : ''}`}
      style={{
        borderColor: selected ? color : undefined,
        cursor: 'pointer',
        boxShadow: selected ? `0 0 16px ${color}33` : 'none'
      }}
      onClick={() => onClick(block)}
    >
      <div className="chain-block-index" style={{ color }}>#{block.index}</div>
      <div className="chain-block-type">{block.data?.type || 'UNKNOWN'}</div>
      <div className="chain-block-hash">{block.hash?.slice(0, 24)}...</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
        {new Date(block.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}

export default function BlockchainExplorer() {
  const [chain, setChain] = useState([]);
  const [stats, setStats] = useState(null);
  const [validation, setValidation] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  const load = async () => {
    try {
      const [c, s, v] = await Promise.all([
        blockchainAPI.getChain(),
        blockchainAPI.getStats(),
        blockchainAPI.validate()
      ]);
      setChain(c.data.data || []);
      setStats(s.data.data);
      setValidation(v.data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const types = ['ALL', 'GENESIS', 'POLICY_ISSUANCE', 'CLAIM_SUBMITTED', 'CLAIM_DECISION', 'SMART_CONTRACT_EXECUTION', 'PREMIUM_PAYMENT'];

  const filtered = filter === 'ALL' ? chain : chain.filter(b => b.data?.type === filter);

  if (loading) return <div className="loading">Loading Blockchain</div>;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-header-title">🔗 Blockchain Explorer</h2>
        <button className="btn btn-outline" onClick={load}>↻ Refresh Chain</button>
      </div>

      {/* Chain Stats */}
      <div className="stats-grid mb-6">
        {[
          { label: 'Total Blocks', value: stats?.totalBlocks || 0, color: 'cyan' },
          { label: 'Policies', value: stats?.totalPolicies || 0, color: 'green' },
          { label: 'Claims', value: stats?.totalClaims || 0, color: 'orange' },
          { label: 'Smart Contracts', value: stats?.smartContractExecutions || 0, color: 'purple' },
          { label: 'Chain Status', value: validation?.isValid ? 'VALID' : 'ERROR', color: validation?.isValid ? 'green' : 'red' },
        ].map((s, i) => (
          <div className={`stat-card ${s.color}`} key={i}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ fontSize: typeof s.value === 'string' ? 16 : undefined }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Validation Banner */}
      <div className={`alert ${validation?.isValid ? 'alert-success' : 'alert-error'} mb-6`}>
        {validation?.isValid
          ? '✅ Chain integrity verified — All blocks valid, no tampering detected'
          : `⚠️ Chain integrity issues detected: ${validation?.issues?.length} problem(s) found`}
      </div>

      {/* Filter */}
      <div className="card mb-6">
        <div className="card-title">Filter by Block Type</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {types.map(t => (
            <button
              key={t}
              className={`btn ${filter === t ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '6px 14px', fontSize: 11 }}
              onClick={() => setFilter(t)}
            >
              {t.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Block Chain Visualization */}
      <div className="card mb-6">
        <div className="card-title">Block Chain ({filtered.length} blocks)</div>
        <div className="block-chain">
          {filtered.map((block, i) => (
            <React.Fragment key={block.index}>
              <BlockCard block={block} onClick={setSelected} selected={selected?.index === block.index} />
              {i < filtered.length - 1 && (
                <div className="chain-arrow">→</div>
              )}
            </React.Fragment>
          ))}
          {filtered.length === 0 && (
            <div style={{ color: 'var(--text-muted)', padding: '20px', fontSize: 14 }}>No blocks of this type yet.</div>
          )}
        </div>
      </div>

      {/* Block Detail */}
      {selected && (
        <div className="card">
          <div className="flex-between mb-4">
            <div className="card-title">Block #{selected.index} — Detail</div>
            <button className="btn btn-outline" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => setSelected(null)}>✕ Close</button>
          </div>

          <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
            <div>
              <div className="stat-label">Block Hash</div>
              <div className="hash-text" style={{ wordBreak: 'break-all', lineHeight: 1.6 }}>{selected.hash}</div>
            </div>
            <div>
              <div className="stat-label">Previous Hash</div>
              <div className="hash-text" style={{ wordBreak: 'break-all', lineHeight: 1.6, color: 'var(--accent-green)' }}>{selected.previousHash}</div>
            </div>
            <div>
              <div className="stat-label">Timestamp</div>
              <div className="monospace" style={{ fontSize: 13 }}>{new Date(selected.timestamp).toLocaleString()}</div>
            </div>
            <div>
              <div className="stat-label">Nonce (Proof of Work)</div>
              <div className="monospace text-orange" style={{ fontSize: 20 }}>{selected.nonce}</div>
            </div>
          </div>

          <div>
            <div className="stat-label" style={{ marginBottom: 12 }}>Block Data Payload</div>
            <div style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: 16,
              fontFamily: 'Space Mono, monospace',
              fontSize: 12,
              color: 'var(--accent-cyan)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              lineHeight: 1.7,
              maxHeight: 400,
              overflowY: 'auto'
            }}>
              {JSON.stringify(selected.data, null, 2)}
            </div>
          </div>

          {/* Hash Integrity Check */}
          <div style={{ marginTop: 20, padding: 16, background: 'rgba(0,255,157,0.05)', border: '1px solid rgba(0,255,157,0.2)', borderRadius: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--accent-green)', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
              ✓ IMMUTABILITY PROOF
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              This block's hash is derived from: <span className="text-cyan">index + previousHash + timestamp + data + nonce</span><br />
              Any modification to block data would invalidate this hash and break the entire chain.
            </div>
          </div>
        </div>
      )}

      {/* Block Type Legend */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-title">Block Type Reference</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-primary)', borderRadius: 6, border: '1px solid var(--border)' }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: color, boxShadow: `0 0 6px ${color}` }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color }}>{type.replace(/_/g, ' ')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}