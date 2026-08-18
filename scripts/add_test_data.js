const fetch = global.fetch || require('node-fetch');
require('dotenv').config();

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'school.management.website01@gmail.com';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'PEARLMAN11..';

let superAdminToken = null;

async function makeRequest(endpoint, method = 'GET', body = null, token = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${BACKEND_URL}${endpoint}`, options);
  const data = await res.json();
  
  if (!res.ok) {
    throw new Error(`API Error: ${data.error || res.statusText}`);
  }
  return data;
}

async function loginSuperAdmin() {
  console.log('🔐 Logging in as super admin...');
  const result = await makeRequest('/api/auth/login', 'POST', {
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASSWORD
  });
  superAdminToken = result.data.token;
  console.log('✓ Super admin logged in');
  return superAdminToken;
}

async function createTestSchool(token) {
  console.log('\n📚 Creating test school...');
  const result = await makeRequest('/api/auth/create-school', 'POST', {
    schoolName: 'Al-Huda Academy',
    schoolCode: 'AHA-2025',
    motto: 'Excellence in Education',
    address: '123 Education Street, Lagos',
    email: 'admin@al-huda.edu.ng',
    phone: '+234 123 456 7890',
    website: 'https://al-huda.edu.ng',
    principalName: 'Dr. Ahmed Oladele',
    principalPhone: '+234 123 456 7890',
    schoolType: 'PRIVATE',
    logoUrl: '',
    primaryColor: '#3B82F6',
    secondaryColor: '#1E40AF',
    sessionSystem: 'TERM'
  }, token);
  
  const schoolId = result.data.id;
  console.log('✓ School created:', schoolId);
  return schoolId;
}

async function createSchoolAdmin(token, schoolId) {
  console.log('\n👤 Creating school administrator...');
  const adminEmail = 'admin@al-huda.edu.ng';
  const adminPassword = 'AdminPassword123!';
  
  const result = await makeRequest('/api/auth/register-user', 'POST', {
    email: adminEmail,
    password: adminPassword,
    fullName: 'Olatunji Adeyemi',
    role: 'SCHOOL_ADMIN',
    schoolId: schoolId,
    phone: '+234 123 456 7890'
  }, token);
  
  console.log('✓ School admin created');
  return { email: adminEmail, password: adminPassword };
}

async function createTestStudents(token, schoolId) {
  console.log('\n👨‍🎓 Creating test students...');
  
  const students = [
    {
      full_name: 'Chioma Okonkwo',
      gender: 'Female',
      date_of_birth: '2010-05-15',
      current_level: 'JSS 2',
      admission_date: '2023-09-01',
      parent_name: 'Mrs. Amaka Okonkwo',
      parent_contact: '+234 803 123 4567',
      parent_email: 'amaka@example.com',
      address: '456 Maple Street, Lagos',
      gpa: 3.8
    },
    {
      full_name: 'Tunde Adebayo',
      gender: 'Male',
      date_of_birth: '2011-03-22',
      current_level: 'JSS 1',
      admission_date: '2024-09-01',
      parent_name: 'Mr. Kayode Adebayo',
      parent_contact: '+234 805 987 6543',
      parent_email: 'kayode@example.com',
      address: '789 Oak Avenue, Lagos',
      gpa: 3.5
    },
    {
      full_name: 'Zainab Mohammed',
      gender: 'Female',
      date_of_birth: '2009-11-08',
      current_level: 'SSS 1',
      admission_date: '2022-09-01',
      parent_name: 'Mrs. Fatima Mohammed',
      parent_contact: '+234 806 234 5678',
      parent_email: 'fatima@example.com',
      address: '321 Pine Road, Lagos',
      gpa: 4.0
    }
  ];
  
  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    try {
      await makeRequest('/api/students', 'POST', {
        ...student,
        school_id: schoolId
      }, token);
      console.log(`  ✓ Student ${i + 1} created: ${student.full_name}`);
    } catch (err) {
      console.log(`  ⚠ Failed to create student: ${err.message}`);
    }
  }
}

async function main() {
  try {
    console.log('═══════════════════════════════════════');
    console.log('  TEST DATA GENERATION SCRIPT');
    console.log('═══════════════════════════════════════');
    
    // Login
    await loginSuperAdmin();
    
    // Create school
    const schoolId = await createTestSchool(superAdminToken);
    
    // Create school admin
    const adminCreds = await createSchoolAdmin(superAdminToken, schoolId);
    
    // Create students
    await createTestStudents(superAdminToken, schoolId);
    
    console.log('\n═══════════════════════════════════════');
    console.log('  ✅ TEST DATA CREATED SUCCESSFULLY');
    console.log('═══════════════════════════════════════');
    console.log('\n📋 TEST LOGIN CREDENTIALS:\n');
    console.log('School: Al-Huda Academy');
    console.log(`Email: ${adminCreds.email}`);
    console.log(`Password: ${adminCreds.password}`);
    console.log('\n3 Sample Students Added:');
    console.log('  1. Chioma Okonkwo (JSS 2, Female)');
    console.log('  2. Tunde Adebayo (JSS 1, Male)');
    console.log('  3. Zainab Mohammed (SSS 1, Female)');
    console.log('\n═══════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
