const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const db = require('../database');

const router = express.Router();

// List payments for a school
router.get('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT'), async (req, res) => {
    try {
        const schoolId = req.user.role === 'SUPER_ADMIN' ? req.query.school_id : req.user.school_id;
        const payments = await db.listPaymentsBySchool(schoolId);
        res.json({ success: true, count: payments.length, data: payments });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Record a payment (from fee invoice)
router.post('/record', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT'), async (req, res) => {
    try {
        const { invoiceId, amount, paymentMethod, officerName, studentId } = req.body;
        if (!invoiceId || !amount || !paymentMethod) {
            return res.status(400).json({ error: 'invoice_id, amount, and payment_method are required' });
        }

        const schoolId = req.user.role === 'SUPER_ADMIN' ? req.body.school_id : req.user.school_id;
        const invoice = await db.getInvoiceById(invoiceId);
        if (!invoice || invoice.school_id !== schoolId) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        // Record payment
        const payment = await db.createPayment({
            id: uuidv4(),
            school_id: schoolId,
            student_id: studentId || invoice.student_id,
            amount,
            payment_method: paymentMethod,
            payment_type: 'FEE',
            status: 'COMPLETED',
            reference: `PAY-${Date.now()}`,
            officer_name: officerName || req.user.full_name,
            paid_at: new Date().toISOString()
        });

        // Update invoice
        const updated = await db.recordPayment(invoiceId, amount);

        // Generate receipt and PDF
        const receipt = generateReceipt(updated, payment);
        const PDFDocument = require('pdfkit');
        const fs = require('fs');
        const receiptsDir = require('path').join(__dirname, '..', 'receipts');
        if (!fs.existsSync(receiptsDir)) fs.mkdirSync(receiptsDir, { recursive: true });
        const pdfPath = require('path').join(receiptsDir, `${receipt.receiptNumber}.pdf`);
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const stream = fs.createWriteStream(pdfPath);
            doc.pipe(stream);
            doc.fontSize(20).text('School Payment Receipt', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Receipt No: ${receipt.receiptNumber}`);
            doc.text(`Verification: ${receipt.verificationCode}`);
            doc.text(`Student: ${receipt.studentName}`);
            doc.text(`Invoice: ${invoice.invoice_number || invoice.id}`);
            doc.text(`Amount Paid: ${receipt.amountPaid}`);
            doc.text(`Payment Method: ${receipt.paymentMethod || payment.payment_method}`);
            doc.text(`Paid Date: ${receipt.paidDate}`);
            doc.moveDown();
            doc.text('Thank you for your payment.', { align: 'center' });
            doc.end();
            receipt.receiptUrl = `/receipts/${receipt.receiptNumber}.pdf`;
        } catch (pdfErr) {
            console.error('Failed to generate PDF receipt:', pdfErr.message);
        }

        res.json({ success: true, data: { payment, invoice: updated, receipt } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get payment details
router.get('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT', 'PARENT'), async (req, res) => {
    try {
        const payment = await db.getPaymentById(req.params.id);
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        if (req.user.role !== 'SUPER_ADMIN' && req.user.school_id !== payment.school_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ success: true, data: payment });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Financial dashboard summary
router.get('/dashboard/summary', authenticateToken, authorizeRoles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT'), async (req, res) => {
    try {
        const schoolId = req.user.role === 'SUPER_ADMIN' ? req.query.school_id : req.user.school_id;

        const totalRevenue = await db.getTotalRevenue(schoolId);
        const todayPayments = await db.getTodayPayments(schoolId);
        const monthlyRevenue = await db.getMonthlyRevenue(schoolId);
        const outstandingFees = await db.getOutstandingFees(schoolId);
        const studentsOwing = await db.getStudentsOwingFees(schoolId);

        res.json({
            success: true,
            data: {
                totalRevenue,
                todayPayments,
                monthlyRevenue,
                outstandingFees,
                studentsOwingCount: studentsOwing.length,
                studentsOwing
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper function to generate receipt data
function generateReceipt(invoice, payment) {
    const receiptNumber = `RCP-${Date.now()}`;
    const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    return {
        receiptNumber,
        verificationCode,
        receiptUrl: `/receipts/${receiptNumber}.pdf`,
        studentName: invoice.student_name || 'N/A',
        admissionNumber: invoice.admission_number || 'N/A',
        class: invoice.class || 'N/A',
        paymentType: invoice.description || payment.payment_type,
        amountPaid: payment.amount,
        amountInWords: numberToWords(payment.amount),
        paymentMethod: payment.payment_method,
        paidDate: payment.paid_at,
        balanceRemaining: (invoice.amount - (invoice.paid_amount || 0)) - payment.amount,
        officerName: payment.officer_name,
        academicSession: 'Current',
        term: 'Term 1'
    };
}

// Helper: convert number to words
function numberToWords(num) {
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

    if (num === 0) return 'zero';
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
    if (num < 1000) return ones[Math.floor(num / 100)] + ' hundred' + (num % 100 ? ' ' + numberToWords(num % 100) : '');
    return num.toString(); // Simplified for large numbers
}

module.exports = router;
