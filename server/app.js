const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const config = require('./config/config');

const app = express();

// Security Middleware
app.use(helmet());

// CORS Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://salescallagent.my',
  'https://www.salescallagent.my'
];
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // In development, allow all localhost variants
    if (process.env.NODE_ENV === 'development' || origin.includes('localhost')) {
      return callback(null, true);
    }
    
    // In production, check against allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logging Middleware - only log errors to reduce CPU usage
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  // In production, only log errors
  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400
  }));
}

// Parsing Middleware with limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Routes
app.use('/api', routes);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'Creativeprocess.io API' });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;