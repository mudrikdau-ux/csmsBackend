const jwt = require('jsonwebtoken');
const db = require('../config/db');

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Check if token is blacklisted
        const blacklisted = await db.query(
            `SELECT id FROM token_blacklist WHERE token = ? AND expires_at > NOW()`,
            [token]
        );

        if (blacklisted.length > 0) {
            return res.status(401).json({ message: 'Token has been invalidated. Please login again.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        req.token = token;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token has expired. Please login again.' });
        }
        return res.status(401).json({ message: 'Invalid token' });
    }
};

const verifyAdmin = async (req, res, next) => {
    await verifyToken(req, res, () => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }
        next();
    });
};

const verifyStaff = async (req, res, next) => {
    await verifyToken(req, res, () => {
        if (req.user.role !== 'staff') {
            return res.status(403).json({ message: 'Access denied. Staff only.' });
        }
        next();
    });
};

module.exports = { verifyToken, verifyAdmin, verifyStaff };