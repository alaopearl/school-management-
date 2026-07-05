const express = require('express');
const db = require('../database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN'), async (req, res) => {
    try {
        const schoolId = req.user.role === 'SUPER_ADMIN' ? req.query.school_id : req.user.school_id;
        const users = await db.listUsersBySchool(schoolId);
        res.json({ success: true, count: users.length, data: users });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const user = await db.getUserById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (req.user.role !== 'SUPER_ADMIN' && req.user.school_id !== user.school_id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN'), async (req, res) => {
    try {
        const user = await db.getUserById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (req.user.role !== 'SUPER_ADMIN' && req.user.school_id !== user.school_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const updates = req.body;
        delete updates.password;
        const updated = await db.updateUser(req.params.id, updates);
        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN'), async (req, res) => {
    try {
        const user = await db.getUserById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (req.user.role !== 'SUPER_ADMIN' && req.user.school_id !== user.school_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await db.deleteUser(req.params.id);
        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Suspend user (student or teacher only)
router.post('/:id/suspend', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN'), async (req, res) => {
    try {
        const user = await db.getUserById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (req.user.role !== 'SUPER_ADMIN' && req.user.school_id !== user.school_id) return res.status(403).json({ error: 'Access denied' });
        if (!['TEACHER','STUDENT'].includes(user.role)) return res.status(400).json({ error: 'Can only suspend TEACHER or STUDENT accounts' });
        const updated = await db.updateUser(req.params.id, { status: 'SUSPENDED' });
        res.json({ success: true, data: updated, message: 'User suspended' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/:id/unsuspend', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN'), async (req, res) => {
    try {
        const user = await db.getUserById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (req.user.role !== 'SUPER_ADMIN' && req.user.school_id !== user.school_id) return res.status(403).json({ error: 'Access denied' });
        const updated = await db.updateUser(req.params.id, { status: 'ACTIVE' });
        res.json({ success: true, data: updated, message: 'User unsuspended' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
