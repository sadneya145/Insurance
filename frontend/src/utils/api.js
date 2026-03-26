import axios from 'axios';

// Create axios instance
const API = axios.create({
  baseURL: 'http://localhost:5000/api', // backend server
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ================= POLICY APIs =================
export const policyAPI = {
  // Get all policies
  getAll: () => API.get('/policies'),

  // Get single policy by ID
  getById: (id) => API.get(`/policies/${id}`),

  // Create new policy
  create: (data) => API.post('/policies', data),

  // Update policy status
  updateStatus: (id, status) =>
    API.put(`/policies/${id}/status`, { status }),

  // Calculate premium using smart contract
  calculatePremium: (data) =>
    API.post('/policies/calculate-premium', data),
};

// ================= CLAIM APIs =================
export const claimAPI = {
  // Get all claims
  getAll: () => API.get('/claims'),

  // Get claim by ID
  getById: (id) => API.get(`/claims/${id}`),

  // Create new claim
  create: (data) => API.post('/claims', data),

  // Approve/Reject claim
  decide: (id, data) =>
    API.put(`/claims/${id}/decision`, data),
};

// ================= BLOCKCHAIN APIs =================
export const blockchainAPI = {
  // Get full blockchain
  getChain: () => API.get('/blockchain/chain'),

  // Get blockchain stats
  getStats: () => API.get('/blockchain/stats'),

  // Validate blockchain integrity
  validate: () => API.get('/blockchain/validate'),

  // Get block by index
  getBlock: (index) =>
    API.get(`/blockchain/block/${index}`),

  // Get blocks by type (POLICY / CLAIM / DECISION)
  getByType: (type) =>
    API.get(`/blockchain/blocks/type/${type}`),
};

export default API;