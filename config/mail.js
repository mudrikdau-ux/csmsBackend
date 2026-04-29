const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Verify transporter
transporter.verify((error) => {
    if (error) {
        console.error('Email configuration error:', error);
    } else {
        console.log('Email server ready');
    }
});

const sendOTPEmail = async (to, name, otp, expiryMinutes = 5) => {
    const mailOptions = {
        from: `"CleanSpark" <${process.env.EMAIL_USER}>`,
        to,
        subject: 'Your Login Verification Code (OTP)',
        html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px; margin: 0;">
            <div style="max-width: 500px; margin: auto; background: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #2c3e50; margin: 0;">🧹 CleanSpark</h1>
                    <p style="color: #7f8c8d; font-size: 14px;">Professional Cleaning Services</p>
                </div>
                
                <h2 style="color: #2c3e50;">Hello ${name},</h2>
                
                <p style="color: #34495e; line-height: 1.6;">We received a request to access your account. Use the verification code below to complete your login:</p>
                
                <div style="background: #f0f8ff; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                    <p style="color: #7f8c8d; margin: 0 0 10px; font-size: 12px;">YOUR VERIFICATION CODE</p>
                    <h1 style="letter-spacing: 10px; color: #3498db; font-size: 36px; margin: 10px 0;">${otp}</h1>
                    <p style="color: #e74c3c; font-size: 12px; margin: 10px 0 0;">Expires in ${expiryMinutes} minutes</p>
                </div>
                
                <div style="background: #fff9e6; border-left: 4px solid #f39c12; padding: 12px; margin: 20px 0;">
                    <p style="margin: 0; color: #e67e22; font-size: 13px;">
                        ⚠️ <strong>Security Notice:</strong> If you didn't request this code, please ignore this email and consider changing your password.
                    </p>
                </div>
                
                <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 20px 0;" />
                
                <p style="font-size: 12px; color: #95a5a6; text-align: center;">
                    This is an automated message from CleanSpark. Please do not reply to this email.<br>
                    © ${new Date().getFullYear()} CleanSpark Cleaning Services. All rights reserved.
                </p>
            </div>
        </body>
        </html>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`OTP email sent to ${to}`);
        return true;
    } catch (error) {
        console.error('Failed to send OTP email:', error);
        throw new Error('Failed to send OTP email');
    }
};

module.exports = { sendOTPEmail };