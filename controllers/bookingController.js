const { createBooking, getBookingById } = require('../models/bookingModel');


// ================= CREATE BOOKING =================
const createBookingController = (req, res) => {
    try {
        const data = req.body;

        // 🔥 PRICE CALCULATION
        let base = data.cleaners * data.hours * data.price_per_hour;

        let extras = 0;
        if (data.materials === true) extras += 10000;
        if (data.payment_method === 'cash') extras += 5000;

        let discount = 0;
        if (data.frequency === 'weekly') {
            discount = base * 0.05;
        }

        const total = base + extras - discount;

        createBooking({
            ...data,
            base_price: base,
            extras,
            discount,
            total_price: total
        }, (err, result) => {
            if (err) return res.status(500).json(err);

            res.status(201).json({
                message: 'Booking created successfully',
                booking_id: result.insertId,
                total
            });
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// ================= GET RECEIPT =================
const getReceipt = (req, res) => {
    const { id } = req.params;

    getBookingById(id, (err, result) => {
        if (err) return res.status(500).json(err);

        if (result.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        res.json(result[0]);
    });
};


module.exports = {
    createBookingController,
    getReceipt
};