const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
require('dotenv').config();

const db = require('./database');

const authRoutes = require('./routes/auth');
const classesRoutes = require('./routes/classes');
const examsRoutes = require('./routes/exams');
const notificationsRoutes = require('./routes/notifications');
const otpRoutes = require('./routes/otp');
const parentPortalRoutes = require('./routes/parent-portal');
const paymentsRoutes = require('./routes/payments');
const plansRoutes = require('./routes/plans');
const reportsRoutes = require('./routes/reports');
const schoolsRoutes = require('./routes/schools');
const studentsRoutes = require('./routes/students');
const syllabusRoutes = require('./routes/syllabus');
const attendanceRoutes = require('./routes/attendance');
const notesRoutes = require('./routes/notes');
const uploadRoutes = require('./routes/upload');
const path = require('path');
const teachersRoutes = require('./routes/teachers');
const usersRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const contactRoutes = require('./routes/contact');
const notificationWorker = require('./workers/notificationWorker');

const app = express();

app.use(helmet());
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', async () => {
        const duration = Date.now() - startedAt;
        console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
        if (req.method !== 'OPTIONS') {
            try {
                await db.createLog({
                    id: require('uuid').v4(),
                    user_id: req.user?.id || null,
                    action: `${req.method} ${req.originalUrl}`,
                    details: JSON.stringify({ duration }),
                    ip: req.ip,
                    status: res.statusCode,
                });
            } catch (error) {
                console.error('Failed to write request log:', error.message);
            }
        }
    });
    next();
});

app.get('/health', (req, res) => {
    res.json({ success: true, message: 'Student Management System backend is ready' });
});

app.use('/api/auth', authRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/exams', examsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/parent-portal', parentPortalRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/schools', schoolsRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/syllabus', syllabusRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/upload', uploadRoutes);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Serve generated receipts
app.use('/receipts', express.static(path.join(__dirname, 'receipts')));
app.use('/api/teachers', teachersRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contact', contactRoutes);

(async () => {
    try {
        await db.initialize();
    } catch (error) {
        console.error('Failed to initialize database:', error.message);
    }
})();

module.exports = app;
