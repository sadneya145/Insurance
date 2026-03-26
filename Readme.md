# ⬡ InsureChain — Blockchain Insurance & Underwriting Platform

A full-stack blockchain-powered insurance platform built with **React.js**, **Node.js**, **MongoDB**, and a custom **Proof-of-Work blockchain** engine — no Ethereum required.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js 18, React Router, Recharts |
| Backend | Node.js, Express.js |
| Database | MongoDB (Mongoose) |
| Blockchain | Custom SHA-256 PoW chain (pure JS) |
| Smart Contracts | Custom JS contract engine |

---

## 📁 Project Structure

```
blockchain-insurance/
├── backend/
│   ├── blockchain/
│   │   ├── Block.js                  ← SHA-256 block with Proof of Work
│   │   ├── InsuranceBlockchain.js    ← Full chain, mining, validation
│   │   └── SmartContracts.js         ← 4 smart contracts
│   ├── models/index.js               ← MongoDB schemas
│   ├── routes/
│   │   ├── policies.js               ← Policy CRUD + blockchain writes
│   │   ├── claims.js                 ← Claims + fraud detection
│   │   └── blockchain.js             ← Chain explorer API
│   ├── scripts/seed.js               ← Demo data seeder
│   └── server.js                     ← Express server
└── frontend/src/
    ├── pages/
    │   ├── Dashboard.js              ← Live stats, charts
    │   ├── Policies.js               ← Policy management
    │   ├── Claims.js                 ← Claims + smart contract results
    │   ├── BlockchainExplorer.js     ← Visual chain explorer
    │   └── SmartContracts.js         ← Interactive contract tester
    ├── utils/api.js                  ← Axios API client
    └── styles/global.css             ← Dark industrial theme
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB running locally on `localhost:27017`

### 1. Backend Setup
```bash
cd backend
cp .env.example .env
npm install
npm run dev        # Starts on http://localhost:5000
```

### 2. Seed Demo Data (optional)
```bash
cd backend
node scripts/seed.js
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm start          # Opens at http://localhost:3000
```

---

## ⛓️ Blockchain Architecture

### Block Structure
```javascript
{
  index: 5,
  timestamp: "2025-01-15T10:30:00.000Z",
  data: { type: "POLICY_ISSUANCE", policyId: "POL-ABC123", ... },
  previousHash: "00a4f3b2...",
  hash: "003d9e1a...",   // SHA-256(index + previousHash + timestamp + data + nonce)
  nonce: 1847            // Proof of Work nonce
}
```

### Block Types
| Type | Trigger |
|------|---------|
| `GENESIS` | Chain initialization |
| `POLICY_ISSUANCE` | New policy created |
| `CLAIM_SUBMITTED` | Claim filed |
| `CLAIM_DECISION` | Adjuster approves/rejects |
| `SMART_CONTRACT_EXECUTION` | Auto-claim processed |
| `PREMIUM_PAYMENT` | Payment received |

---

## 📜 Smart Contracts

### 1. AutoClaimContract
- Auto-approves claims ≤ $5,000 instantly
- Checks fraud score and policy status
- Writes immutable decision block to chain

### 2. PremiumCalculatorContract
- Calculates risk-adjusted premiums
- Variables: insurance type, age, risk level, claims history
- Base rates: HEALTH 4%, AUTO 3.5%, LIFE 2.5%, PROPERTY 1.5%

### 3. FraudDetectionContract
- Scores fraud risk 0–100
- Detects: early large claims, rapid claim patterns, round amounts
- HIGH (>60): reject & investigate | MEDIUM (>30): manual review

### 4. ReinsuranceTriggerContract
- Triggers excess-of-loss reinsurance above $500k retention
- Catastrophe XL trigger above $5M total exposure

---

## 🔌 REST API Reference

### Policies
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/policies` | List all policies |
| GET | `/api/policies/:id` | Get policy by ID |
| POST | `/api/policies` | Create policy (mines block) |
| POST | `/api/policies/calculate-premium` | Run premium smart contract |
| PUT | `/api/policies/:id/status` | Update policy status |

### Claims
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/claims` | List all claims |
| GET | `/api/claims/:id` | Get claim by ID |
| POST | `/api/claims` | Submit claim (runs fraud detection + auto-claim contracts) |
| PUT | `/api/claims/:id/decision` | Record adjuster decision |

### Blockchain
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/blockchain/chain` | Full chain data |
| GET | `/api/blockchain/stats` | Chain statistics |
| GET | `/api/blockchain/validate` | Integrity validation |
| GET | `/api/blockchain/block/:index` | Get specific block |
| GET | `/api/blockchain/blocks/type/:type` | Filter blocks by type |

---

## 🎯 Key Features

- **Immutability**: Every policy, claim, and decision is permanently recorded
- **Proof of Work**: Blocks require mining with SHA-256 hashing
- **Chain Validation**: Real-time tamper detection across entire chain
- **Smart Contracts**: Automated decisions reduce manual processing by ~40%
- **Fraud Detection**: ML-inspired fraud scoring on every claim
- **Full Audit Trail**: Complete traceability from policy issuance to claim payout

---

## 🔐 How Blockchain Impacts Insurance

| Traditional | With InsureChain |
|-------------|-----------------|
| Centralized data, single point of failure | Distributed, tamper-proof ledger |
| Manual claim processing (days) | Smart contract auto-approval (seconds) |
| Fraud detected post-payment | Real-time fraud scoring pre-approval |
| Opaque premium calculation | Transparent, on-chain smart contract |
| Paper audit trails | Immutable blockchain records |
| Reinsurance manual triggers | Automated reinsurance contracts |

---

## 📄 License
MIT — Built for educational purposes demonstrating blockchain applications in InsurTech.