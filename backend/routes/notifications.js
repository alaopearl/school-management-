const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
require('dotenv').config();
const nodemailer = require('nodemailer');

const router = express.Router();
const db = require('../database');
const twilio = (() => {
    try { return require('twilio'); } catch (e) { return null; }
})();

// Send notification (email/SMS/WhatsApp/in-app)
router.post('/send', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'), async (req, res) => {
    try {
        const { recipientId, recipientType, subject, message, notificationType, channel } = req.body;
        if (!message || !channel) {
            return res.status(400).json({ error: 'message and channel are required' });
        }

        const notification = {
            id: uuidv4(),
            recipient_id: recipientId || (recipientType === 'ALL' ? 'ALL' : null),
            recipient_type: recipientType || 'USER',
            subject: subject || 'Notification',
            message,
            type: notificationType || 'GENERAL',
            channel: channel,
            school_id: req.user.school_id,
            sent_by: req.user.user_id,
            status: 'PENDING',
            created_at: new Date().toISOString(),
            scheduled_at: req.body.scheduled_at || null
        };

        // persist notification record
        await db.createNotification({ id: notification.id, school_id: notification.school_id, recipient_id: notification.recipient_id, recipient_type: notification.recipient_type, subject: notification.subject, message: notification.message, type: notification.type, channel: notification.channel, sent_by: notification.sent_by, scheduled_at: notification.scheduled_at });

        // expand recipients into per-user rows
        let targetUsers = [];
        if ((recipientType === 'ALL') || (recipientId === 'ALL')) {
            const users = await db.listUsersBySchool(null);
            targetUsers = users.map(u => u.id);
        } else if (recipientType === 'SCHOOL' && req.body.recipient_id) {
            const users = await db.listUsersBySchool(req.body.recipient_id);
            targetUsers = users.map(u => u.id);
        } else if (recipientType === 'USER' && recipientId) {
            targetUsers = [recipientId];
        } else if (recipientType === 'SCHOOL' && req.user.role === 'SUPER_ADMIN' && !req.body.recipient_id) {
            // if super admin and no school provided, use active school context
            const schoolId = req.query.school_id || req.user.school_id || null;
            const users = await db.listUsersBySchool(schoolId);
            targetUsers = users.map(u => u.id);
        }

        const createdRecipients = [];
        for (const uid of targetUsers) {
            const rid = uuidv4();
            await db.createNotificationRecipient({ id: rid, notification_id: notification.id, user_id: uid, status: 'PENDING', attempts: 0, scheduled_at: notification.scheduled_at });
            createdRecipients.push(rid);
        }

        res.json({ success: true, data: { notification_id: notification.id, recipients: createdRecipients.length }, message: `Notification queued for ${createdRecipients.length} recipients via ${channel}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get in-app notifications for user
router.get('/inbox', authenticateToken, async (req, res) => {
    try {
        const userNotifications = await db.listNotificationsByUser(req.user.user_id, 200);
        const unread = await db.getUnreadCountForUser(req.user.user_id);
        res.json({ success: true, count: userNotifications.length, unread: unread ? unread.unread : 0, data: userNotifications });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// history: view notifications (Super Admin sees all, School Admin sees their school)
router.get('/history', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN'), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit || '200', 10);
        if (req.user.role === 'SUPER_ADMIN') {
            const rows = await db.listAllNotifications(limit);
            return res.json({ success: true, count: rows.length, data: rows });
        }
        const rows = await db.listNotificationsBySchool(req.user.school_id, limit);
        res.json({ success: true, count: rows.length, data: rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// mark a notification as read
router.post('/:id/read', authenticateToken, async (req, res) => {
    try {
        const id = req.params.id;
        const updated = await db.markNotificationRead(id, req.user.user_id);
        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// List failed recipient delivery attempts (Super Admin)
router.get('/retries', authenticateToken, authorizeRoles('SUPER_ADMIN'), async (req, res) => {
    try {
        const rows = await db.all("SELECT nr.id, nr.notification_id, nr.user_id, nr.status, nr.error, nr.attempts, nr.created_at, n.channel, n.subject, n.message FROM notification_recipients nr JOIN notifications n ON n.id = nr.notification_id WHERE nr.status = ? ORDER BY nr.created_at DESC LIMIT 200", ['FAILED']);
        res.json({ success: true, count: rows.length, data: rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Retry a failed recipient delivery
router.post('/recipients/:id/retry', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN'), async (req, res) => {
    try {
        const id = req.params.id;
        const recipient = await db.getRecipientById(id);
        if (!recipient) return res.status(404).json({ error: 'Recipient entry not found' });

        // only super admin or school admin for same school can retry
        if (req.user.role !== 'SUPER_ADMIN') {
            const notif = await db.getNotificationById(recipient.notification_id);
            if (!notif || notif.school_id !== req.user.school_id) return res.status(403).json({ error: 'Access denied' });
        }

        // reset attempts and schedule for immediate retry
        await db.updateRecipientStatus(id, 'PENDING', null);
        await db.rescheduleRecipient(id, 0, null, 0);
        res.json({ success: true, message: 'Recipient scheduled for retry' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Retry all recipients for a notification (Super Admin)
router.post('/:id/retry', authenticateToken, authorizeRoles('SUPER_ADMIN'), async (req, res) => {
    try {
        const id = req.params.id;
        const recipients = await db.listRecipientsByNotification(id);
        for (const r of recipients) {
            await db.updateRecipientStatus(r.id, 'PENDING', null);
            await db.rescheduleRecipient(r.id, 0, null, 0);
        }
        res.json({ success: true, message: `Scheduled ${recipients.length} recipients for retry` });
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

// Test gateway endpoint to exercise gateways immediately
router.post('/test', authenticateToken, authorizeRoles('SUPER_ADMIN'), async (req, res) => {
    try {
        const { channel, recipient, subject, message } = req.body;
        if (!channel || !recipient || !message) return res.status(400).json({ error: 'channel, recipient, and message are required' });

        if (channel === 'EMAIL') {
            try {
                await sendEmailNotification({ recipient_email: recipient, subject: subject || 'Test Email', message });
                return res.json({ success: true, message: 'Test email sent (or logged in fallback).' });
            } catch (err) {
                return res.status(500).json({ error: err.message });
            }
        } else if (channel === 'SMS' || channel === 'WHATSAPP') {
            if (!twilio) return res.status(500).json({ error: 'Twilio SDK not installed' });
            const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
            const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
            const TWILIO_FROM = process.env.TWILIO_FROM;
            if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) return res.status(500).json({ error: 'Twilio not configured in environment' });
            try {
                const client = twilio(TWILIO_SID, TWILIO_TOKEN);
                let from = TWILIO_FROM;
                let to = recipient;
                if (channel === 'WHATSAPP') {
                    from = TWILIO_FROM.startsWith('whatsapp:') ? TWILIO_FROM : `whatsapp:${TWILIO_FROM}`;
                    to = recipient.startsWith('whatsapp:') ? recipient : `whatsapp:${recipient}`;
                }
                await client.messages.create({ from, to, body: message });
                return res.json({ success: true, message: `${channel} test message sent` });
            } catch (err) {
                return res.status(500).json({ error: err.message });
            }
        }

        res.status(400).json({ error: 'Unsupported channel' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
