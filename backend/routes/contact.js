const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
require('dotenv').config();

// Public contact endpoint - accepts messages from website visitors and sends to SUPER_ADMIN_EMAIL
router.post('/', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;
        if (!name || !email || !message) return res.status(400).json({ error: 'name, email and message are required' });

        const recipient = process.env.SUPER_ADMIN_EMAIL || process.env.EMAIL_USER;
        if (!recipient) {
            console.log('[Contact] No recipient configured, logging message:', { name, email, subject, message });
            return res.json({ success: true, message: 'Message received (no email configured for delivery)' });
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: recipient,
            subject: subject || `Website Contact from ${name}`,
            html: `<p><strong>From:</strong> ${name} &lt;${email}&gt;</p><p><strong>Message:</strong></p><p>${message.replace(/</g,'&lt;')}</p>`
        });

        res.json({ success: true, message: 'Message sent' });
    } catch (error) {
        console.error('Contact send failed:', error && error.message ? error.message : error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

module.exports = router;
