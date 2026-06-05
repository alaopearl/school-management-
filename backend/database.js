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
        await run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
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
                settings TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
            CREATE TABLE IF NOT EXISTS loans (
                id TEXT PRIMARY KEY,
                school_id TEXT NOT NULL,
                book_id TEXT NOT NULL,
                borrower_id TEXT NOT NULL,
                borrower_type TEXT NOT NULL,
                borrowed_date TEXT NOT NULL,
                due_date TEXT,
                returned_date TEXT,
                fine_amount REAL DEFAULT 0,
                status TEXT DEFAULT 'BORROWED',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
                FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
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
        await ensureColumn('classes', 'school_id', 'TEXT');
        await ensureColumn('subjects', 'school_id', 'TEXT');
        await ensureColumn('students', 'school_id', 'TEXT');
        await ensureColumn('teachers', 'school_id', 'TEXT');
        await ensureColumn('attendance', 'school_id', 'TEXT');
        await ensureColumn('exams', 'school_id', 'TEXT');
        await ensureColumn('fees', 'school_id', 'TEXT');
        await ensureColumn('books', 'school_id', 'TEXT');
        await ensureColumn('loans', 'school_id', 'TEXT');
        await ensureColumn('hostels', 'school_id', 'TEXT');
        await ensureColumn('transports', 'school_id', 'TEXT');

        console.log('Database schema initialized');
    },

    // School operations
    createSchool: function (school) {
        return run(
            `INSERT INTO schools (id, name, code, logo_url, settings) VALUES (?, ?, ?, ?, ?)`,
            [school.id, school.name, school.code, school.logo_url, serializeJson(school.settings)]
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

module.exports = database;
