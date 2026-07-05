const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/logs', authenticateToken, authorizeRoles('SUPER_ADMIN'), async (req, res) => {
    try {
        const logs = await db.listLogs();
        res.json({ success: true, count: logs.length, data: logs });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
