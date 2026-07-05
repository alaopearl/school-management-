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
        this.availableSchools = [];
        this.activeSchoolId = null;
        this.pendingRegistration = null;
        this.init();
    }

    async fetchNotifications() {
        if (!this.token) return;
        try {
            const response = await this.makeRequest('/notifications/inbox', 'GET');
            this.notifications = response.data || [];
            this.unreadCount = response.unread || 0;
            this.renderNotifications();
        } catch (err) {
            console.warn('Could not load notifications:', err.message);
        }
    }

    async populateRecipientSelect() {
        const type = document.getElementById('notif-recipient-type')?.value;
        const select = document.getElementById('notif-recipient-select');
        if (!select) return;
        select.innerHTML = '<option value="">-- choose recipient --</option>';
        try {
            if (type === 'USER') {
                // if super admin, ask to choose school first
                let schoolId = null;
                if (this.user?.role === 'SUPER_ADMIN') {
                    schoolId = this.activeSchoolId || this.availableSchools[0]?.id || null;
                } else {
                    schoolId = this.user?.school_id;
                }
                const usersResp = await this.makeRequest(`/users?school_id=${schoolId}`);
                const users = usersResp.data || [];
                users.forEach(u => {
                    const opt = document.createElement('option');
                    opt.value = u.id;
                    opt.textContent = `${u.full_name} <${u.email}>`;
                    select.appendChild(opt);
                });
            } else if (type === 'SCHOOL') {
                const schoolsResp = await this.makeRequest('/schools');
                const schools = schoolsResp.data || [];
                schools.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.textContent = `${s.name} (${s.code})`;
                    select.appendChild(opt);
                });
            } else {
                // ALL - leave select empty
            }
        } catch (err) {
            console.warn('Failed to populate recipients:', err.message);
        }
    }

    applyTemplate(key) {
        const subj = document.getElementById('notif-subject');
        const msg = document.getElementById('notif-message');
        if (!subj || !msg) return;
        if (key === 'welcome') {
            subj.value = 'Welcome to our School Portal';
            msg.value = 'Welcome! We are glad to have you. Please login to access your dashboard.';
        } else if (key === 'fee_reminder') {
            subj.value = 'Fee Payment Reminder';
            msg.value = 'This is a friendly reminder to settle outstanding school fees by the due date.';
        } else if (key === 'event_reminder') {
            subj.value = 'Upcoming School Event Reminder';
            msg.value = 'Reminder: A school event is coming up. Please check the calendar for details.';
        }
    }

    previewNotification() {
        const subj = document.getElementById('notif-subject')?.value || '';
        const msg = document.getElementById('notif-message')?.value || '';
        alert(`Preview:\n\nSubject: ${subj}\n\nMessage:\n${msg}`);
    }

    async fetchNotificationHistory() {
        try {
            const resp = await this.makeRequest('/notifications/history', 'GET');
            this.notificationHistory = resp.data || [];
            this.renderNotificationHistory();
        } catch (err) {
            console.warn('Could not load notification history:', err.message);
        }
    }

    renderNotificationHistory() {
        const container = document.getElementById('admin-notif-log');
        if (!container) return;
        if (!this.notificationHistory || this.notificationHistory.length === 0) {
            container.innerHTML = '<p class="login-message">No notifications sent yet.</p>';
            return;
        }
        container.innerHTML = this.notificationHistory.map(n => `
            <div class="admin-list-item">
                <strong>${this.escapeHtml(n.subject || n.type || '')}</strong>
                <div>${this.escapeHtml(n.message || '')}</div>
                <div class="muted">Channel: ${n.channel} • Status: ${n.status || 'PENDING'} • ${new Date(n.created_at).toLocaleString()}</div>
            </div>
        `).join('');
    }

    renderNotifications() {
        const countEl = document.getElementById('notification-count');
        const listEl = document.getElementById('notification-list');
        if (!listEl || !countEl) return;
        if (this.unreadCount > 0) {
            countEl.textContent = this.unreadCount;
            countEl.classList.remove('hidden');
        } else {
            countEl.classList.add('hidden');
        }

        if (!this.notifications || this.notifications.length === 0) {
            listEl.innerHTML = '<p class="muted">No notifications</p>';
            return;
        }

        listEl.innerHTML = this.notifications.map(n => `
            <div class="notif-item ${n.read ? 'read' : 'unread'}">
                <div class="notif-subject">${this.escapeHtml(n.subject || '')}</div>
                <div class="notif-message">${this.escapeHtml(n.message || '')}</div>
                <div class="notif-meta">${new Date(n.created_at).toLocaleString()} <button class="btn btn-link small" onclick="app.markNotificationRead('${n.id}')">Mark read</button></div>
            </div>
        `).join('');
    }

    toggleNotificationDropdown() {
        const dd = document.getElementById('notification-dropdown');
        if (!dd) return;
        dd.classList.toggle('hidden');
        if (!dd.classList.contains('hidden')) {
            this.fetchNotifications();
        }
    }

    async markNotificationRead(id) {
        try {
            // Optimistically mark as read in the UI
            if (this.notifications) {
                const idx = this.notifications.findIndex(n => n.id === id);
                if (idx !== -1 && !this.notifications[idx].read) {
                    this.notifications[idx].read = 1;
                    this.unreadCount = Math.max(0, (this.unreadCount || 0) - 1);
                    this.renderNotifications();
                    this.animateBadge();
                }
            }

            // Persist on server
            await this.makeRequest(`/notifications/${id}/read`, 'POST');
            // refresh silently
            this.fetchNotifications().catch(()=>{});
        } catch (err) {
            this.showMessage('Could not mark notification read', 'error');
            // On error, re-fetch to ensure UI consistency
            this.fetchNotifications().catch(()=>{});
        }
    }

    async markAllRead() {
        if (!this.notifications || this.notifications.length === 0) return;
        const toMark = this.notifications.filter(n => !n.read).map(n => n.id);
        if (toMark.length === 0) return;
        // Optimistically update UI
        this.notifications.forEach(n => { n.read = 1; });
        this.unreadCount = 0;
        this.renderNotifications();
        this.animateBadge();

        try {
            await Promise.all(toMark.map(id => this.makeRequest(`/notifications/${id}/read`, 'POST')));
            // refresh in background
            this.fetchNotifications().catch(()=>{});
        } catch (err) {
            this.showMessage('Failed to mark all read', 'error');
            // revert by reloading actual state
            this.fetchNotifications().catch(()=>{});
        }
    }

    animateBadge() {
        const countEl = document.getElementById('notification-count');
        if (!countEl) return;
        countEl.classList.add('badge-pop');
        setTimeout(() => countEl.classList.remove('badge-pop'), 600);
    }

    async handleSendNotification(e) {
        e.preventDefault();
        const recipientType = document.getElementById('notif-recipient-type').value;
        const recipientId = document.getElementById('notif-recipient-id').value.trim() || null;
        const recipientEmail = document.getElementById('notif-recipient-email').value.trim() || null;
        const channel = document.getElementById('notif-channel').value;
        const subject = document.getElementById('notif-subject').value.trim();
        const message = document.getElementById('notif-message').value.trim();
        const msgEl = document.getElementById('notif-message');

        if (!message) {
            msgEl.textContent = 'Message is required.';
            return;
        }

        try {
            const scheduledAt = document.getElementById('notif-scheduled-at')?.value || null;
            const payload = {
                recipientId: recipientId || (recipientType === 'ALL' ? 'ALL' : undefined),
                recipientType,
                recipient_email: recipientEmail || undefined,
                subject: subject || 'Notification from Admin',
                message,
                notificationType: 'ADMIN_BROADCAST',
                channel,
                scheduled_at: scheduledAt
            };

            const res = await this.makeRequest('/notifications/send', 'POST', payload);
            msgEl.textContent = res.message || 'Notification sent.';
            msgEl.classList.remove('error');
            msgEl.classList.add('success');
            // refresh notifications
            await this.fetchNotifications();
        } catch (err) {
            msgEl.textContent = err.message;
            msgEl.classList.add('error');
        }
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
        document.getElementById('send-notification-form')?.addEventListener('submit', (e) => this.handleSendNotification(e));
        document.getElementById('notif-recipient-type')?.addEventListener('change', () => this.populateRecipientSelect());
        document.getElementById('notif-template')?.addEventListener('change', (e) => this.applyTemplate(e.target.value));
        document.getElementById('notif-preview')?.addEventListener('click', () => this.previewNotification());
        document.getElementById('user-school-select').addEventListener('change', () => this.renderUserManagement());
        document.getElementById('add-school-btn')?.addEventListener('click', () => this.switchSection('admin-panel'));
        document.getElementById('view-schools-btn')?.addEventListener('click', () => this.switchSection('schools'));
        document.getElementById('view-logs-btn')?.addEventListener('click', () => this.switchSection('logs'));
        document.getElementById('refresh-retries-btn')?.addEventListener('click', () => this.fetchRetries());
        document.getElementById('test-gateway-btn')?.addEventListener('click', () => this.handleTestGateway());
        // Payments, Attendance, Academics handlers
        document.getElementById('payment-form')?.addEventListener('submit', (e) => this.handleRecordPayment(e));
        document.getElementById('invoice-form')?.addEventListener('submit', (e) => this.handleCreateInvoice(e));
        document.getElementById('attendance-form')?.addEventListener('submit', (e) => this.handleRecordAttendance(e));
        document.getElementById('syllabus-form')?.addEventListener('submit', (e) => this.handleUploadSyllabus(e));
        document.getElementById('note-form')?.addEventListener('submit', (e) => this.handleCreateNote(e));
        // About us and chat
        document.getElementById('about-us-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('about-modal').classList.add('show');
        });
        document.getElementById('chat-toggle')?.addEventListener('click', () => {
            document.getElementById('live-chat').classList.toggle('hidden');
        });
        document.getElementById('chat-close')?.addEventListener('click', () => {
            document.getElementById('live-chat').classList.add('hidden');
        });
        document.getElementById('chat-form')?.addEventListener('submit', (e) => this.handleChatSubmit(e));

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

        // Footer utilities
        document.getElementById('subscribe-btn')?.addEventListener('click', () => this.handleSubscribe());
        document.getElementById('back-to-top')?.addEventListener('click', () => window.scrollTo({top:0,behavior:'smooth'}));
        document.getElementById('theme-toggle')?.addEventListener('click', () => this.toggleTheme());
        // Notifications
        document.getElementById('notification-bell')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleNotificationDropdown();
        });
        document.getElementById('mark-all-read')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.markAllRead();
        });
        // close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dd = document.getElementById('notification-dropdown');
            if (!dd) return;
            if (!dd.classList.contains('hidden') && !e.target.closest('.notification-wrapper')) {
                dd.classList.add('hidden');
            }
        });
    }

    async handleChatSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('chat-name').value.trim();
        const email = document.getElementById('chat-email').value.trim();
        const text = document.getElementById('chat-input').value.trim();
        if (!name || !email || !text) return;

        // append to chat messages locally
        const messagesEl = document.getElementById('chat-messages');
        const el = document.createElement('div');
        el.className = 'msg';
        el.innerHTML = `<div class="from">You</div><div class="text">${this.escapeHtml(text)}</div>`;
        messagesEl.appendChild(el);
        messagesEl.scrollTop = messagesEl.scrollHeight;

        // send to backend public contact endpoint
        try {
            await fetch(`${API_BASE_URL}/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, subject: 'Website Live Chat', message: text })
            });

            const reply = document.createElement('div');
            reply.className = 'msg';
            reply.innerHTML = `<div class="from">Support</div><div class="text">Thanks ${this.escapeHtml(name)} — your message has been received. Our team will respond via email shortly.</div>`;
            messagesEl.appendChild(reply);
            messagesEl.scrollTop = messagesEl.scrollHeight;
        } catch (err) {
            const errorMsg = document.createElement('div');
            errorMsg.className = 'msg';
            errorMsg.innerHTML = `<div class="from">System</div><div class="text">Failed to send message. Please try again later.</div>`;
            messagesEl.appendChild(errorMsg);
        }

        document.getElementById('chat-input').value = '';
    }

    async handleSubscribe(){
        const email = document.getElementById('newsletter-email')?.value.trim();
        if(!email) { this.showMessage('Enter an email to subscribe', 'warning'); return; }
        try{
            // simulate subscribe action
            await fetch(`${API_BASE_URL}/contact`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name: 'Newsletter', email, subject: 'Newsletter Subscribe', message: 'Subscribe' }) });
            this.showMessage('Subscribed successfully — check your email', 'success');
            document.getElementById('newsletter-email').value = '';
        }catch(err){ this.showMessage('Subscription failed', 'error'); }
    }

    // Payments
    async handleRecordPayment(e) {
        e.preventDefault();
        const invoiceId = document.getElementById('payment-invoice').value.trim();
        const amount = parseFloat(document.getElementById('payment-amount').value);
        const method = document.getElementById('payment-method').value;
        const msgEl = document.getElementById('payment-message');
        if (!invoiceId || !amount) { msgEl.textContent = 'Invoice and amount required'; return; }
        try {
            const res = await this.makeRequest('/payments/record', 'POST', { invoiceId, amount, paymentMethod: method });
            msgEl.textContent = 'Payment recorded';
            this.fetchPaymentsDashboard();
        } catch (err) { msgEl.textContent = err.message; }
    }

    async handleCreateInvoice(e) {
        e.preventDefault();
        const studentId = document.getElementById('invoice-student').value.trim();
        const amount = parseFloat(document.getElementById('invoice-amount').value);
        const dueDate = document.getElementById('invoice-due').value || null;
        const msgEl = document.getElementById('invoice-message');
        if (!studentId || !amount) { msgEl.textContent = 'Student and amount required'; return; }
        try {
            const res = await this.makeRequest('/fees/invoices', 'POST', { studentId, amount, dueDate });
            msgEl.textContent = 'Invoice created: ' + (res.data?.invoice_number || res.data?.id || '');
            this.fetchInvoices();
        } catch (err) { msgEl.textContent = 'Failed to create invoice: ' + err.message; }
    }

    async fetchInvoices() {
        try {
            const res = await this.makeRequest('/fees/invoices', 'GET');
            const container = document.getElementById('payments-dashboard');
            if (!res.data || res.data.length === 0) { container.innerHTML = '<p>No invoices</p>'; return; }
            container.innerHTML = res.data.map(i => `<div>${i.invoice_number || i.id} • ${i.amount} • ${i.status || i.type || ''}</div>`).join('');
        } catch (err) { document.getElementById('payments-dashboard').innerHTML = '<p>Unable to load invoices</p>'; }
    }

    async fetchPaymentsDashboard() {
        try {
            const res = await this.makeRequest('/payments/dashboard/summary', 'GET');
            const el = document.getElementById('payments-dashboard');
            if (!res.data) { el.innerHTML = '<p>No data</p>'; return; }
            const d = res.data;
            el.innerHTML = `
                <div>Total Revenue: ${d.totalRevenue || 0}</div>
                <div>Today: ${d.todayPayments || 0}</div>
                <div>Monthly: ${d.monthlyRevenue || 0}</div>
                <div>Outstanding: ${d.outstandingFees || 0}</div>
            `;
        } catch (err) {
            const el = document.getElementById('payments-dashboard'); el.innerHTML = '<p>Unable to load dashboard</p>';
        }
    }

    // Attendance
    async handleRecordAttendance(e) {
        e.preventDefault();
        const date = document.getElementById('attendance-date').value;
        const type = document.getElementById('attendance-type').value;
        const entriesText = document.getElementById('attendance-entries').value;
        const msgEl = document.getElementById('attendance-message');
        try {
            const records = JSON.parse(entriesText || '[]');
            const res = await this.makeRequest('/attendance/record', 'POST', { records, recordDate: date, personType: type });
            msgEl.textContent = `Recorded ${res.created_count || 0} entries`;
            this.fetchRecentAttendance();
        } catch (err) { msgEl.textContent = 'Failed to record attendance: ' + err.message; }
    }

    async fetchRecentAttendance() {
        try {
            const res = await this.makeRequest('/attendance', 'GET');
            const el = document.getElementById('attendance-list');
            if (!res.data || res.data.length === 0) { el.innerHTML = '<p>No attendance records</p>'; return; }
            el.innerHTML = res.data.slice(0,20).map(a => `<div>${a.record_date} • ${a.person_type} • ${a.person_id} • ${a.status}</div>`).join('');
        } catch (err) { document.getElementById('attendance-list').innerHTML = '<p>Unable to load attendance</p>'; }
    }

    // Syllabus
    async handleUploadSyllabus(e) {
        e.preventDefault();
        const subjectId = document.getElementById('syllabus-subject').value.trim();
        const title = document.getElementById('syllabus-title').value.trim();
        const content = document.getElementById('syllabus-content').value.trim();
        const doc = document.getElementById('syllabus-doc').value.trim();
        const msgEl = document.getElementById('syllabus-message');
        if (!title) { msgEl.textContent = 'Title required'; return; }
        try {
            let documentUrl = doc || null;
            const fileInput = document.getElementById('syllabus-file');
            if (fileInput && fileInput.files && fileInput.files[0]) {
                const uploadRes = await this.uploadFile(fileInput.files[0]);
                documentUrl = uploadRes.url;
            }
            const res = await this.makeRequest('/syllabus', 'POST', { subjectId, title, content, documentUrl });
            msgEl.textContent = res.message || 'Syllabus uploaded';
        } catch (err) { msgEl.textContent = 'Failed to upload syllabus: ' + err.message; }
    }

    // Notes
    async handleCreateNote(e) {
        e.preventDefault();
        const subjectId = document.getElementById('note-subject').value.trim();
        const title = document.getElementById('note-title').value.trim();
        const content = document.getElementById('note-content').value.trim();
        const doc = document.getElementById('note-doc').value.trim();
        const msgEl = document.getElementById('note-message');
        if (!title || (!content && !doc)) { msgEl.textContent = 'Title and content or document required'; return; }
        try {
            let documentUrl = doc || null;
            const fileInput = document.getElementById('note-file');
            if (fileInput && fileInput.files && fileInput.files[0]) {
                const uploadRes = await this.uploadFile(fileInput.files[0]);
                documentUrl = uploadRes.url;
            }
            const res = await this.makeRequest('/notes', 'POST', { subjectId, title, content, documentUrl });
            msgEl.textContent = res.message || 'Note created';
        } catch (err) { msgEl.textContent = 'Failed to create note: ' + err.message; }
    }

    async uploadFile(file) {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch(`${API_BASE_URL}/upload`, { method: 'POST', headers: { ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }, body: form });
        if (!res.ok) throw new Error('Upload failed');
        return res.json();
    }

    toggleTheme(){
        const root = document.documentElement;
        if(root.classList.contains('dark')){ root.classList.remove('dark'); document.getElementById('theme-toggle').textContent='Dark'; }
        else { root.classList.add('dark'); document.getElementById('theme-toggle').textContent='Light'; }
    }

    escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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
        if (this.user?.role === 'SUPER_ADMIN') {
            await this.loadAvailableSchools();
        } else {
            this.activeSchoolId = this.user?.school_id || null;
        }
        await this.loadStudentsFromAPI();
        await this.updateDashboard();
        this.updateUserInfo();
        this.configureNavForRole();
        // load notifications for the user
        await this.fetchNotifications();
        // initialize real-time socket connection
        try {
            this.setupSocket();
        } catch (err) {
            console.warn('Socket setup failed:', err.message);
        }
    }

    setupSocket() {
        if (typeof io === 'undefined') return;
        try {
            const opts = {};
            if (this.token) opts.auth = { token: `Bearer ${this.token}` };
            this.socket = io(undefined, opts);
            this.socket.on('connect', () => {
                console.log('Connected to socket server', this.socket.id);
                // identify to join personal room
                this.socket.emit('identify', { userId: this.user?.id, schoolId: this.getSchoolContext() });
                const statusEl = document.getElementById('socket-status');
                if (statusEl) { statusEl.textContent = '🟢'; statusEl.style.color = 'green'; }
            });

            this.socket.on('notification', (n) => {
                try {
                    this.notifications = this.notifications || [];
                    // prepend notification
                    this.notifications.unshift(n);
                    // update unread count
                    this.unreadCount = (this.unreadCount || 0) + (n.read ? 0 : 1);
                    this.renderNotifications();
                    this.showMessage('New notification received', 'info');
                } catch (err) {
                    console.warn('Failed to handle incoming notification:', err.message);
                }
            });

            this.socket.on('notification:status', (s) => {
                this.showToast(`Notification ${s.id} ${s.status}${s.error ? ': ' + s.error : ''}`);
                if (this.notificationHistory) this.fetchNotificationHistory();
            });

            this.socket.on('connect_error', (err) => {
                console.warn('Socket connect error:', err.message);
                const statusEl = document.getElementById('socket-status');
                if (statusEl) { statusEl.textContent = '🔴'; statusEl.style.color = '#666'; }
                this.showToast('Realtime connection error');
            });

            this.socket.on('disconnect', () => {
                console.log('Socket disconnected');
                const statusEl = document.getElementById('socket-status');
                if (statusEl) { statusEl.textContent = '🔴'; statusEl.style.color = '#666'; }
                this.showToast('Realtime disconnected');
            });

            this.socket.on('disconnect', () => {
                console.log('Socket disconnected');
            });
        } catch (err) {
            console.warn('Socket initialization error:', err.message);
        }
    }

    showToast(message, timeout = 5000) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const el = document.createElement('div');
        el.className = 'toast-item';
        el.style.background = 'rgba(0,0,0,0.8)';
        el.style.color = '#fff';
        el.style.padding = '8px 12px';
        el.style.marginTop = '8px';
        el.style.borderRadius = '6px';
        el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
        el.textContent = message;
        container.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 500); }, timeout);
    }

    async loadAvailableSchools() {
        try {
            const response = await this.makeRequest('/schools');
            this.availableSchools = response.data || [];
            if (!this.activeSchoolId && this.availableSchools.length > 0) {
                this.activeSchoolId = this.availableSchools[0].id;
            }
        } catch (error) {
            console.warn('Could not load schools for Super Admin:', error.message);
            this.availableSchools = [];
        }
    }

    getSchoolContext() {
        if (this.user?.role === 'SUPER_ADMIN') {
            return this.activeSchoolId || this.availableSchools[0]?.id || null;
        }
        return this.user?.school_id || null;
    }

    appendSchoolContext(endpoint, schoolId = null) {
        const resolvedSchoolId = schoolId || this.getSchoolContext();
        if (!resolvedSchoolId || this.user?.role !== 'SUPER_ADMIN') {
            return endpoint;
        }

        const separator = endpoint.includes('?') ? '&' : '?';
        return `${endpoint}${separator}school_id=${encodeURIComponent(resolvedSchoolId)}`;
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
        const schoolsBtn = document.getElementById('schools-btn');
        const logsBtn = document.getElementById('admin-logs-btn');
        const addStudentBtn = document.getElementById('add-student-btn');
        const adminSection = document.getElementById('admin-panel');
        const userManagementSection = document.getElementById('user-management');
        const schoolsSection = document.getElementById('schools');
        const logsSection = document.getElementById('logs');
        const addStudentSection = document.getElementById('add-student');
        const adminBanner = document.getElementById('super-admin-banner');
        const canManageUsers = this.user?.role === 'SCHOOL_ADMIN';

        if (this.user?.role === 'SUPER_ADMIN') {
            adminBtn.classList.remove('hidden');
            schoolsBtn.classList.remove('hidden');
            logsBtn.classList.remove('hidden');
            adminBanner.classList.remove('hidden');
            addStudentBtn.classList.add('hidden');
        } else {
            adminBtn.classList.add('hidden');
            schoolsBtn.classList.add('hidden');
            logsBtn.classList.add('hidden');
            adminBanner.classList.add('hidden');
            addStudentBtn.classList.remove('hidden');
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
        if (schoolsSection && schoolsSection.classList.contains('active') && this.user?.role !== 'SUPER_ADMIN') {
            this.switchSection('overview');
        }
        if (logsSection && logsSection.classList.contains('active') && this.user?.role !== 'SUPER_ADMIN') {
            this.switchSection('overview');
        }
        if (addStudentSection && addStudentSection.classList.contains('active') && this.user?.role === 'SUPER_ADMIN') {
            this.switchSection('overview');
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
                    <div style="margin-top:10px; display:flex; gap:8px;">
                        <button class="btn btn-danger btn-small" onclick="app.deleteSchool('${school.id}')">Delete School</button>
                        <button class="btn btn-outline btn-small" onclick="app.switchSection('schools');">View Details</button>
                    </div>
                </div>
            `).join('');
            // populate recipient select when admin panel renders
            setTimeout(() => this.populateRecipientSelect(), 200);
            // load notification history
            setTimeout(() => this.fetchNotificationHistory(), 300);
            // load failed delivery retries
            setTimeout(() => this.fetchRetries(), 400);
            messageEl.textContent = '';
        } catch (error) {
            listContainer.innerHTML = '';
            messageEl.textContent = error.message;
        }
    }

    async renderSchools() {
        if (this.user?.role !== 'SUPER_ADMIN') {
            this.switchSection('overview');
            return;
        }

        const listContainer = document.getElementById('schools-list');
        const messageEl = document.getElementById('schools-message');
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
                    <p><strong>Email:</strong> ${school.email || 'N/A'}</p>
                    <p><strong>Phone:</strong> ${school.phone || 'N/A'}</p>
                    <p><strong>Principal:</strong> ${school.principal_name || 'N/A'}</p>
                    <p><strong>Status:</strong> ${school.status || 'N/A'}</p>
                    <div style="margin-top:10px; display:flex; gap:8px;">
                        <button class="btn btn-danger btn-small" onclick="app.deleteSchool('${school.id}')">Delete School</button>
                    </div>
                </div>
            `).join('');
            messageEl.textContent = '';
        } catch (error) {
            listContainer.innerHTML = '';
            messageEl.textContent = error.message;
        }
    }

    async renderLogs() {
        if (this.user?.role !== 'SUPER_ADMIN') {
            this.switchSection('overview');
            return;
        }

        const logsContainer = document.getElementById('logs-list');
        const messageEl = document.getElementById('logs-message');
        try {
            const response = await this.makeRequest('/admin/logs');
            const logs = response.data || [];
            if (logs.length === 0) {
                logsContainer.innerHTML = '<tr><td colspan="5">No activity logs available.</td></tr>';
                return;
            }

            logsContainer.innerHTML = logs.map((log) => `
                <tr>
                    <td>${new Date(log.created_at).toLocaleString()}</td>
                    <td>${log.user_id || 'System'}</td>
                    <td>${log.action}</td>
                    <td>${log.status || 'N/A'}</td>
                    <td><pre>${log.details ? this.escapeHtml(log.details) : ''}</pre></td>
                </tr>
            `).join('');
            messageEl.textContent = '';
        } catch (error) {
            logsContainer.innerHTML = '';
            messageEl.textContent = error.message;
        }
    }

    async fetchRetries() {
        const container = document.getElementById('admin-retries-list');
        try {
            const resp = await this.makeRequest('/notifications/retries', 'GET');
            const rows = resp.data || [];
            if (rows.length === 0) {
                container.innerHTML = '<p class="login-message">No failed deliveries.</p>';
                return;
            }
            container.innerHTML = rows.map(r => `
                <div class="admin-list-item">
                    <strong>${this.escapeHtml(r.subject || r.channel || '')}</strong>
                    <div>${this.escapeHtml(r.message || '')}</div>
                    <div class="muted">User: ${r.user_id} • Attempts: ${r.attempts} • Error: ${this.escapeHtml(r.error || '')}</div>
                    <div style="margin-top:6px;"><button class="btn btn-outline btn-small" onclick="app.retryRecipient('${r.id}')">Retry</button> <button class="btn btn-outline btn-small" onclick="app.retryNotification('${r.notification_id}')">Retry All</button></div>
                </div>
            `).join('');
        } catch (err) {
            container.innerHTML = '';
            console.warn('Failed to fetch retries:', err.message);
        }
    }

    async retryRecipient(recipientId) {
        try {
            await this.makeRequest(`/notifications/recipients/${recipientId}/retry`, 'POST');
            this.showMessage('Recipient scheduled for retry', 'success');
            await this.fetchRetries();
        } catch (err) {
            this.showMessage(err.message, 'error');
        }
    }

    async retryNotification(notificationId) {
        try {
            await this.makeRequest(`/notifications/${notificationId}/retry`, 'POST');
            this.showMessage('Notification recipients scheduled for retry', 'success');
            await this.fetchRetries();
        } catch (err) {
            this.showMessage(err.message, 'error');
        }
    }

    async handleTestGateway() {
        const channel = document.getElementById('test-channel').value;
        const recipient = document.getElementById('test-recipient').value.trim();
        const subject = document.getElementById('test-subject').value.trim();
        const message = document.getElementById('test-message').value.trim();
        const resultEl = document.getElementById('test-gateway-result');
        if (!recipient || !message) { resultEl.textContent = 'Recipient and message are required.'; return; }
        try {
            const resp = await this.makeRequest('/notifications/test', 'POST', { channel, recipient, subject, message });
            resultEl.textContent = resp.message || 'Test sent.';
            resultEl.classList.remove('error'); resultEl.classList.add('success');
        } catch (err) {
            resultEl.textContent = err.message;
            resultEl.classList.add('error');
        }
    }

    escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
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

    async deleteSchool(schoolId) {
        if (!confirm('Are you sure you want to delete this school and all its data?')) return;
        try {
            await this.makeRequest(`/schools/${schoolId}`, 'DELETE');
            this.showMessage('School deleted successfully', 'success');
            await this.renderAdminPanel();
            await this.renderSchools();
        } catch (error) {
            this.showMessage(error.message, 'error');
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
        if (sectionId === 'schools') await this.renderSchools();
        if (sectionId === 'logs') await this.renderLogs();
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
            const response = await this.makeRequest(this.appendSchoolContext('/students'));
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
                const response = await this.makeRequest(this.appendSchoolContext(`/students/search/query?q=${encodeURIComponent(query)}`));
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
                const response = await this.makeRequest(this.appendSchoolContext('/reports/statistics'));
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
                const response = await this.makeRequest(this.appendSchoolContext('/reports/level-distribution'));
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
                const response = await this.makeRequest(this.appendSchoolContext('/reports/gpa-by-level'));
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
                const response = await this.makeRequest(this.appendSchoolContext('/reports/gender-distribution'));
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
                const response = await this.makeRequest(this.appendSchoolContext('/reports/status-distribution'));
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
