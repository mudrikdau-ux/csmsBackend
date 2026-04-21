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


// ADMIN ONLY
router.post('/', verifyAdmin, uploadStaff.single('photo'), addStaff);
router.put('/:id', verifyAdmin, uploadStaff.single('photo'), editStaff);
router.delete('/:id', verifyAdmin, removeStaff);

// GET
router.get('/', verifyAdmin, getStaff);
router.get('/:id', verifyAdmin, getSingleStaff);

module.exports = router;