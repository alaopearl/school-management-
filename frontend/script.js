// Student Record Tracker App - API Version
// ==========================================

const API_BASE_URL = 'http://localhost:5000/api';
const USE_BACKEND = true; // Set false to fallback to localStorage if backend is unavailable
const AUTH_STORAGE_KEY = 'sms_auth_token';

class StudentRecordTracker {
    constructor() {
        this.students = [];
        this.currentEditingId = null;
        this.token = null;
        this.user = null;
        this.school = null;
        this.pendingRegistration = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        if (USE_BACKEND) {
            await this.initBackendAuth();
        } else {
            this.students = this.loadStudents();
            this.showApp();
            this.updateDashboard();
        }
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchSection(e.target.dataset.section));
        });

        // Authentication
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('login-submit-btn').addEventListener('click', (e) => this.handleLogin(e));
        document.getElementById('show-login-btn').addEventListener('click', () => this.showLoginForm());
        document.getElementById('show-forgot-password-btn').addEventListener('click', () => this.showForgotPassword());
        document.getElementById('back-to-login-btn').addEventListener('click', () => this.showLogin());
        document.getElementById('back-to-login-btn-2').addEventListener('click', () => this.showLogin());
        document.getElementById('forgot-password-form').addEventListener('submit', (e) => this.handleForgotPassword(e));
        document.getElementById('reset-password-form').addEventListener('submit', (e) => this.handleResetPassword(e));
        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());
        document.getElementById('admin-school-form').addEventListener('submit', (e) => this.handleAdminCreateSchool(e));
        document.getElementById('setup-form').addEventListener('submit', (e) => this.handleSetupSuperAdmin(e));
        document.getElementById('user-management-form').addEventListener('submit', (e) => this.handleCreateUser(e));
        document.getElementById('user-school-select').addEventListener('change', () => this.renderUserManagement());

        // Add Student Form
        document.getElementById('student-form').addEventListener('submit', (e) => this.handleAddStudent(e));

        // Edit Modal
        document.getElementById('edit-form').addEventListener('submit', (e) => this.handleEditStudent(e));
        document.getElementById('close-modal-btn').addEventListener('click', () => this.closeEditModal());
        document.getElementById('close-view-modal-btn').addEventListener('click', () => this.closeViewModal());

        // Modal close on X
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.remove('show');
            });
        });

        // Filters and Search
        document.getElementById('filter-level').addEventListener('change', () => this.displayRecords());
        document.getElementById('filter-status').addEventListener('change', () => this.displayRecords());
        document.getElementById('sort-by').addEventListener('input', () => this.displayRecords());

        // Search
        document.getElementById('search-btn').addEventListener('click', () => this.performSearch());
        document.getElementById('search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });

        // Export and Print
        document.getElementById('export-btn').addEventListener('click', () => this.exportToCSV());
        document.getElementById('print-btn').addEventListener('click', () => this.printReport());
    }

    async initBackendAuth() {
        this.token = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!this.token) {
            const setupStatus = await this.checkSetupStatus();
            if (setupStatus && !setupStatus.hasSuperAdmin) {
                this.showSetup();
            } else {
                this.showLogin();
            }
            return;
        }

        try {
            await this.authenticateUser();
            this.showApp();
        } catch (error) {
            this.clearAuth();
            const setupStatus = await this.checkSetupStatus();
            if (setupStatus && !setupStatus.hasSuperAdmin) {
                this.showSetup();
            } else {
                this.showLogin();
            }
        }
    }

    async checkSetupStatus() {
        try {
            const response = await this.makeRequest('/auth/setup-status', 'GET');
            return response.data || response;
        } catch (error) {
            console.warn('Could not determine setup status:', error.message);
            return { hasSuperAdmin: true };
        }
    }

    async handleSetupSuperAdmin(e) {
        e.preventDefault();
        const messageEl = document.getElementById('setup-message');

        const fullName = document.getElementById('setup-full-name').value.trim();
        const email = document.getElementById('setup-email').value.trim();
        const password = document.getElementById('setup-password').value;
        const phone = document.getElementById('setup-phone').value.trim();

        if (!fullName || !email || !password) {
            messageEl.textContent = 'Full name, email, and password are required.';
            return;
        }

        try {
            const response = await this.makeRequest('/auth/setup-super-admin', 'POST', {
                fullName,
                email,
                password,
                phone
            });
            this.setAuthToken(response.data.token);
            await this.authenticateUser();
            messageEl.textContent = '';
            this.showMessage('Super Admin account created successfully!', 'success');
            this.showApp();
            this.switchSection('overview');
        } catch (error) {
            messageEl.textContent = error.message;
        }
    }

    showSetup() {
        document.getElementById('login-section').style.display = 'block';
        document.getElementById('login-form-container').classList.add('hidden');
        document.getElementById('setup-form-container').classList.remove('hidden');
        document.querySelector('.nav-tabs').style.display = 'none';
        document.querySelector('.content').style.display = 'none';
        document.querySelector('.footer')?.classList.add('hidden');
        document.getElementById('logout-btn').classList.add('hidden');
        document.getElementById('user-greeting').textContent = 'Not signed in';
    }

    showLogin() {
        document.getElementById('login-section').style.display = 'block';
        document.getElementById('login-form-container').classList.remove('hidden');
        document.getElementById('forgot-password-form-container').classList.add('hidden');
        document.getElementById('reset-password-form-container').classList.add('hidden');
        document.getElementById('setup-form-container').classList.add('hidden');
        document.querySelector('.nav-tabs').style.display = 'none';
        document.querySelector('.content').style.display = 'none';
        document.querySelector('.footer')?.classList.add('hidden');
        document.getElementById('logout-btn').classList.add('hidden');
        document.getElementById('user-greeting').textContent = 'Not signed in';
    }

    showForgotPassword() {
        document.getElementById('login-section').style.display = 'block';
        document.getElementById('login-form-container').classList.add('hidden');
        document.getElementById('forgot-password-form-container').classList.remove('hidden');
        document.getElementById('reset-password-form-container').classList.add('hidden');
        document.getElementById('setup-form-container').classList.add('hidden');
        document.querySelector('.nav-tabs').style.display = 'none';
        document.querySelector('.content').style.display = 'none';
        document.querySelector('.footer')?.classList.add('hidden');
        document.getElementById('logout-btn').classList.add('hidden');
        document.getElementById('user-greeting').textContent = 'Not signed in';
    }

    async authenticateUser() {
        const response = await this.makeRequest('/auth/me');
        this.user = response.data.user;
        this.school = response.data.school;
        await this.loadStudentsFromAPI();
        await this.updateDashboard();
        this.updateUserInfo();
        this.configureNavForRole();
    }

    async handleForgotPassword(e) {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value.trim();
        const messageEl = document.getElementById('forgot-password-message');

        if (!email) {
            messageEl.textContent = 'Please enter your email address.';
            return;
        }

        try {
            const response = await this.makeRequest('/auth/forgot-password', 'POST', { email });
            messageEl.textContent = response.message || 'OTP request sent.';
            const resetEmail = document.getElementById('reset-email');
            resetEmail.value = email;
            this.showResetPassword();
        } catch (error) {
            messageEl.textContent = error.message;
        }
    }

    async handleResetPassword(e) {
        e.preventDefault();
        const email = document.getElementById('reset-email').value.trim();
        const otp = document.getElementById('reset-otp').value.trim();
        const newPassword = document.getElementById('reset-password').value;
        const confirmPassword = document.getElementById('reset-password-confirm').value;
        const messageEl = document.getElementById('reset-password-message');

        if (!email || !otp || !newPassword || !confirmPassword) {
            messageEl.textContent = 'All fields are required.';
            return;
        }

        if (newPassword !== confirmPassword) {
            messageEl.textContent = 'Passwords do not match.';
            return;
        }

        try {
            const response = await this.makeRequest('/auth/reset-password', 'POST', {
                email,
                otp,
                newPassword
            });
            messageEl.textContent = response.message || 'Password updated successfully.';
            this.showLogin();
        } catch (error) {
            messageEl.textContent = error.message;
        }
    }

    showResetPassword() {
        document.getElementById('login-section').style.display = 'block';
        document.getElementById('login-form-container').classList.add('hidden');
        document.getElementById('forgot-password-form-container').classList.add('hidden');
        document.getElementById('reset-password-form-container').classList.remove('hidden');
        document.getElementById('setup-form-container').classList.add('hidden');
        document.querySelector('.nav-tabs').style.display = 'none';
        document.querySelector('.content').style.display = 'none';
        document.querySelector('.footer')?.classList.add('hidden');
        document.getElementById('logout-btn').classList.add('hidden');
        document.getElementById('user-greeting').textContent = 'Not signed in';
    }

    configureNavForRole() {
        const adminBtn = document.getElementById('admin-panel-btn');
        const userManagementBtn = document.getElementById('user-management-btn');
        const adminSection = document.getElementById('admin-panel');
        const userManagementSection = document.getElementById('user-management');
        const adminBanner = document.getElementById('super-admin-banner');
        const canManageUsers = ['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(this.user?.role);

        if (this.user?.role === 'SUPER_ADMIN') {
            adminBtn.classList.remove('hidden');
            adminBanner.classList.remove('hidden');
        } else {
            adminBtn.classList.add('hidden');
            adminBanner.classList.add('hidden');
            if (adminSection && adminSection.classList.contains('active')) {
                this.switchSection('overview');
            }
        }

        if (canManageUsers) {
            userManagementBtn.classList.remove('hidden');
        } else {
            userManagementBtn.classList.add('hidden');
            if (userManagementSection && userManagementSection.classList.contains('active')) {
                this.switchSection('overview');
            }
        }
    }

    async handleLogin(e) {
        e.preventDefault();

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value.trim();
        const messageEl = document.getElementById('login-message');

        if (!email || !password) {
            messageEl.textContent = 'Please enter both email and password.';
            return;
        }

        try {
            const response = await this.makeRequest('/auth/login', 'POST', { email, password });
            this.setAuthToken(response.data.token);
            await this.authenticateUser();
            messageEl.textContent = '';
            this.showMessage('Login successful!', 'success');
            this.switchSection('overview');
            this.showApp();
        } catch (error) {
            messageEl.textContent = error.message;
        }
    }

    handleLogout() {
        this.clearAuth();
        this.user = null;
        this.school = null;
        this.students = [];
        this.showLogin();
        this.showMessage('Logged out successfully.', 'success');
    }

    setAuthToken(token) {
        this.token = token;
        localStorage.setItem(AUTH_STORAGE_KEY, token);
    }

    clearAuth() {
        this.token = null;
        localStorage.removeItem(AUTH_STORAGE_KEY);
    }

    showLogin() {
        document.getElementById('login-section').style.display = 'block';
        document.querySelector('.nav-tabs').style.display = 'none';
        document.querySelector('.content').style.display = 'none';
        document.querySelector('.footer').style.display = 'none';
        document.getElementById('logout-btn').classList.add('hidden');
        document.getElementById('user-greeting').textContent = 'Not signed in';
    }

    showApp() {
        document.getElementById('login-section').style.display = 'none';
        document.querySelector('.nav-tabs').style.display = 'flex';
        document.querySelector('.content').style.display = 'block';
        document.querySelector('.footer').style.display = 'block';
        document.getElementById('logout-btn').classList.remove('hidden');
    }

    showLoginForm() {
        document.getElementById('login-form-container').classList.remove('hidden');
        document.getElementById('show-login-btn').classList.add('active');
    }

    updateUserInfo() {
        document.getElementById('user-greeting').textContent = this.user ? `Signed in as ${this.user.full_name} (${this.user.role})` : 'Not signed in';
    }

    async renderAdminPanel() {
        if (this.user?.role !== 'SUPER_ADMIN') {
            this.switchSection('overview');
            return;
        }

        const listContainer = document.getElementById('admin-school-list');
        const messageEl = document.getElementById('admin-panel-message');
        try {
            const response = await this.makeRequest('/schools');
            const schools = response.data || [];
            if (schools.length === 0) {
                listContainer.innerHTML = '<p class="login-message">No schools found.</p>';
                return;
            }

            listContainer.innerHTML = schools.map((school) => `
                <div class="admin-school-item">
                    <h4>${school.name}</h4>
                    <p><strong>Code:</strong> ${school.code}</p>
                    <p><strong>Status:</strong> ${school.status || 'N/A'}</p>
                    <p><strong>Type:</strong> ${school.school_type || 'N/A'}</p>
                    <p><strong>Principal:</strong> ${school.principal_name || 'N/A'}</p>
                </div>
            `).join('');
            messageEl.textContent = '';
        } catch (error) {
            listContainer.innerHTML = '';
            messageEl.textContent = error.message;
        }
    }

    async handleAdminCreateSchool(e) {
        e.preventDefault();
        const messageEl = document.getElementById('admin-panel-message');

        const payload = {
            schoolName: document.getElementById('admin-school-name').value.trim(),
            schoolCode: document.getElementById('admin-school-code').value.trim(),
            motto: document.getElementById('admin-school-motto').value.trim(),
            address: document.getElementById('admin-school-address').value.trim(),
            email: document.getElementById('admin-school-email').value.trim(),
            phone: document.getElementById('admin-school-phone').value.trim(),
            website: document.getElementById('admin-school-website').value.trim(),
            principalName: document.getElementById('admin-school-principal').value.trim(),
            principalPhone: null,
            schoolType: document.getElementById('admin-school-type').value.trim(),
            logoUrl: null,
            primaryColor: null,
            secondaryColor: null,
            sessionSystem: 'TERM'
        };

        if (!payload.schoolName || !payload.schoolCode) {
            messageEl.textContent = 'School name and code are required.';
            return;
        }

        try {
            await this.makeRequest('/auth/create-school', 'POST', payload);
            messageEl.textContent = 'School created successfully.';
            document.getElementById('admin-school-form').reset();
            await this.renderAdminPanel();
            await this.renderUserManagement();
        } catch (error) {
            messageEl.textContent = error.message;
        }
    }

    async renderUserManagement() {
        const userManagementBtn = document.getElementById('user-management-btn');
        const userManagementSection = document.getElementById('user-management');
        if (!['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(this.user?.role)) {
            if (userManagementSection && userManagementSection.classList.contains('active')) {
                this.switchSection('overview');
            }
            return;
        }

        const listContainer = document.getElementById('user-management-list');
        const messageEl = document.getElementById('user-management-message');
        const schoolSelectWrapper = document.getElementById('user-school-select-wrapper');
        const schoolSelect = document.getElementById('user-school-select');
        const isSuperAdmin = this.user.role === 'SUPER_ADMIN';

        try {
            let schoolId = this.user.school_id;

            if (isSuperAdmin) {
                schoolSelectWrapper.classList.remove('hidden');
                const schoolsResponse = await this.makeRequest('/schools');
                const schools = schoolsResponse.data || [];
                schoolSelect.innerHTML = `<option value="">Select a school</option>` + schools.map((school) => `
                    <option value="${school.id}">${school.name} (${school.code})</option>
                `).join('');
                schoolId = schoolSelect.value || (schools.length > 0 ? schools[0].id : null);
                if (schools.length && !schoolSelect.value) {
                    schoolSelect.value = schoolId;
                }
            } else {
                schoolSelectWrapper.classList.add('hidden');
                schoolSelect.innerHTML = '';
            }

            if (!schoolId) {
                listContainer.innerHTML = '<p class="login-message">Select a school to view staff.</p>';
                return;
            }

            const response = await this.makeRequest(`/users?school_id=${schoolId}`);
            const users = response.data || [];
            if (users.length === 0) {
                listContainer.innerHTML = '<p class="login-message">No staff found.</p>';
            } else {
                listContainer.innerHTML = users.map((user) => `
                    <div class="admin-school-item">
                        <h4>${user.full_name}</h4>
                        <p><strong>Role:</strong> ${user.role}</p>
                        <p><strong>Email:</strong> ${user.email}</p>
                    </div>
                `).join('');
            }
            messageEl.textContent = '';
        } catch (error) {
            listContainer.innerHTML = '';
            messageEl.textContent = error.message;
        }
    }

    async handleCreateUser(e) {
        e.preventDefault();
        const messageEl = document.getElementById('user-management-message');

        const fullName = document.getElementById('user-full-name').value.trim();
        const email = document.getElementById('user-email').value.trim();
        const password = document.getElementById('user-password').value;
        const role = document.getElementById('user-role').value;
        const phone = document.getElementById('user-phone').value.trim();
        const schoolId = this.user.role === 'SUPER_ADMIN' ? document.getElementById('user-school-select').value : undefined;

        if (!fullName || !email || !password || !role) {
            messageEl.textContent = 'Fill in all required staff fields.';
            return;
        }
        if (this.user.role === 'SUPER_ADMIN' && !schoolId) {
            messageEl.textContent = 'Select a school first.';
            return;
        }

        try {
            await this.makeRequest('/auth/register-user', 'POST', {
                fullName,
                email,
                password,
                role,
                phone,
                schoolId
            });
            messageEl.textContent = 'Staff account created successfully.';
            document.getElementById('user-management-form').reset();
            await this.renderUserManagement();
        } catch (error) {
            messageEl.textContent = error.message;
        }
    }

    async switchSection(sectionId) {
        document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

        document.getElementById(sectionId).classList.add('active');
        document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');

        if (sectionId === 'manage') await this.displayRecords();
        if (sectionId === 'overview') await this.updateDashboard();
        if (sectionId === 'reports') await this.generateReports();
        if (sectionId === 'admin-panel') await this.renderAdminPanel();
        if (sectionId === 'user-management') await this.renderUserManagement();
    }

    async makeRequest(endpoint, method = 'GET', data = null) {
        const options = { method, headers: { 'Content-Type': 'application/json' } };
        if (this.token) {
            options.headers.Authorization = `Bearer ${this.token}`;
        }
        if (data) options.body = JSON.stringify(data);

        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const text = await response.text();
        let json = {};
        try {
            if (text) {
                json = JSON.parse(text);
            }
        } catch (err) {
            console.warn('Response is not valid JSON:', text);
            json = {};
        }
        if (!response.ok) {
            if (response.status === 401) {
                this.clearAuth();
                this.showLogin();
            }
            throw new Error(json.error || `Request failed (${response.status})`);
        }
        return json;
    }

    async loadStudentsFromAPI() {
        try {
            const response = await this.makeRequest('/students');
            this.students = (response.data || []).map((student) => this.normalizeStudent(student));
        } catch (error) {
            console.warn('Backend unavailable, falling back to local storage:', error.message);
            this.showMessage('Server unavailable — using local mode', 'warning');
            this.students = this.loadStudents();
            this.showApp();
        }
    }

    async handleAddStudent(e) {
        e.preventDefault();

        const student = {
            id: document.getElementById('student-id').value,
            name: document.getElementById('student-name').value,
            dateOfBirth: document.getElementById('date-of-birth').value,
            gender: document.getElementById('gender').value,
            currentLevel: document.getElementById('current-level').value,
            enrollmentDate: document.getElementById('enrollment-date').value,
            parentName: document.getElementById('parent-name').value,
            contactNumber: document.getElementById('contact-number').value,
            address: document.getElementById('address').value,
            gpa: parseFloat(document.getElementById('current-gpa').value) || 0,
            status: document.getElementById('status').value,
            notes: document.getElementById('notes').value
        };

        try {
            if (USE_BACKEND) {
                const payload = {
                    student_code: student.id,
                    full_name: student.name,
                    date_of_birth: student.dateOfBirth,
                    gender: student.gender,
                    admission_date: student.enrollmentDate,
                    parent_name: student.parentName,
                    parent_contact: student.contactNumber,
                    address: student.address,
                    medical_info: student.notes,
                    status: student.status,
                    gpa: student.gpa
                };
                const response = await this.makeRequest('/students', 'POST', payload);
                this.students.unshift(this.normalizeStudent(response.data));
            } else {
                if (this.students.some(s => s.id === student.id)) {
                    this.showMessage('A student with this ID already exists!', 'error');
                    return;
                }
                student.recordDate = new Date().toISOString();
                this.students.unshift(student);
                this.saveStudents();
            }

            document.getElementById('student-form').reset();
            this.showMessage('Student record added successfully!', 'success');
            await this.updateDashboard();
            await this.displayRecords();
        } catch (error) {
            this.showMessage(error.message, 'error');
        }
    }

    async handleEditStudent(e) {
        e.preventDefault();

        const studentId = document.getElementById('edit-student-id').value;
        const updates = {
            full_name: document.getElementById('edit-name').value,
            gpa: parseFloat(document.getElementById('edit-gpa').value) || 0,
            status: document.getElementById('edit-status').value,
            parent_name: document.getElementById('edit-parent-name').value,
            parent_contact: document.getElementById('edit-contact').value,
            medical_info: document.getElementById('edit-notes').value
        };

        try {
            if (USE_BACKEND) {
                const response = await this.makeRequest(`/students/${studentId}`, 'PUT', updates);
                const index = this.students.findIndex(s => s.id === studentId);
                if (index !== -1) this.students[index] = this.normalizeStudent(response.data);
            } else {
                const index = this.students.findIndex(s => s.id === studentId);
                if (index !== -1) {
                    const legacyUpdates = {
                        name: document.getElementById('edit-name').value,
                        currentLevel: document.getElementById('edit-current-level').value,
                        gpa: parseFloat(document.getElementById('edit-gpa').value) || 0,
                        status: document.getElementById('edit-status').value,
                        parentName: document.getElementById('edit-parent-name').value,
                        contactNumber: document.getElementById('edit-contact').value,
                        notes: document.getElementById('edit-notes').value
                    };
                    this.students[index] = { ...this.students[index], ...legacyUpdates };
                    this.saveStudents();
                }
            }

            this.showMessage('Student record updated successfully!', 'success');
            this.closeEditModal();
            await this.updateDashboard();
            await this.displayRecords();
        } catch (error) {
            this.showMessage(error.message, 'error');
        }
    }

    async deleteStudent(studentId) {
        if (!confirm('Are you sure you want to delete this student record?')) return;

        try {
            if (USE_BACKEND) {
                await this.makeRequest(`/students/${studentId}`, 'DELETE');
            }
            this.students = this.students.filter(s => s.id !== studentId);
            if (!USE_BACKEND) this.saveStudents();
            this.showMessage('Student record deleted successfully!', 'success');
            await this.displayRecords();
            await this.updateDashboard();
        } catch (error) {
            this.showMessage(error.message, 'error');
        }
    }

    editStudent(studentId) {
        const student = this.students.find(s => s.id === studentId);
        if (!student) return;

        document.getElementById('edit-student-id').value = student.id;
        document.getElementById('edit-name').value = student.name;
        document.getElementById('edit-current-level').value = student.currentLevel;
        document.getElementById('edit-gpa').value = student.gpa;
        document.getElementById('edit-status').value = student.status;
        document.getElementById('edit-parent-name').value = student.parentName;
        document.getElementById('edit-contact').value = student.contactNumber;
        document.getElementById('edit-notes').value = student.notes;
        this.showEditModal();
    }

    viewStudent(studentId) {
        const student = this.students.find(s => s.id === studentId);
        if (!student) return;

        document.getElementById('student-details').innerHTML = `
            <div class="student-details">
                <div class="detail-row"><div class="detail-label">Student ID:</div><div class="detail-value">${student.id}</div></div>
                <div class="detail-row"><div class="detail-label">Full Name:</div><div class="detail-value">${student.name}</div></div>
                <div class="detail-row"><div class="detail-label">Date of Birth:</div><div class="detail-value">${this.formatDate(student.dateOfBirth)}</div></div>
                <div class="detail-row"><div class="detail-label">Gender:</div><div class="detail-value">${student.gender}</div></div>
                <div class="detail-row"><div class="detail-label">Current Level:</div><div class="detail-value">${student.currentLevel}</div></div>
                <div class="detail-row"><div class="detail-label">Enrollment Date:</div><div class="detail-value">${this.formatDate(student.enrollmentDate)}</div></div>
                <div class="detail-row"><div class="detail-label">Parent/Guardian:</div><div class="detail-value">${student.parentName}</div></div>
                <div class="detail-row"><div class="detail-label">Contact Number:</div><div class="detail-value">${student.contactNumber}</div></div>
                <div class="detail-row"><div class="detail-label">Address:</div><div class="detail-value">${student.address || 'N/A'}</div></div>
                <div class="detail-row"><div class="detail-label">GPA/Grade:</div><div class="detail-value">${student.gpa.toFixed(2)}</div></div>
                <div class="detail-row"><div class="detail-label">Status:</div><div class="detail-value"><span class="status-badge status-${student.status.toLowerCase().replace(' ', '-')}">${student.status}</span></div></div>
                <div class="detail-row"><div class="detail-label">Notes:</div><div class="detail-value">${student.notes || 'N/A'}</div></div>
                ${student.recordDate ? `<div class="detail-row"><div class="detail-label">Record Created:</div><div class="detail-value">${this.formatDate(student.recordDate)}</div></div>` : ''}
            </div>
        `;
        this.showViewModal();
    }

    normalizeStudent(student) {
        return {
            id: student.id,
            studentCode: student.student_code || student.id,
            name: student.full_name || student.name,
            dateOfBirth: student.date_of_birth || student.dateOfBirth,
            gender: student.gender,
            currentLevel: student.class_id || student.currentLevel || 'Unassigned',
            enrollmentDate: student.admission_date || student.enrollmentDate,
            parentName: student.parent_name || student.parentName,
            contactNumber: student.parent_contact || student.contactNumber,
            address: student.address || '',
            gpa: typeof student.gpa === 'number' ? student.gpa : parseFloat(student.gpa) || 0,
            status: student.status || 'Active',
            notes: student.medical_info || student.notes || '',
            recordDate: student.created_at || student.recordDate || new Date().toISOString()
        };
    }

    async displayRecords() {
        const levelFilter = document.getElementById('filter-level').value;
        const statusFilter = document.getElementById('filter-status').value;
        const sortBy = document.getElementById('sort-by').value.toLowerCase();

        let filtered = [...this.students];

        if (levelFilter) filtered = filtered.filter(s => s.currentLevel === levelFilter);
        if (statusFilter) filtered = filtered.filter(s => s.status === statusFilter);

        filtered.sort((a, b) => {
            if (sortBy) {
                const aText = (a.name + ' ' + a.id).toLowerCase();
                const bText = (b.name + ' ' + b.id).toLowerCase();
                return aText.includes(sortBy) ? -1 : 1;
            }
            return new Date(b.recordDate || 0) - new Date(a.recordDate || 0);
        });

        const container = document.getElementById('records-list');
        if (filtered.length === 0) {
            container.innerHTML = '<div class="no-records"><p>No student records found.</p></div>';
            return;
        }
        container.innerHTML = filtered.map(student => this.createRecordCard(student)).join('');
    }

    createRecordCard(student) {
        const statusClass = `status-${student.status.toLowerCase().replace(' ', '-')}`;
        return `
            <div class="record-card">
                <div class="record-header">
                    <div class="record-title">${student.name}</div>
                    <div class="record-id">${student.id}</div>
                </div>
                <div class="record-info">
                    <div class="info-row"><span class="info-label">Level:</span><span class="info-value">${student.currentLevel}</span></div>
                    <div class="info-row"><span class="info-label">GPA:</span><span class="info-value">${student.gpa.toFixed(2)}</span></div>
                    <div class="info-row"><span class="info-label">Parent:</span><span class="info-value">${student.parentName}</span></div>
                    <div class="info-row"><span class="info-label">Contact:</span><span class="info-value">${student.contactNumber}</span></div>
                    <span class="status-badge ${statusClass}">${student.status}</span>
                </div>
                <div class="record-actions">
                    <button class="btn btn-primary btn-small" onclick="app.viewStudent('${student.id}')">View</button>
                    <button class="btn btn-success btn-small" onclick="app.editStudent('${student.id}')">Edit</button>
                    <button class="btn btn-danger btn-small" onclick="app.deleteStudent('${student.id}')">Delete</button>
                </div>
            </div>
        `;
    }

    async performSearch() {
        const query = document.getElementById('search-input').value.toLowerCase().trim();
        const resultsContainer = document.getElementById('search-results');

        if (!query) {
            resultsContainer.innerHTML = '<p style="text-align: center; color: #64748b;">Enter a search term to find student records.</p>';
            return;
        }

        try {
            let results;
            if (USE_BACKEND) {
                const response = await this.makeRequest(`/students/search/query?q=${encodeURIComponent(query)}`);
                results = response.data || [];
            } else {
                results = this.students.filter(student =>
                    student.name.toLowerCase().includes(query) ||
                    student.id.toLowerCase().includes(query) ||
                    student.parentName.toLowerCase().includes(query) ||
                    student.contactNumber.includes(query)
                );
            }

            if (results.length === 0) {
                resultsContainer.innerHTML = '<div class="no-records"><p>No students found matching your search.</p></div>';
                return;
            }

            resultsContainer.innerHTML = `
                <p style="margin-bottom: 20px; color: #64748b;">Found ${results.length} student(s)</p>
                ${results.map(student => this.createSearchResultItem(student)).join('')}
            `;
        } catch (error) {
            this.showMessage(error.message, 'error');
        }
    }

    createSearchResultItem(student) {
        const statusClass = `status-${student.status.toLowerCase().replace(' ', '-')}`;
        return `
            <div class="record-card" style="margin-bottom: 15px;">
                <div class="record-header">
                    <div class="record-title">${student.name}</div>
                    <div class="record-id">${student.id}</div>
                </div>
                <div class="record-info">
                    <div class="info-row"><span class="info-label">Level:</span><span class="info-value">${student.currentLevel}</span></div>
                    <div class="info-row"><span class="info-label">Parent:</span><span class="info-value">${student.parentName}</span></div>
                    <div class="info-row"><span class="info-label">Contact:</span><span class="info-value">${student.contactNumber}</span></div>
                    <span class="status-badge ${statusClass}">${student.status}</span>
                </div>
                <div class="record-actions">
                    <button class="btn btn-primary btn-small" onclick="app.viewStudent('${student.id}')">View</button>
                    <button class="btn btn-success btn-small" onclick="app.editStudent('${student.id}')">Edit</button>
                    <button class="btn btn-danger btn-small" onclick="app.deleteStudent('${student.id}')">Delete</button>
                </div>
            </div>
        `;
    }

    async updateDashboard() {
        try {
            if (USE_BACKEND) {
                const response = await this.makeRequest('/reports/statistics');
                document.getElementById('total-students').textContent = response.data.totalStudents;
                document.getElementById('active-students').textContent = response.data.activeStudents;
                document.getElementById('graduated-students').textContent = response.data.graduatedStudents;
            } else {
                const total = this.students.length;
                const active = this.students.filter(s => s.status === 'Active').length;
                const graduated = this.students.filter(s => s.status === 'Graduated').length;
                document.getElementById('total-students').textContent = total;
                document.getElementById('active-students').textContent = active;
                document.getElementById('graduated-students').textContent = graduated;
            }
            await this.updateLevelDistribution();
            this.updateRecentStudents();
        } catch (error) {
            console.error('Dashboard update failed:', error);
        }
    }

    async updateLevelDistribution() {
        const levels = [
            'Creche', 'Nursery',
            'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6',
            'Junior Secondary 1', 'Junior Secondary 2', 'Junior Secondary 3',
            'Senior Secondary 1', 'Senior Secondary 2', 'Senior Secondary 3'
        ];

        let distribution = [];
        if (USE_BACKEND) {
            try {
                const response = await this.makeRequest('/reports/level-distribution');
                distribution = response.data;
            } catch (error) {
                distribution = [];
            }
        } else {
            distribution = levels.map(level => ({ currentLevel: level, count: this.students.filter(s => s.currentLevel === level).length }));
        }

        const maxCount = Math.max(1, ...distribution.map(item => item.count || 0));
        document.getElementById('level-distribution').innerHTML = levels.map(level => {
            const count = (distribution.find(item => item.currentLevel === level) || {}).count || 0;
            const width = (count / maxCount) * 100;
            return `
                <div class="level-item">
                    <span style="min-width: 150px; font-weight: 500;">${level}</span>
                    <div class="level-bar"><div class="level-progress" style="width: ${width}%"></div></div>
                    <span style="min-width: 40px; text-align: right; font-weight: bold;">${count}</span>
                </div>
            `;
        }).join('');
    }

    updateRecentStudents() {
        const recent = [...this.students].sort((a, b) => new Date(b.recordDate || 0) - new Date(a.recordDate || 0)).slice(0, 5);
        document.getElementById('recent-list').innerHTML = recent.length === 0 ? '<p style="text-align: center; color: #64748b;">No student records yet.</p>' : recent.map(student => `
            <div class="recent-item">
                <div>
                    <strong>${student.name}</strong> (${student.id})<br>
                    <small style="color: #64748b;">${student.currentLevel} • ${student.status}</small>
                </div>
                <small style="color: #64748b;">${this.formatDate(student.recordDate)}</small>
            </div>
        `).join('');
    }

    async generateReports() {
        await this.generateGPAReport();
        await this.generateGenderReport();
        await this.generateStatusReport();
    }

    async generateGPAReport() {
        try {
            let data = [];
            if (USE_BACKEND) {
                const response = await this.makeRequest('/reports/gpa-by-level');
                data = response.data;
            } else {
                const levels = [
                    'Creche', 'Nursery',
                    'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6',
                    'Junior Secondary 1', 'Junior Secondary 2', 'Junior Secondary 3',
                    'Senior Secondary 1', 'Senior Secondary 2', 'Senior Secondary 3'
                ];
                data = levels.map(level => {
                    const students = this.students.filter(s => s.currentLevel === level);
                    return students.length ? { level, averageGPA: (students.reduce((sum, s) => sum + s.gpa, 0) / students.length).toFixed(2) } : null;
                }).filter(Boolean);
            }
            document.getElementById('gpa-report').innerHTML = data.length ? data.map(item => `
                <div class="report-item"><span>${item.level}</span><strong>${item.averageGPA}</strong></div>
            `).join('') : '<p style="text-align: center; color: #64748b;">No data available</p>';
        } catch (error) {
            document.getElementById('gpa-report').innerHTML = '<p style="text-align: center; color: #64748b;">Failed to load data</p>';
        }
    }

    async generateGenderReport() {
        try {
            let data = [];
            if (USE_BACKEND) {
                const response = await this.makeRequest('/reports/gender-distribution');
                data = response.data;
            } else {
                const genders = ['Male', 'Female', 'Other'];
                data = genders.map(gender => ({ gender, count: this.students.filter(s => s.gender === gender).length })).filter(item => item.count > 0);
            }
            document.getElementById('gender-report').innerHTML = data.length ? data.map(item => `
                <div class="report-item"><span>${item.gender}</span><strong>${item.count}</strong></div>
            `).join('') : '<p style="text-align: center; color: #64748b;">No data available</p>';
        } catch (error) {
            document.getElementById('gender-report').innerHTML = '<p style="text-align: center; color: #64748b;">Failed to load data</p>';
        }
    }

    async generateStatusReport() {
        try {
            let data = [];
            if (USE_BACKEND) {
                const response = await this.makeRequest('/reports/status-distribution');
                data = response.data;
            } else {
                const statuses = ['Active', 'On Leave', 'Transferred', 'Graduated'];
                data = statuses.map(status => ({ status, count: this.students.filter(s => s.status === status).length })).filter(item => item.count > 0);
            }
            document.getElementById('status-report').innerHTML = data.length ? data.map(item => `
                <div class="report-item"><span>${item.status}</span><strong>${item.count}</strong></div>
            `).join('') : '<p style="text-align: center; color: #64748b;">No data available</p>';
        } catch (error) {
            document.getElementById('status-report').innerHTML = '<p style="text-align: center; color: #64748b;">Failed to load data</p>';
        }
    }

    exportToCSV() {
        if (this.students.length === 0) {
            this.showMessage('No student records to export!', 'warning');
            return;
        }
        const headers = ['Student ID', 'Name', 'Date of Birth', 'Gender', 'Current Level', 'Enrollment Date', 'Parent/Guardian', 'Contact Number', 'Address', 'GPA', 'Status', 'Notes'];
        const rows = this.students.map(student => [
            student.id,
            student.name,
            student.dateOfBirth,
            student.gender,
            student.currentLevel,
            student.enrollmentDate,
            student.parentName,
            student.contactNumber,
            student.address,
            student.gpa,
            student.status,
            student.notes
        ]);

        let csv = `${headers.join(',')}\n`;
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `student_records_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showMessage('Records exported successfully!', 'success');
    }

    printReport() {
        if (this.students.length === 0) {
            this.showMessage('No student records to print!', 'warning');
            return;
        }
        window.print();
    }

    showEditModal() {
        document.getElementById('edit-modal').classList.add('show');
    }

    closeEditModal() {
        document.getElementById('edit-modal').classList.remove('show');
        document.getElementById('edit-form').reset();
    }

    showViewModal() {
        document.getElementById('view-modal').classList.add('show');
    }

    closeViewModal() {
        document.getElementById('view-modal').classList.remove('show');
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    showMessage(message, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `${type}-message`;
        messageDiv.textContent = message;
        messageDiv.style.position = 'fixed';
        messageDiv.style.top = '20px';
        messageDiv.style.right = '20px';
        messageDiv.style.zIndex = '9999';
        messageDiv.style.maxWidth = '400px';
        messageDiv.style.borderRadius = '6px';
        document.body.appendChild(messageDiv);
        setTimeout(() => messageDiv.remove(), 3000);
    }

    saveStudents() {
        localStorage.setItem('student_records', JSON.stringify(this.students));
    }

    loadStudents() {
        const stored = localStorage.getItem('student_records');
        return stored ? JSON.parse(stored) : [];
    }
}

const app = new StudentRecordTracker();

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
});
