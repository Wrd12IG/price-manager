const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Security headers
app.use(compression()); // Compress responses
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
}));
app.use(morgan('dev')); // Logging
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Import routes
const suppliersRoutes = require('./routes/suppliers');
const mappingsRoutes = require('./routes/mappings');
const pricingRulesRoutes = require('./routes/pricing-rules');
const configurationRoutes = require('./routes/configuration');
const schedulerRoutes = require('./routes/scheduler');
const dashboardRoutes = require('./routes/dashboard');

// API Routes
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/mappings', mappingsRoutes);
app.use('/api/pricing-rules', pricingRulesRoutes);
app.use('/api/config', configurationRoutes);
app.use('/api/scheduler', schedulerRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'E-commerce Price Management API',
        version: '1.0.0',
        endpoints: {
            suppliers: '/api/suppliers',
            mappings: '/api/mappings',
            pricingRules: '/api/pricing-rules',
            configuration: '/api/config',
            scheduler: '/api/scheduler',
            dashboard: '/api/dashboard',
            health: '/health'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
        error: {
            message,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: {
            message: 'Endpoint not found',
            path: req.path
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║  E-commerce Price Management System - Backend API    ║
║  Server running on port ${PORT}                         ║
║  Environment: ${process.env.NODE_ENV || 'development'}                      ║
╚═══════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

module.exports = app;
