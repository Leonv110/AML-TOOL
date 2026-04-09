const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security Hardening
app.use(helmet()); // Sets various HTTP headers for security

// Rate Limiting to prevent brute force
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use('/api/', limiter);

// Middleware
app.use(cors({
  origin: '*', // In production, replace with specific origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(express.json({ limit: '10mb' })); // Reduced limit for safety

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/rules', require('./routes/rules'));
app.use('/api/investigations', require('./routes/investigations'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/reports', require('./routes/reports'));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'gafa-api-server',
    timestamp: new Date().toISOString()
  });
});

// Keep-Alive Mechanism to prevent Render from spinning down free tier services
const axios = require('axios');
function keepAlive() {
  const nodeUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  axios.get(`${nodeUrl}/health`)
    .then(res => console.log(`[Keep-Alive] Node API Pinged - Status: ${res.status}`))
    .catch(err => console.log(`[Keep-Alive] Node API Ping Failed:`, err.message));

  const amlUrl = process.env.AML_BACKEND_URL || process.env.VITE_AML_BACKEND_URL;
  if (amlUrl) {
    axios.get(`${amlUrl}/health`)
      .then(res => console.log(`[Keep-Alive] AML Backend Pinged - Status: ${res.status}`))
      .catch(err => console.log(`[Keep-Alive] AML Backend Ping Failed:`, err.message));
  }
}
// Run every 10 minutes (600,000 ms)
setInterval(keepAlive, 10 * 60 * 1000);

// Start
app.listen(PORT, () => {
  console.log(`🚀 GAFA API Server running on http://localhost:${PORT}`);
  // Ping immediately on boot if in production
  if (process.env.NODE_ENV === 'production') keepAlive();
});
