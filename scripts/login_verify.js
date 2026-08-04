const fetch = global.fetch || require('node-fetch');
require('dotenv').config();

const url = process.env.BACKEND_URL || 'http://localhost:5000';
const email = process.env.SUPER_ADMIN_EMAIL || 'school.management.website01@gmail.com';
const password = process.env.SUPER_ADMIN_PASSWORD || 'Pearlman11..';

(async () => {
  try {
    const res = await fetch(`${url}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const body = await res.json();
    console.log('status', res.status);
    console.log(JSON.stringify(body, null, 2));
  } catch (err) {
    console.error('Request failed', err.message || err);
    process.exit(1);
  }
})();
