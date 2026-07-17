const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const db = require('../database');

const router = express.Router();

// Create invoice
router.post('/invoices', authenticateToken, authorizeRoles('SUPER_ADMIN','SCHOOL_ADMIN','ACCOUNTANT'), async (req, res) => {
    try {
        const { studentId, amount, description, dueDate, paymentMethod } = req.body;
        if (!studentId || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
            return res.status(400).json({ error: 'A student and a positive invoice amount are required' });
        }
        if (!['CASH', 'TRANSFER'].includes(paymentMethod)) {
            return res.status(400).json({ error: 'Select Cash or Bank Transfer as the payment method' });
        }
        const schoolId = req.user.role === 'SUPER_ADMIN' ? req.body.school_id || null : req.user.school_id;
        if (!schoolId) return res.status(400).json({ error: 'Select a school before creating an invoice' });

        const [school, student] = await Promise.all([db.getSchoolById(schoolId), db.getStudentById(studentId)]);
        if (!school || !student || student.school_id !== schoolId) {
            return res.status(404).json({ error: 'Student was not found for the selected school' });
        }

        const invoice = await db.createInvoice({
            id: uuidv4(), school_id: schoolId, student_id: studentId,
            invoice_number: `INV-${new Date().getFullYear()}-${uuidv4().slice(0, 8).toUpperCase()}`,
            description, payment_method: paymentMethod
        });
        const invoiceUrl = await generateInvoicePdf(invoice, school, student);
        res.status(201).json({ success: true, data: { ...invoice, invoiceUrl } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// List invoices for school
router.get('/invoices', authenticateToken, authorizeRoles('SUPER_ADMIN','SCHOOL_ADMIN','ACCOUNTANT','PARENT'), async (req, res) => {
    try {
        const schoolId = req.user.role === 'SUPER_ADMIN' ? req.query.school_id || null : req.user.school_id;
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
module.exports.generateInvoicePdf = generateInvoicePdf;

async function generateInvoicePdf(invoice, school, student) {
    const invoicesDir = path.join(__dirname, '..', 'invoices');
    if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });

    const fileName = `${invoice.invoice_number}.pdf`;
    const filePath = path.join(invoicesDir, fileName);
    const amount = Number(invoice.amount || 0);
    const paid = Number(invoice.paid_amount || 0);
    const outstanding = Math.max(0, amount - paid);
    const naira = value => `NGN ${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

    await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);
        stream.on('finish', resolve);
        stream.on('error', reject);

        doc.fontSize(22).fillColor('#1e40af').text(school.name, { align: 'center' });
        if (school.motto) doc.fontSize(10).fillColor('#444').text(school.motto, { align: 'center' });
        doc.moveDown(1.5);
        doc.fontSize(18).fillColor('#111').text('FEE INVOICE', { align: 'center' });
        doc.moveDown();
        doc.fontSize(11).text(`Invoice No: ${invoice.invoice_number}`);
        doc.text(`Date Issued: ${new Date(invoice.created_at || Date.now()).toLocaleDateString('en-GB')}`);
        doc.text(`Due Date: ${invoice.due_date || 'Not specified'}`);
        doc.moveDown();
        doc.fontSize(12).text('Bill To', { underline: true });
        doc.fontSize(11).text(`Student: ${student.full_name || student.name || 'N/A'}`);
        doc.text(`Student ID: ${student.student_code || student.id}`);
        doc.text(`Date of Birth: ${student.date_of_birth || student.dateOfBirth || 'Not recorded'}`);
        doc.text(`Gender: ${student.gender || 'Not recorded'}`);
        doc.text(`Parent/Guardian: ${student.parent_name || student.parentName || 'Not recorded'}`);
        doc.text(`Parent Contact: ${student.parent_contact || student.contactNumber || 'Not recorded'}`);
        if (student.address) doc.text(`Address: ${student.address}`);
        doc.moveDown();
        doc.text(`Description: ${invoice.description || 'School fees'}`);
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').text(`Total Invoice Amount: ${naira(amount)}`);
        doc.text(`Total Payment Received: ${naira(paid)}`);
        doc.fillColor('#b91c1c').text(`Outstanding Balance: ${naira(outstanding)}`);
        doc.fillColor('#111').moveDown();
        doc.font('Helvetica').text(`Payment Method: ${invoice.payment_method === 'TRANSFER' ? 'Bank Transfer' : 'Cash'}`);
        doc.fontSize(9).fillColor('#555').text('Please present this invoice when making payment.');
        doc.end();
    });

    return `/invoices/${fileName}`;
}
