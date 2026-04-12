const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');

// ==================== INIT ====================
const app = express();
const PORT = 5000;

const MONGO_URI = 'mongodb://root:root@ac-a2vcxk0-shard-00-00.ghkzoew.mongodb.net:27017,ac-a2vcxk0-shard-00-01.ghkzoew.mongodb.net:27017,ac-a2vcxk0-shard-00-02.ghkzoew.mongodb.net:27017/?ssl=true&replicaSet=atlas-xdpfeg-shard-0&authSource=admin&appName=Cluster0';

// ==================== MIDDLEWARE ====================
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ==================== BLOCKCHAIN & CONTRACTS ====================
const { getBlockchain } = require('./proofofwork/InsuranceBlockchain');
const {
  PremiumCalculatorContract,
  AutoClaimContract,
  FraudDetectionContract
} = require('./Validation/SmartContracts');

const premiumCalc = new PremiumCalculatorContract();
const autoClaimContract = new AutoClaimContract();
const fraudContract = new FraudDetectionContract();

// ==================== MODELS ====================

// USER
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  role: {
    type: String,
    enum: ['policyholder', 'underwriter', 'adjuster', 'admin'],
    default: 'policyholder'
  },
  walletAddress: { type: String, unique: true, sparse: true },
  createdAt: { type: Date, default: Date.now }
});

// POLICY
const policySchema = new mongoose.Schema({
  policyId: { type: String, unique: true },
  holderName: String,
  holderEmail: String,
  insuranceType: {
    type: String,
    enum: ['HEALTH', 'AUTO', 'LIFE', 'PROPERTY', 'TRAVEL']
  },
  premium: Number,
  coverageAmount: Number,
  startDate: Date,
  endDate: Date,
  status: {
    type: String,
    enum: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING'],
    default: 'PENDING'
  },
  underwriterId: String,
  riskScore: Number,
  riskLevel: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']
  },
  blockchainHash: String,
  blockIndex: Number,
  // MetaMask / Sepolia fields
  sepoliaTxHash: { type: String, default: null },
  sepoliaBlockNumber: { type: Number, default: null },
  walletAddress: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
});

policySchema.pre('save', function () {
  this.updatedAt = new Date();
});

// CLAIM
const claimSchema = new mongoose.Schema({
  claimId: { type: String, unique: true },
  policyId: String,
  claimantName: String,
  claimantEmail: String,
  claimAmount: Number,
  incidentDate: Date,
  description: String,
  status: {
    type: String,
    enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'AUTO_APPROVED', 'FRAUD_FLAGGED'],
    default: 'PENDING'
  },
  approvedAmount: Number,
  fraudScore: Number,
  fraudFlags: [String],
  smartContractResult: mongoose.Schema.Types.Mixed,
  blockchainHash: String,
  blockIndex: Number,
  decisionBlockHash: String,
  // MetaMask / Sepolia fields — submission
  sepoliaTxHash: { type: String, default: null },
  sepoliaBlockNumber: { type: Number, default: null },
  walletAddress: { type: String, default: null },
  // MetaMask / Sepolia fields — decision
  decisionSepoliaTxHash: { type: String, default: null },
  decisionSepoliaBlockNumber: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
});

claimSchema.pre('save', function () {
  this.updatedAt = new Date();
});

// BLOCKCHAIN LOG
const blockchainLogSchema = new mongoose.Schema({
  blockIndex: Number,
  hash: String,
  previousHash: String,
  data: mongoose.Schema.Types.Mixed,
  nonce: Number,
  timestamp: String,
  createdAt: { type: Date, default: Date.now }
});

// MODELS
const User = mongoose.model('User', userSchema);
const Policy = mongoose.model('Policy', policySchema);
const Claim = mongoose.model('Claim', claimSchema);
const BlockchainLog = mongoose.model('BlockchainLog', blockchainLogSchema);

// ==================== POLICY ROUTES ====================

// GET all policies
app.get('/api/policies', async (req, res) => {
  try {
    const policies = await Policy.find().sort({ createdAt: -1 });
    res.json({ success: true, data: policies });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single policy
app.get('/api/policies/:id', async (req, res) => {
  try {
    const policy = await Policy.findOne({ policyId: req.params.id });
    if (!policy) return res.status(404).json({ success: false, message: 'Policy not found' });
    res.json({ success: true, data: policy });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// CALCULATE PREMIUM
app.post('/api/policies/calculate-premium', (req, res) => {
  try {
    const execution = premiumCalc.execute(req.body);
    res.json({ success: true, data: execution.result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// CREATE POLICY
app.post('/api/policies', async (req, res) => {
  try {
    const {
      sepoliaTxHash,
      sepoliaBlockNumber,
      walletAddress,
      ...policyData
    } = req.body;

    const premiumExecution = premiumCalc.execute(policyData);
    const policyId = `POL-${uuidv4().slice(0, 8).toUpperCase()}`;
    const blockchain = getBlockchain();

    const block = blockchain.addPolicyBlock({
      policyId,
      holderName: policyData.holderName,
      insuranceType: policyData.insuranceType,
      premium: premiumExecution.result.monthlyPremium,
      // embed Sepolia proof inside the block data
      sepoliaTxHash: sepoliaTxHash || null,
      sepoliaBlockNumber: sepoliaBlockNumber || null,
      walletAddress: walletAddress || null
    });

    await BlockchainLog.create({
      blockIndex: block.index,
      hash: block.hash,
      previousHash: block.previousHash,
      data: block.data,
      nonce: block.nonce,
      timestamp: block.timestamp
    });

    const policy = await Policy.create({
      policyId,
      ...policyData,
      premium: premiumExecution.result.monthlyPremium,
      riskScore: premiumExecution.result.riskScore,
      blockchainHash: block.hash,
      blockIndex: block.index,
      sepoliaTxHash: sepoliaTxHash || null,
      sepoliaBlockNumber: sepoliaBlockNumber || null,
      walletAddress: walletAddress || null
    });

    res.status(201).json({
      success: true,
      data: policy,
      blockchain: {
        blockIndex: block.index,
        blockHash: block.hash,
        nonce: block.nonce,
        previousHash: block.previousHash
      },
      premiumCalculation: premiumExecution.result,
      sepoliaProof: sepoliaTxHash
        ? {
            txHash: sepoliaTxHash,
            blockNumber: sepoliaBlockNumber,
            explorerUrl: `https://sepolia.etherscan.io/tx/${sepoliaTxHash}`
          }
        : null
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== CLAIM ROUTES ====================

// GET all claims
app.get('/api/claims', async (req, res) => {
  try {
    const claims = await Claim.find().sort({ createdAt: -1 });
    res.json({ success: true, data: claims });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single claim
app.get('/api/claims/:claimId', async (req, res) => {
  try {
    const claim = await Claim.findOne({ claimId: req.params.claimId });
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });
    res.json({ success: true, data: claim });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// CREATE CLAIM
app.post('/api/claims', async (req, res) => {
  try {
    const {
      sepoliaTxHash,
      sepoliaBlockNumber,
      walletAddress,
      ...claimData
    } = req.body;

    const policy = await Policy.findOne({ policyId: claimData.policyId });
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found' });
    }

    const fraudExecution = fraudContract.execute({ claimAmount: claimData.claimAmount });
    const autoClaimExecution = autoClaimContract.execute({ claimAmount: claimData.claimAmount });

    // Determine initial status based on smart contract results
    let initialStatus = 'PENDING';
    if (autoClaimExecution.result.decision === 'AUTO_APPROVED') {
      initialStatus = 'AUTO_APPROVED';
    } else if (fraudExecution.result.riskLevel === 'HIGH') {
      initialStatus = 'FRAUD_FLAGGED';
    }

    const claimId = `CLM-${uuidv4().slice(0, 8).toUpperCase()}`;
    const blockchain = getBlockchain();

    const block = blockchain.addClaimBlock({
      claimId,
      policyId: claimData.policyId,
      claimAmount: claimData.claimAmount,
      fraudScore: fraudExecution.result.fraudScore,
      autoDecision: autoClaimExecution.result.decision,
      sepoliaTxHash: sepoliaTxHash || null,
      walletAddress: walletAddress || null
    });

    await BlockchainLog.create({
      blockIndex: block.index,
      hash: block.hash,
      previousHash: block.previousHash,
      data: block.data,
      nonce: block.nonce,
      timestamp: block.timestamp
    });

    const claim = await Claim.create({
      claimId,
      ...claimData,
      status: initialStatus,
      fraudScore: fraudExecution.result.fraudScore,
      fraudFlags: fraudExecution.result.flags || [],
      smartContractResult: {
        fraud: fraudExecution.result,
        autoClaim: autoClaimExecution.result
      },
      blockchainHash: block.hash,
      blockIndex: block.index,
      sepoliaTxHash: sepoliaTxHash || null,
      sepoliaBlockNumber: sepoliaBlockNumber || null,
      walletAddress: walletAddress || null
    });

    res.status(201).json({
      success: true,
      data: claim,
      smartContracts: {
        fraud: fraudExecution.result,
        autoClaim: autoClaimExecution.result
      },
      blockchain: {
        claimBlock: {
          index: block.index,
          hash: block.hash,
          nonce: block.nonce,
          previousHash: block.previousHash
        }
      },
      sepoliaProof: sepoliaTxHash
        ? {
            txHash: sepoliaTxHash,
            blockNumber: sepoliaBlockNumber,
            explorerUrl: `https://sepolia.etherscan.io/tx/${sepoliaTxHash}`
          }
        : null
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// CLAIM DECISION
app.post('/api/claims/:claimId/decide', async (req, res) => {
  try {
    const { claimId } = req.params;
    const {
      decision,
      approvedAmount,
      reason,
      adjusterName,
      sepoliaTxHash,
      sepoliaBlockNumber,
      walletAddress
    } = req.body;

    const existingClaim = await Claim.findOne({ claimId });
    if (!existingClaim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }

    const blockchain = getBlockchain();

    const block = blockchain.addDecisionBlock
      ? blockchain.addDecisionBlock({
          claimId,
          decision,
          approvedAmount: approvedAmount || 0,
          adjusterName: adjusterName || 'Unknown',
          reason: reason || '',
          sepoliaTxHash: sepoliaTxHash || null
        })
      : blockchain.addClaimBlock({
          claimId,
          type: 'CLAIM_DECISION',
          decision,
          approvedAmount: approvedAmount || 0,
          adjusterName: adjusterName || 'Unknown',
          sepoliaTxHash: sepoliaTxHash || null
        });

    await BlockchainLog.create({
      blockIndex: block.index,
      hash: block.hash,
      previousHash: block.previousHash,
      data: block.data,
      nonce: block.nonce,
      timestamp: block.timestamp
    });

    // Map decision to status
    const statusMap = {
      APPROVED: 'APPROVED',
      REJECTED: 'REJECTED',
      PARTIAL: 'APPROVED'
    };

    const updatedClaim = await Claim.findOneAndUpdate(
      { claimId },
      {
        status: statusMap[decision] || 'UNDER_REVIEW',
        approvedAmount: decision !== 'REJECTED' ? Number(approvedAmount) || 0 : 0,
        decisionBlockHash: block.hash,
        decisionSepoliaTxHash: sepoliaTxHash || null,
        decisionSepoliaBlockNumber: sepoliaBlockNumber || null,
        updatedAt: new Date()
      },
      { new: true }
    );

    res.json({
      success: true,
      data: updatedClaim,
      blockchain: {
        blockIndex: block.index,
        blockHash: block.hash,
        nonce: block.nonce
      },
      sepoliaProof: sepoliaTxHash
        ? {
            txHash: sepoliaTxHash,
            blockNumber: sepoliaBlockNumber,
            explorerUrl: `https://sepolia.etherscan.io/tx/${sepoliaTxHash}`
          }
        : null
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== BLOCKCHAIN ROUTES ====================

app.get('/api/blockchain/stats', async (req, res) => {
  try {
    const blockchain = getBlockchain();
    const stats = blockchain.getStats();
    const dbBlocks = await BlockchainLog.countDocuments();

    res.json({
      success: true,
      data: {
        ...stats,
        dbPersistedBlocks: dbBlocks
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/blockchain/chain', (req, res) => {
  try {
    const blockchain = getBlockchain();
    res.json({ success: true, data: blockchain.getChainData() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/blockchain/validate', (req, res) => {
  try {
    const blockchain = getBlockchain();
    res.json({ success: true, data: blockchain.isChainValid() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET blockchain logs from DB
app.get('/api/blockchain/logs', async (req, res) => {
  try {
    const logs = await BlockchainLog.find().sort({ blockIndex: -1 }).limit(50);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== USER ROUTES ====================

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    blockchain: (() => {
      try {
        const bc = getBlockchain();
        return { blocks: bc.getStats?.()?.totalBlocks ?? 'N/A', valid: bc.isChainValid?.()?.isValid ?? true };
      } catch {
        return { error: 'unavailable' };
      }
    })()
  });
});

// ==================== 404 HANDLER (MUST BE LAST) ====================
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
});

// ==================== GLOBAL ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

// ==================== DB + SERVER START ====================
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🦊 MetaMask/Sepolia integration active`);
      console.log(`📋 Routes:`);
      console.log(`   GET  /api/policies`);
      console.log(`   POST /api/policies`);
      console.log(`   POST /api/policies/calculate-premium`);
      console.log(`   GET  /api/claims`);
      console.log(`   POST /api/claims`);
      console.log(`   POST /api/claims/:claimId/decide`);
      console.log(`   GET  /api/blockchain/stats`);
      console.log(`   GET  /api/blockchain/chain`);
      console.log(`   GET  /api/blockchain/validate`);
      console.log(`   GET  /api/blockchain/logs`);
      console.log(`   GET  /api/health`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

module.exports = app;