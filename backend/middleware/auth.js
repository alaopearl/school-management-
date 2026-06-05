const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication token is missing or invalid' });
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, payload) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid or expired token' });
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
