const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'backend', 'students.db');
const email = 'school.management.website01@gmail.com';

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening DB:', err.message);
    process.exit(1);
  }
});

db.get('SELECT id, email, role, status, full_name FROM users WHERE email = ?', [email], (err, row) => {
  if (err) {
    console.error('Query error:', err.message);
    process.exit(1);
  }
  console.log(JSON.stringify(row || null));
  db.close();
});
