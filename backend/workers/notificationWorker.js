const db = require('../database');
const nodemailer = require('nodemailer');
require('dotenv').config();
const socketModule = require('../socket');
const { v4: uuidv4 } = require('uuid');

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_FROM; // e.g., +123456789 or whatsapp:+123456789
let twilioClient = null;
if (TWILIO_SID && TWILIO_TOKEN) {
    try {
        const twilio = require('twilio');
        twilioClient = twilio(TWILIO_SID, TWILIO_TOKEN);
    } catch (err) {
        console.warn('Twilio client not available:', err.message);
    }
}

async function sendEmail(notification) {
    const SMTP_HOST = process.env.SMTP_HOST;
    const SMTP_PORT = process.env.SMTP_PORT;
    const SMTP_USER = process.env.SMTP_USER;
    const SMTP_PASS = process.env.SMTP_PASS;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        console.log('[Email fallback] SMTP not configured. Skipping actual send.');
        return;
    }

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT, 10),
        secure: SMTP_PORT == 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS }
    });

    await transporter.sendMail({
        from: process.env.SMTP_FROM || SMTP_USER,
        to: notification.recipient_email || 'unknown@localhost',
        subject: notification.subject || 'Notification',
        html: `<p>${notification.message}</p>`
    });
}

async function sendSms(notification) {
    if (!twilioClient || !TWILIO_FROM) {
        console.log('[SMS fallback] Twilio not configured. Logging SMS:', notification.message);
        return;
    }
    const to = notification.recipient_phone || notification.recipient_contact || notification.recipient_id;
    if (!to) throw new Error('No recipient phone provided for SMS');
    await twilioClient.messages.create({ from: TWILIO_FROM, to, body: notification.message });
}

async function sendWhatsApp(notification) {
    if (!twilioClient || !TWILIO_FROM) {
        console.log('[WhatsApp fallback] Twilio not configured. Logging WhatsApp message:', notification.message);
        return;
    }
    const to = notification.recipient_phone || notification.recipient_contact || notification.recipient_id;
    if (!to) throw new Error('No recipient phone provided for WhatsApp');
    const from = TWILIO_FROM.startsWith('whatsapp:') ? TWILIO_FROM : `whatsapp:${TWILIO_FROM}`;
    const toWa = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    await twilioClient.messages.create({ from, to: toWa, body: notification.message });
}

async function processPending() {
    try {
        // process per-user recipients queue
        const recipients = await db.listPendingRecipients(100);
        for (const r of recipients) {
            try {
                // build a small notification object
                const notif = { id: r.notification_id, channel: r.channel, subject: r.subject, message: r.message, school_id: r.school_id, sent_by: r.sent_by };
                // perform channel-specific delivery
                if (notif.channel === 'EMAIL') {
                    // need to resolve recipient email
                    const user = await db.getUserById(r.user_id);
                    const payload = Object.assign({}, notif, { recipient_email: user?.email, recipient_id: r.user_id });
                    await sendEmail(payload);
                } else if (notif.channel === 'SMS') {
                    const user = await db.getUserById(r.user_id);
                    const payload = Object.assign({}, notif, { recipient_phone: user?.phone, recipient_id: r.user_id });
                    await sendSms(payload);
                } else if (notif.channel === 'WHATSAPP') {
                    const user = await db.getUserById(r.user_id);
                    const payload = Object.assign({}, notif, { recipient_phone: user?.phone, recipient_id: r.user_id });
                    await sendWhatsApp(payload);
                } else {
                    // IN_APP or unknown: no external delivery required
                }

                const updatedRecipient = await db.updateRecipientStatus(r.id, 'SENT', null);
                // create a per-user notification record so inbox/history can show it
                try {
                    await db.createNotification({ id: uuidv4(), school_id: r.school_id || null, recipient_id: r.user_id, recipient_type: 'USER', subject: r.subject || null, message: r.message || null, type: 'GENERAL', channel: r.channel || 'IN_APP', sent_by: r.sent_by || null, scheduled_at: r.scheduled_at || null });
                } catch (createErr) {
                    console.warn('Failed to insert per-user notification record:', createErr.message);
                }
                // notify user in real-time
                try {
                    const io = socketModule.getIo();
                    if (io) {
                        io.to(`user:${r.user_id}`).emit('notification', Object.assign({}, updatedRecipient, { notification_id: r.notification_id, subject: r.subject, message: r.message }));
                        io.to(`user:${r.user_id}`).emit('notification:status', { id: updatedRecipient.id, status: updatedRecipient.status, delivered_at: updatedRecipient.delivered_at });
                    }
                } catch (emitErr) {
                    console.warn('Failed to emit socket notification to user', r.user_id, emitErr.message);
                }
            } catch (err) {
                console.error('Failed to deliver recipient', r.id, err.message);
                // retry/backoff
                const maxRetries = parseInt(process.env.NOTIF_MAX_RETRIES || '3', 10);
                const attempts = (r.attempts || 0) + 1;
                const backoffSeconds = Math.min(60 * 60, Math.pow(2, attempts) * 5);
                if (attempts >= maxRetries) {
                    await db.updateRecipientStatus(r.id, 'FAILED', err.message);
                    try {
                        const io = socketModule.getIo();
                        if (io) io.to(`user:${r.user_id}`).emit('notification:status', { id: r.id, status: 'FAILED', error: err.message });
                    } catch (ee) { console.warn('Emit failure status failed:', ee.message); }
                } else {
                    await db.rescheduleRecipient(r.id, attempts, err.message, backoffSeconds);
                    console.log(`Rescheduled recipient ${r.id} retry #${attempts} in ${backoffSeconds}s`);
                }
            }
        }
    } catch (err) {
        console.error('Notification worker error:', err.message);
    }
}

let intervalId = null;
function startWorker(intervalMs = 5000) {
    if (intervalId) return;
    intervalId = setInterval(processPending, intervalMs);
    // run once immediately
    processPending().catch(() => {});
}

function stopWorker() {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
}

module.exports = { startWorker, stopWorker };
