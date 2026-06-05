const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
require('dotenv').config();
const db = require('./database');
const authRoutes = require('./routes/auth');
const otpRoutes = require('./routes/otp');
const schoolRoutes = require('./routes/schools');
const userRoutes = require('./routes/users');
const studentRoutes = require('./routes/students');
const teacherRoutes = require('./routes/teachers');
const classRoutes = require('./routes/classes');
const reportRoutes = require('./routes/reports');

const app = express();

app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    next();
});

(async () => {
    try {
        await db.initialize();
    } catch (error) {
        console.error('Database initialization failed:', error);
        process.exit(1);
    }
})();

app.use('/api/auth', authRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/users', userRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/reports', reportRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        status: err.status || 500
    });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

module.exports = app;
