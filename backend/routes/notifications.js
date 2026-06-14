const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
require('dotenv').config();
const nodemailer = require('nodemailer');

const router = express.Router();
const notifications = [];

// Send notification (email/SMS/WhatsApp/in-app)
router.post('/send', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'), async (req, res) => {
    try {
        const { recipientId, recipientType, subject, message, notificationType, channel } = req.body;
        if (!recipientId || !message || !channel) {
            return res.status(400).json({ error: 'recipientId, message, and channel are required' });
        }

        const notification = {
            id: uuidv4(),
            recipient_id: recipientId,
            recipient_type: recipientType || 'STUDENT',
            subject: subject || 'Notification',
            message,
            type: notificationType || 'GENERAL',
            channel: channel,
            school_id: req.user.school_id,
            sent_by: req.user.user_id,
            status: 'PENDING',
            created_at: new Date().toISOString()
        };

        if (channel === 'EMAIL') {
            await sendEmailNotification(notification);
        } else if (channel === 'SMS') {
            console.log(`[SMS] ${notification.message}`);
        } else if (channel === 'WHATSAPP') {
            console.log(`[WhatsApp] ${notification.message}`);
        } else if (channel === 'IN_APP') {
            notifications.push(notification);
        }

        notification.status = 'SENT';
        res.json({ success: true, data: notification, message: `Notification sent via ${channel}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get in-app notifications for user
router.get('/inbox', authenticateToken, async (req, res) => {
    try {
        const userNotifications = notifications.filter(n => n.recipient_id === req.user.user_id && n.channel === 'IN_APP');
        res.json({ success: true, count: userNotifications.length, data: userNotifications });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

async function sendEmailNotification(notification) {
    const SMTP_HOST = process.env.SMTP_HOST;
    const SMTP_PORT = process.env.SMTP_PORT;
    const SMTP_USER = process.env.SMTP_USER;
    const SMTP_PASS = process.env.SMTP_PASS;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        console.log(`[Email fallback] ${notification.message}`);
        return;
    }

    try {
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: parseInt(SMTP_PORT, 10),
            secure: SMTP_PORT == 465,
            auth: { user: SMTP_USER, pass: SMTP_PASS }
        });

        await transporter.sendMail({
            from: process.env.SMTP_FROM || SMTP_USER,
            to: notification.recipient_email || 'student@school.com',
            subject: notification.subject,
            html: `<p>${notification.message}</p>`
        });
    } catch (error) {
        console.error('Email send failed:', error);
    }
}

module.exports = router;
