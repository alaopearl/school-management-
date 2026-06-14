const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const db = require('../database');

const router = express.Router();

// List all subscription plans (public)
router.get('/', async (req, res) => {
    try {
        const plans = await db.listSubscriptionPlans();
        res.json({ success: true, count: plans.length, data: plans });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Super Admin: Create a new plan
router.post('/', authenticateToken, authorizeRoles('SUPER_ADMIN'), async (req, res) => {
    try {
        const { name, description, price, maxStudents, maxTeachers, features, billingCycle } = req.body;
        if (!name || price === undefined) {
            return res.status(400).json({ error: 'name and price are required' });
        }

        const plan = await db.createSubscriptionPlan({
            id: uuidv4(),
            name,
            description: description || null,
            price,
            max_students: maxStudents || 500,
            max_teachers: maxTeachers || 50,
            features: JSON.stringify(features || []),
            billing_cycle: billingCycle || 'MONTHLY'
        });

        res.status(201).json({ success: true, data: plan });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get plan details
router.get('/:id', async (req, res) => {
    try {
        const plan = await db.getSubscriptionPlanById(req.params.id);
        if (!plan) {
            return res.status(404).json({ error: 'Plan not found' });
        }
        res.json({ success: true, data: plan });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Super Admin: Update a plan
router.put('/:id', authenticateToken, authorizeRoles('SUPER_ADMIN'), async (req, res) => {
    try {
        const plan = await db.getSubscriptionPlanById(req.params.id);
        if (!plan) {
            return res.status(404).json({ error: 'Plan not found' });
        }

        const updated = await db.updateSubscriptionPlan(req.params.id, req.body);
        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Super Admin: Upgrade/downgrade school subscription
router.post('/school/:schoolId/upgrade', authenticateToken, authorizeRoles('SUPER_ADMIN'), async (req, res) => {
    try {
        const { planId, durationMonths } = req.body;
        if (!planId || !durationMonths) {
            return res.status(400).json({ error: 'planId and durationMonths are required' });
        }

        const school = await db.getSchoolById(req.params.schoolId);
        if (!school) {
            return res.status(404).json({ error: 'School not found' });
        }

        const plan = await db.getSubscriptionPlanById(planId);
        if (!plan) {
            return res.status(404).json({ error: 'Plan not found' });
        }

        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

        const updated = await db.updateSchoolSubscription(req.params.schoolId, {
            subscription_plan: plan.name,
            subscription_expires_at: expiresAt.toISOString()
        });

        res.json({
            success: true,
            data: {
                school: updated,
                plan,
                subscriptionExpires: expiresAt.toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get school current plan
router.get('/school/:schoolId/current', authenticateToken, async (req, res) => {
    try {
        const school = await db.getSchoolById(req.params.schoolId);
        if (!school) {
            return res.status(404).json({ error: 'School not found' });
        }

        if (req.user.role !== 'SUPER_ADMIN' && req.user.school_id !== school.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const plan = await db.getSubscriptionPlanByName(school.subscription_plan);
        res.json({
            success: true,
            data: {
                school: {
                    id: school.id,
                    name: school.name,
                    plan: school.subscription_plan,
                    subscriptionExpiresAt: school.subscription_expires_at
                },
                plan: plan || { name: school.subscription_plan || 'FREE', price: 0 }
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
