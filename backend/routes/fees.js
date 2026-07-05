const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const db = require('../database');

const router = express.Router();

// Create invoice
router.post('/invoices', authenticateToken, authorizeRoles('SUPER_ADMIN','SCHOOL_ADMIN','ACCOUNTANT'), async (req, res) => {
    try {
        const { studentId, amount, description, dueDate } = req.body;
        if (!studentId || !amount) return res.status(400).json({ error: 'studentId and amount required' });
        const schoolId = req.user.role === 'SUPER_ADMIN' ? req.body.school_id || null : req.user.school_id;
        const invoice = await db.createInvoice({ id: uuidv4(), school_id: schoolId, student_id: studentId, invoice_number: `INV-${Date.now()}`, amount, due_date: dueDate || null, description });
        res.status(201).json({ success: true, data: invoice });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// List invoices for school
router.get('/invoices', authenticateToken, authorizeRoles('SUPER_ADMIN','SCHOOL_ADMIN','ACCOUNTANT','PARENT'), async (req, res) => {
    try {
        const schoolId = req.user.role === 'SUPER_ADMIN' ? req.query.school_id || null : req.user.school_id;
        const rows = await db.listPaymentsBySchool(schoolId); // reuse payments list which returns payments; invoices listing helper exists as listInvoicesBySchool
        // better: use fees listing
        const invoices = await db.listInvoicesBySchool ? db.listInvoicesBySchool(schoolId) : [];
        res.json({ success: true, count: (invoices.length||0), data: invoices });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get invoice
router.get('/invoices/:id', authenticateToken, authorizeRoles('SUPER_ADMIN','SCHOOL_ADMIN','ACCOUNTANT','PARENT'), async (req, res) => {
    try {
        const inv = await db.getInvoiceById(req.params.id);
        if (!inv) return res.status(404).json({ error: 'Invoice not found' });
        if (req.user.role !== 'SUPER_ADMIN' && req.user.school_id !== inv.school_id) return res.status(403).json({ error: 'Access denied' });
        res.json({ success: true, data: inv });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
