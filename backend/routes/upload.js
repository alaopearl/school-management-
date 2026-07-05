const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const useCloudinary = !!process.env.CLOUDINARY_URL;
if (useCloudinary) {
    cloudinary.config({ url: process.env.CLOUDINARY_URL });
}

let upload;
if (useCloudinary) {
    // keep file in memory to stream to Cloudinary
    const storage = multer.memoryStorage();
    upload = multer({ storage });
} else {
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
    upload = multer({ storage });
}

// single file upload
router.post('/', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'file required' });
        if (useCloudinary) {
            // upload buffer to cloudinary
            const streamifier = require('streamifier');
            const streamUpload = (buffer) => {
                return new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream({ folder: 'school_uploads' }, (error, result) => {
                        if (error) return reject(error);
                        resolve(result);
                    });
                    streamifier.createReadStream(buffer).pipe(stream);
                });
            };
            const result = await streamUpload(req.file.buffer);
            return res.json({ success: true, url: result.secure_url, provider: 'cloudinary', raw: result });
        } else {
            const url = `/uploads/${req.file.filename}`;
            return res.json({ success: true, url, filename: req.file.filename });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
