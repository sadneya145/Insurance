const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Claim, Policy, BlockchainLog } = require('../Validation/models');
const { getBlockchain } = require('../proofofwork/InsuranceBlockchain');
const { AutoClaimContract, FraudDetectionContract } = require('../Validation/SmartContracts');

const autoClaimContract = new AutoClaimContract();
const fraudContract = new FraudDetectionContract();

// GET all claims
router.get('/', async (req, res) => {
  try {
    const claims = await Claim.find().sort({ createdAt: -1 });
    res.json({ success: true, data: claims, count: claims.length });
  } catch (err) {
    console.error('GET /claims error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST submit new claim
router.post('/', async (req, res) => {
  try {
    const { policyId, claimantName, claimantEmail, claimAmount, incidentDate, description } = req.body;

    // Validate request
    if (!policyId || !claimantName || !claimantEmail || !claimAmount || !incidentDate || !description) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Verify policy exists
    const policy = await Policy.findOne({ policyId });
    if (!policy) return res.status(404).json({ success: false, message: 'Policy not found' });
    if (policy.status !== 'ACTIVE') return res.status(400).json({ success: false, message: 'Policy is not active' });

    // Fraud & AutoClaim execution
    const existingClaims = await Claim.countDocuments({ policyId });
    const fraudExecution = fraudContract.execute({
      claimAmount,
      averagePreviousClaim: claimAmount * 0.8,
      claimsThisYear: existingClaims,
      daysSincePolicy: Math.floor((new Date() - policy.createdAt) / 86400000)
    });
    const autoClaimExecution = autoClaimContract.execute({
      claimAmount,
      hasEvidence: true,
      policyStatus: policy.status,
      fraudScore: fraudExecution.result.fraudScore
    });

    const claimId = `CLM-${uuidv4().slice(0, 8).toUpperCase()}`;
    const blockchain = getBlockchain();

    // Write claim block
    const claimBlock = blockchain.addClaimBlock({
      claimId, policyId, claimantName, claimAmount,
      incidentDate, description
    });

    await BlockchainLog.create({
      blockIndex: claimBlock.index, hash: claimBlock.hash,
      previousHash: claimBlock.previousHash, data: claimBlock.data,
      nonce: claimBlock.nonce, timestamp: claimBlock.timestamp
    });

    // Determine initial status
    let status = 'PENDING';
    if (fraudExecution.result.riskLevel === 'HIGH') status = 'FRAUD_FLAGGED';
    else if (autoClaimExecution.result.decision === 'AUTO_APPROVED') status = 'AUTO_APPROVED';

    // Decision block if auto-approved
    let decisionBlock = null;
    if (status === 'AUTO_APPROVED') {
      decisionBlock = blockchain.addClaimDecisionBlock({
        claimId, decision: 'APPROVED',
        approvedAmount: claimAmount,
        reason: autoClaimExecution.result.reason,
        adjusterName: 'Smart Contract (Automated)'
      });
      await BlockchainLog.create({
        blockIndex: decisionBlock.index, hash: decisionBlock.hash,
        previousHash: decisionBlock.previousHash, data: decisionBlock.data,
        nonce: decisionBlock.nonce, timestamp: decisionBlock.timestamp
      });
    }

    // Save claim in DB
    const claim = await Claim.create({
      claimId, policyId, claimantName, claimantEmail, claimAmount,
      incidentDate: new Date(incidentDate), description, status,
      approvedAmount: status === 'AUTO_APPROVED' ? claimAmount : undefined,
      fraudScore: fraudExecution.result.fraudScore,
      fraudFlags: fraudExecution.result.flags,
      smartContractResult: { fraud: fraudExecution.result, autoClaim: autoClaimExecution.result },
      blockchainHash: claimBlock.hash,
      blockIndex: claimBlock.index,
      decisionBlockHash: decisionBlock?.hash
    });

    res.status(201).json({
      success: true,
      data: claim,
      blockchain: { claimBlock: { index: claimBlock.index, hash: claimBlock.hash } },
      smartContracts: {
        fraudDetection: fraudExecution.result,
        autoClaim: autoClaimExecution.result
      }
    });
  } catch (err) {
    console.error('POST /claims error:', err);
    res.status(500).json({ success: false, message: err.message, stack: err.stack });
  }
});

module.exports = router;