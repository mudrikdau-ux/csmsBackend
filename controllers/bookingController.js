const {
    createBooking,
    getBookingById,
    getAllBookings,
    updateBookingStatus,
    getBookingCount,
    getBookingsByUserId
} = require('../models/bookingModel');

const { getServiceById } = require('../models/serviceModel');

// ==================== CREATE BOOKING (AUTHENTICATED ONLY) ====================

const createBookingController = async (req, res) => {
    try {
        const data = req.body;

        // ✅ Get user from token (required)
        const userId = req.user.id;
        const userEmail = req.user.email;

        // ✅ VALIDATE: Check if service exists
        const serviceResult = await getServiceById(data.service_id);
        
        if (!serviceResult || serviceResult.length === 0) {
            return res.status(404).json({ 
                message: 'Service not found',
                service_id: data.service_id,
                hint: 'Please check available services at GET /api/services'
            });
        }

        const service = serviceResult[0];

        // ✅ Check for duplicate booking (prevent double submission)
        const duplicateBooking = await getBookingsByUserId(userId, {
            service_id: data.service_id,
            service_date: data.service_date,
            status: 'pending'
        });

        if (duplicateBooking.length > 0) {
            return res.status(409).json({
                message: 'You already have a pending booking for this service on this date',
                existing_booking_id: duplicateBooking[0].id,
                hint: 'Please wait for the existing booking to be processed or cancel it first'
            });
        }

        // ✅ Use actual service price per hour
        const pricePerHour = data.price_per_hour || (parseFloat(service.price) / service.duration * 60) || 5000;

        // Price calculation
        const base = data.cleaners * data.hours * pricePerHour;

        let extras = 0;
        if (data.materials === true || data.materials === 'true') {
            extras += 10000;
        }
        if (data.payment_method === 'cash') {
            extras += 5000;
        }

        let discount = 0;
        if (data.frequency === 'weekly') {
            discount = base * 0.05; // 5% discount for weekly bookings
        }

        const total = base + extras - discount;

        // Create booking with authenticated user
        const result = await createBooking({
            ...data,
            user_id: userId,          // ✅ Auto-set from token
            email: userEmail,         // ✅ Use logged-in user's email
            first_name: data.first_name,  // Can still override names
            last_name: data.last_name,
            base_price: base,
            extras,
            discount,
            total_price: total,
            status: 'pending'
        });

        const bookingId = result.insertId;

        res.status(201).json({
            message: 'Booking created successfully',
            booking: {
                id: bookingId,
                user_id: userId,
                service: {
                    id: service.id,
                    name: service.name,
                    price: parseFloat(service.price),
                    duration: service.duration,
                    location: service.location
                },
                cleaners: data.cleaners,
                hours: data.hours,
                frequency: data.frequency,
                materials_provided: data.materials || false,
                property_type: data.property_type,
                address: data.address,
                city: data.city,
                payment_method: data.payment_method,
                pricing: {
                    base_price: base,
                    extras: extras,
                    discount: discount,
                    total_price: total
                },
                status: 'pending',
                service_date: data.service_date,
                service_time: data.service_time
            }
        });

    } catch (error) {
        console.error('Create booking error:', error);
        res.status(500).json({ message: 'Failed to create booking', error: error.message });
    }
};

// ==================== GET MY BOOKINGS ====================

const getMyBookings = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const filters = {
            status: req.query.status,
            date_from: req.query.date_from,
            date_to: req.query.date_to,
            limit: req.query.limit || 50,
            offset: req.query.offset || 0
        };

        const bookings = await getBookingsByUserId(userId, filters);
        const countResult = await getBookingCount({ 
            status: req.query.status, 
            user_id: userId 
        });
        const total = countResult[0].count;

        // Enrich bookings with service names
        const enrichedBookings = await Promise.all(
            bookings.map(async (b) => {
                let serviceName = 'Unknown Service';
                let serviceLocation = null;
                
                if (b.service_id) {
                    try {
                        const serviceResult = await getServiceById(b.service_id);
                        if (serviceResult && serviceResult.length > 0) {
                            serviceName = serviceResult[0].name;
                            serviceLocation = serviceResult[0].location;
                        }
                    } catch (err) {
                        // Silently fail
                    }
                }

                return {
                    id: b.id,
                    service: {
                        id: b.service_id,
                        name: serviceName,
                        location: serviceLocation
                    },
                    property_type: b.property_type,
                    address: b.address,
                    city: b.city,
                    service_date: b.service_date,
                    service_time: b.service_time,
                    frequency: b.frequency,
                    total_price: parseFloat(b.total_price),
                    payment_method: b.payment_method,
                    status: b.status,
                    created_at: b.created_at
                };
            })
        );

        res.json({
            success: true,
            total,
            count: bookings.length,
            bookings: enrichedBookings
        });

    } catch (error) {
        console.error('Get my bookings error:', error);
        res.status(500).json({ message: 'Failed to fetch your bookings', error: error.message });
    }
};

// ==================== GET RECEIPT (Owner or Admin) ====================

const getReceipt = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid booking ID' });
        }

        const booking = await getBookingById(id);

        if (booking.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const b = booking[0];

        // ✅ Check if user is owner or admin
        if (req.user.role !== 'admin' && b.user_id !== req.user.id) {
            return res.status(403).json({ 
                message: 'Access denied. You can only view your own bookings.' 
            });
        }

        // Get service details for the booking
        let serviceDetails = null;
        if (b.service_id) {
            const serviceResult = await getServiceById(b.service_id);
            if (serviceResult && serviceResult.length > 0) {
                const s = serviceResult[0];
                serviceDetails = {
                    id: s.id,
                    name: s.name,
                    price: parseFloat(s.price),
                    duration: s.duration,
                    location: s.location
                };
            }
        }

        res.json({
            receipt: {
                id: b.id,
                customer: {
                    name: `${b.first_name} ${b.last_name}`,
                    email: b.email,
                    phone: b.phone
                },
                service: serviceDetails || {
                    id: b.service_id,
                    note: 'Service details not available'
                },
                booking_details: {
                    property_type: b.property_type,
                    address: b.address,
                    city: b.city,
                    landmark: b.landmark,
                    service_date: b.service_date,
                    service_time: b.service_time,
                    frequency: b.frequency
                },
                cleaning_details: {
                    cleaners: b.cleaners,
                    hours: b.hours,
                    materials_provided: b.materials ? 'Yes' : 'No',
                    instructions: b.instructions || 'None'
                },
                pricing: {
                    base_price: parseFloat(b.base_price),
                    extras: parseFloat(b.extras),
                    discount: parseFloat(b.discount),
                    total_price: parseFloat(b.total_price),
                    payment_method: b.payment_method
                },
                status: b.status,
                created_at: b.created_at
            }
        });

    } catch (error) {
        console.error('Get receipt error:', error);
        res.status(500).json({ message: 'Failed to fetch receipt', error: error.message });
    }
};

// ==================== GET ALL BOOKINGS (ADMIN ONLY) ====================

const getAllBookingsController = async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            date_from: req.query.date_from,
            date_to: req.query.date_to,
            user_id: req.query.user_id,
            limit: req.query.limit || 50,
            offset: req.query.offset || 0
        };

        const bookings = await getAllBookings(filters);
        const countResult = await getBookingCount({ status: req.query.status });
        const total = countResult[0].count;

        // Enrich bookings with service names
        const enrichedBookings = await Promise.all(
            bookings.map(async (b) => {
                let serviceName = 'Unknown Service';
                if (b.service_id) {
                    try {
                        const serviceResult = await getServiceById(b.service_id);
                        if (serviceResult && serviceResult.length > 0) {
                            serviceName = serviceResult[0].name;
                        }
                    } catch (err) {
                        // Silently fail
                    }
                }

                return {
                    id: b.id,
                    user_id: b.user_id,
                    customer: {
                        name: `${b.first_name} ${b.last_name}`,
                        email: b.email,
                        phone: b.phone
                    },
                    service: {
                        id: b.service_id,
                        name: serviceName
                    },
                    property_type: b.property_type,
                    address: b.address,
                    city: b.city,
                    service_date: b.service_date,
                    service_time: b.service_time,
                    total_price: parseFloat(b.total_price),
                    payment_method: b.payment_method,
                    status: b.status,
                    created_at: b.created_at
                };
            })
        );

        res.json({
            success: true,
            total,
            count: bookings.length,
            bookings: enrichedBookings
        });

    } catch (error) {
        console.error('Get bookings error:', error);
        res.status(500).json({ message: 'Failed to fetch bookings', error: error.message });
    }
};

// ==================== UPDATE BOOKING STATUS (ADMIN ONLY) ====================

const updateBookingStatusController = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid booking ID' });
        }

        const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                message: 'Invalid status',
                valid_statuses: validStatuses
            });
        }

        // Check if booking exists
        const booking = await getBookingById(id);
        if (booking.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        await updateBookingStatus(id, status);

        res.json({ 
            success: true,
            message: 'Booking status updated successfully',
            booking: {
                id: parseInt(id),
                status: status,
                previous_status: booking[0].status
            }
        });

    } catch (error) {
        console.error('Update booking status error:', error);
        res.status(500).json({ message: 'Failed to update booking status', error: error.message });
    }
};

// ==================== GET BOOKING STATISTICS (ADMIN ONLY) ====================

const getBookingStats = async (req, res) => {
    try {
        const totalBookings = await getBookingCount({});
        const pendingBookings = await getBookingCount({ status: 'pending' });
        const confirmedBookings = await getBookingCount({ status: 'confirmed' });
        const completedBookings = await getBookingCount({ status: 'completed' });
        const cancelledBookings = await getBookingCount({ status: 'cancelled' });

        res.json({
            success: true,
            statistics: {
                total: totalBookings[0].count,
                pending: pendingBookings[0].count,
                confirmed: confirmedBookings[0].count,
                completed: completedBookings[0].count,
                cancelled: cancelledBookings[0].count
            }
        });

    } catch (error) {
        console.error('Get booking stats error:', error);
        res.status(500).json({ message: 'Failed to fetch statistics', error: error.message });
    }
};

module.exports = {
    createBookingController,
    getReceipt,
    getAllBookingsController,
    updateBookingStatusController,
    getBookingStats,
    getMyBookings
};