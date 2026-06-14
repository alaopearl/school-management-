const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const db = require('../database');

const router = express.Router();

// Upload/create syllabus
router.post('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'), async (req, res) => {
    try {
        const { subjectId, title, content, documentUrl, topics, completionPercentage } = req.body;
        if (!subjectId || !title) {
            return res.status(400).json({ error: 'subjectId and title are required' });
        }

        const syllabus = {
            id: uuidv4(),
            subject_id: subjectId,
            school_id: req.user.school_id,
            title,
            content: content || null,
            document_url: documentUrl || null,
            topics: JSON.stringify(topics || []),
            completion_percentage: completionPercentage || 0,
            created_by: req.user.user_id,
            updated_at: new Date().toISOString()
        };

        res.status(201).json({ success: true, data: syllabus, message: 'Syllabus created. Extend database schema to persist.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// List syllabi by subject
router.get('/subject/:subjectId', authenticateToken, async (req, res) => {
    try {
        res.json({ success: true, data: [], message: 'Syllabus retrieval endpoint ready for database extension' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Teacher: mark topic as completed
router.post('/:syllabusId/mark-topic-completed', authenticateToken, authorizeRoles('TEACHER'), async (req, res) => {
    try {
        const { topicName } = req.body;
        res.json({ success: true, data: { syllabusId: req.params.syllabusId, topic: topicName, status: 'COMPLETED' } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
