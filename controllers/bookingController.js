const {
    createBooking,
    getBookingById,
    getAllBookings,
    getBookingsByUserId,
    updateBookingStatus,
    assignStaffToBooking,
    removeStaffAssignment,
    getBookingCount,
    getStaffBookings
} = require('../models/bookingModel');

const { getServiceById } = require('../models/serviceModel');
const { getStaffById } = require('../models/userModel');
const { sendBookingConfirmation, sendBookingStatusUpdate } = require('../utils/notifications');

// ==================== CREATE BOOKING (AUTHENTICATED ONLY) ====================

const createBookingController = async (req, res) => {
    try {
        const data = req.body;
        const userId = req.user.id;
        const userEmail = req.user.email;

        // Validate service exists
        const serviceResult = await getServiceById(data.service_id);
        
        if (!serviceResult || serviceResult.length === 0) {
            return res.status(404).json({ 
                message: 'Service not found',
                service_id: data.service_id,
                hint: 'Please check available services at GET /api/services'
            });
        }

        const service = serviceResult[0];

        // Check duplicate booking
        const duplicateBooking = await getBookingsByUserId(userId, {
            service_id: data.service_id,
            service_date: data.service_date,
            status: 'pending'
        });

        if (duplicateBooking.length > 0) {
            return res.status(409).json({
                message: 'You already have a pending booking for this service on this date',
                existing_booking_id: duplicateBooking[0].id
            });
        }

        // Price calculation
        const pricePerHour = data.price_per_hour || (parseFloat(service.price) / service.duration * 60) || 5000;
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
            discount = base * 0.05;
        }

        const total = base + extras - discount;

        // Create booking
        const result = await createBooking({
            ...data,
            user_id: userId,
            email: userEmail,
            base_price: base,
            extras,
            discount,
            total_price: total,
            status: 'pending'
        });

        const bookingId = result.insertId;

        // ✅ SEND BOOKING CONFIRMATION EMAIL
        sendBookingConfirmation(userId, {
            id: bookingId,
            customer_name: `${data.first_name} ${data.last_name}`,
            service_name: service.name,
            service_date: data.service_date,
            service_time: data.service_time,
            address: data.address,
            city: data.city,
            total_price: total,
            assigned_staff: null
        });

        res.status(201).json({
            success: true,
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
                landmark: data.landmark || null,
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
        res.status(500).json({ 
            success: false,
            message: 'Failed to create booking', 
            error: error.message 
        });
    }
};

// ==================== HELPER: STATUS LABELS ====================

const getStatusLabel = (status) => {
    const labels = {
        'pending': 'Pending',
        'confirmed': 'Upcoming',
        'in_progress': 'In Progress',
        'completed': 'Delivered',
        'cancelled': 'Cancelled'
    };
    return labels[status] || status;
};

// ==================== GET MY BOOKINGS (ENHANCED) ====================

const getMyBookings = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Support multiple filter types
        let statusFilter = req.query.status;
        
        // Map friendly filter names to actual statuses
        if (req.query.filter) {
            switch (req.query.filter) {
                case 'upcoming':
                    statusFilter = 'confirmed';
                    break;
                case 'pending':
                    statusFilter = 'pending';
                    break;
                case 'in_progress':
                    statusFilter = 'in_progress';
                    break;
                case 'delivered':
                case 'completed':
                    statusFilter = 'completed';
                    break;
                case 'cancelled':
                    statusFilter = 'cancelled';
                    break;
                case 'unpaid':
                    statusFilter = 'pending';
                    break;
                case 'all':
                    statusFilter = null;
                    break;
            }
        }
        
        const filters = {
            status: statusFilter,
            date_from: req.query.date_from,
            date_to: req.query.date_to,
            limit: req.query.limit || 50,
            offset: req.query.offset || 0
        };

        const bookings = await getBookingsByUserId(userId, filters);

        // Enrich bookings with service names and staff details
        const enrichedBookings = await Promise.all(
            bookings.map(async (b) => {
                let serviceName = 'Unknown Service';
                let serviceLocation = null;
                let serviceDuration = null;
                let servicePrice = null;
                
                if (b.service_id) {
                    try {
                        const serviceResult = await getServiceById(b.service_id);
                        if (serviceResult && serviceResult.length > 0) {
                            const s = serviceResult[0];
                            serviceName = s.name;
                            serviceLocation = s.location;
                            serviceDuration = s.duration;
                            servicePrice = parseFloat(s.price);
                        }
                    } catch (err) {}
                }

                // Get assigned staff details if any
                let assignedStaffDetails = null;
                if (b.assigned_staff_id) {
                    try {
                        const staffResult = await getStaffById(b.assigned_staff_id);
                        if (staffResult && staffResult.length > 0) {
                            const staff = staffResult[0];
                            assignedStaffDetails = {
                                id: staff.id,
                                full_name: `${staff.first_name} ${staff.last_name}`,
                                first_name: staff.first_name,
                                last_name: staff.last_name,
                                email: staff.email,
                                phone: staff.phone,
                                staff_type: staff.staff_type,
                                photo: staff.photo ? `${req.protocol}://${req.get('host')}/uploads/staff/${staff.photo}` : null
                            };
                        }
                    } catch (err) {}
                }

                return {
                    id: b.id,
                    service: {
                        id: b.service_id,
                        name: serviceName,
                        price: servicePrice,
                        duration: serviceDuration,
                        location: serviceLocation
                    },
                    booking_details: {
                        cleaners: b.cleaners,
                        hours: b.hours,
                        frequency: b.frequency,
                        materials_provided: b.materials ? true : false,
                        property_type: b.property_type,
                        address: b.address,
                        city: b.city,
                        landmark: b.landmark
                    },
                    schedule: {
                        date: b.service_date,
                        time: b.service_time
                    },
                    instructions: b.instructions,
                    payment: {
                        method: b.payment_method,
                        base_price: parseFloat(b.base_price),
                        extras: parseFloat(b.extras),
                        discount: parseFloat(b.discount),
                        total_price: parseFloat(b.total_price)
                    },
                    status: b.status,
                    status_label: getStatusLabel(b.status),
                    assigned_staff: assignedStaffDetails,
                    created_at: b.created_at
                };
            })
        );

        // Get counts for each filter category
        const allBookings = await getBookingsByUserId(userId, {});
        const filterCounts = {
            all: allBookings.length,
            upcoming: allBookings.filter(b => b.status === 'confirmed').length,
            pending: allBookings.filter(b => b.status === 'pending').length,
            in_progress: allBookings.filter(b => b.status === 'in_progress').length,
            completed: allBookings.filter(b => b.status === 'completed').length,
            cancelled: allBookings.filter(b => b.status === 'cancelled').length,
            unpaid: allBookings.filter(b => b.status === 'pending').length
        };

        res.json({
            success: true,
            count: bookings.length,
            filter_counts: filterCounts,
            active_filter: req.query.filter || req.query.status || 'all',
            bookings: enrichedBookings
        });

    } catch (error) {
        console.error('Get my bookings error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch your bookings', 
            error: error.message 
        });
    }
};

// ==================== ADMIN: GET ALL BOOKINGS ====================

const getAllBookingsController = async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            date_from: req.query.date_from,
            date_to: req.query.date_to,
            user_id: req.query.user_id,
            assigned_staff_id: req.query.assigned_staff_id,
            limit: req.query.limit || 100,
            offset: req.query.offset || 0
        };

        const bookings = await getAllBookings(filters);
        const countResult = await getBookingCount({ 
            status: req.query.status,
            assigned_staff_id: req.query.assigned_staff_id
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
                    } catch (err) {}
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
                        name: serviceName,
                        location: serviceLocation
                    },
                    cleaning_details: {
                        cleaners: b.cleaners,
                        hours: b.hours,
                        frequency: b.frequency,
                        materials_provided: b.materials
                    },
                    property: {
                        type: b.property_type,
                        address: b.address,
                        city: b.city,
                        landmark: b.landmark
                    },
                    location: {
                        latitude: b.latitude,
                        longitude: b.longitude
                    },
                    schedule: {
                        date: b.service_date,
                        time: b.service_time
                    },
                    instructions: b.instructions,
                    payment: {
                        method: b.payment_method,
                        base_price: parseFloat(b.base_price),
                        extras: parseFloat(b.extras),
                        discount: parseFloat(b.discount),
                        total_price: parseFloat(b.total_price)
                    },
                    status: b.status,
                    status_label: getStatusLabel(b.status),
                    assigned_staff: b.assigned_staff_name ? {
                        id: b.assigned_staff_id,
                        name: b.assigned_staff_name
                    } : null,
                    created_at: b.created_at
                };
            })
        );

        res.json({
            success: true,
            total,
            count: bookings.length,
            filters_applied: {
                status: req.query.status || 'all',
                date_from: req.query.date_from || null,
                date_to: req.query.date_to || null
            },
            bookings: enrichedBookings
        });

    } catch (error) {
        console.error('Get all bookings error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch bookings', 
            error: error.message 
        });
    }
};

// ==================== ADMIN: GET SINGLE BOOKING DETAILS ====================

const getBookingDetails = async (req, res) => {
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

        // Get service details
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
                    location: s.location,
                    description: s.description,
                    includes: s.includes
                };
            }
        }

        // Get assigned staff details
        let staffDetails = null;
        if (b.assigned_staff_id) {
            const staffResult = await getStaffById(b.assigned_staff_id);
            if (staffResult && staffResult.length > 0) {
                const staff = staffResult[0];
                staffDetails = {
                    id: staff.id,
                    full_name: `${staff.first_name} ${staff.last_name}`,
                    first_name: staff.first_name,
                    last_name: staff.last_name,
                    email: staff.email,
                    phone: staff.phone,
                    staff_type: staff.staff_type,
                    photo: staff.photo ? `${req.protocol}://${req.get('host')}/uploads/staff/${staff.photo}` : null
                };
            }
        }

        res.json({
            success: true,
            booking: {
                id: b.id,
                user_id: b.user_id,
                customer: {
                    name: `${b.first_name} ${b.last_name}`,
                    email: b.email,
                    phone: b.phone
                },
                service: serviceDetails,
                cleaning_details: {
                    cleaners: b.cleaners,
                    hours: b.hours,
                    frequency: b.frequency,
                    materials_provided: b.materials
                },
                property: {
                    type: b.property_type,
                    address: b.address,
                    city: b.city,
                    landmark: b.landmark
                },
                location: {
                    latitude: b.latitude,
                    longitude: b.longitude
                },
                schedule: {
                    date: b.service_date,
                    time: b.service_time
                },
                instructions: b.instructions,
                payment: {
                    method: b.payment_method,
                    base_price: parseFloat(b.base_price),
                    extras: parseFloat(b.extras),
                    discount: parseFloat(b.discount),
                    total_price: parseFloat(b.total_price)
                },
                status: b.status,
                status_label: getStatusLabel(b.status),
                assigned_staff: staffDetails,
                created_at: b.created_at
            }
        });

    } catch (error) {
        console.error('Get booking details error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch booking details', 
            error: error.message 
        });
    }
};

// ==================== ADMIN: ASSIGN STAFF TO BOOKING ====================

const assignStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const { staff_id } = req.body;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid booking ID' });
        }

        if (!staff_id || isNaN(staff_id)) {
            return res.status(400).json({ message: 'Invalid staff ID' });
        }

        // Check booking exists
        const booking = await getBookingById(id);
        if (booking.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const b = booking[0];

        // Check if booking can be assigned
        if (['completed', 'cancelled'].includes(b.status)) {
            return res.status(400).json({ 
                message: `Cannot assign staff to a ${b.status} booking` 
            });
        }

        // Check staff exists and is active
        const staffResult = await getStaffById(staff_id);
        if (!staffResult || staffResult.length === 0) {
            return res.status(404).json({ message: 'Staff member not found' });
        }

        const staff = staffResult[0];
        const staffName = `${staff.first_name} ${staff.last_name}`;

        // Assign staff
        await assignStaffToBooking(id, staff_id, staffName);

        // ✅ SEND NOTIFICATION TO CUSTOMER
        if (b.user_id) {
            sendBookingStatusUpdate(b.user_id, {
                id: parseInt(id),
                service_name: 'Cleaning Service',
                service_date: b.service_date,
                service_time: b.service_time,
                assigned_staff: staffName
            }, 'confirmed');
        }

        res.json({
            success: true,
            message: 'Staff assigned successfully',
            booking: {
                id: parseInt(id),
                assigned_staff: {
                    id: staff.id,
                    full_name: staffName,
                    first_name: staff.first_name,
                    last_name: staff.last_name,
                    email: staff.email,
                    phone: staff.phone,
                    staff_type: staff.staff_type,
                    photo: staff.photo ? `${req.protocol}://${req.get('host')}/uploads/staff/${staff.photo}` : null
                },
                status: 'confirmed'
            }
        });

    } catch (error) {
        console.error('Assign staff error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to assign staff', 
            error: error.message 
        });
    }
};

// ==================== ADMIN: REMOVE STAFF ASSIGNMENT ====================

const removeStaff = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid booking ID' });
        }

        // Check booking exists
        const booking = await getBookingById(id);
        if (booking.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const b = booking[0];

        if (!b.assigned_staff_id) {
            return res.status(400).json({ message: 'No staff assigned to this booking' });
        }

        await removeStaffAssignment(id);

        res.json({
            success: true,
            message: 'Staff removed from booking',
            booking: {
                id: parseInt(id),
                status: 'pending'
            }
        });

    } catch (error) {
        console.error('Remove staff error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to remove staff', 
            error: error.message 
        });
    }
};

// ==================== ADMIN: UPDATE BOOKING STATUS ====================

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

        // Validate status transitions
        const currentStatus = booking[0].status;
        if (status === 'confirmed' && !booking[0].assigned_staff_id) {
            return res.status(400).json({ 
                message: 'Cannot confirm booking without assigned staff' 
            });
        }

        await updateBookingStatus(id, status);

        // ✅ SEND NOTIFICATION ON STATUS CHANGE
        if (booking[0].user_id) {
            sendBookingStatusUpdate(booking[0].user_id, {
                id: parseInt(id),
                service_name: 'Cleaning Service',
                service_date: booking[0].service_date,
                service_time: booking[0].service_time
            }, status);
        }

        res.json({ 
            success: true,
            message: 'Booking status updated successfully',
            booking: {
                id: parseInt(id),
                previous_status: currentStatus,
                previous_status_label: getStatusLabel(currentStatus),
                new_status: status,
                new_status_label: getStatusLabel(status)
            }
        });

    } catch (error) {
        console.error('Update booking status error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to update booking status', 
            error: error.message 
        });
    }
};

// ==================== GET BOOKING STATISTICS ====================

const getBookingStats = async (req, res) => {
    try {
        const totalBookings = await getBookingCount({});
        const pendingBookings = await getBookingCount({ status: 'pending' });
        const confirmedBookings = await getBookingCount({ status: 'confirmed' });
        const inProgressBookings = await getBookingCount({ status: 'in_progress' });
        const completedBookings = await getBookingCount({ status: 'completed' });
        const cancelledBookings = await getBookingCount({ status: 'cancelled' });

        res.json({
            success: true,
            statistics: {
                total: totalBookings[0].count,
                pending: pendingBookings[0].count,
                upcoming: confirmedBookings[0].count,
                in_progress: inProgressBookings[0].count,
                delivered: completedBookings[0].count,
                cancelled: cancelledBookings[0].count,
                unpaid: pendingBookings[0].count
            }
        });

    } catch (error) {
        console.error('Get booking stats error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch statistics', 
            error: error.message 
        });
    }
};

// ==================== CUSTOMER: GET RECEIPT (ENHANCED) ====================

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

        // Check access (owner or admin)
        if (req.user.role !== 'admin' && b.user_id !== req.user.id) {
            return res.status(403).json({ 
                message: 'Access denied. You can only view your own bookings.' 
            });
        }

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
                    location: s.location,
                    description: s.description,
                    includes: s.includes ? JSON.parse(s.includes) : []
                };
            }
        }

        // Get staff details for receipt
        let staffDetails = null;
        if (b.assigned_staff_id) {
            const staffResult = await getStaffById(b.assigned_staff_id);
            if (staffResult && staffResult.length > 0) {
                const staff = staffResult[0];
                staffDetails = {
                    id: staff.id,
                    full_name: `${staff.first_name} ${staff.last_name}`,
                    first_name: staff.first_name,
                    last_name: staff.last_name,
                    email: staff.email,
                    phone: staff.phone,
                    staff_type: staff.staff_type,
                    photo: staff.photo ? `${req.protocol}://${req.get('host')}/uploads/staff/${staff.photo}` : null
                };
            }
        }

        res.json({
            success: true,
            receipt: {
                id: b.id,
                customer: {
                    name: `${b.first_name} ${b.last_name}`,
                    email: b.email,
                    phone: b.phone
                },
                service: serviceDetails || { id: b.service_id, note: 'Service details unavailable' },
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
                status_label: getStatusLabel(b.status),
                assigned_staff: staffDetails,
                created_at: b.created_at
            }
        });

    } catch (error) {
        console.error('Get receipt error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch receipt', 
            error: error.message 
        });
    }
};

// ==================== CUSTOMER: CANCEL MY BOOKING ====================

const cancelMyBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const booking = await getBookingById(id);
        
        if (booking.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const b = booking[0];

        if (b.user_id !== userId) {
            return res.status(403).json({ message: 'You can only cancel your own bookings' });
        }

        if (['cancelled', 'completed'].includes(b.status)) {
            return res.status(400).json({ 
                message: `Cannot cancel a ${b.status} booking` 
            });
        }

        await updateBookingStatus(id, 'cancelled');
        await removeStaffAssignment(id);

        res.json({ 
            success: true,
            message: 'Booking cancelled successfully',
            booking_id: parseInt(id),
            status: 'cancelled',
            status_label: 'Cancelled'
        });

    } catch (error) {
        console.error('Cancel booking error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to cancel booking', 
            error: error.message 
        });
    }
};

// ==================== STAFF: GET MY ASSIGNMENTS ====================

const getStaffAssignments = async (req, res) => {
    try {
        const staffId = req.user.id;
        
        const filters = {
            status: req.query.status,
            date_from: req.query.date_from,
            date_to: req.query.date_to
        };

        const bookings = await getStaffBookings(staffId, filters);

        const enrichedBookings = await Promise.all(
            bookings.map(async (b) => {
                let serviceName = 'Unknown Service';
                if (b.service_id) {
                    try {
                        const serviceResult = await getServiceById(b.service_id);
                        if (serviceResult && serviceResult.length > 0) {
                            serviceName = serviceResult[0].name;
                        }
                    } catch (err) {}
                }

                return {
                    id: b.id,
                    customer: {
                        name: `${b.first_name} ${b.last_name}`,
                        phone: b.phone,
                        email: b.email
                    },
                    service: {
                        id: b.service_id,
                        name: serviceName
                    },
                    property: {
                        type: b.property_type,
                        address: b.address,
                        city: b.city,
                        landmark: b.landmark
                    },
                    schedule: {
                        date: b.service_date,
                        time: b.service_time
                    },
                    cleaning_details: {
                        cleaners: b.cleaners,
                        hours: b.hours,
                        materials_provided: b.materials
                    },
                    instructions: b.instructions,
                    payment: {
                        method: b.payment_method,
                        total_price: parseFloat(b.total_price)
                    },
                    status: b.status,
                    status_label: getStatusLabel(b.status),
                    created_at: b.created_at
                };
            })
        );

        res.json({
            success: true,
            count: bookings.length,
            bookings: enrichedBookings
        });

    } catch (error) {
        console.error('Get staff assignments error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch assignments', 
            error: error.message 
        });
    }
};

module.exports = {
    createBookingController,
    getMyBookings,
    getAllBookingsController,
    getBookingDetails,
    assignStaff,
    removeStaff,
    updateBookingStatusController,
    getBookingStats,
    getReceipt,
    cancelMyBooking,
    getStaffAssignments
};