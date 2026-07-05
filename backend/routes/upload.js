const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const unique = Date.now() + '-' + Math.random().toString(36).substring(2,8);
        const safe = file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_');
        cb(null, `${unique}-${safe}`);
    }
});

const upload = multer({ storage });

// single file upload
router.post('/', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'file required' });
        const url = `/uploads/${req.file.filename}`;
        res.json({ success: true, url, filename: req.file.filename });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
