const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const db = require('../database');

const router = express.Router();

// Record attendance entries (bulk)
router.post('/record', authenticateToken, authorizeRoles('SUPER_ADMIN','SCHOOL_ADMIN','TEACHER'), async (req, res) => {
    try {
        const { records, recordDate, personType } = req.body; // records: [{ person_id, status, remarks }]
        if (!Array.isArray(records) || !recordDate || !personType) return res.status(400).json({ error: 'records, recordDate and personType are required' });

        const schoolId = req.user.role === 'SUPER_ADMIN' ? req.body.school_id || null : req.user.school_id;
        const created = [];
        for (const r of records) {
            const id = uuidv4();
            await db.recordAttendance({ id, school_id: schoolId, record_date: recordDate, person_type: personType, person_id: r.person_id, status: r.status, remarks: r.remarks || null });
            created.push(id);
        }

        res.json({ success: true, created_count: created.length, ids: created });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// List attendance for a school (with optional date)
router.get('/', authenticateToken, authorizeRoles('SUPER_ADMIN','SCHOOL_ADMIN','TEACHER'), async (req, res) => {
    try {
        const schoolId = req.user.role === 'SUPER_ADMIN' ? req.query.school_id || null : req.user.school_id;
        const date = req.query.date || null;
        const rows = await db.listAttendanceBySchool(schoolId, { record_date: date });
        res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
