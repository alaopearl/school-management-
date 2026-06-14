const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const databaseFile = process.env.DATABASE_PATH || './students.db';
const dbPath = path.join(__dirname, databaseFile);
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
    }
});

db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');
});

const run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
};

const get = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row || null);
        });
    });
};

const all = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
};

const serializeJson = (value) => {
    if (value == null) return null;
    return typeof value === 'string' ? value : JSON.stringify(value);
};

const getTableColumns = async (tableName) => {
    const rows = await all(`PRAGMA table_info(${tableName})`);
    return rows.map((row) => row.name);
};

const ensureColumn = async (tableName, columnName, definition) => {
    const columns = await getTableColumns(tableName);
    if (!columns.includes(columnName)) {
        console.log(`Adding missing column ${columnName} to table ${tableName}`);
        try {
            await run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
        } catch (err) {
            if (err.message && err.message.includes('non-constant default')) {
                const typeOnly = definition.split(' ')[0];
                await run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${typeOnly}`);
                if (columnName === 'created_at' || columnName === 'updated_at') {
                    await run(`UPDATE ${tableName} SET ${columnName} = CURRENT_TIMESTAMP WHERE ${columnName} IS NULL`);
                }
            } else {
                throw err;
            }
        }
    }
};

const database = {
    initialize: async function () {
        await run(`
            CREATE TABLE IF NOT EXISTS schools (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                code TEXT UNIQUE NOT NULL,
                logo_url TEXT,
                motto TEXT,
                address TEXT,
                email TEXT,
                phone TEXT,
                website TEXT,
                principal_name TEXT,
                principal_phone TEXT,
                school_type TEXT,
                primary_color TEXT,
                secondary_color TEXT,
                session_system TEXT,
                status TEXT DEFAULT 'ACTIVE',
                subscription_plan TEXT DEFAULT 'FREE',
                subscription_expires_at TEXT,
                settings TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await run(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                school_id TEXT,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                full_name TEXT NOT NULL,
                role TEXT NOT NULL,
                phone TEXT,
                status TEXT NOT NULL DEFAULT 'ACTIVE',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
            )
        `);

        await run(`
            CREATE TABLE IF NOT EXISTS classes (
                id TEXT PRIMARY KEY,
                school_id TEXT NOT NULL,
                name TEXT NOT NULL,
                arm TEXT,
                department TEXT,
                teacher_id TEXT,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
            )
        `);

        await run(`
            CREATE TABLE IF NOT EXISTS subjects (
                id TEXT PRIMARY KEY,
                school_id TEXT NOT NULL,
                name TEXT NOT NULL,
                code TEXT,
                department TEXT,
                teacher_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
            )
        `);

        await run(`
            CREATE TABLE IF NOT EXISTS students (
                id TEXT PRIMARY KEY,
                school_id TEXT NOT NULL,
                student_code TEXT NOT NULL,
                full_name TEXT NOT NULL,
                gender TEXT,
                date_of_birth TEXT,
                address TEXT,
                parent_name TEXT,
                parent_contact TEXT,
                medical_info TEXT,
                class_id TEXT,
                admission_date TEXT,
                status TEXT DEFAULT 'ACTIVE',
                gpa REAL DEFAULT 0,
                photo_url TEXT,
                graduated_at TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
                FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE SET NULL
            )
        `);

        await run(`
            CREATE TABLE IF NOT EXISTS teachers (
                id TEXT PRIMARY KEY,
                school_id TEXT NOT NULL,
                full_name TEXT NOT NULL,
                email TEXT UNIQUE,
                phone TEXT,
                department TEXT,
                subjects TEXT,
                salary REAL DEFAULT 0,
                status TEXT DEFAULT 'ACTIVE',
                hired_date TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
            )
        `);

        await run(`
            CREATE TABLE IF NOT EXISTS attendance (
                id TEXT PRIMARY KEY,
                school_id TEXT NOT NULL,
                record_date TEXT NOT NULL,
                person_type TEXT NOT NULL,
                person_id TEXT NOT NULL,
                status TEXT NOT NULL,
                remarks TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
            )
        `);

        await run(`
            CREATE TABLE IF NOT EXISTS exams (
                id TEXT PRIMARY KEY,
                school_id TEXT NOT NULL,
                title TEXT NOT NULL,
                term TEXT,
                session TEXT,
                exam_type TEXT,
                class_id TEXT,
                subject_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
            )
        `);

        await run(`
            CREATE TABLE IF NOT EXISTS results (
                id TEXT PRIMARY KEY,
                exam_id TEXT NOT NULL,
                student_id TEXT NOT NULL,
                score REAL NOT NULL,
                grade TEXT,
                remarks TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(exam_id) REFERENCES exams(id) ON DELETE CASCADE,
                FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
            )
        `);

        await run(`
            CREATE TABLE IF NOT EXISTS fees (
                id TEXT PRIMARY KEY,
                school_id TEXT NOT NULL,
                student_id TEXT NOT NULL,
                invoice_number TEXT NOT NULL,
                amount REAL NOT NULL,
                paid_amount REAL DEFAULT 0,
                due_date TEXT,
                status TEXT DEFAULT 'PENDING',
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
                FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
            )
        `);

        await run(`
            CREATE TABLE IF NOT EXISTS books (
                id TEXT PRIMARY KEY,
                school_id TEXT NOT NULL,
                title TEXT NOT NULL,
                author TEXT,
                isbn TEXT,
                category TEXT,
                total_copies INTEGER DEFAULT 1,
                available_copies INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
            )
        `);

        await run(`
            CREATE TABLE IF NOT EXISTS subscription_plans (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                price REAL NOT NULL,
                max_students INTEGER,
                max_teachers INTEGER,
                features TEXT,
                billing_cycle TEXT DEFAULT 'MONTHLY',
                status TEXT DEFAULT 'ACTIVE',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await run(`
            CREATE TABLE IF NOT EXISTS payments (
                id TEXT PRIMARY KEY,
                school_id TEXT NOT NULL,
                student_id TEXT,
                amount REAL NOT NULL,
                currency TEXT DEFAULT 'NGN',
                payment_type TEXT,
                payment_method TEXT,
                reference TEXT UNIQUE,
                status TEXT DEFAULT 'PENDING',
                receipt_url TEXT,
                officer_name TEXT,
                paid_at TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
                FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE SET NULL
            )
        `);

        await run(`
            CREATE TABLE IF NOT EXISTS hostels (
                id TEXT PRIMARY KEY,
                school_id TEXT NOT NULL,
                name TEXT NOT NULL,
                room_number TEXT,
                student_id TEXT,
                status TEXT DEFAULT 'OCCUPIED',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
                FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE SET NULL
            )
        `);

        await run(`
            CREATE TABLE IF NOT EXISTS transports (
                id TEXT PRIMARY KEY,
                school_id TEXT NOT NULL,
                route_name TEXT NOT NULL,
                stop_points TEXT,
                driver_name TEXT,
                vehicle_number TEXT,
                capacity INTEGER,
                status TEXT DEFAULT 'ACTIVE',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
            )
        `);

        await ensureColumn('users', 'school_id', 'TEXT');
        await ensureColumn('users', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('users', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('schools', 'motto', 'TEXT');
        await ensureColumn('schools', 'address', 'TEXT');
        await ensureColumn('schools', 'email', 'TEXT');
        await ensureColumn('schools', 'phone', 'TEXT');
        await ensureColumn('schools', 'website', 'TEXT');
        await ensureColumn('schools', 'principal_name', 'TEXT');
        await ensureColumn('schools', 'principal_phone', 'TEXT');
        await ensureColumn('schools', 'school_type', 'TEXT');
        await ensureColumn('schools', 'primary_color', 'TEXT');
        await ensureColumn('schools', 'secondary_color', 'TEXT');
        await ensureColumn('schools', 'session_system', 'TEXT');
        await ensureColumn('schools', 'status', 'TEXT DEFAULT ACTIVE');
        await ensureColumn('schools', 'subscription_plan', 'TEXT');
        await ensureColumn('schools', 'settings', 'TEXT');
        await ensureColumn('schools', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('schools', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('classes', 'school_id', 'TEXT');
        await ensureColumn('classes', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('classes', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('subjects', 'school_id', 'TEXT');
        await ensureColumn('subjects', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('subjects', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('students', 'school_id', 'TEXT');
        await ensureColumn('students', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('students', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('teachers', 'school_id', 'TEXT');
        await ensureColumn('teachers', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('teachers', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('attendance', 'school_id', 'TEXT');
        await ensureColumn('attendance', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('attendance', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('exams', 'school_id', 'TEXT');
        await ensureColumn('exams', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('exams', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('results', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('results', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('fees', 'school_id', 'TEXT');
        await ensureColumn('fees', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('fees', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('books', 'school_id', 'TEXT');
        await ensureColumn('books', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('books', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('loans', 'school_id', 'TEXT');
        await ensureColumn('loans', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('loans', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('hostels', 'school_id', 'TEXT');
        await ensureColumn('hostels', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('hostels', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('transports', 'school_id', 'TEXT');
        await ensureColumn('transports', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('transports', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('subscription_plans', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('subscription_plans', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('payments', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await ensureColumn('payments', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

        console.log('Database schema initialized');
    },

    // School operations
    createSchool: function (school) {
        return run(
            `INSERT INTO schools (id, name, code, logo_url, motto, address, email, phone, website, principal_name, principal_phone, school_type, primary_color, secondary_color, session_system, status, subscription_plan, settings) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [school.id, school.name, school.code, school.logo_url || null, school.motto || null, school.address || null, school.email || null, school.phone || null, school.website || null, school.principal_name || null, school.principal_phone || null, school.school_type || null, school.primary_color || '#3B82F6', school.secondary_color || '#1E40AF', school.session_system || 'TERM', school.status || 'ACTIVE', school.subscription_plan || 'FREE', school.settings]
        ).then(() => this.getSchoolById(school.id));
    },

    getSchoolById: function (id) {
        return get('SELECT * FROM schools WHERE id = ?', [id]);
    },

    getSchoolByCode: function (code) {
        return get('SELECT * FROM schools WHERE code = ?', [code]);
    },

    listSchools: function () {
        return all('SELECT * FROM schools ORDER BY name');
    },

    updateSchoolSettings: function (id, settings) {
        return run(
            `UPDATE schools SET settings = ? WHERE id = ?`,
            [serializeJson(settings), id]
        ).then(() => this.getSchoolById(id));
    },

    // User operations
    createUser: function (user) {
        return run(
            `INSERT INTO users (id, school_id, email, password, full_name, role, phone, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [user.id, user.school_id, user.email, user.password, user.full_name, user.role, user.phone, user.status || 'ACTIVE']
        ).then(() => this.getUserById(user.id));
    },

    getUserByEmail: function (email) {
        return get('SELECT * FROM users WHERE email = ?', [email]);
    },

    getSuperAdmin: function () {
        return get('SELECT * FROM users WHERE role = ? LIMIT 1', ['SUPER_ADMIN']);
    },

    getUserById: function (id) {
        return get('SELECT * FROM users WHERE id = ?', [id]);
    },

    listUsersBySchool: function (schoolId) {
        if (!schoolId) {
            return all('SELECT * FROM users ORDER BY created_at DESC');
        }
        return all('SELECT * FROM users WHERE school_id = ? ORDER BY created_at DESC', [schoolId]);
    },

    updateUser: function (id, updates) {
        const fields = [];
        const values = [];
        for (const [key, value] of Object.entries(updates)) {
            fields.push(`${key} = ?`);
            values.push(value);
        }
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        return run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values).then(() => this.getUserById(id));
    },

    deleteUser: function (id) {
        return run('DELETE FROM users WHERE id = ?', [id]);
    },

    // Student operations
    createStudent: function (student) {
        return run(
            `INSERT INTO students (id, school_id, student_code, full_name, gender, date_of_birth, address, parent_name, parent_contact, medical_info, class_id, admission_date, status, gpa, photo_url, graduated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [student.id, student.school_id, student.student_code, student.full_name, student.gender, student.date_of_birth, student.address, student.parent_name, student.parent_contact, student.medical_info, student.class_id, student.admission_date, student.status || 'ACTIVE', student.gpa || 0, student.photo_url, student.graduated_at || null]
        ).then(() => this.getStudentById(student.id));
    },

    getStudentById: function (id) {
        return get('SELECT * FROM students WHERE id = ?', [id]);
    },

    listStudentsBySchool: function (schoolId) {
        return all('SELECT * FROM students WHERE school_id = ? ORDER BY created_at DESC', [schoolId]);
    },

    updateStudent: function (id, updates) {
        const fields = [];
        const values = [];
        for (const [key, value] of Object.entries(updates)) {
            fields.push(`${key} = ?`);
            values.push(value);
        }
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        return run(`UPDATE students SET ${fields.join(', ')} WHERE id = ?`, values).then(() => this.getStudentById(id));
    },

    deleteStudent: function (id) {
        return run('DELETE FROM students WHERE id = ?', [id]);
    },

    searchStudents: function (schoolId, query) {
        const searchTerm = `%${query}%`;
        const baseSql = `SELECT * FROM students WHERE school_id = ? AND (full_name LIKE ? OR student_code LIKE ? OR parent_name LIKE ? OR parent_contact LIKE ?) ORDER BY created_at DESC`;
        return all(baseSql, [schoolId, searchTerm, searchTerm, searchTerm, searchTerm]);
    },

    filterStudents: function (schoolId, filters = {}) {
        let query = 'SELECT * FROM students WHERE school_id = ?';
        const values = [schoolId];
        if (filters.class_id) {
            query += ' AND class_id = ?';
            values.push(filters.class_id);
        }
        if (filters.status) {
            query += ' AND status = ?';
            values.push(filters.status);
        }
        if (filters.gender) {
            query += ' AND gender = ?';
            values.push(filters.gender);
        }
        query += ' ORDER BY created_at DESC';
        return all(query, values);
    },

    getStatistics: function (schoolId) {
        return get(
            `SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN status = 'GRADUATED' THEN 1 ELSE 0 END) AS graduated,
                AVG(gpa) AS average_gpa
            FROM students
            WHERE school_id = ?`,
            [schoolId]
        );
    },

    getLevelDistribution: function (schoolId) {
        return all(
            `SELECT class_id, COUNT(*) AS student_count
            FROM students
            WHERE school_id = ?
            GROUP BY class_id
            ORDER BY student_count DESC`,
            [schoolId]
        );
    },

    getGenderDistribution: function (schoolId) {
        return all(
            `SELECT gender, COUNT(*) AS count
            FROM students
            WHERE school_id = ?
            GROUP BY gender`,
            [schoolId]
        );
    },

    getStatusDistribution: function (schoolId) {
        return all(
            `SELECT status, COUNT(*) AS count
            FROM students
            WHERE school_id = ?
            GROUP BY status`,
            [schoolId]
        );
    },

    getAverageGPAByLevel: function (schoolId) {
        return all(
            `SELECT class_id, AVG(gpa) AS average_gpa, COUNT(*) AS student_count
            FROM students
            WHERE school_id = ?
            GROUP BY class_id
            ORDER BY average_gpa DESC`,
            [schoolId]
        );
    },

    // Teachers
    createTeacher: function (teacher) {
        return run(
            `INSERT INTO teachers (id, school_id, full_name, email, phone, department, subjects, salary, status, hired_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [teacher.id, teacher.school_id, teacher.full_name, teacher.email, teacher.phone, teacher.department, serializeJson(teacher.subjects), teacher.salary || 0, teacher.status || 'ACTIVE', teacher.hired_date || null]
        ).then(() => this.getTeacherById(teacher.id));
    },

    getTeacherById: function (id) {
        return get('SELECT * FROM teachers WHERE id = ?', [id]);
    },

    listTeachersBySchool: function (schoolId) {
        return all('SELECT * FROM teachers WHERE school_id = ? ORDER BY created_at DESC', [schoolId]);
    },

    updateTeacher: function (id, updates) {
        const fields = [];
        const values = [];
        for (const [key, value] of Object.entries(updates)) {
            fields.push(`${key} = ?`);
            values.push(key === 'subjects' ? serializeJson(value) : value);
        }
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        return run(`UPDATE teachers SET ${fields.join(', ')} WHERE id = ?`, values).then(() => this.getTeacherById(id));
    },

    deleteTeacher: function (id) {
        return run('DELETE FROM teachers WHERE id = ?', [id]);
    },

    // Classes
    createClass: function (klass) {
        return run(
            `INSERT INTO classes (id, school_id, name, arm, department, teacher_id, description) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [klass.id, klass.school_id, klass.name, klass.arm, klass.department, klass.teacher_id, klass.description]
        ).then(() => this.getClassById(klass.id));
    },

    getClassById: function (id) {
        return get('SELECT * FROM classes WHERE id = ?', [id]);
    },

    listClassesBySchool: function (schoolId) {
        return all('SELECT * FROM classes WHERE school_id = ? ORDER BY name', [schoolId]);
    },

    updateClass: function (id, updates) {
        const fields = [];
        const values = [];
        for (const [key, value] of Object.entries(updates)) {
            fields.push(`${key} = ?`);
            values.push(value);
        }
        if (fields.length === 0) {
            return this.getClassById(id);
        }
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        return run(`UPDATE classes SET ${fields.join(', ')} WHERE id = ?`, values).then(() => this.getClassById(id));
    },

    deleteClass: function (id) {
        return run('DELETE FROM classes WHERE id = ?', [id]);
    },

    // Subjects
    createSubject: function (subject) {
        return run(
            `INSERT INTO subjects (id, school_id, name, code, department, teacher_id) VALUES (?, ?, ?, ?, ?, ?)`,
            [subject.id, subject.school_id, subject.name, subject.code, subject.department, subject.teacher_id]
        ).then(() => this.getSubjectById(subject.id));
    },

    getSubjectById: function (id) {
        return get('SELECT * FROM subjects WHERE id = ?', [id]);
    },

    listSubjectsBySchool: function (schoolId) {
        return all('SELECT * FROM subjects WHERE school_id = ? ORDER BY name', [schoolId]);
    },

    updateSubject: function (id, updates) {
        const fields = [];
        const values = [];
        for (const [key, value] of Object.entries(updates)) {
            fields.push(`${key} = ?`);
            values.push(value);
        }
        values.push(id);
        return run(`UPDATE subjects SET ${fields.join(', ')} WHERE id = ?`, values).then(() => this.getSubjectById(id));
    },

    deleteSubject: function (id) {
        return run('DELETE FROM subjects WHERE id = ?', [id]);
    },

    // Attendance
    recordAttendance: function (attendance) {
        return run(
            `INSERT INTO attendance (id, school_id, record_date, person_type, person_id, status, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [attendance.id, attendance.school_id, attendance.record_date, attendance.person_type, attendance.person_id, attendance.status, attendance.remarks]
        ).then(() => this.getAttendanceById(attendance.id));
    },

    getAttendanceById: function (id) {
        return get('SELECT * FROM attendance WHERE id = ?', [id]);
    },

    listAttendanceBySchool: function (schoolId, query = {}) {
        let sql = 'SELECT * FROM attendance WHERE school_id = ?';
        const values = [schoolId];
        if (query.record_date) {
            sql += ' AND record_date = ?';
            values.push(query.record_date);
        }
        if (query.person_type) {
            sql += ' AND person_type = ?';
            values.push(query.person_type);
        }
        sql += ' ORDER BY record_date DESC';
        return all(sql, values);
    },

    // Exams and results
    createExam: function (exam) {
        return run(
            `INSERT INTO exams (id, school_id, title, term, session, exam_type, class_id, subject_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [exam.id, exam.school_id, exam.title, exam.term, exam.session, exam.exam_type, exam.class_id, exam.subject_id]
        ).then(() => this.getExamById(exam.id));
    },

    getExamById: function (id) {
        return get('SELECT * FROM exams WHERE id = ?', [id]);
    },

    listExamsBySchool: function (schoolId) {
        return all('SELECT * FROM exams WHERE school_id = ? ORDER BY created_at DESC', [schoolId]);
    },

    createResult: function (result) {
        return run(
            `INSERT INTO results (id, exam_id, student_id, score, grade, remarks) VALUES (?, ?, ?, ?, ?, ?)`,
            [result.id, result.exam_id, result.student_id, result.score, result.grade, result.remarks]
        ).then(() => this.getResultById(result.id));
    },

    getResultById: function (id) {
        return get('SELECT * FROM results WHERE id = ?', [id]);
    },

    listResultsByStudent: function (studentId) {
        return all('SELECT * FROM results WHERE student_id = ? ORDER BY created_at DESC', [studentId]);
    },

    listResultsByExam: function (examId) {
        return all('SELECT * FROM results WHERE exam_id = ? ORDER BY created_at DESC', [examId]);
    },

    // Fees
    createInvoice: function (invoice) {
        return run(
            `INSERT INTO fees (id, school_id, student_id, invoice_number, amount, paid_amount, due_date, status, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [invoice.id, invoice.school_id, invoice.student_id, invoice.invoice_number, invoice.amount, invoice.paid_amount || 0, invoice.due_date, invoice.status || 'PENDING', invoice.description]
        ).then(() => this.getInvoiceById(invoice.id));
    },

    getInvoiceById: function (id) {
        return get('SELECT * FROM fees WHERE id = ?', [id]);
    },

    listInvoicesBySchool: function (schoolId) {
        return all('SELECT * FROM fees WHERE school_id = ? ORDER BY created_at DESC', [schoolId]);
    },

    recordPayment: function (invoiceId, paidAmount) {
        return get('SELECT * FROM fees WHERE id = ?', [invoiceId]).then((invoice) => {
            if (!invoice) throw new Error('Invoice not found');
            const newPaid = (invoice.paid_amount || 0) + paidAmount;
            const status = newPaid >= invoice.amount ? 'PAID' : 'PARTIAL';
            return run('UPDATE fees SET paid_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newPaid, status, invoiceId]).then(() => this.getInvoiceById(invoiceId));
        });
    },

    // Library
    createBook: function (book) {
        return run(
            `INSERT INTO books (id, school_id, title, author, isbn, category, total_copies, available_copies) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [book.id, book.school_id, book.title, book.author, book.isbn, book.category, book.total_copies || 1, book.available_copies || book.total_copies || 1]
        ).then(() => this.getBookById(book.id));
    },

    getBookById: function (id) {
        return get('SELECT * FROM books WHERE id = ?', [id]);
    },

    listBooksBySchool: function (schoolId) {
        return all('SELECT * FROM books WHERE school_id = ? ORDER BY title', [schoolId]);
    },

    loanBook: function (loan) {
        return run(
            `INSERT INTO loans (id, school_id, book_id, borrower_id, borrower_type, borrowed_date, due_date, fine_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [loan.id, loan.school_id, loan.book_id, loan.borrower_id, loan.borrower_type, loan.borrowed_date, loan.due_date, loan.fine_amount || 0, loan.status || 'BORROWED']
        ).then(() => this.getLoanById(loan.id));
    },

    getLoanById: function (id) {
        return get('SELECT * FROM loans WHERE id = ?', [id]);
    },

    returnBook: function (loanId, returnedDate, fineAmount) {
        return get('SELECT * FROM loans WHERE id = ?', [loanId]).then((loan) => {
            if (!loan) throw new Error('Loan not found');
            return run('UPDATE loans SET returned_date = ?, fine_amount = ?, status = ?, created_at = created_at WHERE id = ?', [returnedDate, fineAmount || loan.fine_amount, 'RETURNED', loanId]).then(() => this.getLoanById(loanId));
        });
    },

    listLoansBySchool: function (schoolId) {
        return all('SELECT * FROM loans WHERE school_id = ? ORDER BY borrowed_date DESC', [schoolId]);
    },

    // Transport
    createTransport: function (transport) {
        return run(
            `INSERT INTO transports (id, school_id, route_name, stop_points, driver_name, vehicle_number, capacity, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [transport.id, transport.school_id, transport.route_name, serializeJson(transport.stop_points), transport.driver_name, transport.vehicle_number, transport.capacity || null, transport.status || 'ACTIVE']
        ).then(() => this.getTransportById(transport.id));
    },

    getTransportById: function (id) {
        return get('SELECT * FROM transports WHERE id = ?', [id]);
    },

    listTransportsBySchool: function (schoolId) {
        return all('SELECT * FROM transports WHERE school_id = ? ORDER BY route_name', [schoolId]);
    },

    updateTransport: function (id, updates) {
        const fields = [];
        const values = [];
        for (const [key, value] of Object.entries(updates)) {
            fields.push(`${key} = ?`);
            values.push(key === 'stop_points' ? serializeJson(value) : value);
        }
        values.push(id);
        return run(`UPDATE transports SET ${fields.join(', ')} WHERE id = ?`, values).then(() => this.getTransportById(id));
    },

    deleteTransport: function (id) {
        return run('DELETE FROM transports WHERE id = ?', [id]);
    },

    listTransportBySchool: function (schoolId) {
        return this.listTransportsBySchool(schoolId);
    },

    close: function () {
        return new Promise((resolve, reject) => {
            db.close((err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }
};

// Payments
database.createPayment = function (payment) {
    return run(
        `INSERT INTO payments (id, school_id, student_id, amount, currency, payment_type, payment_method, reference, status, officer_name, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [payment.id, payment.school_id, payment.student_id || null, payment.amount, payment.currency || 'NGN', payment.payment_type || 'FEE', payment.payment_method, payment.reference, payment.status || 'PENDING', payment.officer_name || null, payment.paid_at || null]
    ).then(() => database.getPaymentById(payment.id));
};

database.getPaymentById = function (id) {
    return get('SELECT * FROM payments WHERE id = ?', [id]);
};

database.listPaymentsBySchool = function (schoolId) {
    return all('SELECT * FROM payments WHERE school_id = ? ORDER BY paid_at DESC', [schoolId]);
};

database.getTotalRevenue = function (schoolId) {
    return get('SELECT SUM(amount) as total FROM payments WHERE school_id = ? AND status = ?', [schoolId, 'COMPLETED']).then(row => row?.total || 0);
};

database.getTodayPayments = function (schoolId) {
    const today = new Date().toISOString().split('T')[0];
    return get('SELECT SUM(amount) as total FROM payments WHERE school_id = ? AND status = ? AND date(paid_at) = ?', [schoolId, 'COMPLETED', today]).then(row => row?.total || 0);
};

database.getMonthlyRevenue = function (schoolId) {
    const currentMonth = new Date().toISOString().substring(0, 7);
    return get('SELECT SUM(amount) as total FROM payments WHERE school_id = ? AND status = ? AND substr(paid_at, 1, 7) = ?', [schoolId, 'COMPLETED', currentMonth]).then(row => row?.total || 0);
};

database.getOutstandingFees = function (schoolId) {
    return get('SELECT SUM(amount - paid_amount) as total FROM fees WHERE school_id = ? AND status != ?', [schoolId, 'PAID']).then(row => row?.total || 0);
};

database.getStudentsOwingFees = function (schoolId) {
    return all('SELECT DISTINCT s.id, s.full_name, s.student_code, SUM(f.amount - f.paid_amount) as amount_owing FROM students s JOIN fees f ON s.id = f.student_id WHERE f.school_id = ? AND f.status != ? GROUP BY s.id', [schoolId, 'PAID']);
};

// Subscription Plans
database.createSubscriptionPlan = function (plan) {
    return run(
        `INSERT INTO subscription_plans (id, name, description, price, max_students, max_teachers, features, billing_cycle, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [plan.id, plan.name, plan.description, plan.price, plan.max_students, plan.max_teachers, plan.features, plan.billing_cycle, plan.status || 'ACTIVE']
    ).then(() => database.getSubscriptionPlanById(plan.id));
};

database.getSubscriptionPlanById = function (id) {
    return get('SELECT * FROM subscription_plans WHERE id = ?', [id]);
};

database.getSubscriptionPlanByName = function (name) {
    return get('SELECT * FROM subscription_plans WHERE name = ?', [name]);
};

database.listSubscriptionPlans = function () {
    return all('SELECT * FROM subscription_plans WHERE status = ? ORDER BY price', ['ACTIVE']);
};

database.updateSubscriptionPlan = function (id, updates) {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(updates)) {
        fields.push(`${key} = ?`);
        values.push(key === 'features' ? serializeJson(value) : value);
    }
    values.push(id);
    return run(`UPDATE subscription_plans SET ${fields.join(', ')} WHERE id = ?`, values).then(() => database.getSubscriptionPlanById(id));
};

database.updateSchoolSubscription = function (schoolId, updates) {
    const fields = [];
    const values = [];
    fields.push('updated_at = CURRENT_TIMESTAMP');
    for (const [key, value] of Object.entries(updates)) {
        fields.push(`${key} = ?`);
        values.push(value);
    }
    values.push(schoolId);
    return run(`UPDATE schools SET ${fields.join(', ')} WHERE id = ?`, values).then(() => database.getSchoolById(schoolId));
};

module.exports = database;
