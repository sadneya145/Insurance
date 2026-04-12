import React from 'react';
import { useMetaMask } from '../pages/UseMetamask';

export default function MetaMaskConnector({ onConnected }) {
  const { account, isConnected, isCorrectNetwork, error, connect, switchToSepolia } = useMetaMask();

  const handleConnect = async () => {
    const acc = await connect();
    if (acc && onConnected) onConnected(acc);
  };

  const shortAddress = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

  if (isConnected && isCorrectNetwork) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(0,255,157,0.08)',
        border: '1px solid rgba(0,255,157,0.3)',
        borderRadius: 8, padding: '6px 14px',
        fontSize: 13
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff9d', boxShadow: '0 0 6px #00ff9d' }} />
        <span style={{ color: '#00ff9d', fontFamily: 'Space Mono, monospace', fontSize: 12 }}>
          {shortAddress(account)}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Sepolia</span>
      </div>
    );
  }

  if (isConnected && !isCorrectNetwork) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ color: '#ff8c42', fontSize: 12 }}>Wrong Network</div>
        <button
          className="btn btn-outline"
          style={{ padding: '4px 12px', fontSize: 12, borderColor: '#ff8c42', color: '#ff8c42' }}
          onClick={switchToSepolia}
        >
          Switch to Sepolia
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button
        className="btn"
        style={{
          padding: '6px 16px',
          fontSize: 13,
          background: 'linear-gradient(135deg, #f6851b, #e2761b)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontWeight: 600
        }}
        onClick={handleConnect}
      >
        <svg width="16" height="16" viewBox="0 0 35 33" fill="none">
          <path d="M32.9582 1L19.8241 10.7183L22.2665 4.99099L32.9582 1Z" fill="#E17726" stroke="#E17726" strokeWidth="0.25"/>
          <path d="M2.04858 1L15.0707 10.809L12.7402 4.99099L2.04858 1Z" fill="#E27625" stroke="#E27625" strokeWidth="0.25"/>
        </svg>
        Connect MetaMask
      </button>
      {error && <div style={{ color: '#ff4757', fontSize: 11 }}>{error}</div>}
    </div>
  );
}