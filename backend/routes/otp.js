const express = require('express');
require('dotenv').config();

const router = express.Router();

const OTP_STORE = new Map();
const OTP_EXPIRY = 10 * 60 * 1000; // 10 minutes

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const storeOTP = (email, otp) => {
    OTP_STORE.set(email, {
        otp,
        createdAt: Date.now(),
        attempts: 0
    });
};

const sendEmailOTP = async (email, otp) => {
    // If SMTP settings are configured, use Nodemailer to send the OTP
    const SMTP_HOST = process.env.SMTP_HOST;
    const SMTP_PORT = process.env.SMTP_PORT;
    const SMTP_USER = process.env.SMTP_USER;
    const SMTP_PASS = process.env.SMTP_PASS;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        return false; // SMTP not configured
    }

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT, 10),
        secure: SMTP_PORT == 465, // true for 465, false for others
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        }
    });

    const mailOptions = {
        from: process.env.SMTP_FROM || SMTP_USER,
        to: email,
        subject: 'Your verification code',
        text: `Your verification code is: ${otp}`,
        html: `<p>Your verification code is: <strong>${otp}</strong></p>`
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (err) {
        console.error('Failed to send OTP email:', err);
        return false;
    }
};

const verifyAndClearOTP = (email, otp) => {
    const stored = OTP_STORE.get(email);
    if (!stored) {
        return { valid: false, message: 'No OTP found for this email' };
    }

    if (Date.now() - stored.createdAt > OTP_EXPIRY) {
        OTP_STORE.delete(email);
        return { valid: false, message: 'OTP has expired' };
    }

    if (stored.attempts >= 5) {
        OTP_STORE.delete(email);
        return { valid: false, message: 'Too many failed attempts. Request a new OTP.' };
    }

    if (stored.otp !== otp) {
        stored.attempts += 1;
        return { valid: false, message: 'Invalid OTP' };
    }

    OTP_STORE.delete(email);
    return { valid: true, message: 'OTP verified successfully' };
};

const sendOtpToEmail = async (email) => {
    const otp = generateOTP();
    storeOTP(email, otp);
    const sent = await sendEmailOTP(email, otp);
    if (!sent) {
        console.warn(`[WARNING] Failed to send OTP email to ${email}. OTP for development: ${otp}`);
    }
    return { sent, otp };
};

router.post('/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const otp = generateOTP();
        storeOTP(email, otp);

        const sent = await sendEmailOTP(email, otp);
        if (!sent) {
            // Fallback to console when SMTP not configured
            console.log(`[OTP for ${email}]: ${otp}`);
        }

        res.json({
            success: true,
            message: sent ? 'OTP sent to your email' : 'OTP generated (check console in development)',
            // Provide OTP for development convenience
            otp: process.env.NODE_ENV === 'development' ? otp : undefined
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ error: 'Email and OTP are required' });
        }

        const result = verifyAndClearOTP(email, otp);
        if (!result.valid) {
            return res.status(401).json({ error: result.message });
        }

        res.json({ success: true, message: result.message });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/resend-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const otp = generateOTP();
        storeOTP(email, otp);

        const sent = await sendEmailOTP(email, otp);
        if (!sent) {
            console.log(`[OTP for ${email}]: ${otp}`);
        }

        res.json({
            success: true,
            message: sent ? 'New OTP sent to your email' : 'New OTP generated (check console in development)',
            otp: process.env.NODE_ENV === 'development' ? otp : undefined
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
module.exports.sendOtpToEmail = sendOtpToEmail;
module.exports.verifyOtpCode = verifyAndClearOTP;

