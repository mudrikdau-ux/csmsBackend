const express = require('express');
const router = express.Router();

const upload = require('../config/upload');
const { verifyAdmin, verifyToken } = require('../middleware/auth');

const {
    addService,
    getServices,
    getSingleService,
    editService,
    removeService
} = require('../controllers/serviceController');

// Public routes
router.get('/', getServices);
router.get('/:id', getSingleService);

// Admin only routes
router.post('/', verifyAdmin, upload.single('image'), addService);
router.put('/:id', verifyAdmin, upload.single('image'), editService);
router.delete('/:id', verifyAdmin, removeService);

module.exports = router;