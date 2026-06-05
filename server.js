const path = require('path');
const express = require('express');
const backendApp = require('./backend/app');

const PORT = process.env.PORT || 5000;
const PUBLIC_DIR = path.join(__dirname, 'frontend');

const app = express();

app.use(express.static(PUBLIC_DIR));
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use(backendApp);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Student Management System backend is ready');
});
