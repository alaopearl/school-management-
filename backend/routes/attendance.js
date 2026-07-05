const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const db = require('../database');

const router = express.Router();

// Record attendance entries (bulk)
router.post('/record', authenticateToken, authorizeRoles('SUPER_ADMIN','SCHOOL_ADMIN','TEACHER'), async (req, res) => {
    try {
        const { records, recordDate, personType } = req.body; // records: [{ person_id, action: 'MARK'|'CANCEL', remarks }]
        if (!Array.isArray(records) || !recordDate || !personType) return res.status(400).json({ error: 'records, recordDate and personType are required' });

        const schoolId = req.user.role === 'SUPER_ADMIN' ? req.body.school_id || null : req.user.school_id;
        const created = [];
        for (const r of records) {
            const id = uuidv4();
            // action can be MARK or CANCEL — store as status
            const status = (r.action && r.action.toUpperCase() === 'CANCEL') ? 'CANCELLED' : (r.action && r.action.toUpperCase() === 'MARK' ? 'PRESENT' : (r.status || 'PRESENT'));
            await db.recordAttendance({ id, school_id: schoolId, record_date: recordDate, person_type: personType, person_id: r.person_id, status, remarks: r.remarks || null });
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

// Get students grouped by class for marking
router.get('/students/grouped', authenticateToken, authorizeRoles('SUPER_ADMIN','SCHOOL_ADMIN','TEACHER'), async (req, res) => {
    try {
        const schoolId = req.user.role === 'SUPER_ADMIN' ? req.query.school_id || req.user.school_id : req.user.school_id;
        const grouped = await db.listStudentsGroupedByClass(schoolId);
        res.json({ success: true, data: grouped });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Student attendance summary (percentage)
router.get('/student/:id/summary', authenticateToken, async (req, res) => {
    try {
        const studentId = req.params.id;
        // any authenticated user can request their own summary, or school admin/teacher can request
        if (req.user.role === 'STUDENT' && req.user.user_id !== studentId) return res.status(403).json({ error: 'Forbidden' });
        const summary = await db.getStudentAttendanceSummary(studentId);
        res.json({ success: true, data: summary });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
