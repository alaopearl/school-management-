require('dotenv').config();
const { sendStudentNotification } = require('./utils/email');

(async () => {
  const ok = await sendStudentNotification('Test School', {
    student_code: 'TST-001',
    full_name: 'Automated Test Student',
    date_of_birth: '2010-01-01',
    gender: 'Other',
    admission_date: '2026-07-05',
    parent_name: 'Test Parent',
    parent_contact: '0000000000',
    status: 'ACTIVE'
  }, 'school-admin@example.com');

  console.log('Email send result:', ok);
  process.exit(ok ? 0 : 1);
})();