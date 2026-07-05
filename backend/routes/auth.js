const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const db = require('../database');
const otpService = require('../routes/otp');
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

// Super Admin only: Create/manage schools
router.post('/create-school', authenticateToken, authorizeRoles('SUPER_ADMIN'), async (req, res) => {
    try {
        const { schoolName, schoolCode, motto, address, email, phone, website, principalName, principalPhone, schoolType, logoUrl, primaryColor, secondaryColor, sessionSystem } = req.body;
        if (!schoolName || !schoolCode) {
            return res.status(400).json({ error: 'School name and code are required' });
        }

        const existingSchool = await db.getSchoolByCode(schoolCode);
        if (existingSchool) {
            return res.status(409).json({ error: 'School code already exists' });
        }

        const school = await db.createSchool({
            id: uuidv4(),
            name: schoolName,
            code: schoolCode,
            motto: motto || null,
            address: address || null,
            email: email || null,
            phone: phone || null,
            website: website || null,
            principal_name: principalName || null,
            principal_phone: principalPhone || null,
            school_type: schoolType || null,
            logo_url: logoUrl || null,
            primary_color: primaryColor || '#3B82F6',
            secondary_color: secondaryColor || '#1E40AF',
            session_system: sessionSystem || 'TERM',
            status: 'ACTIVE',
            subscription_plan: 'STANDARD',
            settings: JSON.stringify({ theme: 'light', language: 'en' })
        });

        res.status(201).json({ success: true, data: school });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const normalizedEmail = email.toLowerCase();
        const user = await db.getUserByEmail(normalizedEmail);
        if (!user) {
            return res.json({ success: true, message: 'If an account exists, an OTP has been sent to the email.' });
        }

        const { sent, otp } = await otpService.sendOtpToEmail(normalizedEmail);
        res.json({
            success: true,
            message: sent ? 'OTP sent to your email' : 'OTP generated (check console in development)',
            otp: process.env.NODE_ENV === 'development' ? otp : undefined
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ error: 'Email, OTP, and new password are required' });
        }

        const normalizedEmail = email.toLowerCase();
        const verification = otpService.verifyOtpCode(normalizedEmail, otp);
        if (!verification.valid) {
            return res.status(401).json({ error: verification.message });
        }

        const user = await db.getUserByEmail(normalizedEmail);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await db.updateUser(user.id, { password: hashedPassword });
        res.json({ success: true, message: 'Password has been reset successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/setup-status', async (req, res) => {
    try {
        const superAdmin = await db.getSuperAdmin();
        res.json({ success: true, hasSuperAdmin: !!superAdmin });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/setup-super-admin', async (req, res) => {
    try {
        const { fullName, email, password, phone } = req.body;
        if (!fullName || !email || !password) {
            return res.status(400).json({ error: 'Full name, email, and password are required' });
        }

        const existingAdmin = await db.getSuperAdmin();
        if (existingAdmin) {
            return res.status(403).json({ error: 'Super Admin already exists' });
        }

        const normalizedEmail = email.toLowerCase();
        const existingUser = await db.getUserByEmail(normalizedEmail);
        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const superAdmin = await db.createUser({
            id: uuidv4(),
            school_id: null,
            email: normalizedEmail,
            password: hashedPassword,
            full_name: fullName,
            phone: phone || null,
            role: 'SUPER_ADMIN',
            status: 'ACTIVE'
        });

        const token = generateToken(superAdmin);
        res.status(201).json({ success: true, data: { user: superAdmin, token } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Public endpoint: Register a new school with OTP verification
router.post('/register-school', async (req, res) => {
    try {
        const { schoolName, schoolCode, email, phone, principalName, address, schoolType, otp } = req.body;
        
        if (!schoolName || !schoolCode || !email) {
            return res.status(400).json({ error: 'School name, code, and email are required' });
        }

        const normalizedEmail = email.toLowerCase();
        
        // If OTP is provided, verify it
        if (otp) {
            const verification = otpService.verifyOtpCode(normalizedEmail, otp);
            if (!verification.valid) {
                return res.status(401).json({ error: verification.message });
            }
            
            // OTP verified, proceed with school creation
            const existingSchool = await db.getSchoolByCode(schoolCode);
            if (existingSchool) {
                return res.status(409).json({ error: 'School code already exists' });
            }

            const school = await db.createSchool({
                id: uuidv4(),
                name: schoolName,
                code: schoolCode,
                email: normalizedEmail,
                phone: phone || null,
                motto: null,
                address: address || null,
                website: null,
                principal_name: principalName || null,
                principal_phone: null,
                school_type: schoolType || null,
                logo_url: null,
                primary_color: '#3B82F6',
                secondary_color: '#1E40AF',
                session_system: 'TERM',
                status: 'ACTIVE',
                subscription_plan: 'STANDARD',
                settings: JSON.stringify({ theme: 'light', language: 'en' })
            });

            return res.status(201).json({ 
                success: true, 
                message: 'School registered successfully',
                data: school 
            });
        } else {
            // First step: Send OTP to school email
            const { sent, otp: generatedOtp } = await otpService.sendOtpToEmail(normalizedEmail);
            
            return res.json({
                success: true,
                message: sent ? 'OTP sent to your email. Please check your inbox.' : 'OTP generated (check console in development)',
                requiresOtp: true,
                otp: process.env.NODE_ENV === 'development' ? generatedOtp : undefined
            });
        }
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
