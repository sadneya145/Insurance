import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { blockchainAPI, policyAPI, claimAPI } from '../utils/api';

const COLORS = ['#00d4ff', '#00ff9d', '#ff8c42', '#9b59ff', '#ff4757'];

const areaData = [
  { month: 'Jan', policies: 12, claims: 4, premiums: 48000 },
  { month: 'Feb', policies: 19, claims: 6, premiums: 72000 },
  { month: 'Mar', policies: 15, claims: 9, premiums: 61000 },
  { month: 'Apr', policies: 27, claims: 7, premiums: 95000 },
  { month: 'May', policies: 23, claims: 12, premiums: 87000 },
  { month: 'Jun', policies: 34, claims: 8, premiums: 130000 },
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, p, c] = await Promise.all([
          blockchainAPI.getStats(),
          policyAPI.getAll(),
          claimAPI.getAll()
        ]);
        setStats(s.data.data);
        setPolicies(p.data.data || []);
        setClaims(c.data.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const claimStatusData = [
    { name: 'Auto Approved', value: claims.filter(c => c.status === 'AUTO_APPROVED').length || 3 },
    { name: 'Approved', value: claims.filter(c => c.status === 'APPROVED').length || 5 },
    { name: 'Pending', value: claims.filter(c => c.status === 'PENDING').length || 4 },
    { name: 'Rejected', value: claims.filter(c => c.status === 'REJECTED').length || 2 },
    { name: 'Fraud', value: claims.filter(c => c.status === 'FRAUD_FLAGGED').length || 1 },
  ];

  if (loading) return <div className="loading">Loading Dashboard</div>;

  const totalPolicies = policies.length || (stats?.totalPolicies || 0);
  const totalClaims = claims.length || (stats?.totalClaims || 0);
  const chainBlocks = stats?.totalBlocks || 1;
  const scExecutions = stats?.smartContractExecutions || 0;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-header-title">⬡ Network Overview</h2>
        <div className="badge badge-info">Chain Valid: {stats?.chainValidity?.isValid ? '✓ Verified' : '✗ Error'}</div>
      </div>

      <div className="stats-grid">
        {[
          { label: 'Total Blocks', value: chainBlocks, sub: 'In blockchain', color: 'cyan' },
          { label: 'Active Policies', value: totalPolicies, sub: 'Underwritten', color: 'green' },
          { label: 'Total Claims', value: totalClaims, sub: 'Submitted', color: 'orange' },
          { label: 'Smart Contracts', value: scExecutions, sub: 'Executions', color: 'purple' },
          { label: 'Chain Difficulty', value: stats?.difficulty || 2, sub: 'Proof of Work', color: 'red' },
        ].map((s, i) => (
          <div className={`stat-card ${s.color}`} key={i}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-title">Monthly Activity</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={areaData}>
              <defs>
                <linearGradient id="colorPolicies" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorClaims" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff8c42" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ff8c42" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2d3d" />
              <XAxis dataKey="month" stroke="#3a5a6e" tick={{ fill: '#7a9bb5', fontSize: 12 }} />
              <YAxis stroke="#3a5a6e" tick={{ fill: '#7a9bb5', fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#0f1821', border: '1px solid #1a2d3d', borderRadius: '6px', color: '#e8f4f8' }} />
              <Area type="monotone" dataKey="policies" stroke="#00d4ff" fill="url(#colorPolicies)" strokeWidth={2} />
              <Area type="monotone" dataKey="claims" stroke="#ff8c42" fill="url(#colorClaims)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">Claims Distribution</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={claimStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                {claimStatusData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f1821', border: '1px solid #1a2d3d', borderRadius: '6px', color: '#e8f4f8' }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
            {claimStatusData.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i], display: 'block' }}></span>
                <span style={{ color: '#7a9bb5' }}>{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Recent Policies</div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Policy ID</th><th>Holder</th><th>Type</th><th>Premium/mo</th><th>Coverage</th><th>Status</th><th>Block</th>
              </tr>
            </thead>
            <tbody>
              {policies.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                  No policies yet. Create your first policy!
                </td></tr>
              ) : policies.slice(0, 5).map(p => (
                <tr key={p.policyId}>
                  <td><span className="monospace text-cyan" style={{ fontSize: 12 }}>{p.policyId}</span></td>
                  <td>{p.holderName}</td>
                  <td><span className="badge badge-info">{p.insuranceType}</span></td>
                  <td className="text-green">${p.premium?.toFixed(2)}</td>
                  <td>${p.coverageAmount?.toLocaleString()}</td>
                  <td><span className={`badge badge-${p.status === 'ACTIVE' ? 'active' : 'pending'}`}>{p.status}</span></td>
                  <td><span className="monospace text-muted" style={{ fontSize: 10 }}>#{p.blockIndex}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}