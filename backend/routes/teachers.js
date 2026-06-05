const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

const validateTeacherData = (req, res, next) => {
    const { full_name, email } = req.body;
    if (!full_name || !email) {
        return res.status(400).json({ error: 'Missing required teacher fields' });
    }
    next();
};

const resolveSchoolContext = (req) => {
    if (req.user.role === 'SUPER_ADMIN') {
        return req.body.school_id || req.query.school_id;
    }
    return req.user.school_id;
};

router.get('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN'), async (req, res) => {
    try {
        const schoolId = resolveSchoolContext(req);
        if (!schoolId) {
            return res.status(400).json({ error: 'School context required' });
        }

        const teachers = await db.listTeachersBySchool(schoolId);
        res.json({ success: true, count: teachers.length, data: teachers });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN'), async (req, res) => {
    try {
        const teacher = await db.getTeacherById(req.params.id);
        if (!teacher) {
            return res.status(404).json({ error: 'Teacher not found' });
        }
        if (req.user.role !== 'SUPER_ADMIN' && req.user.school_id !== teacher.school_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ success: true, data: teacher });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN'), validateTeacherData, async (req, res) => {
    try {
        const schoolId = resolveSchoolContext(req);
        if (!schoolId) {
            return res.status(400).json({ error: 'School context required' });
        }

        const teacher = await db.createTeacher({
            id: uuidv4(),
            school_id: schoolId,
            full_name: req.body.full_name,
            email: req.body.email.toLowerCase(),
            phone: req.body.phone || null,
            department: req.body.department || null,
            subjects: req.body.subjects || null,
            salary: req.body.salary || 0,
            status: req.body.status || 'ACTIVE',
            hired_date: req.body.hired_date || null
        });

        res.status(201).json({ success: true, data: teacher });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN'), async (req, res) => {
    try {
        const teacher = await db.getTeacherById(req.params.id);
        if (!teacher) {
            return res.status(404).json({ error: 'Teacher not found' });
        }
        if (req.user.role !== 'SUPER_ADMIN' && req.user.school_id !== teacher.school_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const updates = { ...req.body };
        const updated = await db.updateTeacher(req.params.id, updates);
        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN'), async (req, res) => {
    try {
        const teacher = await db.getTeacherById(req.params.id);
        if (!teacher) {
            return res.status(404).json({ error: 'Teacher not found' });
        }
        if (req.user.role !== 'SUPER_ADMIN' && req.user.school_id !== teacher.school_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await db.deleteTeacher(req.params.id);
        res.json({ success: true, message: 'Teacher removed', data: { id: req.params.id } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
