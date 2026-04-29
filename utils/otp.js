const crypto = require('crypto');

const generateOTP = (length = 6) => {
    // Generate numeric OTP
    return Math.floor(Math.pow(10, length - 1) + Math.random() * 9 * Math.pow(10, length - 1)).toString();
};

module.exports = { generateOTP };