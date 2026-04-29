const validateRegister = (req, res, next) => {
    const {
        first_name,
        last_name,
        email,
        password,
        confirm_password,
        address,
        gender
    } = req.body;

    // Check required fields
    if (!first_name || !last_name || !email || !password || !confirm_password || !address || !gender) {
        return res.status(400).json({ 
            message: 'All fields are required',
            required: ['first_name', 'last_name', 'email', 'password', 'confirm_password', 'address', 'gender']
        });
    }

    // Validate name lengths
    if (first_name.length < 2 || first_name.length > 50) {
        return res.status(400).json({ message: 'First name must be between 2 and 50 characters' });
    }

    if (last_name.length < 2 || last_name.length > 50) {
        return res.status(400).json({ message: 'Last name must be between 2 and 50 characters' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
    }

    // Validate password strength
    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check password match
    if (password !== confirm_password) {
        return res.status(400).json({ message: 'Passwords do not match' });
    }

    // Validate gender
    if (!['Male', 'Female'].includes(gender)) {
        return res.status(400).json({ message: 'Gender must be either Male or Female' });
    }

    next();
};

const validateBooking = (req, res, next) => {
    const {
        service_id,
        cleaners,
        hours,
        frequency,
        property_type,
        address,
        city,
        service_date,
        service_time,
        first_name,
        last_name,
        email,
        phone,
        payment_method
    } = req.body;

    const errors = [];

    // Required fields validation
    if (!service_id) errors.push('Service ID is required');
    if (!cleaners) errors.push('Number of cleaners is required');
    if (!hours) errors.push('Hours is required');
    if (!frequency) errors.push('Frequency is required');
    if (!property_type) errors.push('Property type is required');
    if (!address) errors.push('Address is required');
    if (!city) errors.push('City is required');
    if (!service_date) errors.push('Service date is required');
    if (!service_time) errors.push('Service time is required');
    if (!first_name) errors.push('First name is required');
    if (!last_name) errors.push('Last name is required');
    if (!email) errors.push('Email is required');
    if (!phone) errors.push('Phone is required');
    if (!payment_method) errors.push('Payment method is required');

    // Validate cleaners
    if (cleaners && (isNaN(cleaners) || cleaners < 1 || cleaners > 10)) {
        errors.push('Cleaners must be between 1 and 10');
    }

    // Validate hours
    if (hours && (isNaN(hours) || hours < 1 || hours > 24)) {
        errors.push('Hours must be between 1 and 24');
    }

    // Validate frequency
    if (frequency && !['one-time', 'weekly'].includes(frequency)) {
        errors.push('Frequency must be either "one-time" or "weekly"');
    }

    // Validate email format
    if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            errors.push('Invalid email format');
        }
    }

    // Validate phone
    if (phone && !/^[\d\+\-\(\) ]{10,20}$/.test(phone)) {
        errors.push('Invalid phone number format');
    }

    // Validate payment method
    if (payment_method && !['cash', 'card', 'mobile_money'].includes(payment_method)) {
        errors.push('Payment method must be cash, card, or mobile_money');
    }

    // Validate service date (should not be in the past)
    if (service_date) {
        const bookingDate = new Date(service_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (bookingDate < today) {
            errors.push('Service date cannot be in the past');
        }
    }

    if (errors.length > 0) {
        return res.status(400).json({ 
            message: 'Validation failed',
            errors 
        });
    }

    next();
};

const validateLogin = (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
    }

    next();
};

module.exports = { validateRegister, validateBooking, validateLogin };