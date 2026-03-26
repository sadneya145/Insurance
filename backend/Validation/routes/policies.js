const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Policy, BlockchainLog } = require('../models');
const { getBlockchain } = require('../../proofofwork/InsuranceBlockchain');
const { PremiumCalculatorContract } = require('../SmartContracts');

const premiumCalc = new PremiumCalculatorContract();

// GET all policies
router.get('/', async (req, res) => {
  try {
    const policies = await Policy.find().sort({ createdAt: -1 });
    res.json({ success: true, data: policies, count: policies.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single policy
router.get('/:id', async (req, res) => {
  try {
    const policy = await Policy.findOne({ policyId: req.params.id });
    if (!policy) return res.status(404).json({ success: false, message: 'Policy not found' });
    res.json({ success: true, data: policy });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST calculate premium (smart contract)
router.post('/calculate-premium', (req, res) => {
  try {
    const { insuranceType, coverageAmount, riskLevel, age, claimsHistory } = req.body;
    const execution = premiumCalc.execute({ insuranceType, coverageAmount, riskLevel, age, claimsHistory });
    res.json({ success: true, data: execution.result, gasUsed: execution.gasUsed });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create policy (writes to blockchain + MongoDB)
router.post('/', async (req, res) => {
  try {
    console.log("Incoming request:", req.body);

    const {
      holderName, holderEmail, insuranceType, coverageAmount,
      startDate, endDate, riskLevel, age, claimsHistory
    } = req.body;

    if (!holderName || !holderEmail || !insuranceType || !coverageAmount || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const premiumExecution = premiumCalc.execute({
      insuranceType,
      coverageAmount,
      riskLevel,
      age: age || 30,
      claimsHistory: claimsHistory || 0
    });

    console.log("Premium Execution:", premiumExecution);

    if (!premiumExecution || !premiumExecution.result) {
      throw new Error("Premium calculation failed");
    }

    const policyId = `POL-${uuidv4().slice(0, 8).toUpperCase()}`;
    const blockchain = getBlockchain();

    const block = blockchain.addPolicyBlock({
      policyId,
      holderName,
      insuranceType,
      premium: premiumExecution.result.monthlyPremium,
      coverageAmount,
      startDate,
      endDate,
      underwriterId: 'UW-' + Math.floor(Math.random() * 1000),
      riskScore: premiumExecution.result.riskScore
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
      holderName,
      holderEmail,
      insuranceType,
      premium: premiumExecution.result.monthlyPremium,
      coverageAmount,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: 'ACTIVE',
      riskScore: premiumExecution.result.riskScore,
      riskLevel: riskLevel || 'MEDIUM',
      blockchainHash: block.hash,
      blockIndex: block.index
    });

    res.status(201).json({ success: true, data: policy });

  } catch (err) {
    console.error("❌ ERROR:", err);
    res.status(500).json({
      success: false,
      message: err.message,
      stack: err.stack
    });
  }
});

// PUT update policy status
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const policy = await Policy.findOneAndUpdate(
      { policyId: req.params.id },
      { status },
      { new: true }
    );
    if (!policy) return res.status(404).json({ success: false, message: 'Policy not found' });
    res.json({ success: true, data: policy });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;