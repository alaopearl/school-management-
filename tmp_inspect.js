(async()=>{
  const db = require('./backend/database');
  await db.initialize();
  const u1 = await db.getUserByEmail('test.user1@example.com');
  const u2 = await db.getUserByEmail('test.user2@example.com');
  console.log('u1', u1);
  console.log('u2', u2);
  if (u1) {
    const n1 = await db.all('SELECT * FROM notifications WHERE recipient_id = ? ORDER BY created_at DESC', [u1.id]);
    console.log('notifications for u1', n1.length);
    console.log(JSON.stringify(n1.slice(0,5), null, 2));
  }
  if (u2) {
    const n2 = await db.all('SELECT * FROM notifications WHERE recipient_id = ? ORDER BY created_at DESC', [u2.id]);
    console.log('notifications for u2', n2.length);
    console.log(JSON.stringify(n2.slice(0,5), null, 2));
  }
  const recs = await db.all("SELECT * FROM notification_recipients WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test.user%')");
  console.log('recipient entries for test users:', JSON.stringify(recs, null, 2));
})();
