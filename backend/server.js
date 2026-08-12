const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const backendApp = require('./app');
const db = require('./database');
const socketModule = require('./socket');
const notificationWorker = require('./workers/notificationWorker');

const PORT = process.env.PORT || 5000;
const PUBLIC_DIR = path.join(__dirname, '..', 'frontend', 'dist');

const app = express();

if (fs.existsSync(path.join(PUBLIC_DIR, 'index.html'))) {
    app.use(express.static(PUBLIC_DIR));
} else {
    console.warn('Frontend build not found at', PUBLIC_DIR);
}

app.use(backendApp);

app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/receipts') || req.path.startsWith('/invoices')) {
        return res.status(404).json({ error: 'Not found' });
    }

    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }

    res.status(200).send('Backend running. Frontend build not present.');
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
socketModule.init(io);

(async () => {
    try {
        await db.initialize();
    } catch (err) {
        console.error('DB initialize failed:', err.message);
    }

    server.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log('Student Management System backend is ready');
        try {
            notificationWorker.startWorker(5000);
        } catch (err) {
            console.error('Failed to start notification worker:', err.message);
        }
    });
})();
