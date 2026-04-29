const express = require('express');
const router = express.Router();

const {
    createBookingController,
    getReceipt
} = require('../controllers/bookingController');

// CREATE BOOKING
router.post('/', createBookingController);

// GET RECEIPT
router.get('/:id', getReceipt);

module.exports = router;