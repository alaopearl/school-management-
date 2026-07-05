const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const backendApp = require('./backend/app');
const db = require('./backend/database');
const socketModule = require('./backend/socket');
const notificationWorker = require('./backend/workers/notificationWorker');

const PORT = process.env.PORT || 5000;
const PUBLIC_DIR = path.join(__dirname, 'frontend');

const app = express();

app.use(express.static(PUBLIC_DIR));
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

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
