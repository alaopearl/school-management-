(async()=>{
  const db = require('./backend/database');
  await db.initialize();
  const u1 = await db.getUserByEmail('test.user1@example.com');
  const u2 = await db.getUserByEmail('test.user2@example.com');
  if (u1) {
    const inbox1 = await db.listNotificationsByUser(u1.id, 50);
    console.log('inbox for u1 count:', inbox1.length);
    console.log(JSON.stringify(inbox1.slice(0,5), null, 2));
  }
  if (u2) {
    const inbox2 = await db.listNotificationsByUser(u2.id, 50);
    console.log('inbox for u2 count:', inbox2.length);
    console.log(JSON.stringify(inbox2.slice(0,5), null, 2));
  }
})();
