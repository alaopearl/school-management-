const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

const validateClassData = (req, res, next) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Class name is required' });
    }
    next();
};

const allowedClassFields = ['name', 'arm', 'department', 'teacher_id', 'description'];
const filterClassUpdates = (updates) => {
    return Object.fromEntries(
        Object.entries(updates).filter(
            ([key, value]) => allowedClassFields.includes(key) && value !== undefined
        )
    );
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
        const classes = await db.listClassesBySchool(schoolId);
        res.json({ success: true, count: classes.length, data: classes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN'), async (req, res) => {
    try {
        const klass = await db.getClassById(req.params.id);
        if (!klass) {
            return res.status(404).json({ error: 'Class not found' });
        }
        if (req.user.role !== 'SUPER_ADMIN' && req.user.school_id !== klass.school_id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        res.json({ success: true, data: klass });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN'), validateClassData, async (req, res) => {
    try {
        const schoolId = resolveSchoolContext(req);
        if (!schoolId) {
            return res.status(400).json({ error: 'School context required' });
        }

        const klass = await db.createClass({
            id: uuidv4(),
            school_id: schoolId,
            name: req.body.name,
            arm: req.body.arm || null,
            department: req.body.department || null,
            teacher_id: req.body.teacher_id || null,
            description: req.body.description || null
        });

        res.status(201).json({ success: true, data: klass });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN'), async (req, res) => {
    try {
        const klass = await db.getClassById(req.params.id);
        if (!klass) {
            return res.status(404).json({ error: 'Class not found' });
        }
        if (req.user.role !== 'SUPER_ADMIN' && req.user.school_id !== klass.school_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const updates = filterClassUpdates(req.body);
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid class fields to update' });
        }
        if (updates.name !== undefined && !updates.name) {
            return res.status(400).json({ error: 'Class name cannot be empty' });
        }

        const updated = await db.updateClass(req.params.id, updates);
        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN'), async (req, res) => {
    try {
        const klass = await db.getClassById(req.params.id);
        if (!klass) {
            return res.status(404).json({ error: 'Class not found' });
        }
        if (req.user.role !== 'SUPER_ADMIN' && req.user.school_id !== klass.school_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await db.deleteClass(req.params.id);
        res.json({ success: true, message: 'Class deleted', data: { id: req.params.id } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
