const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'backend', 'students.db');
const uploadsDir = path.join(__dirname, '..', 'backend', 'uploads');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) return console.error('DB open error', err.message);
});

const emailsToRemove = ['demo@demoschool.edu', 'demo@harmonyacademy.edu', 'demo@harmonyacademy.edu', 'demo@harmonyacademy.edu'];
const patterns = ['%demo%', '%test%', 'test-upload'];

(async () => {
  try {
    console.log('Removing demo users...');
    await runPromise(`DELETE FROM users WHERE email IN (${emailsToRemove.map(() => '?').join(',')})`, emailsToRemove);
    await runPromise(`DELETE FROM users WHERE email LIKE ? OR email LIKE ?`, ['%demo%', '%test%']);

    console.log('Removing demo schools...');
    await runPromise(`DELETE FROM schools WHERE code = ? OR name LIKE ?`, ['DEMO', '%Demo%']);

    console.log('Removing test uploads from DB records...');
    // If there's an uploads table or records referencing files, try to remove rows.
    try {
      await runPromise(`DELETE FROM uploads WHERE id LIKE ? OR filename LIKE ?`, ['%test%', '%test%']);
    } catch (e) {
      // ignore - not all installs have uploads table
    }

    console.log('Removing test upload files...');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        if (patterns.some(p => file.toLowerCase().includes(p.replace(/%/g, '')))) {
          try { fs.unlinkSync(path.join(uploadsDir, file)); console.log('Deleted', file); } catch (e) { console.error('Failed delete', file, e.message); }
        }
      }
    }

    console.log('Cleaning completed.');
    db.close();
  } catch (err) {
    console.error('Error during cleanup', err.message || err);
    db.close();
    process.exit(1);
  }
})();

function runPromise(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}
