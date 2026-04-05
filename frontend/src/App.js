import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Policies from './pages/Policies';
import Claims from './pages/Claims';
import BlockchainExplorer from './results/BlockchainExplorer';
import SmartContracts from './results/SmartContracts';
import './styles/global.css';

function NavLink({ to, icon, label }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link to={to} className={`nav-link ${active ? 'active' : ''}`}>
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
    </Link>
  );
}

function Layout({ children }) {
  return (
    <div className="app-layout">
      <main className="main-content">
        <header className="top-bar">
          <div className="logo">
            <span className="logo-icon">⬡</span>
            <span className="logo-text">InsureChain</span>
          </div>
          <div className="network-badge">⬡ InsureChain v1.0</div>
        </header>

        <nav className="top-nav">
          <NavLink to="/"           icon="⬡"  label="Dashboard" />
          <NavLink to="/policies"   icon="📋" label="Policies" />
          <NavLink to="/claims"     icon="⚡" label="Claims" />
          <NavLink to="/blockchain" icon="🔗" label="Blockchain" />
          <NavLink to="/contracts"  icon="📜" label="Smart Contracts" />
          <div className="chain-status">
            <span className="dot green"></span>
            Chain Active
          </div>
        </nav>

        <div className="content-area">{children}</div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/"           element={<Dashboard />} />
          <Route path="/policies"   element={<Policies />} />
          <Route path="/claims"     element={<Claims />} />
          <Route path="/blockchain" element={<BlockchainExplorer />} />
          <Route path="/contracts"  element={<SmartContracts />} />
        </Routes>
      </Layout>
    </Router>
  );
}
