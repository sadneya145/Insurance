const express = require('express');
const router = express.Router();
const { getBlockchain } = require('../proofofwork/InsuranceBlockchain');
const { BlockchainLog } = require('../Validation/models');

// GET full chain data
router.get('/chain', (req, res) => {
  const blockchain = getBlockchain();
  res.json({ success: true, data: blockchain.getChainData(), length: blockchain.chain.length });
});

// GET chain statistics
router.get('/stats', async (req, res) => {
  const blockchain = getBlockchain();
  const stats = blockchain.getStats();
  const dbBlocks = await BlockchainLog.countDocuments();
  res.json({ success: true, data: { ...stats, dbPersistedBlocks: dbBlocks } });
});

// GET validate chain integrity
router.get('/validate', (req, res) => {
  const blockchain = getBlockchain();
  const validation = blockchain.isChainValid();
  res.json({ success: true, data: validation });
});

// GET specific block by index
router.get('/block/:index', (req, res) => {
  const blockchain = getBlockchain();
  const idx = parseInt(req.params.index);
  if (idx < 0 || idx >= blockchain.chain.length) {
    return res.status(404).json({ success: false, message: 'Block not found' });
  }
  const block = blockchain.chain[idx];
  res.json({ success: true, data: { index: block.index, timestamp: block.timestamp, data: block.data, hash: block.hash, previousHash: block.previousHash, nonce: block.nonce } });
});

// GET blocks by type
router.get('/blocks/type/:type', (req, res) => {
  const blockchain = getBlockchain();
  const blocks = blockchain.getBlocksByType(req.params.type.toUpperCase());
  res.json({ success: true, data: blocks, count: blocks.length });
});

module.exports = router;