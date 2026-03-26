const Block = require('../blockchain/Block');

const DIFFICULTY = 2; // Adjustable proof-of-work difficulty

class InsuranceBlockchain {
  constructor() {
    this.chain = [this.createGenesisBlock()];
    this.difficulty = DIFFICULTY;
    this.pendingTransactions = [];
  }

  createGenesisBlock() {
    return new Block(0, new Date().toISOString(), {
      type: 'GENESIS',
      message: 'Insurance Blockchain Genesis Block',
      network: 'InsureChain v1.0'
    }, '0');
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  addBlock(data) {
    const newBlock = new Block(
      this.chain.length,
      new Date().toISOString(),
      data,
      this.getLatestBlock().hash
    );
    newBlock.mineBlock(this.difficulty);
    this.chain.push(newBlock);
    return newBlock;
  }

  // Add insurance policy to blockchain
  addPolicyBlock(policyData) {
    const blockData = {
      type: 'POLICY_ISSUANCE',
      policyId: policyData.policyId,
      holderName: policyData.holderName,
      insuranceType: policyData.insuranceType,
      premium: policyData.premium,
      coverageAmount: policyData.coverageAmount,
      startDate: policyData.startDate,
      endDate: policyData.endDate,
      underwriterId: policyData.underwriterId,
      riskScore: policyData.riskScore,
      timestamp: new Date().toISOString()
    };
    return this.addBlock(blockData);
  }

  // Add claim to blockchain
  addClaimBlock(claimData) {
    const blockData = {
      type: 'CLAIM_SUBMITTED',
      claimId: claimData.claimId,
      policyId: claimData.policyId,
      claimantName: claimData.claimantName,
      claimAmount: claimData.claimAmount,
      incidentDate: claimData.incidentDate,
      description: claimData.description,
      evidence: claimData.evidence || [],
      status: 'PENDING',
      timestamp: new Date().toISOString()
    };
    return this.addBlock(blockData);
  }

  // Record claim decision
  addClaimDecisionBlock(decisionData) {
    const blockData = {
      type: 'CLAIM_DECISION',
      claimId: decisionData.claimId,
      decision: decisionData.decision, // APPROVED | REJECTED | PARTIAL
      approvedAmount: decisionData.approvedAmount,
      reason: decisionData.reason,
      adjusterName: decisionData.adjusterName,
      timestamp: new Date().toISOString()
    };
    return this.addBlock(blockData);
  }

  // Smart Contract: Auto-approve micro-claims
  executeSmartContract(claimData) {
    const AUTO_APPROVE_THRESHOLD = 5000; // Auto-approve claims under $5,000
    const result = {
      executed: true,
      claimId: claimData.claimId,
      contractType: 'AUTO_CLAIM_SETTLEMENT',
      timestamp: new Date().toISOString()
    };

    if (claimData.claimAmount <= AUTO_APPROVE_THRESHOLD) {
      result.decision = 'AUTO_APPROVED';
      result.approvedAmount = claimData.claimAmount;
      result.reason = 'Smart contract auto-approval: Amount within threshold';
    } else {
      result.decision = 'MANUAL_REVIEW_REQUIRED';
      result.reason = 'Claim exceeds smart contract threshold';
    }

    const blockData = {
      type: 'SMART_CONTRACT_EXECUTION',
      ...result
    };
    const block = this.addBlock(blockData);
    return { result, block };
  }

  // Record premium payment
  addPaymentBlock(paymentData) {
    const blockData = {
      type: 'PREMIUM_PAYMENT',
      paymentId: paymentData.paymentId,
      policyId: paymentData.policyId,
      amount: paymentData.amount,
      paymentMethod: paymentData.paymentMethod,
      transactionHash: paymentData.transactionHash,
      timestamp: new Date().toISOString()
    };
    return this.addBlock(blockData);
  }

  // Validate the entire chain
  isChainValid() {
    const issues = [];
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      if (!currentBlock.isValid()) {
        issues.push({ blockIndex: i, issue: 'Hash mismatch - block tampered' });
      }

      if (currentBlock.previousHash !== previousBlock.hash) {
        issues.push({ blockIndex: i, issue: 'Chain broken - previous hash mismatch' });
      }
    }
    return { isValid: issues.length === 0, issues };
  }

  // Get all blocks of a certain type
  getBlocksByType(type) {
    return this.chain.filter(b => b.data && b.data.type === type);
  }

  // Get chain statistics
  getStats() {
    const policies = this.getBlocksByType('POLICY_ISSUANCE');
    const claims = this.getBlocksByType('CLAIM_SUBMITTED');
    const decisions = this.getBlocksByType('CLAIM_DECISION');
    const payments = this.getBlocksByType('PREMIUM_PAYMENT');
    const contracts = this.getBlocksByType('SMART_CONTRACT_EXECUTION');

    return {
      totalBlocks: this.chain.length,
      totalPolicies: policies.length,
      totalClaims: claims.length,
      totalDecisions: decisions.length,
      totalPayments: payments.length,
      smartContractExecutions: contracts.length,
      chainValidity: this.isChainValid(),
      difficulty: this.difficulty
    };
  }

  // Export chain as array
  getChainData() {
    return this.chain.map(block => ({
      index: block.index,
      timestamp: block.timestamp,
      data: block.data,
      hash: block.hash,
      previousHash: block.previousHash,
      nonce: block.nonce
    }));
  }
}

// Singleton instance
let blockchainInstance = null;

function getBlockchain() {
  if (!blockchainInstance) {
    blockchainInstance = new InsuranceBlockchain();
  }
  return blockchainInstance;
}

module.exports = { InsuranceBlockchain, getBlockchain };