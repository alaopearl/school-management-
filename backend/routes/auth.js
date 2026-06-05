const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const db = require('../database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';
const SALT_ROUNDS = 10;

const generateToken = (user) => {
    const payload = {
        user_id: user.id,
        email: user.email,
        role: user.role,
        school_id: user.school_id || null
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

router.post('/register-school', async (req, res) => {
    try {
        const { schoolName, schoolCode, logoUrl, adminName, adminEmail, password } = req.body;
        if (!schoolName || !schoolCode || !adminName || !adminEmail || !password) {
            return res.status(400).json({ error: 'Missing required registration fields' });
        }

        const existingSchool = await db.getSchoolByCode(schoolCode);
        if (existingSchool) {
            return res.status(409).json({ error: 'School code already exists' });
        }

        const school = await db.createSchool({
            id: uuidv4(),
            name: schoolName,
            code: schoolCode,
            logo_url: logoUrl || null,
            settings: JSON.stringify({ theme: 'light', language: 'en' })
        });

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const adminUser = await db.createUser({
            id: uuidv4(),
            school_id: school.id,
            email: adminEmail.toLowerCase(),
            password: hashedPassword,
            full_name: adminName,
            role: 'SCHOOL_ADMIN',
            status: 'ACTIVE'
        });

        const token = generateToken(adminUser);
        res.status(201).json({ success: true, data: { school, user: { id: adminUser.id, email: adminUser.email, full_name: adminUser.full_name, role: adminUser.role }, token } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await db.getUserByEmail(email.toLowerCase());
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const passwordMatches = await bcrypt.compare(password, user.password);
        if (!passwordMatches) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const school = user.school_id ? await db.getSchoolById(user.school_id) : null;
        const token = generateToken(user);

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    full_name: user.full_name,
                    role: user.role,
                    school_id: user.school_id,
                    status: user.status
                },
                school,
                token
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await db.getUserById(req.user.user_id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const school = user.school_id ? await db.getSchoolById(user.school_id) : null;
        res.json({ success: true, data: { user, school } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/register-user', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN'), async (req, res) => {
    try {
        const { email, password, fullName, role, phone, schoolId } = req.body;

        if (!email || !password || !fullName || !role) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const normalizedEmail = email.toLowerCase();
        const existing = await db.getUserByEmail(normalizedEmail);
        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const school_id = req.user.role === 'SUPER_ADMIN' ? schoolId || null : req.user.school_id;
        if (req.user.role !== 'SUPER_ADMIN' && !school_id) {
            return res.status(403).json({ error: 'School context required' });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const user = await db.createUser({
            id: uuidv4(),
            school_id,
            email: normalizedEmail,
            password: hashedPassword,
            full_name: fullName,
            phone: phone || null,
            role,
            status: 'ACTIVE'
        });

        res.status(201).json({ success: true, data: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, school_id: user.school_id } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
