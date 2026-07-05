const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const db = require('../database');

const router = express.Router();

// Create a note (attached to subject or class) - stored minimally for now
router.post('/', authenticateToken, authorizeRoles('SUPER_ADMIN','SCHOOL_ADMIN','TEACHER'), async (req, res) => {
    try {
            const { title, content, subjectId, documentUrl } = req.body;
            if (!title || (!content && !documentUrl)) return res.status(400).json({ error: 'title and (content or documentUrl) required' });
            const note = {
                id: uuidv4(),
                school_id: req.user.school_id,
                created_by: req.user.user_id,
                subject_id: subjectId || null,
                title,
                content: content || null,
                document_url: documentUrl || null
            };
            const created = await db.createNote(note);
            res.status(201).json({ success: true, data: created, message: 'Note created' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// List notes for a subject
router.get('/subject/:subjectId', authenticateToken, async (req, res) => {
    try {
        const schoolId = req.user.role === 'SUPER_ADMIN' ? req.query.school_id || req.user.school_id : req.user.school_id;
        const subjectId = req.params.subjectId;
        const rows = await db.listNotesBySubject(schoolId, subjectId);
        res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
