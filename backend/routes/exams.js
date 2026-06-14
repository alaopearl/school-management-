const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const db = require('../database');

const router = express.Router();

// Create exam
router.post('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'), async (req, res) => {
    try {
        const { title, term, session, examType, classId, subjectId } = req.body;
        if (!title || !term || !session || !examType) {
            return res.status(400).json({ error: 'Missing required exam fields' });
        }

        const schoolId = req.user.role === 'SUPER_ADMIN' ? req.body.school_id : req.user.school_id;
        const exam = await db.createExam({
            id: uuidv4(),
            school_id: schoolId,
            title,
            term,
            session,
            exam_type: examType,
            class_id: classId || null,
            subject_id: subjectId || null
        });

        res.status(201).json({ success: true, data: exam });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// List exams
router.get('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT'), async (req, res) => {
    try {
        const schoolId = req.user.role === 'SUPER_ADMIN' ? req.query.school_id : req.user.school_id;
        const exams = await db.listExamsBySchool(schoolId);
        res.json({ success: true, count: exams.length, data: exams });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Post exam result
router.post('/:examId/results', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'), async (req, res) => {
    try {
        const { studentId, score, remarks } = req.body;
        if (!studentId || score === undefined) {
            return res.status(400).json({ error: 'studentId and score are required' });
        }

        const grade = calculateGrade(score);
        const result = await db.createResult({
            id: uuidv4(),
            exam_id: req.params.examId,
            student_id: studentId,
            score,
            grade,
            remarks: remarks || null
        });

        res.status(201).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get student results
router.get('/student/:studentId', authenticateToken, async (req, res) => {
    try {
        const results = await db.listResultsByStudent(req.params.studentId);
        const student = await db.getStudentById(req.params.studentId);

        // Calculate GPA
        let totalScore = 0, count = 0;
        results.forEach(r => {
            totalScore += r.score || 0;
            count++;
        });
        const gpa = count > 0 ? (totalScore / count / 20).toFixed(2) : 0; // 0-5 scale

        res.json({ success: true, data: { student, results, gpa } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get class rankings
router.get('/class/:classId/rankings', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'), async (req, res) => {
    try {
        const students = await db.listStudentsByClass(req.params.classId);
        const rankings = await Promise.all(students.map(async s => {
            const results = await db.listResultsByStudent(s.id);
            const totalScore = results.reduce((sum, r) => sum + (r.score || 0), 0);
            const gpa = results.length > 0 ? (totalScore / results.length / 20).toFixed(2) : 0;
            return { student: s, totalScore, gpa };
        }));

        rankings.sort((a, b) => b.totalScore - a.totalScore);
        rankings.forEach((r, i) => { r.position = i + 1; });

        res.json({ success: true, data: rankings });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper: grade calculator
function calculateGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
}

module.exports = router;
