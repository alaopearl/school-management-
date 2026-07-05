const nodemailer = require('nodemailer');
require('dotenv').config();

// Email configuration for Gmail using env vars
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

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

module.exports = {
    sendStudentNotification
};
