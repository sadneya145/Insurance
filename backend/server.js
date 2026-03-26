const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
// require('dotenv').config();

const app = express();
const PORT = 5000;
const MONGO_URI ='mongodb://root:root@ac-a2vcxk0-shard-00-00.ghkzoew.mongodb.net:27017,ac-a2vcxk0-shard-00-01.ghkzoew.mongodb.net:27017,ac-a2vcxk0-shard-00-02.ghkzoew.mongodb.net:27017/?ssl=true&replicaSet=atlas-xdpfeg-shard-0&authSource=admin&appName=Cluster0';

// Middleware
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/policies', require('./Validation/routes/policies'));
app.use('/api/claims', require('./blockchainWrites/claim'));
app.use('/api/blockchain', require('./blockchainWrites/blockchain'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Insurance Blockchain API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Connect to MongoDB and start server
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected:', MONGO_URI);
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🔗 Blockchain API ready`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

module.exports = app;