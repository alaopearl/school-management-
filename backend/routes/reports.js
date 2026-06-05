const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const resolveSchoolContext = (req) => {
    if (req.user.role === 'SUPER_ADMIN') {
        return req.query.school_id || req.body.school_id;
    }
    return req.user.school_id;
};

router.use(authenticateToken);

router.get('/statistics', authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN'), async (req, res) => {
    try {
        const schoolId = resolveSchoolContext(req);
        if (!schoolId) {
            return res.status(400).json({ error: 'School context required' });
        }

        const stats = await db.getStatistics(schoolId);
        res.json({
            success: true,
            data: {
                totalStudents: stats.total || 0,
                activeStudents: stats.active || 0,
                graduatedStudents: stats.graduated || 0,
                averageGPA: parseFloat(stats.average_gpa || 0).toFixed(2)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/level-distribution', authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN'), async (req, res) => {
    try {
        const schoolId = resolveSchoolContext(req);
        if (!schoolId) {
            return res.status(400).json({ error: 'School context required' });
        }

        const distribution = await db.getLevelDistribution(schoolId);
        res.json({ success: true, data: distribution });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/gender-distribution', authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN'), async (req, res) => {
    try {
        const schoolId = resolveSchoolContext(req);
        if (!schoolId) {
            return res.status(400).json({ error: 'School context required' });
        }

        const distribution = await db.getGenderDistribution(schoolId);
        res.json({ success: true, data: distribution });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/status-distribution', authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN'), async (req, res) => {
    try {
        const schoolId = resolveSchoolContext(req);
        if (!schoolId) {
            return res.status(400).json({ error: 'School context required' });
        }

        const distribution = await db.getStatusDistribution(schoolId);
        res.json({ success: true, data: distribution });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/gpa-by-level', authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN'), async (req, res) => {
    try {
        const schoolId = resolveSchoolContext(req);
        if (!schoolId) {
            return res.status(400).json({ error: 'School context required' });
        }

        const report = await db.getAverageGPAByLevel(schoolId);
        res.json({
            success: true,
            data: report.map(item => ({
                level: item.class_id || 'Unassigned',
                averageGPA: parseFloat(item.average_gpa || 0).toFixed(2),
                studentCount: item.student_count
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/dashboard', authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN'), async (req, res) => {
    try {
        const schoolId = resolveSchoolContext(req);
        if (!schoolId) {
            return res.status(400).json({ error: 'School context required' });
        }

        const [stats, levelDist, genderDist, statusDist, gpaByLevel] = await Promise.all([
            db.getStatistics(schoolId),
            db.getLevelDistribution(schoolId),
            db.getGenderDistribution(schoolId),
            db.getStatusDistribution(schoolId),
            db.getAverageGPAByLevel(schoolId)
        ]);

        res.json({
            success: true,
            data: {
                statistics: {
                    totalStudents: stats.total || 0,
                    activeStudents: stats.active || 0,
                    graduatedStudents: stats.graduated || 0,
                    averageGPA: parseFloat(stats.average_gpa || 0).toFixed(2)
                },
                levelDistribution: levelDist,
                genderDistribution: genderDist,
                statusDistribution: statusDist,
                gpaByLevel: gpaByLevel.map(item => ({
                    level: item.class_id || 'Unassigned',
                    averageGPA: parseFloat(item.average_gpa || 0).toFixed(2),
                    studentCount: item.student_count
                }))
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
