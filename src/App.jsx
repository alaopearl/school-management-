import { useEffect, useMemo, useRef, useState } from 'react';

const navItems = [
  ['overview', 'Overview', '⌂'], ['students', 'Students', '♙'], ['staff', 'Staff', '👥'], ['attendance', 'Attendance', '✓'],
  ['academics', 'Academics', '▣'], ['finance', 'Finance', '₦'], ['messages', 'Messages', '✉'],
  ['parent-portal', 'Parent portal', '◔'], ['settings', 'Settings', '⚙']
];

const demoStudents = [];

const api = async (endpoint, token, options = {}) => {
  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Something went wrong');
  return body;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const getStudentId = (student) => student?.id || student?.student_id || student?.student_code || '';
const getStudentName = (student) => student?.full_name || student?.name || 'Unnamed student';
const getStudentClass = (student) => student?.current_level || student?.currentLevel || student?.grade || 'Unassigned';
const getStudentGuardian = (student) => student?.parent_name || student?.guardian || 'Not set';
const queryString = (params = {}) => {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (!entries.length) return '';
  return `?${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')}`;
};
const schoolBody = (user) => (user?.role === 'SUPER_ADMIN' && user?.school_id ? { school_id: user.school_id } : {});
const schoolQuery = (user) => (user?.role === 'SUPER_ADMIN' && user?.school_id ? { school_id: user.school_id } : {});

function App() {
  const [active, setActive] = useState('overview');
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 700 : false);
  const mobileMenuButtonRef = useRef(null);
  const sidebarRef = useRef(null);
  const prevMenuOpenRef = useRef(menuOpen);
  const [token, setToken] = useState(() => localStorage.getItem('sms_auth_token'));
  const [user, setUser] = useState(null);
  const [school, setSchool] = useState(null);
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [login, setLogin] = useState({ email: '', password: '' });
  const [setup, setSetup] = useState({ fullName: '', email: '', password: '', phone: '' });
  const [loginError, setLoginError] = useState('');
  const [notice, setNotice] = useState('');
  const [studentModal, setStudentModal] = useState(false);
  const [studentError, setStudentError] = useState('');
  const [savingStudent, setSavingStudent] = useState(false);
  const [schoolForm, setSchoolForm] = useState({
    schoolName: '',
    schoolCode: '',
    email: '',
    phone: '',
    principalName: '',
    principalPhone: '',
    principalEmail: '',
    address: '',
    state: '',
    country: 'Nigeria',
    schoolType: 'PRIVATE',
    motto: '',
    website: '',
    administratorName: '',
    administratorEmail: '',
    administratorPassword: ''
  });
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [creatingSchool, setCreatingSchool] = useState(false);
  const [schoolCreationError, setSchoolCreationError] = useState('');
  const [schoolCreationSuccess, setSchoolCreationSuccess] = useState('');
  const [studentForm, setStudentForm] = useState({
    full_name: '',
    date_of_birth: '',
    gender: '',
    current_level: '',
    admission_date: '',
    parent_name: '',
    parent_contact: '',
    address: '',
    gpa: ''
  });
  const classOptions = [
    'Creche', 'Nursery 1', 'Nursery 2',
    'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6',
    'JSS 1', 'JSS 2', 'JSS 3',
    'SSS 1', 'SSS 2', 'SSS 3'
  ];

  const visibleNavItems = useMemo(() => navItems.filter(([key]) => {
    if (key === 'parent-portal') return user?.role === 'PARENT';
    return true;
  }), [user?.role]);

  useEffect(() => {
    if (!token) return;
    api('/auth/me', token)
      .then(({ data }) => {
        setUser(data.user);
        setSchool(data.school || null);
        loadStudents(token, data.user);
      })
      .catch(() => {
        localStorage.removeItem('sms_auth_token');
        setToken(null);
        setUser(null);
        setSchool(null);
      });
  }, [token]);

  useEffect(() => {
    const base = school?.name || 'EduManage';
    try { document.title = `${base} • EduManage`; } catch (e) {}
  }, [school?.name]);

  useEffect(() => {
    api('/auth/setup-status')
      .then(({ hasSuperAdmin }) => {
        setNeedsSetup(!hasSuperAdmin);
        if (!hasSuperAdmin) setSetupMode(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const updateIsMobile = () => {
      setIsMobile(window.innerWidth <= 700);
    };

    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);
    return () => window.removeEventListener('resize', updateIsMobile);
  }, []);

  useEffect(() => {
    if (!isMobile && menuOpen) {
      setMenuOpen(false);
    }
  }, [isMobile, menuOpen]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target) && !(mobileMenuButtonRef.current && mobileMenuButtonRef.current.contains(event.target))) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen && prevMenuOpenRef.current) {
      mobileMenuButtonRef.current?.focus();
    }
    prevMenuOpenRef.current = menuOpen;
  }, [menuOpen]);

  const loadStudents = async (authToken = token, currentUser = user) => {
    try {
      if (currentUser?.role === 'SUPER_ADMIN' && !currentUser?.school_id) {
        setStudents([]);
        return;
      }

      const response = await api(`/students${queryString(schoolQuery(currentUser))}`, authToken);
      setStudents(response.data || []);
    } catch {
      setStudents([]);
    }
  };

  const toggleSidebar = () => {
    if (isMobile) {
      setMenuOpen((current) => !current);
      return;
    }

    setCollapsed((current) => !current);
  };

  const visibleStudents = useMemo(() => {
    const displayRows = students.length
      ? students.map((student, index) => ({
          id: student.student_code || student.id,
          name: getStudentName(student),
          grade: getStudentClass(student),
          guardian: getStudentGuardian(student),
          status: student.status === 'ACTIVE' ? 'Active' : student.status || 'Active',
          initials: getStudentName(student)
            .split(' ')
            .map((part) => part[0])
            .slice(0, 2)
            .join('') || 'S',
          color: ['violet', 'orange', 'teal', 'blue'][index % 4]
        }))
      : demoStudents;

    return displayRows.filter((student) => `${student.name} ${student.id} ${student.grade}`.toLowerCase().includes(search.toLowerCase()));
  }, [students, search]);

  const onLogin = async (event) => {
    event.preventDefault();
    setLoginError('');
    try {
      const { data } = await api('/auth/login', null, { method: 'POST', body: JSON.stringify(login) });
      localStorage.setItem('sms_auth_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setSchool(data.school || null);
      setLoginOpen(false);
      setNotice(`Welcome back, ${data.user.full_name.split(' ')[0]}!`);
    } catch (error) {
      setLoginError(error.message);
    }
  };

  const onSetup = async (event) => {
    event.preventDefault();
    setLoginError('');
    try {
      const { data } = await api('/auth/setup-super-admin', null, { method: 'POST', body: JSON.stringify(setup) });
      localStorage.setItem('sms_auth_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setSchool(data.school || null);
      setNeedsSetup(false);
      setLoginOpen(false);
      setNotice('Your administrator account is ready.');
    } catch (error) {
      setLoginError(error.message);
    }
  };

  const submitSchoolRegistration = async (event) => {
    event.preventDefault();
    setCreatingSchool(true);
    setSchoolCreationError('');
    setSchoolCreationSuccess('');
    try {
      const body = {
        schoolName: schoolForm.schoolName,
        schoolCode: schoolForm.schoolCode,
        email: schoolForm.email,
        phone: schoolForm.phone,
        principalName: schoolForm.principalName,
        principalPhone: schoolForm.principalPhone,
        principalEmail: schoolForm.principalEmail,
        address: schoolForm.address,
        state: schoolForm.state,
        country: schoolForm.country,
        schoolType: schoolForm.schoolType,
        motto: schoolForm.motto,
        website: schoolForm.website,
        administratorName: schoolForm.administratorName,
        administratorEmail: schoolForm.administratorEmail,
        administratorPassword: schoolForm.administratorPassword,
        otp: schoolForm.otp || otpCode
      };

      if (!otpSent) {
        setSchoolCreationError('Please verify your official school email with the OTP before submitting.');
        setCreatingSchool(false);
        return;
      }

      // Server-side verify OTP before proceeding
      try {
        await api('/otp/verify-otp', null, { method: 'POST', body: JSON.stringify({ email: schoolForm.email, otp: body.otp }) });
      } catch (err) {
        setSchoolCreationError(`OTP verification failed: ${err.message}`);
        setCreatingSchool(false);
        return;
      }

      const response = await api('/auth/register-school', null, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      setSchoolCreationSuccess(response.message || 'School registration submitted successfully.');
      setSchoolForm({
        schoolName: '',
        schoolCode: '',
        email: '',
        phone: '',
        principalName: '',
        principalPhone: '',
        principalEmail: '',
        address: '',
        state: '',
        country: 'Nigeria',
        schoolType: 'PRIVATE',
        motto: '',
        website: '',
        administratorName: '',
        administratorEmail: '',
        administratorPassword: ''
      });
    } catch (error) {
      setSchoolCreationError(error.message);
    } finally {
      setCreatingSchool(false);
    }
  };

  const sendOtpToOfficial = async () => {
    if (!schoolForm.email) {
      setSchoolCreationError('Please enter the official school email first');
      return;
    }
    setSchoolCreationError('');
    try {
      const resp = await api('/otp/send-otp', null, { method: 'POST', body: JSON.stringify({ email: schoolForm.email }) });
      setOtpSent(true);
      if (resp.otp) setOtpCode(resp.otp);
      setSchoolCreationSuccess(resp.message || 'OTP sent');
    } catch (err) {
      setSchoolCreationError(err.message);
    }
  };

  const verifyOtpForOfficial = async () => {
    if (!schoolForm.email || !otpCode) {
      setSchoolCreationError('Please enter the OTP received in email');
      return;
    }
    setVerifyingOtp(true);
    setSchoolCreationError('');
    try {
      await api('/otp/verify-otp', null, { method: 'POST', body: JSON.stringify({ email: schoolForm.email, otp: otpCode }) });
      setSchoolCreationSuccess('Email verified. You can now submit the registration.');
      setOtpSent(true);
    } catch (err) {
      setSchoolCreationError(err.message);
    } finally {
      setVerifyingOtp(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('sms_auth_token');
    setToken(null);
    setUser(null);
    setSchool(null);
    setStudents([]);
    setNotice('You have been signed out.');
  };

  const openStudentForm = () => {
    if (!user) {
      setLoginOpen(true);
      setNotice('Sign in as a School Administrator to add students.');
      return;
    }
    if (!['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      setNotice('Your role does not have permission to add students.');
      return;
    }
    if (user.role === 'SUPER_ADMIN' && !user.school_id) {
      setNotice('Select a school context before adding a student.');
      return;
    }
    setStudentError('');
    setStudentModal(true);
  };

  const saveStudent = async (event) => {
    event.preventDefault();
    setSavingStudent(true);
    setStudentError('');
    try {
      await api('/students', token, {
        method: 'POST',
        body: JSON.stringify({
          ...studentForm,
          gpa: Number(studentForm.gpa || 0),
          status: 'ACTIVE',
          ...schoolBody(user)
        })
      });
      await loadStudents();
      setStudentModal(false);
      setStudentForm({
        full_name: '',
        date_of_birth: '',
        gender: '',
        current_level: '',
        admission_date: '',
        parent_name: '',
        parent_contact: '',
        address: '',
        gpa: ''
      });
      setNotice('Student record created successfully.');
    } catch (error) {
      setStudentError(error.message);
    } finally {
      setSavingStudent(false);
    }
  };

  return (
    <div className={`app ${collapsed ? 'sidebar-collapsed' : ''} ${menuOpen ? 'menu-open' : ''}`}>
      <aside ref={sidebarRef} id="main-sidebar" className="sidebar" aria-hidden={isMobile && !menuOpen}>
        <div className="brand">
          <div className="brand-mark"><span></span><span></span><span></span></div>
          <strong>edu<span>manage</span></strong>
        </div>
        <div className="school-switch">
          {school?.logo_url ? (
            <div className="school-icon"><img src={school.logo_url} alt={school?.name || 'School logo'} className="school-icon-img" /></div>
          ) : (
            <div className="school-icon">{(school?.name || 'Your School')[0]}</div>
          )}
          <div>
            <b>{school?.name || 'Your School'}</b>
            <small>{user ? user.role.replace('_', ' ') : 'School workspace'}</small>
          </div>
          <span className="chevron">⌄</span>
        </div>
        <nav>
          {visibleNavItems.map(([key, label, icon]) => (
            <button key={key} onClick={() => { setActive(key); setMenuOpen(false); }} className={active === key ? 'active' : ''}>
              <i>{icon}</i><span>{label}</span>{key === 'messages' && <em>3</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button onClick={() => setActive('help')}><i>?</i><span>Help & support</span></button>
          <div className="profile">
            <div className="avatar">{user?.full_name?.[0] || 'A'}</div>
            <div>
              <b>{user?.full_name || 'Admin User'}</b>
              <small>{user?.role?.replace('_', ' ') || 'School administrator'}</small>
            </div>
            <button className="more" onClick={() => (user ? logout() : setLoginOpen(true))}>⋮</button>
          </div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <button
            ref={mobileMenuButtonRef}
            className="mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="main-sidebar"
            onClick={toggleSidebar}
          >
            <span className={`hamburger ${menuOpen ? 'is-open' : ''}`} aria-hidden="true">☰</span>
            <span className="mobile-menu-label">{menuOpen ? 'Close menu' : 'Open menu'}</span>
          </button>
          <button className="collapse" onClick={() => setCollapsed((current) => !current)}>☰</button>
          <div className="page-title">
            <small>{school?.name || 'Your School'}</small>
            <h1>{visibleNavItems.find((item) => item[0] === active)?.[1] || 'Help & support'}</h1>
          </div>
          <div className="top-actions">
            <button className="search-button" onClick={() => setActive('students')}>⌕ <span>Search anything...</span><kbd>⌘ K</kbd></button>
            <button className="icon-button">◔<i></i></button>
            <button className="bell">♧<i></i></button>
            {user ? <button className="user-button" onClick={logout}>Sign out</button> : <button className="user-button" onClick={() => setLoginOpen(true)}>Sign in</button>}
          </div>
        </header>

        {notice && <div className="notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}
        <div className="page-content">
          {active === 'overview'
                    ? <Overview setActive={setActive} students={visibleStudents} user={user} token={token} school={school} openStudentForm={openStudentForm} />
            : <Workspace active={active} directoryStudents={visibleStudents} students={students} search={search} setSearch={setSearch} openStudentForm={openStudentForm} token={token} user={user} school={school} setNotice={setNotice} />
          }
        </div>
      </main>

      {menuOpen && <div className="backdrop" onClick={() => setMenuOpen(false)} />}

      {loginOpen && (
        <div className="modal-layer">
          <form className="login-card" onSubmit={setupMode ? onSetup : onLogin}>
            <button type="button" className="close" onClick={() => setLoginOpen(false)}>×</button>
            <div className="brand compact">
              <div className="brand-mark"><span></span><span></span><span></span></div>
              <strong>edu<span>manage</span></strong>
            </div>
            {setupMode ? (
              <>
                <h2>Set up your school</h2>
                <p>Create the first administrator account to get started.</p>
                <label>Full name<input value={setup.fullName} onChange={(e) => setSetup({ ...setup, fullName: e.target.value })} required placeholder="Your full name" /></label>
                <label>Email<input type="email" value={setup.email} onChange={(e) => setSetup({ ...setup, email: e.target.value })} required placeholder="admin@school.edu" /></label>
                <label>Password<input type="password" value={setup.password} onChange={(e) => setSetup({ ...setup, password: e.target.value })} required placeholder="Create a secure password" /></label>
                <label>Phone <small>(optional)</small><input type="tel" value={setup.phone} onChange={(e) => setSetup({ ...setup, phone: e.target.value })} placeholder="08000000000" /></label>
              </>
            ) : (
              <>
                <h2>Welcome back</h2>
                <p>Sign in to manage your school workspace.</p>
                <label>Email<input type="email" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} required placeholder="you@school.edu" /></label>
                <label>Password<input type="password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} required placeholder="••••••••" /></label>
              </>
            )}
            {loginError && <div className="form-error">{loginError}</div>}
            <button className="primary" type="submit">{setupMode ? 'Create administrator account →' : 'Sign in to dashboard →'}</button>
            {!needsSetup && <button type="button" className="switch-auth" onClick={() => { setSetupMode(!setupMode); setLoginError(''); }}>{setupMode ? 'Already have an account? Sign in' : 'Set up a new school'}</button>}
          </form>
        </div>
      )}

      {active === 'overview' && (
        <div style={{ margin: '24px 18px 0' }}>
          <div className="panel records">
            <div className="panel-heading"><div><h3>Create school account</h3><p>Register a new school and administrator account</p></div></div>
            <form className="ticket-form" onSubmit={submitSchoolRegistration}>
              <div className="ticket-fields">
                <label>School name<input value={schoolForm.schoolName} onChange={(e) => setSchoolForm({ ...schoolForm, schoolName: e.target.value })} required /></label>
                <label>School code<input value={schoolForm.schoolCode} onChange={(e) => setSchoolForm({ ...schoolForm, schoolCode: e.target.value })} required /></label>
              </div>
              <div className="ticket-fields">
                <label>Official email<input type="email" value={schoolForm.email} onChange={(e) => setSchoolForm({ ...schoolForm, email: e.target.value })} required /></label>
                <label>Phone<input value={schoolForm.phone} onChange={(e) => setSchoolForm({ ...schoolForm, phone: e.target.value })} /></label>
              </div>
              <div style={{display:'flex',gap:12,alignItems:'flex-end'}}>
                <div style={{flex:1}}>
                  <label style={{display:'block'}}>Official email verification
                    <input type="text" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="Enter OTP" />
                  </label>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button type="button" className="primary" onClick={sendOtpToOfficial} disabled={otpSent}>Send code</button>
                  <button type="button" className="primary" onClick={verifyOtpForOfficial} disabled={!otpSent || verifyingOtp}>{verifyingOtp ? 'Verifying…' : 'Verify'}</button>
                </div>
              </div>
              <div className="ticket-fields">
                <label>Principal name<input value={schoolForm.principalName} onChange={(e) => setSchoolForm({ ...schoolForm, principalName: e.target.value })} /></label>
                <label>Principal phone<input value={schoolForm.principalPhone} onChange={(e) => setSchoolForm({ ...schoolForm, principalPhone: e.target.value })} /></label>
              </div>
              <div className="ticket-fields">
                <label>Principal email<input type="email" value={schoolForm.principalEmail} onChange={(e) => setSchoolForm({ ...schoolForm, principalEmail: e.target.value })} /></label>
                <label>School type<select value={schoolForm.schoolType} onChange={(e) => setSchoolForm({ ...schoolForm, schoolType: e.target.value })}><option value="PRIVATE">Private</option><option value="PUBLIC">Public</option><option value="RELIGIOUS">Religious</option></select></label>
              </div>
              <div className="ticket-fields">
                <label>Address<input value={schoolForm.address} onChange={(e) => setSchoolForm({ ...schoolForm, address: e.target.value })} /></label>
                <label>State<input value={schoolForm.state} onChange={(e) => setSchoolForm({ ...schoolForm, state: e.target.value })} /></label>
              </div>
              <div className="ticket-fields">
                <label>Country<input value={schoolForm.country} onChange={(e) => setSchoolForm({ ...schoolForm, country: e.target.value })} /></label>
                <label>Website<input value={schoolForm.website} onChange={(e) => setSchoolForm({ ...schoolForm, website: e.target.value })} /></label>
              </div>
              <div className="ticket-fields">
                <label>Administrator name<input value={schoolForm.administratorName} onChange={(e) => setSchoolForm({ ...schoolForm, administratorName: e.target.value })} /></label>
                <label>Administrator email<input type="email" value={schoolForm.administratorEmail} onChange={(e) => setSchoolForm({ ...schoolForm, administratorEmail: e.target.value })} /></label>
              </div>
              <label>Administrator password<input type="password" value={schoolForm.administratorPassword} onChange={(e) => setSchoolForm({ ...schoolForm, administratorPassword: e.target.value })} /></label>
              <label>Motto <small>(optional)</small><input value={schoolForm.motto} onChange={(e) => setSchoolForm({ ...schoolForm, motto: e.target.value })} /></label>
              {schoolCreationError && <div className="form-error">{schoolCreationError}</div>}
              {schoolCreationSuccess && <div className="notice">{schoolCreationSuccess}</div>}
              <button className="primary" disabled={creatingSchool}>{creatingSchool ? 'Creating…' : 'Create school account'}</button>
            </form>
          </div>

        </div>
      )}

      {studentModal && (
        <div className="modal-layer" onClick={() => setStudentModal(false)}>
          <form className="student-card" onSubmit={saveStudent} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="close" onClick={() => setStudentModal(false)}>×</button>
            <p className="eyebrow">STUDENT MANAGEMENT</p>
            <h2>Add new student</h2>
            <p>Create a student record for your school.</p>
            <div className="student-fields">
              <label>Full name<input value={studentForm.full_name} onChange={(e) => setStudentForm({ ...studentForm, full_name: e.target.value })} required /></label>
              <label>Gender<select value={studentForm.gender} onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value })} required><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></label>
              <label>Date of birth<input type="date" value={studentForm.date_of_birth} onChange={(e) => setStudentForm({ ...studentForm, date_of_birth: e.target.value })} required /></label>
              <label>Level / class<select value={studentForm.current_level} onChange={(e) => setStudentForm({ ...studentForm, current_level: e.target.value })} required>
                <option value="">Select class</option>
                {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select></label>
              <label>Admission date<input type="date" value={studentForm.admission_date} onChange={(e) => setStudentForm({ ...studentForm, admission_date: e.target.value })} required /></label>
              <label>GPA <small>(optional)</small><input type="number" min="0" max="5" step="0.1" value={studentForm.gpa} onChange={(e) => setStudentForm({ ...studentForm, gpa: e.target.value })} /></label>
              <label>Parent / guardian<input value={studentForm.parent_name} onChange={(e) => setStudentForm({ ...studentForm, parent_name: e.target.value })} required /></label>
              <label>Parent phone<input type="tel" value={studentForm.parent_contact} onChange={(e) => setStudentForm({ ...studentForm, parent_contact: e.target.value })} required /></label>
            </div>
            <label>Address<textarea rows="2" value={studentForm.address} onChange={(e) => setStudentForm({ ...studentForm, address: e.target.value })} required /></label>
            {studentError && <div className="form-error">{studentError}</div>}
            <button className="primary" disabled={savingStudent}>{savingStudent ? 'Saving…' : 'Save student →'}</button>
          </form>
        </div>
      )}
    </div>
  );
}

function Overview({ setActive, students, user, token, school, openStudentForm }) {
  if (user?.role === 'SUPER_ADMIN') return <PlatformOverview token={token} />;
  if (user?.role === 'PARENT') return <ParentLanding token={token} user={user} />;

  return (
    <>
      <section className="welcome">
        <div>
          <p className="eyebrow">MONDAY, 27 JULY</p>
          <h2>Good morning, Admin <span>👋</span></h2>
          <p>Here’s what’s happening at {school?.name || 'your school'} today.</p>
        </div>
        <button className="primary" onClick={openStudentForm}>+ Add new student</button>
      </section>
      <section className="metrics">
        <Metric title="Total students" value="1,248" change="12.5%" icon="♙" color="indigo" />
        <Metric title="Attendance today" value="94.8%" change="2.4%" icon="✓" color="mint" />
        <Metric title="Outstanding fees" value="₦1.82m" change="8.2%" icon="₦" color="peach" />
        <Metric title="Staff on duty" value="86" change="5.4%" icon="♟" color="lilac" />
      </section>
      <section className="dashboard-grid">
        <div className="panel enrollment">
          <div className="panel-heading">
            <div><h3>Enrollment overview</h3><p>Student growth across this academic year</p></div>
            <select><option>This academic year</option></select>
          </div>
          <div className="chart">
            <div className="y-labels"><span>1,500</span><span>1,000</span><span>500</span><span>0</span></div>
            <div className="plot">
              <div className="grid-lines"></div>
              <svg viewBox="0 0 600 185" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#5553d9" stopOpacity=".22" /><stop offset="1" stopColor="#5553d9" stopOpacity="0" /></linearGradient>
                </defs>
                <path className="area" d="M0,143 C46,133 67,137 105,118 S160,113 197,107 S250,117 287,87 S335,92 375,77 S434,76 469,48 S518,55 600,11 L600,185 L0,185 Z" />
                <path className="line" d="M0,143 C46,133 67,137 105,118 S160,113 197,107 S250,117 287,87 S335,92 375,77 S434,76 469,48 S518,55 600,11" />
              </svg>
              <div className="months"><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span></div>
            </div>
          </div>
        </div>
        <div className="panel calendar">
          <div className="panel-heading">
            <div><h3>Upcoming</h3><p>Your next events</p></div>
            <button onClick={() => setActive('academics')}>View calendar</button>
          </div>
          <Event date="29" month="JUL" title="Parent–teacher meeting" time="10:00 AM – 1:00 PM" color="blue" />
          <Event date="02" month="AUG" title="Inter-house sports day" time="8:00 AM – 3:30 PM" color="orange" />
          <Event date="05" month="AUG" title="Third term begins" time="All day" color="purple" />
        </div>
      </section>
      <section className="panel records">
        <div className="panel-heading">
          <div><h3>Recently added students</h3><p>Latest admissions to your school</p></div>
          <button onClick={() => setActive('students')}>View all students →</button>
        </div>
        <StudentTable students={students.slice(0, 4)} />
      </section>
    </>
  );
}

function ParentLanding({ token, user }) {
  return (
    <section className="workspace">
      <div className="workspace-title">
        <div>
          <p className="eyebrow">PARENT PORTAL</p>
          <h2>Welcome, {user?.full_name?.split(' ')[0] || 'parent'}</h2>
          <p>Use the parent portal to review your child&apos;s attendance, results, and fees.</p>
        </div>
      </div>
      <div className="panel records">
        <div className="panel-heading"><div><h3>Quick access</h3><p>Everything you need is just a click away</p></div></div>
        <div className="mini-grid">
          <article className="mini-card"><b>Attendance</b><small>Daily presence and trends</small></article>
          <article className="mini-card"><b>Results</b><small>School assessment summaries</small></article>
          <article className="mini-card"><b>Fees</b><small>Outstanding balances and invoices</small></article>
        </div>
      </div>
    </section>
  );
}

function PlatformOverview({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [schools, setSchools] = useState([]);
  const [loadingSchools, setLoadingSchools] = useState(false);

  useEffect(() => {
    api('/schools/platform/dashboard', token)
      .then(({ data: responseData }) => setData(responseData))
      .catch((err) => setError(err.message));
  }, [token]);

  useEffect(() => {
    const loadSchools = async () => {
      if (!token) return;
      setLoadingSchools(true);
      try {
        const response = await api('/schools', token);
        setSchools(response.data || []);
      } catch {
        setSchools([]);
      } finally {
        setLoadingSchools(false);
      }
    };
    loadSchools();
  }, [token]);

  const schoolMetrics = data?.schools || {};

  return (
    <>
      <section className="welcome">
        <div>
          <p className="eyebrow">PLATFORM CONTROL CENTER</p>
          <h2>Super Admin dashboard</h2>
          <p>Monitor every tenant, subscription, and platform activity from one place.</p>
        </div>
      </section>
      {error ? <div className="form-error">{error}</div> : (
        <section className="metrics">
          <Metric title="Registered schools" value={schoolMetrics.total ?? '—'} change={`${schoolMetrics.pending || 0} pending`} icon="⌂" color="indigo" />
          <Metric title="Active schools" value={schoolMetrics.active ?? '—'} change={`${schoolMetrics.suspended || 0} suspended`} icon="✓" color="mint" />
          <Metric title="All students" value={data?.total_students ?? '—'} change="across all schools" icon="♙" color="peach" />
          <Metric title="Platform revenue" value={`₦${Number(data?.total_revenue || 0).toLocaleString()}`} change={`${schoolMetrics.expired || 0} expired plans`} icon="₦" color="lilac" />
        </section>
      )}
      <section className="panel records">
        <div className="panel-heading"><div><h3>School directory</h3><p>All schools currently onboarded to the platform</p></div></div>
        {loadingSchools ? <p>Loading schools…</p> : schools.length ? (
          <div className="student-table">
            <div className="table-head"><span>NAME</span><span>CODE</span><span>STATUS</span><span>ADMIN</span><span></span></div>
            {schools.map((schoolEntry) => (
              <div className="table-row" key={schoolEntry.id}>
                <span className="student-name"><b>{schoolEntry.name}<small>{schoolEntry.email || schoolEntry.address || 'No contact'}</small></b></span>
                <span>{schoolEntry.code}</span>
                <span>{schoolEntry.status}</span>
                <span>{schoolEntry.principal_name || 'Pending'}</span>
                <span></span>
              </div>
            ))}
          </div>
        ) : <div className="empty-state"><div>⌂</div><h3>No schools yet</h3><p>Schools will appear here after onboarding.</p></div>}
      </section>
      <section className="panel records">
        <div className="panel-heading"><div><h3>Recent platform activities</h3><p>Cross-school audit trail</p></div></div>
        {data?.recent_activities?.length ? (
          <div className="student-table">
            <div className="table-head"><span>ACTION</span><span>STATUS</span><span>TIME</span><span></span><span></span></div>
            {data.recent_activities.map((log) => (
              <div className="table-row" key={log.id}>
                <span className="student-name"><b>{log.action}<small>{log.ip || 'Platform'}</small></b></span>
                <span>{log.status}</span>
                <span>{new Date(log.created_at).toLocaleString()}</span>
                <span></span>
                <span></span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div>⌂</div>
            <h3>No platform activity yet</h3>
            <p>School registrations and administrator actions will appear here.</p>
          </div>
        )}
      </section>
    </>
  );
}

function Metric({ title, value, change, icon, color }) {
  return <article className="metric"><div className={`metric-icon ${color}`}>{icon}</div><div><p>{title}</p><h3>{value}</h3><small><b>↑ {change}</b> vs last month</small></div></article>;
}

function Event({ date, month, title, time, color }) {
  return <div className="event"><div className={`date ${color}`}><b>{date}</b><small>{month}</small></div><div><b>{title}</b><small>{time}</small></div><button>•••</button></div>;
}

function Workspace({ active, directoryStudents, students, search, setSearch, openStudentForm, token, user, school, setNotice }) {
  if (active === 'help') return <SupportCenter token={token} user={user} school={school} />;
  if (active === 'overview') return <Overview setActive={() => {}} students={directoryStudents} user={user} token={token} openStudentForm={openStudentForm} />;
  if (active === 'attendance') return <AttendanceWorkspace token={token} user={user} students={students} setNotice={setNotice} />;
  if (active === 'academics') return <AcademicsWorkspace token={token} user={user} setNotice={setNotice} />;
  if (active === 'finance') return <FinanceWorkspace token={token} user={user} students={students} setNotice={setNotice} />;
  if (active === 'messages') return <MessagesWorkspace token={token} user={user} setNotice={setNotice} />;
  if (active === 'parent-portal') return <ParentPortalWorkspace token={token} user={user} students={students} setNotice={setNotice} />;
  if (active === 'staff') return <StaffWorkspace token={token} user={user} setNotice={setNotice} />;
  if (active === 'settings') return <SettingsWorkspace token={token} user={user} school={school} setNotice={setNotice} />;

  const filteredStudents = (directoryStudents || []).filter((student) => `${student.name} ${student.id} ${student.grade}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <section className="workspace">
      <div className="workspace-title">
        <div>
          <p className="eyebrow">SCHOOL MANAGEMENT</p>
          <h2>Student directory</h2>
          <p>Search, view and manage your school records.</p>
        </div>
        <button className="primary" onClick={openStudentForm}>+ Add student</button>
      </div>
      <div className="panel directory">
        <div className="directory-tools">
          <label>⌕<input autoFocus placeholder="Search by name, ID or class" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
          <button>Filter ▾</button>
          <button>Export</button>
        </div>
        <StudentTable students={filteredStudents} />
      </div>
    </section>
  );
}

function AttendanceWorkspace({ token, user, students, setNotice }) {
  const [recordDate, setRecordDate] = useState(todayIso());
  const [statusMap, setStatusMap] = useState({});
  const [history, setHistory] = useState([]);
  const [grouped, setGrouped] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const hasSchoolContext = user?.role !== 'SUPER_ADMIN' || !!user?.school_id;

  useEffect(() => {
    const next = {};
    for (const student of students || []) {
      const id = getStudentId(student);
      if (id) next[id] = statusMap[id] || 'PRESENT';
    }
    setStatusMap(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students]);

  useEffect(() => {
    const load = async () => {
      if (!token || !hasSchoolContext) return;
      try {
        const response = await api(`/attendance${queryString({ ...schoolQuery(user), date: recordDate })}`, token);
        setHistory(response.data || []);
      } catch {
        setHistory([]);
      }

      try {
        const response = await api(`/attendance/students/grouped${queryString(schoolQuery(user))}`, token);
        setGrouped(response.data || []);
      } catch {
        setGrouped([]);
      }
    };
    load();
  }, [token, recordDate, user?.school_id, hasSchoolContext]);

  const saveAttendance = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const records = (students || [])
        .map((student) => {
          const id = getStudentId(student);
          if (!id) return null;
          return { person_id: id, status: statusMap[id] || 'PRESENT' };
        })
        .filter(Boolean);

      if (!records.length) throw new Error('No students available for attendance');

      await api('/attendance/record', token, {
        method: 'POST',
        body: JSON.stringify({ recordDate, personType: 'STUDENT', records, ...schoolBody(user) })
      });
      setNotice('Attendance recorded successfully.');
      const response = await api(`/attendance${queryString({ ...schoolQuery(user), date: recordDate })}`, token);
      setHistory(response.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const roster = (students || []).filter((student) => getStudentId(student));

  return (
    <section className="workspace">
      <div className="workspace-title">
        <div><p className="eyebrow">SCHOOL MANAGEMENT</p><h2>Attendance</h2><p>Mark daily presence and review attendance history for the selected date.</p></div>
      </div>
      {!hasSchoolContext ? <div className="empty-state"><div>✓</div><h3>Select a school context</h3><p>Attendance is available once you are working inside a school.</p></div> : (
        <div className="workspace-grid two-up">
          <form className="panel ticket-form" onSubmit={saveAttendance}>
            <h3>Mark attendance</h3>
            <label>Date<input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} /></label>
            <div className="student-table attendance-table">
              <div className="table-head"><span>STUDENT</span><span>CLASS</span><span>STATUS</span><span></span><span></span></div>
              {roster.map((student) => {
                const id = getStudentId(student);
                return (
                  <div className="table-row" key={id}>
                    <span className="student-name"><b>{getStudentName(student)}<small>{id}</small></b></span>
                    <span>{getStudentClass(student)}</span>
                    <span>
                      <select value={statusMap[id] || 'PRESENT'} onChange={(e) => setStatusMap((current) => ({ ...current, [id]: e.target.value }))}>
                        <option value="PRESENT">Present</option>
                        <option value="ABSENT">Absent</option>
                        <option value="LATE">Late</option>
                        <option value="EXCUSED">Excused</option>
                      </select>
                    </span>
                    <span></span>
                    <span></span>
                  </div>
                );
              })}
            </div>
            {error && <div className="form-error">{error}</div>}
            <button className="primary" disabled={loading}>{loading ? 'Saving…' : 'Save attendance'}</button>
          </form>
          <div className="panel records">
            <div className="panel-heading"><div><h3>Grouped students</h3><p>Who is available for marking today</p></div></div>
            <div className="mini-grid">
              {(grouped || []).slice(0, 6).map((group) => <article className="mini-card" key={group.id || group.name}><b>{group.name || 'Unassigned'}</b><small>{group.students?.length || 0} student(s)</small></article>)}
            </div>
            <div className="panel-heading" style={{ marginTop: 18 }}><div><h3>Attendance history</h3><p>{recordDate}</p></div></div>
            {history.length ? <div className="student-table"><div className="table-head"><span>STUDENT</span><span>STATUS</span><span>DATE</span><span></span><span></span></div>{history.map((entry) => <div className="table-row" key={entry.id}><span className="student-name"><b>{entry.person_id}<small>{entry.person_type}</small></b></span><span>{entry.status}</span><span>{entry.record_date}</span><span></span><span></span></div>)}</div> : <div className="empty-state"><div>✓</div><h3>No attendance recorded</h3><p>Submit the first attendance entry for this date.</p></div>}
          </div>
        </div>
      )}
    </section>
  );
}

function StaffWorkspace({ token, user, setNotice }) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [addStaffModal, setAddStaffModal] = useState(false);
  const [staffForm, setStaffForm] = useState({ full_name: '', email: '', phone: '', department: '', subjects: '', hired_date: '', status: 'ACTIVE', assigned_class: '' });
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [editingStaff, setEditingStaff] = useState(null);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      setLoading(true);
      setError('');
      try {
        const response = await api(`/teachers${queryString(schoolQuery(user))}`, token);
        const list = (response.data || []).slice().sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
        setTeachers(list);
      } catch (err) {
        setError(err.message || 'Unable to load staff');
        setTeachers([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token, user?.school_id]);

  const openAddStaff = () => {
    setStaffForm({ full_name: '', email: '', phone: '', department: '', subjects: '', hired_date: '', status: 'ACTIVE' });
    setStaffError('');
    setEditingStaff(null);
    setAddStaffModal(true);
  };

  const saveStaff = async (event) => {
    event && event.preventDefault();
    setCreatingStaff(true);
    setStaffError('');
    // Basic client-side validation
    if (!staffForm.full_name || staffForm.full_name.trim().length < 3) {
      setStaffError('Please provide a full name (at least 3 characters).');
      setCreatingStaff(false);
      return;
    }
    if (!staffForm.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(staffForm.email)) {
      setStaffError('Please provide a valid email address.');
      setCreatingStaff(false);
      return;
    }
    try {
      if (editingStaff) {
        await api(`/teachers/${editingStaff}`, token, { method: 'PUT', body: JSON.stringify({ ...staffForm }) });
        setNotice('Staff record updated.');
      } else {
        const created = await api('/teachers', token, { method: 'POST', body: JSON.stringify({ ...staffForm, ...schoolBody(user) }) });
        setNotice('Staff record created.');
        if (staffForm.assigned_class && created?.data?.id) {
          // Persist assigned class via update if backend doesn't store it on create
          await api(`/teachers/${created.data.id}`, token, { method: 'PUT', body: JSON.stringify({ assigned_class: staffForm.assigned_class }) });
        }
      }
      setAddStaffModal(false);
      setEditingStaff(null);
      // refresh list
      const listResp = await api(`/teachers${queryString(schoolQuery(user))}`, token);
      const list = (listResp.data || []).slice().sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
      setTeachers(list);
    } catch (err) {
      setStaffError(err.message || 'Unable to create staff');
    } finally {
      setCreatingStaff(false);
    }
  };

  const openEditStaff = (staff) => {
    setStaffForm({
      full_name: staff.full_name || '',
      email: staff.email || '',
      phone: staff.phone || '',
      department: staff.department || '',
      subjects: staff.subjects || '',
      assigned_class: staff.assigned_class || '',
      hired_date: staff.hired_date || '',
      status: staff.status || 'ACTIVE'
    });
    setStaffError('');
    setEditingStaff(staff.id);
    setAddStaffModal(true);
  };

  const removeStaff = async (id) => {
    if (!confirm('Remove this staff member?')) return;
    try {
      await api(`/teachers/${id}`, token, { method: 'DELETE' });
      setTeachers((cur) => cur.filter((t) => t.id !== id));
      setNotice('Staff removed.');
    } catch (err) {
      setNotice(err.message);
    }
  };

  return (
    <section className="workspace">
      <div className="workspace-title">
        <div>
          <p className="eyebrow">SCHOOL MANAGEMENT</p>
          <h2>Staff directory</h2>
          <p>View and manage your teaching and support staff.</p>
        </div>
      </div>
      <div className="panel records">
        <div className="panel-heading"><div><h3>All staff</h3><p>Teachers and staff for this school</p></div><div><button className="primary" onClick={openAddStaff} style={{padding:'8px 12px'}}>+ Add staff</button></div></div>
        {loading ? <p>Loading staff…</p> : error ? <div className="form-error">{error}</div> : <StaffTable teachers={teachers} removeStaff={removeStaff} editStaff={openEditStaff} />}
      </div>

      {addStaffModal && (
        <div className="modal-layer">
          <form className="student-card" onSubmit={saveStaff}>
            <button type="button" className="close" onClick={() => setAddStaffModal(false)}>×</button>
            <p className="eyebrow">STAFF MANAGEMENT</p>
            <h2>Add staff member</h2>
            <div className="student-fields">
              <label>Full name<input value={staffForm.full_name} onChange={(e) => setStaffForm({ ...staffForm, full_name: e.target.value })} required /></label>
              <label>Email<input type="email" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} required /></label>
              <label>Phone<input value={staffForm.phone} onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })} /></label>
              <label>Department<input value={staffForm.department} onChange={(e) => setStaffForm({ ...staffForm, department: e.target.value })} /></label>
              <label>Subjects<input value={staffForm.subjects} onChange={(e) => setStaffForm({ ...staffForm, subjects: e.target.value })} /></label>
              <label>Hired date<input type="date" value={staffForm.hired_date} onChange={(e) => setStaffForm({ ...staffForm, hired_date: e.target.value })} /></label>
              <label>Assigned class<select value={staffForm.assigned_class} onChange={(e) => setStaffForm({ ...staffForm, assigned_class: e.target.value })}>
                <option value="">Not assigned</option>
                {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select></label>
            </div>
            {staffError && <div className="form-error">{staffError}</div>}
            <button className="primary" disabled={creatingStaff}>{creatingStaff ? 'Adding…' : 'Add staff member'}</button>
          </form>
        </div>
      )}
    </section>
  );
}

function StaffTable({ teachers, removeStaff, editStaff }) {
  return (
    <div className="student-table">
      <div className="table-head"><span>NAME</span><span>DEPARTMENT</span><span>EMAIL</span><span>STATUS</span></div>
      {(teachers || []).length ? teachers.map((t) => (
        <div className="table-row" key={t.id}>
          <span className="student-name"><i className={`student-avatar teal`}>{(t.full_name || '').split(' ').map(n=>n[0]).slice(0,2).join('')}</i><b>{t.full_name}<small>{t.id}</small></b></span>
          <span>{t.department || 'General'}</span>
          <span>{t.email || '—'}</span>
          <span><em className={(t.status || 'active').toLowerCase()}>{t.status || 'ACTIVE'}</em></span>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button onClick={() => editStaff && editStaff(t)} style={{border:0,background:'transparent',color:'#0b5cff'}}>Edit</button>
            <button onClick={() => removeStaff && removeStaff(t.id)} style={{border:0,background:'transparent',color:'#e11d48'}}>Remove</button>
          </div>
        </div>
      )) : (
        <div className="empty-state">
          <div>👥</div>
          <h3>No staff yet</h3>
          <p>Create teacher accounts to populate the directory.</p>
        </div>
      )}
    </div>
  );
}

function ParentPortalWorkspace({ token, user, students, setNotice }) {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [attendance, setAttendance] = useState(null);
  const [results, setResults] = useState(null);
  const [fees, setFees] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!students?.length) return;
    setSelectedStudentId((current) => current || getStudentId(students[0]) || '');
  }, [students]);

  useEffect(() => {
    const loadPortalData = async () => {
      if (!token || user?.role !== 'PARENT' || !selectedStudentId) return;
      setLoading(true);
      setError('');
      try {
        const [attendanceResponse, resultsResponse, feesResponse] = await Promise.all([
          api(`/parent-portal/attendance/${selectedStudentId}`, token),
          api(`/parent-portal/results/${selectedStudentId}`, token),
          api(`/parent-portal/fees/${selectedStudentId}`, token)
        ]);
        setAttendance(attendanceResponse.data || null);
        setResults(resultsResponse.data || null);
        setFees(feesResponse.data || null);
      } catch (err) {
        setError(err.message);
        setAttendance(null);
        setResults(null);
        setFees(null);
      } finally {
        setLoading(false);
      }
    };

    loadPortalData();
  }, [token, user?.role, selectedStudentId]);

  const selectedStudent = students.find((student) => getStudentId(student) === selectedStudentId) || null;

  return (
    <section className="workspace">
      <div className="workspace-title">
        <div>
          <p className="eyebrow">PARENT PORTAL</p>
          <h2>My child&apos;s progress</h2>
          <p>Review attendance, test results, and fee activity in one place.</p>
        </div>
      </div>
      {user?.role !== 'PARENT' ? (
        <div className="empty-state"><div>◔</div><h3>Parent portal unavailable</h3><p>This view is intended for parent accounts.</p></div>
      ) : (
        <div className="workspace-grid two-up">
          <div className="panel ticket-form">
            <h3>Select student</h3>
            <label>Child<select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
              {students.length ? students.map((student) => <option key={getStudentId(student)} value={getStudentId(student)}>{getStudentName(student)} ({getStudentClass(student)})</option>) : <option value="">No students available</option>}
            </select></label>
            {selectedStudent && <div className="mini-card" style={{ marginTop: 12 }}><b>{getStudentName(selectedStudent)}</b><small>{getStudentClass(selectedStudent)} • {getStudentGuardian(selectedStudent)}</small></div>}
            {error && <div className="form-error">{error}</div>}
          </div>

          <div className="panel records">
            <div className="panel-heading"><div><h3>Snapshot</h3><p>Latest school updates</p></div></div>
            <section className="metrics finance-metrics">
              <Metric title="Attendance" value={`${attendance?.summary?.percentage ?? 0}%`} change={`${attendance?.summary?.present ?? 0} present`} icon="✓" color="mint" />
              <Metric title="GPA" value={results?.summary?.gpa ?? '0.00'} change="current records" icon="▣" color="indigo" />
              <Metric title="Balance" value={`₦${Number(fees?.summary?.balance || 0).toLocaleString()}`} change={fees?.summary?.outstanding ? 'outstanding' : 'current'} icon="₦" color="peach" />
              <Metric title="Invoices" value={fees?.invoices?.length ?? 0} change="open items" icon="♙" color="lilac" />
            </section>
          </div>

          <div className="panel records">
            <div className="panel-heading"><div><h3>Attendance</h3><p>Daily presence history</p></div></div>
            {attendance?.attendance?.length ? (
              <div className="student-table">
                <div className="table-head"><span>DATE</span><span>STATUS</span><span>REMARKS</span><span></span><span></span></div>
                {attendance.attendance.map((entry) => (
                  <div className="table-row" key={entry.id || `${entry.record_date}-${entry.status}`}>
                    <span className="student-name"><b>{entry.record_date}</b></span>
                    <span>{entry.status}</span>
                    <span>{entry.remarks || '—'}</span>
                    <span></span>
                    <span></span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state"><div>✓</div><h3>No attendance records</h3><p>Attendance updates will appear here once your school has posted them.</p></div>
            )}
          </div>

          <div className="panel records">
            <div className="panel-heading"><div><h3>Results and fees</h3><p>Performance and billing summary</p></div></div>
            {results?.results?.length ? (
              <div className="student-table" style={{ marginBottom: 12 }}>
                <div className="table-head"><span>EXAM</span><span>SCORE</span><span>GRADE</span><span></span><span></span></div>
                {results.results.map((result) => (
                  <div className="table-row" key={result.id}>
                    <span className="student-name"><b>{result.exam_id || 'Assessment'}</b></span>
                    <span>{result.score}</span>
                    <span>{result.grade}</span>
                    <span></span>
                    <span></span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state"><div>▣</div><h3>No results yet</h3><p>Your child’s assessment results will appear here.</p></div>
            )}
            {fees?.invoices?.length ? (
              <div className="student-table">
                <div className="table-head"><span>INVOICE</span><span>AMOUNT</span><span>PAID</span><span>STATUS</span><span></span></div>
                {fees.invoices.map((invoice) => (
                  <div className="table-row" key={invoice.id}>
                    <span className="student-name"><b>{invoice.invoice_number || invoice.id}</b></span>
                    <span>₦{Number(invoice.amount || 0).toLocaleString()}</span>
                    <span>₦{Number(invoice.paid_amount || 0).toLocaleString()}</span>
                    <span>{invoice.status || 'PENDING'}</span>
                    <span></span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state"><div>₦</div><h3>No fee records</h3><p>Billing information will appear as soon as the school posts it.</p></div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function AcademicsWorkspace({ token, user, setNotice }) {
  const [activeTab, setActiveTab] = useState('classes');
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [exams, setExams] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [classStudents, setClassStudents] = useState([]);
  const [classTeacher, setClassTeacher] = useState(null);
  const [loadingClassDetail, setLoadingClassDetail] = useState(false);
  const [report, setReport] = useState({ statistics: null, levelDistribution: [], genderDistribution: [], statusDistribution: [], gpaByLevel: [] });
  const [classForm, setClassForm] = useState({ name: '', arm: '', department: '', teacherId: '', description: '' });
  const [teacherForm, setTeacherForm] = useState({ full_name: '', email: '', phone: '', department: '', subjects: '', salary: '', status: 'ACTIVE', hired_date: '' });
  const [examForm, setExamForm] = useState({ title: '', term: 'First Term', session: '', examType: 'CA', classId: '', subjectId: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const hasSchoolContext = user?.role !== 'SUPER_ADMIN' || !!user?.school_id;

  const loadAcademics = async () => {
    if (!token || !hasSchoolContext) return;
    try {
      const classesResponse = await api(`/classes${queryString(schoolQuery(user))}`, token);
      setClasses(classesResponse.data || []);
    } catch {
      setClasses([]);
    }

    try {
      const teachersResponse = await api(`/teachers${queryString(schoolQuery(user))}`, token);
      setTeachers(teachersResponse.data || []);
    } catch {
      setTeachers([]);
    }

    try {
      const examsResponse = await api(`/exams${queryString(schoolQuery(user))}`, token);
      setExams(examsResponse.data || []);
    } catch {
      setExams([]);
    }

    try {
      const [statisticsResponse, levelResponse, genderResponse, statusResponse, gpaResponse] = await Promise.all([
        api(`/reports/statistics${queryString(schoolQuery(user))}`, token),
        api(`/reports/level-distribution${queryString(schoolQuery(user))}`, token),
        api(`/reports/gender-distribution${queryString(schoolQuery(user))}`, token),
        api(`/reports/status-distribution${queryString(schoolQuery(user))}`, token),
        api(`/reports/gpa-by-level${queryString(schoolQuery(user))}`, token)
      ]);
      setReport({
        statistics: statisticsResponse.data || null,
        levelDistribution: levelResponse.data || [],
        genderDistribution: genderResponse.data || [],
        statusDistribution: statusResponse.data || [],
        gpaByLevel: gpaResponse.data || []
      });
    } catch {
      setReport({ statistics: null, levelDistribution: [], genderDistribution: [], statusDistribution: [], gpaByLevel: [] });
    }
  };

  useEffect(() => {
    loadAcademics();
  }, [token, user?.school_id, hasSchoolContext]);

  const openClass = async (klass) => {
    if (!klass || !klass.id) return;
    setLoadingClassDetail(true);
    setSelectedClass(null);
    setClassStudents([]);
    setClassTeacher(null);
    try {
      const classResp = await api(`/classes/${klass.id}`, token);
      const classData = classResp.data;
      setSelectedClass(classData);

      // fetch students in this class via filter endpoint
      let studentsResp;
      try {
        studentsResp = await api('/students/filter', token, { method: 'POST', body: JSON.stringify({ class_id: klass.id, school_id: user?.school_id }) });
        setClassStudents(studentsResp.data || []);
      } catch {
        // fallback: fetch all students and filter by current_level or class_id
        const allResp = await api(`/students${queryString(schoolQuery(user))}`, token);
        const all = allResp.data || [];
        setClassStudents(all.filter(s => s.class_id === klass.id || s.current_level === klass.name));
      }

      if (classData.teacher_id) {
        try {
          const tResp = await api(`/teachers/${classData.teacher_id}`, token);
          setClassTeacher(tResp.data || null);
        } catch {
          setClassTeacher(null);
        }
      }
    } catch (err) {
      setSelectedClass(null);
      setClassStudents([]);
      setClassTeacher(null);
      setNotice(err.message || 'Unable to load class details');
    } finally {
      setLoadingClassDetail(false);
    }
  };

  const submitClass = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api('/classes', token, { method: 'POST', body: JSON.stringify({ ...classForm, teacher_id: classForm.teacherId || null, ...schoolBody(user) }) });
      setNotice('Class created successfully.');
      setClassForm({ name: '', arm: '', department: '', teacherId: '', description: '' });
      await loadAcademics();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitTeacher = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api('/teachers', token, {
        method: 'POST',
        body: JSON.stringify({
          ...teacherForm,
          subjects: teacherForm.subjects ? teacherForm.subjects.split(',').map((item) => item.trim()).filter(Boolean) : [],
          salary: Number(teacherForm.salary || 0),
          ...schoolBody(user)
        })
      });
      setNotice('Teacher created successfully.');
      setTeacherForm({ full_name: '', email: '', phone: '', department: '', subjects: '', salary: '', status: 'ACTIVE', hired_date: '' });
      await loadAcademics();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitExam = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api('/exams', token, { method: 'POST', body: JSON.stringify({ ...examForm, ...schoolBody(user) }) });
      setNotice('Exam created successfully.');
      setExamForm({ title: '', term: 'First Term', session: '', examType: 'CA', classId: '', subjectId: '' });
      await loadAcademics();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="workspace">
      <div className="workspace-title">
        <div>
          <p className="eyebrow">SCHOOL MANAGEMENT</p>
          <h2>Academics</h2>
          <p>Manage classes, teachers, examinations, and academic reports from one place.</p>
        </div>
      </div>
      {!hasSchoolContext ? <div className="empty-state"><div>▣</div><h3>Select a school context</h3><p>Academic tools are available once you are inside a school.</p></div> : (
        <>
          <div className="panel directory" style={{ marginBottom: 18 }}>
            <div className="directory-tools" style={{ flexWrap: 'wrap' }}>
              <button className={activeTab === 'classes' ? 'active' : ''} onClick={() => setActiveTab('classes')}>Classes</button>
              <button className={activeTab === 'teachers' ? 'active' : ''} onClick={() => setActiveTab('teachers')}>Teachers</button>
              <button className={activeTab === 'exams' ? 'active' : ''} onClick={() => setActiveTab('exams')}>Exams</button>
              <button className={activeTab === 'reports' ? 'active' : ''} onClick={() => setActiveTab('reports')}>Reports</button>
            </div>
          </div>

          {activeTab === 'classes' && (
            <div className="workspace-grid two-up">
              <form className="panel ticket-form" onSubmit={submitClass}>
                <h3>Create class</h3>
                <label>Class name<input value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} required /></label>
                <div className="ticket-fields">
                  <label>Arm<input value={classForm.arm} onChange={(e) => setClassForm({ ...classForm, arm: e.target.value })} /></label>
                  <label>Department<input value={classForm.department} onChange={(e) => setClassForm({ ...classForm, department: e.target.value })} /></label>
                </div>
                <label>Class teacher<select value={classForm.teacherId} onChange={(e) => setClassForm({ ...classForm, teacherId: e.target.value })}><option value="">No teacher assigned</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}</select></label>
                <label>Description<textarea rows="3" value={classForm.description} onChange={(e) => setClassForm({ ...classForm, description: e.target.value })} /></label>
                {error && <div className="form-error">{error}</div>}
                <button className="primary" disabled={loading}>{loading ? 'Saving…' : 'Save class'}</button>
              </form>
              <div className="panel records">
                <div className="panel-heading"><div><h3>Classes</h3><p>Current academic structure</p></div></div>
                <div className="mini-grid">
                  {classes.length ? classes.map((klass) => (
                    <article key={klass.id} className="mini-card" style={{cursor:'pointer'}} onClick={() => openClass(klass)}>
                      <b>{klass.name}</b>
                      <small>{klass.arm || 'No arm'} {klass.department ? `• ${klass.department}` : ''}</small>
                    </article>
                  )) : <div className="empty-state"><div>▣</div><h3>No classes yet</h3><p>Create your first class to begin academic setup.</p></div>}
                </div>
              </div>
            </div>
          )}

          {selectedClass && (
            <div className="modal-layer">
              <div className="panel" style={{width:720,maxWidth:'100%'}}>
                <button className="close" onClick={() => setSelectedClass(null)}>×</button>
                <div className="panel-heading"><div><h3>{selectedClass.name} <small>{selectedClass.arm || ''}</small></h3><p>{selectedClass.description}</p></div></div>
                <div style={{display:'flex',gap:18}}>
                  <div style={{flex:1}}>
                    <h4>Assigned teacher</h4>
                    {classTeacher ? (<div className="panel" style={{padding:12}}><b>{classTeacher.full_name}</b><div>{classTeacher.email}</div><div>{classTeacher.phone}</div></div>) : <div className="empty-state"><div>♟</div><h3>No teacher assigned</h3><p>Assign a teacher from class settings.</p></div>}
                  </div>
                  <div style={{flex:2}}>
                    <h4>Students ({classStudents.length})</h4>
                    {classStudents.length ? (
                      <div className="student-table">
                        <div className="table-head"><span>STUDENT</span><span>CLASS</span><span>GUARDIAN</span><span>STATUS</span></div>
                        {classStudents.map((s) => (
                          <div className="table-row" key={s.id}><span className="student-name"><b>{s.full_name || s.name || 'Unnamed'}<small>{s.student_code || s.id}</small></b></span><span>{s.current_level || s.class_id}</span><span>{s.parent_name}</span><span>{s.status}</span></div>
                        ))}
                      </div>
                    ) : <div className="empty-state"><div>♙</div><h3>No students</h3><p>This class has no students yet.</p></div>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'teachers' && (
            <div className="workspace-grid two-up">
              <form className="panel ticket-form" onSubmit={submitTeacher}>
                <h3>Create teacher</h3>
                <label>Full name<input value={teacherForm.full_name} onChange={(e) => setTeacherForm({ ...teacherForm, full_name: e.target.value })} required /></label>
                <label>Email<input type="email" value={teacherForm.email} onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })} required /></label>
                <div className="ticket-fields">
                  <label>Phone<input value={teacherForm.phone} onChange={(e) => setTeacherForm({ ...teacherForm, phone: e.target.value })} /></label>
                  <label>Department<input value={teacherForm.department} onChange={(e) => setTeacherForm({ ...teacherForm, department: e.target.value })} /></label>
                </div>
                <label>Subjects <small>(comma separated)</small><input value={teacherForm.subjects} onChange={(e) => setTeacherForm({ ...teacherForm, subjects: e.target.value })} placeholder="Mathematics, English" /></label>
                <div className="ticket-fields">
                  <label>Status<select value={teacherForm.status} onChange={(e) => setTeacherForm({ ...teacherForm, status: e.target.value })}><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="ON_LEAVE">On leave</option></select></label>
                  <label>Hired date<input type="date" value={teacherForm.hired_date} onChange={(e) => setTeacherForm({ ...teacherForm, hired_date: e.target.value })} /></label>
                </div>
                <label>Salary<input type="number" min="0" step="0.01" value={teacherForm.salary} onChange={(e) => setTeacherForm({ ...teacherForm, salary: e.target.value })} /></label>
                {error && <div className="form-error">{error}</div>}
                <button className="primary" disabled={loading}>{loading ? 'Saving…' : 'Save teacher'}</button>
              </form>
              <div className="panel records">
                <div className="panel-heading"><div><h3>Teachers</h3><p>Teaching staff roster</p></div></div>
                {teachers.length ? <div className="student-table"><div className="table-head"><span>NAME</span><span>DEPARTMENT</span><span>EMAIL</span><span>STATUS</span><span></span></div>{teachers.map((teacher) => <div className="table-row" key={teacher.id}><span className="student-name"><b>{teacher.full_name}<small>{teacher.phone || 'No phone'}</small></b></span><span>{teacher.department || 'General'}</span><span>{teacher.email || 'No email'}</span><span><em className={(teacher.status || 'active').toLowerCase()}>{teacher.status || 'ACTIVE'}</em></span><span></span></div>)}</div> : <div className="empty-state"><div>♟</div><h3>No teachers yet</h3><p>Add your first teacher to start managing staff.</p></div>}
              </div>
            </div>
          )}

          {activeTab === 'exams' && (
            <div className="workspace-grid two-up">
              <form className="panel ticket-form" onSubmit={submitExam}>
                <h3>Create exam</h3>
                <label>Title<input value={examForm.title} onChange={(e) => setExamForm({ ...examForm, title: e.target.value })} required /></label>
                <div className="ticket-fields">
                  <label>Term<select value={examForm.term} onChange={(e) => setExamForm({ ...examForm, term: e.target.value })}><option>First Term</option><option>Second Term</option><option>Third Term</option></select></label>
                  <label>Type<select value={examForm.examType} onChange={(e) => setExamForm({ ...examForm, examType: e.target.value })}><option value="CA">CA</option><option value="Midterm">Midterm</option><option value="Exam">Exam</option></select></label>
                </div>
                <div className="ticket-fields">
                  <label>Session<input value={examForm.session} onChange={(e) => setExamForm({ ...examForm, session: e.target.value })} placeholder="2025/2026" required /></label>
                  <label>Class<select value={examForm.classId} onChange={(e) => setExamForm({ ...examForm, classId: e.target.value })}><option value="">All classes</option>{classes.map((klass) => <option key={klass.id} value={klass.id}>{klass.name}</option>)}</select></label>
                </div>
                <label>Subject ID<input value={examForm.subjectId} onChange={(e) => setExamForm({ ...examForm, subjectId: e.target.value })} placeholder="Optional" /></label>
                {error && <div className="form-error">{error}</div>}
                <button className="primary" disabled={loading}>{loading ? 'Saving…' : 'Save exam'}</button>
              </form>
              <div className="panel records">
                <div className="panel-heading"><div><h3>Recent exams</h3><p>Created assessments</p></div></div>
                {exams.length ? <div className="student-table"><div className="table-head"><span>TITLE</span><span>TERM</span><span>TYPE</span><span>CLASS</span><span></span></div>{exams.map((exam) => <div className="table-row" key={exam.id}><span className="student-name"><b>{exam.title}<small>{exam.session}</small></b></span><span>{exam.term}</span><span>{exam.exam_type}</span><span>{exam.class_id || 'All classes'}</span><span></span></div>)}</div> : <div className="empty-state"><div>▣</div><h3>No exams yet</h3><p>Create an exam to start entering results.</p></div>}
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="workspace-grid two-up">
              <div className="panel records">
                <div className="panel-heading"><div><h3>Academic snapshot</h3><p>Live report summary</p></div></div>
                {report.statistics ? (
                  <>
                    <section className="metrics finance-metrics">
                      <Metric title="Students" value={report.statistics?.totalStudents ?? 0} change="total" icon="♙" color="indigo" />
                      <Metric title="Active" value={report.statistics?.activeStudents ?? 0} change="in class" icon="✓" color="mint" />
                      <Metric title="Graduated" value={report.statistics?.graduatedStudents ?? 0} change="completed" icon="⌂" color="peach" />
                      <Metric title="Average GPA" value={report.statistics?.averageGPA ?? '0.00'} change="school wide" icon="₦" color="lilac" />
                    </section>
                    <div className="mini-grid" style={{ marginTop: 12 }}>
                      <article className="mini-card"><b>Levels</b><small>{report.levelDistribution.length} groups</small></article>
                      <article className="mini-card"><b>Gender</b><small>{report.genderDistribution.length} groups</small></article>
                      <article className="mini-card"><b>Status</b><small>{report.statusDistribution.length} groups</small></article>
                      <article className="mini-card"><b>GPA bands</b><small>{report.gpaByLevel.length} groups</small></article>
                    </div>
                  </>
                ) : <div className="empty-state"><div>▣</div><h3>No reports yet</h3><p>Academic reporting will appear once a school has student data.</p></div>}
              </div>
              <div className="panel records">
                <div className="panel-heading"><div><h3>Distribution</h3><p>Class, gender, and status breakdowns</p></div></div>
                <div className="mini-grid">
                  <article className="mini-card"><b>Levels</b><small>{report?.levelDistribution?.length || 0} groups</small></article>
                  <article className="mini-card"><b>Gender</b><small>{report?.genderDistribution?.length || 0} groups</small></article>
                  <article className="mini-card"><b>Status</b><small>{report?.statusDistribution?.length || 0} groups</small></article>
                  <article className="mini-card"><b>GPA bands</b><small>{report?.gpaByLevel?.length || 0} groups</small></article>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function FinanceWorkspace({ token, user, students, setNotice }) {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState({ studentId: '', amount: '', description: '', dueDate: '', paymentMethod: 'CASH' });
  const [paymentForm, setPaymentForm] = useState({ studentId: '', amount: '', invoiceAmount: '', paymentMethod: 'CASH', officerName: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const hasSchoolContext = user?.role !== 'SUPER_ADMIN' || !!user?.school_id;

  useEffect(() => {
    const load = async () => {
      if (!token || !hasSchoolContext) return;
      try {
        const invoicesResponse = await api(`/fees/invoices${queryString(schoolQuery(user))}`, token);
        setInvoices(invoicesResponse.data || []);
      } catch {
        setInvoices([]);
      }

      try {
        const paymentsResponse = await api(`/payments${queryString(schoolQuery(user))}`, token);
        setPayments(paymentsResponse.data || []);
      } catch {
        setPayments([]);
      }

      try {
        const summaryResponse = await api(`/payments/dashboard/summary${queryString(schoolQuery(user))}`, token);
        setSummary(summaryResponse.data || null);
      } catch {
        setSummary(null);
      }
    };
    load();
  }, [token, user?.school_id, hasSchoolContext]);

  const refreshFinance = async () => {
    const invoicesResponse = await api(`/fees/invoices${queryString(schoolQuery(user))}`, token);
    setInvoices(invoicesResponse.data || []);
    const paymentsResponse = await api(`/payments${queryString(schoolQuery(user))}`, token);
    setPayments(paymentsResponse.data || []);
  };

  const submitInvoice = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api('/fees/invoices', token, {
        method: 'POST',
        body: JSON.stringify({ ...invoiceForm, studentId: invoiceForm.studentId, amount: Number(invoiceForm.amount), ...schoolBody(user) })
      });
      setNotice('Invoice created successfully.');
      setInvoiceForm({ studentId: '', amount: '', description: '', dueDate: '', paymentMethod: 'CASH' });
      await refreshFinance();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api('/payments/record', token, {
        method: 'POST',
        body: JSON.stringify({ ...paymentForm, studentId: paymentForm.studentId, amount: Number(paymentForm.amount), invoiceAmount: Number(paymentForm.invoiceAmount), ...schoolBody(user) })
      });
      setNotice('Payment recorded successfully.');
      setPaymentForm({ studentId: '', amount: '', invoiceAmount: '', paymentMethod: 'CASH', officerName: '' });
      await refreshFinance();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="workspace">
      <div className="workspace-title"><div><p className="eyebrow">SCHOOL MANAGEMENT</p><h2>Finance</h2><p>Track invoices, payments, and balances from one workspace.</p></div></div>
      {!hasSchoolContext ? <div className="empty-state"><div>₦</div><h3>Select a school context</h3><p>Finance tools are available once you are inside a school.</p></div> : (
        <div className="workspace-grid two-up">
          <form className="panel ticket-form" onSubmit={submitInvoice}>
            <h3>Create invoice</h3>
            <label>Student<select value={invoiceForm.studentId} onChange={(e) => setInvoiceForm({ ...invoiceForm, studentId: e.target.value })} required><option value="">Select student</option>{students.map((student) => <option key={getStudentId(student)} value={getStudentId(student)}>{getStudentName(student)} ({student.student_code || student.id})</option>)}</select></label>
            <div className="ticket-fields">
              <label>Amount<input type="number" min="1" step="0.01" value={invoiceForm.amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} required /></label>
              <label>Due date<input type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })} /></label>
            </div>
            <label>Description<textarea rows="3" value={invoiceForm.description} onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })} /></label>
            <label>Payment method<select value={invoiceForm.paymentMethod} onChange={(e) => setInvoiceForm({ ...invoiceForm, paymentMethod: e.target.value })}><option value="CASH">Cash</option><option value="TRANSFER">Bank transfer</option></select></label>
            {error && <div className="form-error">{error}</div>}
            <button className="primary" disabled={loading}>{loading ? 'Saving…' : 'Save invoice'}</button>
          </form>

          <form className="panel ticket-form" onSubmit={submitPayment}>
            <h3>Record payment</h3>
            <label>Student<select value={paymentForm.studentId} onChange={(e) => setPaymentForm({ ...paymentForm, studentId: e.target.value })} required><option value="">Select student</option>{students.map((student) => <option key={getStudentId(student)} value={getStudentId(student)}>{getStudentName(student)} ({student.student_code || student.id})</option>)}</select></label>
            <div className="ticket-fields">
              <label>Amount paid<input type="number" min="1" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} required /></label>
              <label>Invoice balance<input type="number" min="1" step="0.01" value={paymentForm.invoiceAmount} onChange={(e) => setPaymentForm({ ...paymentForm, invoiceAmount: e.target.value })} required /></label>
            </div>
            <div className="ticket-fields">
              <label>Payment method<select value={paymentForm.paymentMethod} onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}><option value="CASH">Cash</option><option value="TRANSFER">Bank transfer</option></select></label>
              <label>Officer<input value={paymentForm.officerName} onChange={(e) => setPaymentForm({ ...paymentForm, officerName: e.target.value })} placeholder="Optional" /></label>
            </div>
            <button className="primary" disabled={loading}>{loading ? 'Saving…' : 'Record payment'}</button>
          </form>

          <div className="panel records">
            <div className="panel-heading"><div><h3>Summary</h3><p>Fee health at a glance</p></div></div>
            <section className="metrics finance-metrics">
              <Metric title="Revenue" value={`₦${Number(summary?.totalRevenue || 0).toLocaleString()}`} change="collected" icon="₦" color="indigo" />
              <Metric title="Today" value={`₦${Number(summary?.todayPayments || 0).toLocaleString()}`} change="payments today" icon="✓" color="mint" />
              <Metric title="Outstanding" value={`₦${Number(summary?.outstandingFees || 0).toLocaleString()}`} change="still due" icon="⌂" color="peach" />
              <Metric title="Students owing" value={summary?.studentsOwingCount ?? 0} change="accounts" icon="♙" color="lilac" />
            </section>
            <div className="panel-heading" style={{ marginTop: 18 }}><div><h3>Recent invoices</h3><p>Latest billing records</p></div></div>
            {invoices.length ? <div className="student-table"><div className="table-head"><span>INVOICE</span><span>STUDENT</span><span>AMOUNT</span><span>STATUS</span><span></span></div>{invoices.map((invoice) => <div className="table-row" key={invoice.id}><span className="student-name"><b>{invoice.invoice_number}<small>{invoice.description || 'Fee invoice'}</small></b></span><span>{invoice.student_id}</span><span>₦{Number(invoice.amount || 0).toLocaleString()}</span><span>{invoice.status}</span><span></span></div>)}</div> : <div className="empty-state"><div>₦</div><h3>No invoices yet</h3><p>Create an invoice to begin tracking fees.</p></div>}
            <div className="panel-heading" style={{ marginTop: 18 }}><div><h3>Recent payments</h3><p>Collected transactions</p></div></div>
            {payments.length ? <div className="student-table"><div className="table-head"><span>REFERENCE</span><span>STUDENT</span><span>AMOUNT</span><span>STATUS</span><span></span></div>{payments.map((payment) => <div className="table-row" key={payment.id}><span className="student-name"><b>{payment.reference}<small>{payment.payment_method}</small></b></span><span>{payment.student_id}</span><span>₦{Number(payment.amount || 0).toLocaleString()}</span><span>{payment.status}</span><span></span></div>)}</div> : <div className="empty-state"><div>₦</div><h3>No payments yet</h3><p>Record a payment to see fee movement.</p></div>}
          </div>
        </div>
      )}
    </section>
  );
}

function MessagesWorkspace({ token, user, setNotice }) {
  const [inbox, setInbox] = useState([]);
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState({ recipientType: 'ALL', recipientId: '', subject: '', message: '', channel: 'IN_APP' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      try {
        const inboxResponse = await api('/notifications/inbox', token);
        setInbox(inboxResponse.data || []);
      } catch {
        setInbox([]);
      }

      try {
        const historyResponse = await api(`/notifications/history${queryString(schoolQuery(user))}`, token);
        setHistory(historyResponse.data || []);
      } catch {
        setHistory([]);
      }
    };
    load();
  }, [token, user?.school_id]);

  const refreshMessages = async () => {
    const inboxResponse = await api('/notifications/inbox', token);
    setInbox(inboxResponse.data || []);
    const historyResponse = await api(`/notifications/history${queryString(schoolQuery(user))}`, token);
    setHistory(historyResponse.data || []);
  };

  const submitMessage = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api('/notifications/send', token, { method: 'POST', body: JSON.stringify(form) });
      setNotice('Notification queued successfully.');
      setForm({ recipientType: 'ALL', recipientId: '', subject: '', message: '', channel: 'IN_APP' });
      await refreshMessages();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id) => {
    try {
      await api(`/notifications/${id}/read`, token, { method: 'POST' });
      await refreshMessages();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="workspace">
      <div className="workspace-title"><div><p className="eyebrow">SCHOOL MANAGEMENT</p><h2>Messages</h2><p>Send announcements and manage inbox notifications.</p></div></div>
      <div className="workspace-grid two-up">
        <form className="panel ticket-form" onSubmit={submitMessage}>
          <h3>Broadcast notification</h3>
          <div className="ticket-fields">
            <label>Recipient type<select value={form.recipientType} onChange={(e) => setForm({ ...form, recipientType: e.target.value })}><option value="ALL">All users</option><option value="USER">Single user</option><option value="SCHOOL">School</option></select></label>
            <label>Channel<select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}><option value="IN_APP">In-app</option><option value="EMAIL">Email</option><option value="SMS">SMS</option><option value="WHATSAPP">WhatsApp</option></select></label>
          </div>
          <label>Recipient ID<input value={form.recipientId} onChange={(e) => setForm({ ...form, recipientId: e.target.value })} placeholder="Optional for single user or school" /></label>
          <label>Subject<input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required /></label>
          <label>Message<textarea rows="5" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required /></label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary" disabled={loading}>{loading ? 'Sending…' : 'Send notification'}</button>
        </form>

        <div className="panel records">
          <div className="panel-heading"><div><h3>Inbox</h3><p>Latest user notifications</p></div></div>
          {inbox.length ? <div className="notification-list">{inbox.map((item) => <article className="notification-card" key={item.recipient_entry_id || item.id}><div><b>{item.subject || 'Notification'}</b><small>{item.message}</small></div><button onClick={() => markRead(item.id)}>Mark read</button></article>)}</div> : <div className="empty-state"><div>✉</div><h3>No inbox items</h3><p>Notifications sent to this account will appear here.</p></div>}
          <div className="panel-heading" style={{ marginTop: 18 }}><div><h3>History</h3><p>Recent broadcasts</p></div></div>
          {history.length ? <div className="student-table"><div className="table-head"><span>SUBJECT</span><span>TYPE</span><span>CHANNEL</span><span>STATUS</span><span></span></div>{history.map((item) => <div className="table-row" key={item.id}><span className="student-name"><b>{item.subject}<small>{item.message}</small></b></span><span>{item.type}</span><span>{item.channel}</span><span>{item.status || 'PENDING'}</span><span></span></div>)}</div> : <div className="empty-state"><div>✉</div><h3>No history yet</h3><p>Broadcasts will show up here.</p></div>}
        </div>
      </div>
    </section>
  );
}

function SettingsWorkspace({ token, user, school, setNotice }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm({
      name: school?.name || '',
      code: school?.code || '',
      logo_url: school?.logo_url || '',
      motto: school?.motto || '',
      support_email: school?.support_email || '',
      address: school?.address || '',
      email: school?.email || '',
      phone: school?.phone || '',
      website: school?.website || '',
      principal_name: school?.principal_name || '',
      principal_phone: school?.principal_phone || '',
      primary_color: school?.primary_color || '#2563EB',
      secondary_color: school?.secondary_color || '#1E40AF'
    });
  }, [school]);

  const saveSchool = async (event) => {
    event.preventDefault();
    if (!school?.id) return;
    setSaving(true);
    setError('');
    try {
      const resp = await api(`/schools/${school.id}`, token, { method: 'PUT', body: JSON.stringify(form) });
      setNotice('School settings updated.');
      if (resp && resp.data) setSchool(resp.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const uploadLogo = async (file) => {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      const resp = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: fd
      });
      const bodyResp = await resp.json();
      if (!resp.ok) throw new Error(bodyResp.error || 'Upload failed');
      setForm((f) => ({ ...f, logo_url: bodyResp.url }));
      setNotice('Logo uploaded. Click Save to persist.');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <section className="workspace">
      <div className="workspace-title"><div><p className="eyebrow">SCHOOL MANAGEMENT</p><h2>Settings</h2><p>Review your account and update school profile details.</p></div></div>
      {!school ? <div className="empty-state"><div>⚙</div><h3>No school selected</h3><p>School settings appear after you sign into a school workspace.</p></div> : (
        <div className="workspace-grid two-up">
          <div className="panel ticket-form">
            <h3>Account details</h3>
            <label>Full name<input value={user?.full_name || ''} readOnly /></label>
            <label>Email<input value={user?.email || ''} readOnly /></label>
            <label>Role<input value={user?.role || ''} readOnly /></label>
            <label>School<input value={school?.name || ''} readOnly /></label>
            <label>Status<input value={user?.status || 'ACTIVE'} readOnly /></label>
          </div>
          <form className="panel ticket-form" onSubmit={saveSchool}>
            <h3>School profile</h3>
            {error && <div className="form-error">{error}</div>}
            <div className="ticket-fields">
              <label>Name<input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} required disabled={user?.role !== 'SUPER_ADMIN'} /></label>
              <label>Code<input value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} required disabled={user?.role !== 'SUPER_ADMIN'} /></label>
            </div>
            <label>Support email<input type="email" value={form.support_email || ''} onChange={(e) => setForm({ ...form, support_email: e.target.value })} disabled={user?.role !== 'SUPER_ADMIN'} /></label>
            <label>Motto<input value={form.motto || ''} onChange={(e) => setForm({ ...form, motto: e.target.value })} disabled={user?.role !== 'SUPER_ADMIN'} /></label>
            <label>Address<textarea rows="3" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} disabled={user?.role !== 'SUPER_ADMIN'} /></label>
            <div className="ticket-fields">
              <label>Email<input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={user?.role !== 'SUPER_ADMIN'} /></label>
              <label>Phone<input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={user?.role !== 'SUPER_ADMIN'} /></label>
            </div>
            <div className="ticket-fields">
              <label>Principal<input value={form.principal_name || ''} onChange={(e) => setForm({ ...form, principal_name: e.target.value })} disabled={user?.role !== 'SUPER_ADMIN'} /></label>
              <label>Principal phone<input value={form.principal_phone || ''} onChange={(e) => setForm({ ...form, principal_phone: e.target.value })} disabled={user?.role !== 'SUPER_ADMIN'} /></label>
            </div>
            <div className="ticket-fields">
              <label>Primary color<input value={form.primary_color || ''} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} disabled={user?.role !== 'SUPER_ADMIN'} /></label>
              <label>Secondary color<input value={form.secondary_color || ''} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} disabled={user?.role !== 'SUPER_ADMIN'} /></label>
            </div>
            <label>Website<input value={form.website || ''} onChange={(e) => setForm({ ...form, website: e.target.value })} disabled={user?.role !== 'SUPER_ADMIN'} /></label>
            <label>Logo URL<input value={form.logo_url || ''} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} disabled={user?.role !== 'SUPER_ADMIN'} /></label>
            <div style={{display:'flex',gap:12,alignItems:'center'}}>
              <input type="file" accept="image/*" onChange={(e) => uploadLogo(e.target.files && e.target.files[0])} disabled={user?.role !== 'SUPER_ADMIN' || uploadingLogo} />
              {uploadingLogo && <small>Uploading…</small>}
              {form.logo_url && <img src={form.logo_url} alt="logo preview" style={{height:44,borderRadius:8,objectFit:'cover'}} />}
            </div>
            {user?.role === 'SUPER_ADMIN' ? <button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save school profile'}</button> : <p className="support-note">Only a super admin can edit school profile settings.</p>}
          </form>
        </div>
      )}
    </section>
  );
}

function SupportCenter({ token, user, school }) {
  const [ticket, setTicket] = useState({ name: '', email: '', subject: '', category: 'General support', priority: 'Normal', message: '' });
  const [result, setResult] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSending(true);
    setResult('');
    try {
      const payload = { ...ticket };
      if (user?.school_id) payload.school_id = user.school_id;
      const response = await api('/contact', token, { method: 'POST', body: JSON.stringify(payload) });
      setResult(response.message);
      setTicket({ name: '', email: '', subject: '', category: 'General support', priority: 'Normal', message: '' });
    } catch (err) {
      setResult(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="support">
      <div className="workspace-title">
        <div><p className="eyebrow">WE ARE HERE TO HELP</p><h2>Help & support</h2><p>Contact our support team or send a ticket and we will get back to you.</p></div>
      </div>
      <div className="support-grid">
        <aside className="support-details">
          <h3>Contact support</h3>
          <p>For account, billing, or platform assistance, reach us directly.</p>
          <a href="tel:07058292660"><span>☎</span><div><small>PHONE</small><b>07058292660</b></div></a>
          <a href="mailto:student.management.website01@gmail.com"><span>✉</span><div><small>EMAIL</small><b>student.management.website01@gmail.com</b></div></a>
          <p className="support-note">Please include your school name and a clear description of the issue for faster help.</p>
        </aside>
        <form className="panel ticket-form" onSubmit={submit}>
          <h3>Open a support ticket</h3>
          <div className="ticket-fields">
            <label>Your name<input value={ticket.name} onChange={(e) => setTicket({ ...ticket, name: e.target.value })} required /></label>
            <label>Email address<input type="email" value={ticket.email} onChange={(e) => setTicket({ ...ticket, email: e.target.value })} required /></label>
            <label>Category<select value={ticket.category} onChange={(e) => setTicket({ ...ticket, category: e.target.value })}><option>General support</option><option>Account access</option><option>Billing & subscription</option><option>Technical issue</option></select></label>
            <label>Priority<select value={ticket.priority} onChange={(e) => setTicket({ ...ticket, priority: e.target.value })}><option>Normal</option><option>High</option><option>Urgent</option></select></label>
          </div>
          <label>Subject<input value={ticket.subject} onChange={(e) => setTicket({ ...ticket, subject: e.target.value })} required /></label>
          <label>Message<textarea rows="5" value={ticket.message} onChange={(e) => setTicket({ ...ticket, message: e.target.value })} required /></label>
          {result && <p className="ticket-result">{result}</p>}
          <button className="primary" disabled={sending}>{sending ? 'Sending…' : 'Send ticket'}</button>
        </form>
      </div>
    </section>
  );
}

function StudentTable({ students }) {
  return (
    <div className="student-table">
      <div className="table-head"><span>STUDENT</span><span>CLASS</span><span>GUARDIAN</span><span>STATUS</span><span></span></div>
      {(students || []).length ? students.map((student) => (
        <div className="table-row" key={student.id}>
          <span className="student-name"><i className={`student-avatar ${student.color}`}>{student.initials}</i><b>{student.name}<small>{student.id}</small></b></span>
          <span>{student.grade}</span>
          <span>{student.guardian}</span>
          <span><em className={(student.status || 'active').toLowerCase().replace(' ', '-')}>{student.status}</em></span>
          <button>•••</button>
        </div>
      )) : (
        <div className="empty-state">
          <div>♙</div>
          <h3>No students yet</h3>
          <p>Create the first student record to populate the directory.</p>
        </div>
      )}
    </div>
  );
}

export default App;
