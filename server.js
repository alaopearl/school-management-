const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const backendApp = require('./backend/app');
const db = require('./backend/database');
const socketModule = require('./backend/socket');
const notificationWorker = require('./backend/workers/notificationWorker');

const PORT = process.env.PORT || 5000;
// Resolve frontend build output from common locations so deploys from different
// build contexts (root or /src) still work on hosts like Render.
const publicCandidates = [
  path.join(__dirname, 'frontend', 'dist'),
  path.join(__dirname, 'dist'),
  path.join(__dirname, 'src', 'dist')
];
let PUBLIC_DIR = null;
// prefer a candidate that actually contains an index.html
for (const p of publicCandidates) {
  try {
    const indexFile = path.join(p, 'index.html');
    if (fs.existsSync(indexFile)) {
      PUBLIC_DIR = p;
      break;
    }
  } catch (e) {
    // ignore
  }
}
if (!PUBLIC_DIR) {
  console.warn(`No frontend index.html found in ${publicCandidates.join(', ')}. Serving API only.`);
} else {
  console.log(`Serving static files from ${PUBLIC_DIR}`);
}

const app = express();

if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  app.get('/', (req, res) => {
    const indexFile = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
    // if index missing, return helpful text
    return res.status(200).send('Frontend build not found. Please run the build and redeploy.');
  });
} else {
  // No frontend build available — continue serving backend routes only
  app.get('/', (req, res) => res.status(200).send('Backend running. Frontend build not present on server.'));
}

app.use(backendApp);

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
    // start the notification worker after socket and DB are available
    try {
      notificationWorker.startWorker(5000);
    } catch (err) {
      console.error('Failed to start notification worker:', err.message);
    }
  });
})();
