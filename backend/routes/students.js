const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

const validateStudentData = (req, res, next) => {
    const {
        student_code,
        full_name,
        date_of_birth,
        gender,
        admission_date,
        parent_name,
        parent_contact
    } = req.body;

    if (!student_code || !full_name || !date_of_birth || !gender || !admission_date || !parent_name || !parent_contact) {
        return res.status(400).json({ error: 'Missing required student fields' });
    }
    next();
};

router.get('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'PARENT', 'STUDENT'), async (req, res) => {
    try {
        const schoolId = req.user.role === 'SUPER_ADMIN' ? req.query.school_id : req.user.school_id;
        if (!schoolId) {
            return res.status(400).json({ error: 'School context required' });
        }

        const students = await db.listStudentsBySchool(schoolId);
        res.json({ success: true, count: students.length, data: students });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/search/query', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'PARENT', 'STUDENT'), async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ error: 'Search query required' });

        const schoolId = req.user.role === 'SUPER_ADMIN' ? req.query.school_id : req.user.school_id;
        if (!schoolId) return res.status(400).json({ error: 'School context required' });

        const results = await db.searchStudents(schoolId, query);
        res.json({ success: true, count: results.length, data: results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/filter', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN'), async (req, res) => {
    try {
        const schoolId = req.user.role === 'SUPER_ADMIN' ? req.body.school_id : req.user.school_id;
        if (!schoolId) return res.status(400).json({ error: 'School context required' });

        const results = await db.filterStudents(schoolId, req.body);
        res.json({ success: true, count: results.length, data: results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'PARENT', 'STUDENT'), async (req, res) => {
    try {
        const student = await db.getStudentById(req.params.id);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        if (req.user.role !== 'SUPER_ADMIN' && req.user.school_id !== student.school_id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        res.json({ success: true, data: student });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN'), validateStudentData, async (req, res) => {
    try {
        const schoolId = req.user.role === 'SUPER_ADMIN' ? req.body.school_id : req.user.school_id;
        if (!schoolId) {
            return res.status(400).json({ error: 'School context required' });
        }

        const student = await db.createStudent({
            id: uuidv4(),
            school_id: schoolId,
            student_code: req.body.student_code,
            full_name: req.body.full_name,
            gender: req.body.gender,
            date_of_birth: req.body.date_of_birth,
            address: req.body.address,
            parent_name: req.body.parent_name,
            parent_contact: req.body.parent_contact,
            medical_info: req.body.medical_info,
            class_id: req.body.class_id,
            admission_date: req.body.admission_date,
            status: req.body.status || 'ACTIVE',
            gpa: req.body.gpa || 0,
            photo_url: req.body.photo_url,
            graduated_at: req.body.graduated_at
        });

        res.status(201).json({ success: true, data: student });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'), async (req, res) => {
    try {
        const student = await db.getStudentById(req.params.id);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        if (req.user.role !== 'SUPER_ADMIN' && req.user.school_id !== student.school_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const updates = req.body;
        const updated = await db.updateStudent(req.params.id, updates);
        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN'), async (req, res) => {
    try {
        const student = await db.getStudentById(req.params.id);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        if (req.user.role !== 'SUPER_ADMIN' && req.user.school_id !== student.school_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await db.deleteStudent(req.params.id);
        res.json({ success: true, message: 'Student deleted', data: { id: req.params.id } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
