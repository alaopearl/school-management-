const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const db = require('../database');

const router = express.Router();

// Parent: view child's attendance
router.get('/attendance/:studentId', authenticateToken, authorizeRoles('PARENT', 'SUPER_ADMIN', 'SCHOOL_ADMIN'), async (req, res) => {
    try {
        const attendance = await db.listAttendanceBySchool(req.user.school_id, { person_id: req.params.studentId });
        const present = attendance.filter(a => a.status === 'PRESENT').length;
        const absent = attendance.filter(a => a.status === 'ABSENT').length;
        const percentage = attendance.length > 0 ? ((present / attendance.length) * 100).toFixed(2) : 0;

        res.json({
            success: true,
            data: {
                attendance,
                summary: { totalRecords: attendance.length, present, absent, percentage }
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Parent: view child's results
router.get('/results/:studentId', authenticateToken, authorizeRoles('PARENT', 'SUPER_ADMIN', 'SCHOOL_ADMIN'), async (req, res) => {
    try {
        const results = await db.listResultsByStudent(req.params.studentId);
        const totalScore = results.reduce((sum, r) => sum + (r.score || 0), 0);
        const gpa = results.length > 0 ? (totalScore / results.length / 20).toFixed(2) : 0;

        res.json({
            success: true,
            data: {
                results,
                summary: { gpa, averageScore: results.length > 0 ? (totalScore / results.length).toFixed(2) : 0 }
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Parent: view fee balance
router.get('/fees/:studentId', authenticateToken, authorizeRoles('PARENT', 'SUPER_ADMIN', 'SCHOOL_ADMIN'), async (req, res) => {
    try {
        const student = await db.getStudentById(req.params.studentId);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const invoices = await db.listInvoicesBySchool(student.school_id);
        const studentInvoices = invoices.filter(inv => inv.student_id === req.params.studentId);

        const totalFees = studentInvoices.reduce((sum, inv) => sum + inv.amount, 0);
        const totalPaid = studentInvoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
        const balance = totalFees - totalPaid;

        res.json({
            success: true,
            data: {
                invoices: studentInvoices,
                summary: { totalFees, totalPaid, balance, outstanding: balance > 0 }
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Parent: download receipt
router.get('/receipt/:invoiceId', authenticateToken, authorizeRoles('PARENT', 'SUPER_ADMIN', 'SCHOOL_ADMIN'), async (req, res) => {
    try {
        const invoice = await db.getInvoiceById(req.params.invoiceId);
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        res.json({
            success: true,
            data: {
                receiptNumber: `RCP-${invoice.id}`,
                studentName: 'N/A',
                amount: invoice.amount,
                paidAmount: invoice.paid_amount,
                balance: invoice.amount - invoice.paid_amount,
                message: 'Receipt PDF generation requires pdfkit library integration'
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
