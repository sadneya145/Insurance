const mongoose = require('mongoose');

// ==================== USER MODEL ====================
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ['policyholder', 'underwriter', 'adjuster', 'admin'], default: 'policyholder' },
  walletAddress: { type: String, unique: true, sparse: true },
  createdAt: { type: Date, default: Date.now }
});

// ==================== POLICY MODEL ====================
const policySchema = new mongoose.Schema({
  policyId: { type: String, required: true, unique: true },
  holderName: { type: String, required: true },
  holderEmail: { type: String, required: true },
  insuranceType: {
    type: String,
    enum: ['HEALTH', 'AUTO', 'LIFE', 'PROPERTY', 'TRAVEL'],
    required: true
  },
  premium: { type: Number, required: true },
  coverageAmount: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING'],
    default: 'PENDING'
  },
  underwriterId: { type: String },
  riskScore: { type: Number, min: 0, max: 100 },
  riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'] },
  blockchainHash: { type: String }, // Reference to blockchain block hash
  blockIndex: { type: Number },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Attach pre-save hook to the correct schema
policySchema.pre('save', function () {
  console.log('Pre-save hook called for policy:', this.policyId);
  this.updatedAt = new Date();
  // ❌ do not call next() in async style
});

// ==================== CLAIM MODEL ====================
const claimSchema = new mongoose.Schema({
  claimId: { type: String, required: true, unique: true },
  policyId: { type: String, required: true },
  claimantName: { type: String, required: true },
  claimantEmail: { type: String, required: true },
  claimAmount: { type: Number, required: true },
  incidentDate: { type: Date, required: true },
  description: { type: String, required: true },
  status: {
    type: String,
    enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'AUTO_APPROVED', 'FRAUD_FLAGGED'],
    default: 'PENDING'
  },
  approvedAmount: { type: Number },
  decision: { type: String },
  decisionReason: { type: String },
  adjusterName: { type: String },
  fraudScore: { type: Number },
  fraudFlags: [{ type: String }],
  smartContractResult: { type: mongoose.Schema.Types.Mixed },
  blockchainHash: { type: String },
  blockIndex: { type: Number },
  decisionBlockHash: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

claimSchema.pre('save', function () {
  console.log('Pre-save hook called for claim:', this.claimId);
  this.updatedAt = new Date();
});

// ==================== PAYMENT MODEL ====================
const paymentSchema = new mongoose.Schema({
  paymentId: { type: String, required: true, unique: true },
  policyId: { type: String, required: true },
  amount: { type: Number, required: true },
  paymentType: { type: String, enum: ['PREMIUM', 'CLAIM_PAYOUT'], default: 'PREMIUM' },
  paymentMethod: { type: String, enum: ['CREDIT_CARD', 'BANK_TRANSFER', 'CRYPTO', 'UPI'], default: 'BANK_TRANSFER' },
  transactionHash: { type: String },
  blockchainHash: { type: String },
  blockIndex: { type: Number },
  status: { type: String, enum: ['PENDING', 'COMPLETED', 'FAILED'], default: 'COMPLETED' },
  createdAt: { type: Date, default: Date.now }
});

// ==================== BLOCKCHAIN LOG MODEL ====================
const blockchainLogSchema = new mongoose.Schema({
  blockIndex: { type: Number, required: true },
  hash: { type: String, required: true },
  previousHash: { type: String },
  data: { type: mongoose.Schema.Types.Mixed },
  nonce: { type: Number },
  timestamp: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Policy = mongoose.model('Policy', policySchema);
const Claim = mongoose.model('Claim', claimSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const BlockchainLog = mongoose.model('BlockchainLog', blockchainLogSchema);

module.exports = { User, Policy, Claim, Payment, BlockchainLog };