const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const schoolStatuses = new Set(['PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'SUBSCRIPTION_EXPIRED']);

const audit = (req, action, details = {}) => db.createLog({
    id: require('uuid').v4(), user_id: req.user.user_id, action, details: JSON.stringify(details), ip: req.ip, status: 200
}).catch(() => {});

router.get('/platform/dashboard', authenticateToken, authorizeRoles('SUPER_ADMIN'), async (req, res) => {
    try { res.json({ success: true, data: await db.getPlatformMetrics() }); }
    catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/', authenticateToken, authorizeRoles('SUPER_ADMIN'), async (req, res) => {
    try {
        const schools = await db.listSchoolsWithMetrics(req.query);
        res.json({ success: true, count: schools.length, data: schools });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const school = await db.getSchoolById(req.params.id);
        if (!school) return res.status(404).json({ error: 'School not found' });
        if (req.user.role !== 'SUPER_ADMIN' && req.user.school_id !== school.id) return res.status(403).json({ error: 'Access denied' });
        res.json({ success: true, data: school });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.put('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN'), async (req, res) => {
    try {
        if (!await db.getSchoolById(req.params.id)) return res.status(404).json({ error: 'School not found' });
        const school = await db.updateSchool(req.params.id, req.body);
        await audit(req, 'SCHOOL_UPDATED', { schoolId: school.id });
        res.json({ success: true, data: school });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/:id/approve', authenticateToken, authorizeRoles('SUPER_ADMIN'), async (req, res) => {
    try {
        const school = await db.getSchoolById(req.params.id);
        if (!school) return res.status(404).json({ error: 'School not found' });
        const updated = await db.updateSchool(school.id, { status: 'ACTIVE', login_enabled: 1, approved_by: req.user.user_id, approved_at: new Date().toISOString(), rejection_reason: null });
        await db.run("UPDATE users SET status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP WHERE school_id = ? AND role = 'SCHOOL_ADMIN'", [school.id]);
        await audit(req, 'SCHOOL_APPROVED', { schoolId: school.id });
        res.json({ success: true, data: updated, message: 'School approved and administrator access enabled' });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/:id/reject', authenticateToken, authorizeRoles('SUPER_ADMIN'), async (req, res) => {
    try {
        const school = await db.getSchoolById(req.params.id);
        if (!school) return res.status(404).json({ error: 'School not found' });
        const updated = await db.updateSchool(school.id, { status: 'REJECTED', login_enabled: 0, rejection_reason: req.body.reason || 'Registration request was not approved' });
        await db.run("UPDATE users SET status = 'INACTIVE', updated_at = CURRENT_TIMESTAMP WHERE school_id = ?", [school.id]);
        await audit(req, 'SCHOOL_REJECTED', { schoolId: school.id, reason: req.body.reason });
        res.json({ success: true, data: updated });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/:id/status', authenticateToken, authorizeRoles('SUPER_ADMIN'), async (req, res) => {
    try {
        const { status, loginEnabled } = req.body;
        if (status && !schoolStatuses.has(status)) return res.status(400).json({ error: 'Invalid school status' });
        const school = await db.updateSchool(req.params.id, { status, login_enabled: loginEnabled === undefined ? undefined : Number(Boolean(loginEnabled)) });
        if (!school) return res.status(404).json({ error: 'School not found' });
        await audit(req, 'SCHOOL_STATUS_CHANGED', { schoolId: school.id, status, loginEnabled });
        res.json({ success: true, data: school });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/:id/reset-password', authenticateToken, authorizeRoles('SUPER_ADMIN'), async (req, res) => {
    try {
        if (!req.body.password || req.body.password.length < 8) return res.status(400).json({ error: 'A password of at least 8 characters is required' });
        const school = await db.getSchoolById(req.params.id);
        if (!school) return res.status(404).json({ error: 'School not found' });
        const admin = (await db.listUsersBySchool(school.id)).find(user => user.role === 'SCHOOL_ADMIN');
        if (!admin) return res.status(404).json({ error: 'School administrator not found' });
        await db.updateUser(admin.id, { password: await bcrypt.hash(req.body.password, 10) });
        await audit(req, 'SCHOOL_ADMIN_PASSWORD_RESET', { schoolId: school.id, adminId: admin.id });
        res.json({ success: true, message: 'School administrator password reset' });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/:id/logs', authenticateToken, authorizeRoles('SUPER_ADMIN'), async (req, res) => {
    try {
        const logs = await db.all('SELECT l.* FROM logs l JOIN users u ON u.id = l.user_id WHERE u.school_id = ? ORDER BY l.created_at DESC LIMIT 200', [req.params.id]);
        res.json({ success: true, count: logs.length, data: logs });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.delete('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN'), async (req, res) => {
    try {
        const school = await db.getSchoolById(req.params.id);
        if (!school) return res.status(404).json({ error: 'School not found' });
        await db.deleteSchool(school.id); await audit(req, 'SCHOOL_DELETED', { schoolId: school.id });
        res.json({ success: true, message: 'School deleted' });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

module.exports = router;
