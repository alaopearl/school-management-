const jwt = require('jsonwebtoken');
const db = require('../database');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication token is missing or invalid' });
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, async (err, payload) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        if (payload.role !== 'SUPER_ADMIN' && payload.school_id) {
            try {
                const school = await db.getSchoolById(payload.school_id);
                if (!school || school.login_enabled === 0 || ['PENDING_APPROVAL', 'SUSPENDED', 'REJECTED'].includes(school.status)) {
                    return res.status(403).json({ error: 'This school account is not permitted to access the platform.' });
                }
                const expired = school.status === 'SUBSCRIPTION_EXPIRED' || (school.subscription_expires_at && new Date(school.subscription_expires_at) < new Date());
                if (expired && !req.originalUrl.startsWith('/api/plans/')) {
                    return res.status(402).json({ error: 'Subscription expired. Billing access only.', code: 'SUBSCRIPTION_EXPIRED' });
                }
                req.school = school;
            } catch (error) {
                return res.status(500).json({ error: 'Unable to validate school access' });
            }
        }
        req.user = payload;
        next();
    });
};

const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied: insufficient privileges' });
        }
        next();
    };
};

const requireSchoolContext = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user.role === 'SUPER_ADMIN') {
        return next();
    }

    if (!req.user.school_id) {
        return res.status(403).json({ error: 'School context is required' });
    }

    next();
};

module.exports = {
    authenticateToken,
    authorizeRoles,
    requireSchoolContext
};
