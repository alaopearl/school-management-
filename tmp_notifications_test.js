(async () => {
  const base = 'http://localhost:5000/api';
  const fetch = global.fetch;
  const headers = (token) => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) });

  async function GET(path, token) {
    const res = await fetch(base + path, { headers: headers(token) });
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text ? JSON.parse(text) : {} };
  }
  async function POST(path, body, token) {
    const res = await fetch(base + path, { method: 'POST', headers: headers(token), body: JSON.stringify(body) });
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text ? JSON.parse(text) : {} };
  }

  try {
    console.log('Checking setup status...');
    let s = await GET('/auth/setup-status');
    console.log('setup-status', s.body);
    let superToken = null;
    if (!s.body.hasSuperAdmin) {
      console.log('Creating super admin...');
      const r = await POST('/auth/setup-super-admin', { fullName: 'CI Super', email: 'ci.super@example.com', password: 'Password123!', phone: '07000000000' });
      console.log('created:', r.status, r.body);
      superToken = r.body.data.token;
    } else {
      console.log('Logging in as super admin...');
      // try default known admin email, else fallback
      const tryEmails = ['school.management.website01@gmail.com', 'ci.super@example.com'];
      for (const em of tryEmails) {
        try {
          const res = await POST('/auth/login', { email: em, password: em === 'ci.super@example.com' ? 'Password123!' : 'PEARLMAN11..' });
          if (res.ok) { superToken = res.body.data.token; console.log('Logged in as', em); break; }
        } catch (e) { }
      }
      if (!superToken) {
        throw new Error('Could not obtain super admin token');
      }
    }

    console.log('Super token obtained');
    // create test users
    console.log('Creating test users...');
    await POST('/auth/register-user', { email: 'test.user1@example.com', password: 'Testpass1!', fullName: 'Test User1', role: 'TEACHER', phone: '07011111111', schoolId: null }, superToken).catch(e=>console.log('create user1 err', e.message));
    await POST('/auth/register-user', { email: 'test.user2@example.com', password: 'Testpass2!', fullName: 'Test User2', role: 'TEACHER', phone: '07022222222', schoolId: null }, superToken).catch(e=>console.log('create user2 err', e.message));

    console.log('Logging in as test users...');
    const t1 = await POST('/auth/login', { email: 'test.user1@example.com', password: 'Testpass1!' });
    const t2 = await POST('/auth/login', { email: 'test.user2@example.com', password: 'Testpass2!' });
    if (!t1.ok || !t2.ok) { console.warn('One or both test user logins failed', t1.status, t2.status); }
    const tok1 = t1.body?.data?.token;
    const tok2 = t2.body?.data?.token;

    console.log('Sending broadcast IN_APP...');
    const send = await POST('/notifications/send', { recipientType: 'ALL', subject: 'CI Broadcast', message: 'This is a CI broadcast test', channel: 'IN_APP' }, superToken);
    console.log('send result', send.status, send.body);

    console.log('Waiting 6s for worker...');
    await new Promise(r => setTimeout(r, 6000));

    console.log('Fetching inbox for user1');
    const in1 = await GET('/notifications/inbox', tok1);
    console.log('user1 inbox', in1.status, JSON.stringify(in1.body));

    console.log('Fetching inbox for user2');
    const in2 = await GET('/notifications/inbox', tok2);
    console.log('user2 inbox', in2.status, JSON.stringify(in2.body));

    console.log('Fetching retries (should be none for IN_APP)');
    const r = await GET('/notifications/retries', superToken);
    console.log('retries', r.status, JSON.stringify(r.body));

  } catch (err) {
    console.error('Test script error', err);
  }
})();
