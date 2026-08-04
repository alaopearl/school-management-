const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
require('dotenv').config();

// Public contact endpoint - accepts support messages from website visitors and sends to the configured school or fallback support recipient
router.post('/', async (req, res) => {
    try {
        const { name, email, subject, message, category = 'General support', priority = 'Normal' } = req.body;
        if (!name || !email || !message) return res.status(400).json({ error: 'name, email and message are required' });
        // Determine recipient: prefer school-level support_email if provided in body, otherwise env var, otherwise fallback
        const db = require('../database');
        let recipient = process.env.SUPPORT_EMAIL || 'student.management.website01@gmail.com';
        try {
            if (req.body.school_id) {
                const school = await db.getSchoolById(req.body.school_id);
                if (school) recipient = school.support_email || school.email || recipient;
            }
        } catch (e) {
            console.warn('Unable to resolve school for contact recipient', e && e.message ? e.message : e);
        }
        if (!recipient) {
            console.log('[Contact] No recipient configured, logging message:', { name, email, subject, message });
            return res.json({ success: true, message: 'Message received (no email configured for delivery)' });
        }

        const SMTP_HOST = process.env.SMTP_HOST;
        const SMTP_PORT = process.env.SMTP_PORT;
        const SMTP_USER = process.env.SMTP_USER;
        const SMTP_PASS = process.env.SMTP_PASS;
        const SMTP_FROM = process.env.SMTP_FROM || recipient;

        let transporter;
        if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
            transporter = nodemailer.createTransport({
                host: SMTP_HOST,
                port: Number(SMTP_PORT),
                secure: Number(SMTP_PORT) === 465,
                auth: {
                    user: SMTP_USER,
                    pass: SMTP_PASS
                }
            });
        } else if (process.env.SUPPORT_EMAIL && process.env.GMAIL_APP_PASSWORD) {
            transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.SUPPORT_EMAIL,
                    pass: process.env.GMAIL_APP_PASSWORD
                }
            });
        } else {
            console.log('[Contact] No SMTP configured, logging support ticket:', { name, email, subject, message });
            return res.json({ success: true, message: 'Support ticket received (email delivery unavailable)' });
        }

        await transporter.sendMail({
            from: SMTP_FROM,
            to: recipient,
            replyTo: email,
            subject: `[Support Ticket] ${subject || `Request from ${name}`}`,
            html: `<h2>New support ticket</h2><p><strong>From:</strong> ${name.replace(/</g,'&lt;')} &lt;${email.replace(/</g,'&lt;')}&gt;</p><p><strong>Category:</strong> ${category.replace(/</g,'&lt;')}</p><p><strong>Priority:</strong> ${priority.replace(/</g,'&lt;')}</p><p><strong>Message:</strong></p><p>${message.replace(/</g,'&lt;').replace(/\n/g, '<br>')}</p>`
        });

        res.status(201).json({ success: true, message: 'Support ticket sent successfully' });
    } catch (error) {
        console.error('Contact send failed:', error && error.message ? error.message : error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

module.exports = router;
