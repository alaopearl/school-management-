const nodemailer = require('nodemailer');
require('dotenv').config();

// Email configuration for Gmail using env vars
const createTransporter = () => {
    const SMTP_HOST = process.env.SMTP_HOST;
    const SMTP_PORT = process.env.SMTP_PORT;
    const SMTP_USER = process.env.SMTP_USER || process.env.EMAIL_USER;
    const SMTP_PASS = process.env.SMTP_PASS || process.env.EMAIL_PASSWORD;

    if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
        return nodemailer.createTransport({
            host: SMTP_HOST,
            port: Number(SMTP_PORT),
            secure: Number(SMTP_PORT) === 465,
            auth: { user: SMTP_USER, pass: SMTP_PASS }
        });
    }

    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        }
    });
};

const sendStudentNotification = async (schoolName, studentData, schoolAdminEmail) => {
    try {
        const recipient = process.env.SUPER_ADMIN_EMAIL || process.env.EMAIL_USER || 'school.management.website01@gmail.com';
        const mailOptions = {
            from: process.env.EMAIL_USER || 'no-reply@example.com',
            to: recipient,
            cc: schoolAdminEmail || '',
            subject: `New Student Added - ${schoolName}`,
            html: `
                <h2>Student Addition Notification</h2>
                <p>A new student has been added to the system.</p>
                
                <h3>School Information:</h3>
                <ul>
                    <li><strong>School Name:</strong> ${schoolName}</li>
                    <li><strong>School Admin:</strong> ${schoolAdminEmail || 'N/A'}</li>
                </ul>
                
                <h3>Student Information:</h3>
                <ul>
                    <li><strong>Student Code:</strong> ${studentData.student_code || 'N/A'}</li>
                    <li><strong>Full Name:</strong> ${studentData.full_name || 'N/A'}</li>
                    <li><strong>Date of Birth:</strong> ${studentData.date_of_birth || 'N/A'}</li>
                    <li><strong>Gender:</strong> ${studentData.gender || 'N/A'}</li>
                    <li><strong>Admission Date:</strong> ${studentData.admission_date || 'N/A'}</li>
                    <li><strong>Parent Name:</strong> ${studentData.parent_name || 'N/A'}</li>
                    <li><strong>Parent Contact:</strong> ${studentData.parent_contact || 'N/A'}</li>
                    <li><strong>Status:</strong> ${studentData.status || 'ACTIVE'}</li>
                </ul>
                
                <p style="color: #666; font-size: 12px; margin-top: 20px;">
                    This is an automated notification from the Student Record Tracker system.
                </p>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Notification email sent successfully to', recipient, 'messageId=', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending notification email:', error && error.message ? error.message : error);
        return false;
    }
};

const sendParentNotification = async (schoolName, studentData, parentEmails = [], schoolAdminEmail = '') => {
    try {
        if (!parentEmails || (Array.isArray(parentEmails) && parentEmails.length === 0) || (typeof parentEmails === 'string' && !parentEmails.trim())) {
            console.warn('No parent emails provided for notification');
            return false;
        }

        const recipients = Array.isArray(parentEmails) ? parentEmails.filter(Boolean) : parentEmails.split(',').map((s) => s.trim()).filter(Boolean);
        if (!recipients.length) return false;

        const mailOptions = {
            from: process.env.EMAIL_USER || 'no-reply@example.com',
            to: recipients.join(','),
            subject: `Welcome to ${schoolName} — Student record created`,
            html: `
                <h2>Welcome to ${schoolName}</h2>
                <p>Hello,</p>
                <p>Your child has been registered in <strong>${schoolName}</strong>. Below are the details recorded:</p>
                <ul>
                    <li><strong>Student Name:</strong> ${studentData.full_name || 'N/A'}</li>
                    <li><strong>Student Code:</strong> ${studentData.student_code || 'N/A'}</li>
                    <li><strong>Admission Date:</strong> ${studentData.admission_date || 'N/A'}</li>
                    <li><strong>Class:</strong> ${studentData.current_level || studentData.currentLevel || 'N/A'}</li>
                </ul>
                <p>If you have any questions, contact the school administration at ${schoolAdminEmail || 'the email on file'}.</p>
                <p style="color:#666;font-size:12px">This is an automated message from ${schoolName}.</p>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Parent notification email sent to', recipients, 'messageId=', info.messageId);
        return true;
    } catch (err) {
        console.error('Error sending parent notification:', err && err.message ? err.message : err);
        return false;
    }
};

module.exports = {
    sendStudentNotification,
    sendParentNotification
};
