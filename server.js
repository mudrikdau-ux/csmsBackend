const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/reports', express.static(path.join(__dirname, 'reports')));
app.use('/invoices', express.static(path.join(__dirname, 'invoices')));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Create upload directories if they don't exist
const fs = require('fs');
const dirs = ['uploads/services', 'uploads/staff', 'reports', 'invoices', 'receipts'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/services', require('./routes/serviceRoutes'));
app.use('/api/admin-staff', require('./routes/adminStaffRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/contractors', require('./routes/contractorRoutes'));
app.use('/api/invoices', require('./routes/invoiceRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/feedbacks', require('./routes/feedbackRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/profile', require('./routes/profileRoutes'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;