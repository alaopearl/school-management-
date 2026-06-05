const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get('/', authenticateToken, authorizeRoles('SUPER_ADMIN'), async (req, res) => {
    try {
        const schools = await db.listSchools();
        res.json({ success: true, count: schools.length, data: schools });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const school = await db.getSchoolById(req.params.id);
        if (!school) {
            return res.status(404).json({ error: 'School not found' });
        }

        if (req.user.role !== 'SUPER_ADMIN' && req.user.school_id !== school.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ success: true, data: school });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id/settings', authenticateToken, async (req, res) => {
    try {
        const school = await db.getSchoolById(req.params.id);
        if (!school) {
            return res.status(404).json({ error: 'School not found' });
        }

        if (req.user.role !== 'SUPER_ADMIN' && req.user.school_id !== school.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const settings = req.body.settings || {};
        const updated = await db.updateSchoolSettings(req.params.id, settings);
        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
