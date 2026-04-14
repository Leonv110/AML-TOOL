const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// --- CORS must come FIRST — before helmet or any other middleware ---
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://gafa-sigma.vercel.app',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (curl, mobile apps, Render health checks)
    if (!origin) return callback(null, true);
    // Allow any origin that matches our list, or allow all if wildcard
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    // Also allow any *.vercel.app subdomain
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    return callback(null, true); // permissive for now — tighten in production
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Handle preflight OPTIONS requests explicitly
app.options('*', cors());

// Security Hardening — after CORS so it doesn't override CORS headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Rate Limiting — generous enough for bulk data ingestion
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // 2000 requests per window (needed for 10K+ row ingestion in batches)
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use('/api/', limiter);

app.use(express.json({ limit: '50mb' })); // Allow large payloads for bulk ingestion

// --- Swagger API Documentation ---
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'GAFA AML API Documentation',
}));
// Serve raw OpenAPI spec as JSON
app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));

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
app.use('/api/countries', require('./routes/countries'));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'gafa-api-server',
    timestamp: new Date().toISOString()
  });
});

// --- Centralized Error Handler (must be AFTER all routes) ---
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

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
