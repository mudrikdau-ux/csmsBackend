const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendOTPEmail = async (to, name, otp, expiryMinutes = 5) => {
    const mailOptions = {
        from: `"CleanSpark" <${process.env.EMAIL_USER}>`,
        to,
        subject: 'Your Login Verification Code (OTP)',
        html: `
        <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">
            <div style="max-width: 500px; margin: auto; background: #ffffff; padding: 20px; border-radius: 10px;">
                
                <h2 style="color: #2c3e50;">CleanSpark Cleaning Services</h2>
                
                <p>Dear <strong>${name}</strong>,</p>
                
                <p>We received a request to log in to your account. Please use the One-Time Password (OTP) below to complete your login:</p>
                
                <div style="text-align: center; margin: 20px 0;">
                    <h1 style="letter-spacing: 5px; color: #3498db;">${otp}</h1>
                </div>
                
                <p>This OTP is valid for <strong>${expiryMinutes} minutes</strong>.</p>
                
                <p>If you did not request this login, please ignore this email or contact support immediately.</p>
                
                <hr style="margin: 20px 0;" />
                
                <p style="font-size: 12px; color: #7f8c8d;">
                    This is an automated message from CleanSpark. Please do not reply.
                </p>
                
                <p style="font-size: 12px; color: #7f8c8d;">
                    © ${new Date().getFullYear()} CleanSpark Cleaning Services
                </p>
            </div>
        </div>
        `
    };

    await transporter.sendMail(mailOptions);
};

module.exports = { sendOTPEmail };