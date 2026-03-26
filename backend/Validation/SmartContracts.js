/**
 * Smart Contracts for Insurance
 * Simulates Ethereum-style smart contract logic in pure JS
 */

class SmartContract {
  constructor(contractId, type, terms) {
    this.contractId = contractId;
    this.type = type;
    this.terms = terms;
    this.state = 'ACTIVE';
    this.executions = [];
    this.createdAt = new Date().toISOString();
  }

  execute(input) {
    const execution = {
      executionId: `exec_${Date.now()}`,
      input,
      timestamp: new Date().toISOString(),
      result: null,
      gasUsed: Math.floor(Math.random() * 1000) + 500 // simulated gas
    };

    try {
      execution.result = this._runLogic(input);
      execution.status = 'SUCCESS';
    } catch (err) {
      execution.result = { error: err.message };
      execution.status = 'FAILED';
    }

    this.executions.push(execution);
    return execution;
  }

  _runLogic(input) {
    throw new Error('Abstract method: override in subclass');
  }
}

// ---- Auto-Claim Settlement Contract ----
class AutoClaimContract extends SmartContract {
  constructor() {
    super('CONTRACT_AUTO_CLAIM_001', 'AUTO_CLAIM_SETTLEMENT', {
      autoApproveLimit: 5000,
      requireEvidenceAbove: 1000,
      fraudCheckThreshold: 10000,
      payoutDelay: 0 // days, 0 = instant
    });
  }

  _runLogic({ claimAmount, hasEvidence, policyStatus, fraudScore }) {
    if (policyStatus !== 'ACTIVE') {
      return { approved: false, reason: 'Policy is not active', code: 'POLICY_INACTIVE' };
    }
    if (fraudScore > 75) {
      return { approved: false, reason: 'High fraud risk detected', code: 'FRAUD_RISK', flagged: true };
    }
    if (claimAmount > this.terms.requireEvidenceAbove && !hasEvidence) {
      return { approved: false, reason: 'Evidence required for claims above $1,000', code: 'EVIDENCE_REQUIRED' };
    }
    if (claimAmount <= this.terms.autoApproveLimit) {
      return {
        approved: true,
        approvedAmount: claimAmount,
        reason: 'Auto-approved within smart contract threshold',
        code: 'AUTO_APPROVED',
        payout: claimAmount
      };
    }
    return {
      approved: null,
      reason: 'Manual underwriter review required',
      code: 'MANUAL_REVIEW',
      escalated: true
    };
  }
}

// ---- Premium Calculator Contract ----
class PremiumCalculatorContract extends SmartContract {
  constructor() {
    super('CONTRACT_PREMIUM_CALC_001', 'PREMIUM_CALCULATOR', {
      baseRates: {
        HEALTH: 0.04,
        AUTO: 0.035,
        LIFE: 0.025,
        PROPERTY: 0.015,
        TRAVEL: 0.02
      },
      riskMultipliers: {
        LOW: 0.8,
        MEDIUM: 1.0,
        HIGH: 1.5,
        VERY_HIGH: 2.2
      }
    });
  }

  _runLogic({ insuranceType, coverageAmount, riskLevel, age, claimsHistory }) {
    const baseRate = this.terms.baseRates[insuranceType] || 0.03;
    const riskMultiplier = this.terms.riskMultipliers[riskLevel] || 1.0;
    const ageModifier = age > 60 ? 1.3 : age > 45 ? 1.1 : 1.0;
    const claimsModifier = 1 + (claimsHistory || 0) * 0.1;

    const annualPremium = coverageAmount * baseRate * riskMultiplier * ageModifier * claimsModifier;
    const monthlyPremium = annualPremium / 12;

    return {
      annualPremium: Math.round(annualPremium * 100) / 100,
      monthlyPremium: Math.round(monthlyPremium * 100) / 100,
      breakdown: {
        baseRate,
        riskMultiplier,
        ageModifier,
        claimsModifier
      },
      riskScore: Math.round(riskMultiplier * ageModifier * claimsModifier * 33.3)
    };
  }
}

// ---- Fraud Detection Contract ----
class FraudDetectionContract extends SmartContract {
  constructor() {
    super('CONTRACT_FRAUD_001', 'FRAUD_DETECTION', {
      redFlags: ['DUPLICATE_CLAIM', 'RAPID_CLAIMS', 'SUSPICIOUS_AMOUNT', 'INCONSISTENT_DOCS'],
      maxClaimsPerYear: 3,
      suspiciousAmountMultiple: 5
    });
  }

  _runLogic({ claimAmount, averagePreviousClaim, claimsThisYear, daysSincePolicy }) {
    let fraudScore = 0;
    const flags = [];

    // New policy with immediate large claim
    if (daysSincePolicy < 30 && claimAmount > 10000) {
      fraudScore += 35;
      flags.push('EARLY_LARGE_CLAIM');
    }

    // Claim amount unusually high
    if (averagePreviousClaim && claimAmount > averagePreviousClaim * this.terms.suspiciousAmountMultiple) {
      fraudScore += 25;
      flags.push('SUSPICIOUS_AMOUNT');
    }

    // Too many claims this year
    if (claimsThisYear >= this.terms.maxClaimsPerYear) {
      fraudScore += 20;
      flags.push('RAPID_CLAIMS');
    }

    // Round number claims (suspicious pattern)
    if (claimAmount % 1000 === 0 && claimAmount > 5000) {
      fraudScore += 10;
      flags.push('ROUND_AMOUNT_PATTERN');
    }

    return {
      fraudScore: Math.min(fraudScore, 100),
      riskLevel: fraudScore > 60 ? 'HIGH' : fraudScore > 30 ? 'MEDIUM' : 'LOW',
      flags,
      recommendation: fraudScore > 60
        ? 'REJECT_AND_INVESTIGATE'
        : fraudScore > 30 ? 'MANUAL_REVIEW' : 'PROCEED'
    };
  }
}

// ---- Reinsurance Trigger Contract ----
class ReinsuranceTriggerContract extends SmartContract {
  constructor() {
    super('CONTRACT_REINSURANCE_001', 'REINSURANCE_TRIGGER', {
      retentionLimit: 500000,      // Insurer retains up to this amount
      catastropheThreshold: 5000000 // Triggers catastrophe reinsurance
    });
  }

  _runLogic({ totalExposure, singleRiskAmount }) {
    const exceedance = Math.max(0, singleRiskAmount - this.terms.retentionLimit);
    const isCatastrophe = totalExposure > this.terms.catastropheThreshold;

    return {
      requiresReinsurance: exceedance > 0 || isCatastrophe,
      retainedAmount: Math.min(singleRiskAmount, this.terms.retentionLimit),
      cededAmount: exceedance,
      catastropheTriggered: isCatastrophe,
      reinsuranceType: isCatastrophe ? 'CATASTROPHE_XL' : exceedance > 0 ? 'EXCESS_OF_LOSS' : 'NONE'
    };
  }
}

module.exports = {
  SmartContract,
  AutoClaimContract,
  PremiumCalculatorContract,
  FraudDetectionContract,
  ReinsuranceTriggerContract
};