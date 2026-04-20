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

    if (!first_name || !last_name || !email || !password || !confirm_password || !address || !gender) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    if (password !== confirm_password) {
        return res.status(400).json({ message: 'Passwords do not match' });
    }

    next();
};

module.exports = { validateRegister };