const express = require('express');
const router = express.Router();

const upload = require('../config/upload');
const { verifyAdmin } = require('../middleware/auth');

const {
    addService,
    getServices,
    getSingleService,
    editService,
    removeService
} = require('../controllers/serviceController');


// ADMIN ONLY
router.post('/', verifyAdmin, upload.single('image'), addService);
router.put('/:id', verifyAdmin, upload.single('image'), editService);
router.delete('/:id', verifyAdmin, removeService);

// PUBLIC
router.get('/', getServices);
router.get('/:id', getSingleService);

module.exports = router;