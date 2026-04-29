const express = require('express');
const router = express.Router();

const uploadStaff = require('../config/uploadStaff');
const { verifyAdmin } = require('../middleware/auth');

const {
    addStaff,
    getStaff,
    getSingleStaff,
    editStaff,
    removeStaff
} = require('../controllers/adminStaffController');

// All routes require admin authentication
router.use(verifyAdmin);

// Routes
router.post('/', uploadStaff.single('photo'), addStaff);
router.get('/', getStaff);
router.get('/:id', getSingleStaff);
router.put('/:id', uploadStaff.single('photo'), editStaff);
router.delete('/:id', removeStaff);

module.exports = router;