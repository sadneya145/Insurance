/**
 * Seed script — populates MongoDB + blockchain with demo data
 * Run: node scripts/seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { Policy, Claim, BlockchainLog } = require('../models');
const { getBlockchain } = require('../blockchain/InsuranceBlockchain');
const { PremiumCalculatorContract, FraudDetectionContract, AutoClaimContract } = require('../blockchain/SmartContracts');

const premiumCalc = new PremiumCalculatorContract();
const fraudDet = new FraudDetectionContract();
const autoClaim = new AutoClaimContract();

const DEMO_POLICIES = [
  { holderName: 'Priya Sharma', holderEmail: 'priya@example.com', insuranceType: 'HEALTH', coverageAmount: 500000, riskLevel: 'MEDIUM', age: 34 },
  { holderName: 'Rahul Mehta', holderEmail: 'rahul@example.com', insuranceType: 'AUTO', coverageAmount: 200000, riskLevel: 'HIGH', age: 28 },
  { holderName: 'Anita Patel', holderEmail: 'anita@example.com', insuranceType: 'LIFE', coverageAmount: 1000000, riskLevel: 'LOW', age: 45 },
  { holderName: 'Vikram Singh', holderEmail: 'vikram@example.com', insuranceType: 'PROPERTY', coverageAmount: 750000, riskLevel: 'MEDIUM', age: 52 },
  { holderName: 'Deepika Nair', holderEmail: 'deepika@example.com', insuranceType: 'TRAVEL', coverageAmount: 100000, riskLevel: 'LOW', age: 30 },
];

async function seed() {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/insurance_blockchain';
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing
    await Policy.deleteMany({});
    await Claim.deleteMany({});
    await BlockchainLog.deleteMany({});
    console.log('🗑️  Cleared existing data');

    const blockchain = getBlockchain();

    // Save genesis block
    const genesis = blockchain.chain[0];
    await BlockchainLog.create({
      blockIndex: genesis.index, hash: genesis.hash,
      previousHash: genesis.previousHash, data: genesis.data,
      nonce: genesis.nonce, timestamp: genesis.timestamp
    });

    // Seed policies
    for (const p of DEMO_POLICIES) {
      const policyId = `POL-${uuidv4().slice(0, 8).toUpperCase()}`;
      const premResult = premiumCalc.execute({ ...p, claimsHistory: 0 });

      const start = new Date();
      const end = new Date(); end.setFullYear(end.getFullYear() + 1);

      const block = blockchain.addPolicyBlock({
        policyId, holderName: p.holderName, insuranceType: p.insuranceType,
        premium: premResult.result.monthlyPremium, coverageAmount: p.coverageAmount,
        startDate: start.toISOString(), endDate: end.toISOString(),
        underwriterId: `UW-${Math.floor(Math.random() * 999)}`,
        riskScore: premResult.result.riskScore
      });

      await BlockchainLog.create({ blockIndex: block.index, hash: block.hash, previousHash: block.previousHash, data: block.data, nonce: block.nonce, timestamp: block.timestamp });

      const policy = await Policy.create({
        policyId, holderName: p.holderName, holderEmail: p.holderEmail,
        insuranceType: p.insuranceType, premium: premResult.result.monthlyPremium,
        coverageAmount: p.coverageAmount, startDate: start, endDate: end,
        status: 'ACTIVE', riskScore: premResult.result.riskScore, riskLevel: p.riskLevel,
        blockchainHash: block.hash, blockIndex: block.index
      });
      console.log(`  📋 Policy: ${policyId} — ${p.holderName} (${p.insuranceType}) — Block #${block.index}`);

      // Add a demo claim for 3 of the policies
      if (DEMO_POLICIES.indexOf(p) < 3) {
        const claimAmount = Math.floor(Math.random() * 8000) + 1000;
        const claimId = `CLM-${uuidv4().slice(0, 8).toUpperCase()}`;

        const fraudResult = fraudDet.execute({ claimAmount, averagePreviousClaim: claimAmount * 0.8, claimsThisYear: 0, daysSincePolicy: 90 });
        const autoResult = autoClaim.execute({ claimAmount, hasEvidence: true, policyStatus: 'ACTIVE', fraudScore: fraudResult.result.fraudScore });

        const claimBlock = blockchain.addClaimBlock({ claimId, policyId: policy.policyId, claimantName: p.holderName, claimAmount, incidentDate: new Date().toISOString(), description: `Demo claim for ${p.insuranceType} policy` });
        await BlockchainLog.create({ blockIndex: claimBlock.index, hash: claimBlock.hash, previousHash: claimBlock.previousHash, data: claimBlock.data, nonce: claimBlock.nonce, timestamp: claimBlock.timestamp });

        let status = autoResult.result.decision === 'AUTO_APPROVED' ? 'AUTO_APPROVED' : 'PENDING';

        await Claim.create({
          claimId, policyId: policy.policyId, claimantName: p.holderName, claimantEmail: p.holderEmail,
          claimAmount, incidentDate: new Date(), description: `Demo claim for ${p.insuranceType}`, status,
          approvedAmount: status === 'AUTO_APPROVED' ? claimAmount : undefined,
          fraudScore: fraudResult.result.fraudScore, fraudFlags: fraudResult.result.flags,
          smartContractResult: { fraud: fraudResult.result, autoClaim: autoResult.result },
          blockchainHash: claimBlock.hash, blockIndex: claimBlock.index
        });
        console.log(`  ⚡ Claim: ${claimId} — $${claimAmount} — ${status} — Block #${claimBlock.index}`);
      }
    }

    const stats = blockchain.getStats();
    console.log('\n📊 Blockchain Stats:', stats);
    console.log('\n✅ Seed complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

seed();