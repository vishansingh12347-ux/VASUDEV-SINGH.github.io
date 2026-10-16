import { firebaseConfig, appSettings } from '../firebase-config.js';

const FIREBASE_VERSION = '10.12.5';
const DEMO_DATA_KEY = 'shalasetu-demo-data-v1';
const DEMO_ROLE_KEY = 'shalasetu-demo-role-v1';
const VALID_ROLES = ['principal', 'teacher', 'operator'];
const ROLE_LABELS = {
  principal: 'प्रधानाचार्य · Principal',
  teacher: 'शिक्षक · Teacher',
  operator: 'कंप्यूटर ऑपरेटर · Operator'
};

const DEFAULT_SETTINGS = {
  schoolName: appSettings.schoolName,
  schoolNameEn: appSettings.schoolNameEn,
  schoolAddress: appSettings.schoolAddress,
  academicSession: appSettings.academicSession,
  classes: Array.isArray(appSettings.classes) ? appSettings.classes : ['5th', '8th', '10th'],
  subjectsByClass: appSettings.subjectsByClass || {}
};

const state = {
  ready: false,
  configured: false,
  firebaseReady: false,
  connected: false,
  isDemo: false,
  currentUser: null,
  authUser: null,
  profileMissing: false,
  error: '',
  students: [],
  results: [],
  feeRequests: [],
  feeLedger: [],
  notices: [],
  users: [],
  settings: structuredCloneSafe(DEFAULT_SETTINGS)
};

const listeners = new Set();
let firebaseAppSDK = null;
let firebaseAuthSDK = null;
let firebaseDbSDK = null;
let firebaseApp = null;
let auth = null;
let db = null;
let initPromise = null;
let authUnsubscribe = null;
let databaseUnsubscribers = [];
let infoUnsubscribe = null;
let authVersion = 0;

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasRealFirebaseConfig() {
  const required = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId'];
  return required.every((key) => {
    const value = firebaseConfig?.[key];
    return typeof value === 'string' && value.length > 5 && !value.includes('REPLACE_WITH');
  }) && /^[A-Za-z0-9_-]{1,80}$/.test(appSettings?.schoolId || '');
}

function rootPath(path = '') {
  const schoolId = appSettings.schoolId;
  return `schools/${schoolId}${path ? `/${path}` : ''}`;
}

function emit(event = 'change', payload = null) {
  for (const listener of [...listeners]) {
    try {
      if (listener.event === '*' || listener.event === event) listener.callback(event, payload);
    } catch (error) {
      console.error('ShalaSetu listener error:', error);
    }
  }
}

function resetCloudData() {
  state.students = [];
  state.results = [];
  state.feeRequests = [];
  state.feeLedger = [];
  state.notices = [];
  state.users = [];
  state.settings = structuredCloneSafe(DEFAULT_SETTINGS);
}

function stopRealtime() {
  for (const unsubscribe of databaseUnsubscribers) {
    try { unsubscribe(); } catch (_) {}
  }
  databaseUnsubscribers = [];
}

function getRole() {
  return state.currentUser?.role || '';
}

function assertRole(allowed) {
  if (!state.currentUser) throw new Error('कृपया पहले लॉगिन करें। Please sign in first.');
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  if (!roles.includes(getRole())) throw new Error('आपके खाते को इस काम की अनुमति नहीं है। You are not authorized for this action.');
}

function profileFromSnapshot(uid, user, profile) {
  const role = profile?.role;
  if (!VALID_ROLES.includes(role)) return null;
  return {
    uid,
    email: profile.email || user?.email || '',
    name: profile.name || user?.displayName || user?.email || 'School staff',
    role
  };
}

function parseCollection(value) {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value)
    .filter(([, item]) => item && typeof item === 'object')
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => Number(b.createdAt || b.timestamp || 0) - Number(a.createdAt || a.timestamp || 0));
}

function demoSeed() {
  const sampleStudents = [
    { id: 'demo-student-1', rollNo: '1', srNo: 'SR-101', name: 'आरव शर्मा', fatherName: 'मोहन शर्मा', class: '5th', medium: 'हिंदी' },
    { id: 'demo-student-2', rollNo: '2', srNo: 'SR-102', name: 'अनन्या सिंह', fatherName: 'राजेश सिंह', class: '5th', medium: 'हिंदी' },
    { id: 'demo-student-3', rollNo: '1', srNo: 'SR-201', name: 'कबीर चौधरी', fatherName: 'सुरेश चौधरी', class: '8th', medium: 'English' },
    { id: 'demo-student-4', rollNo: '1', srNo: 'SR-301', name: 'मीरा कुमारी', fatherName: 'रामलाल कुमारी', class: '10th', medium: 'हिंदी' }
  ];
  const now = Date.now();
  return {
    settings: structuredCloneSafe(DEFAULT_SETTINGS),
    students: sampleStudents,
    results: [
      {
        id: 'demo-result-1', title: 'अर्धवार्षिक परीक्षा 2026-27', class: '5th', medium: 'हिंदी', session: DEFAULT_SETTINGS.academicSession,
        date: new Date().toISOString().slice(0, 10), createdAt: now - 86400000, totalStudents: 2, passCount: 2, failCount: 0,
        publishedBy: 'Demo Teacher', topper: { name: 'अनन्या सिंह', percentage: 88 },
        subjects: [{ name: 'हिंदी', max: 100 }, { name: 'English', max: 100 }, { name: 'गणित', max: 100 }, { name: 'पर्यावरण अध्ययन', max: 100 }],
        studentsData: [
          { studentId: 'demo-student-1', rollNo: '1', srNo: 'SR-101', name: 'आरव शर्मा', fatherName: 'मोहन शर्मा', marks: { हिंदी: 82, English: 78, गणित: 81, 'पर्यावरण अध्ययन': 83 }, totalMarks: 324, totalMax: 400, percentage: 81, grade: 'A', isPass: true, rank: 2 },
          { studentId: 'demo-student-2', rollNo: '2', srNo: 'SR-102', name: 'अनन्या सिंह', fatherName: 'राजेश सिंह', marks: { हिंदी: 90, English: 85, गणित: 88, 'पर्यावरण अध्ययन': 89 }, totalMarks: 352, totalMax: 400, percentage: 88, grade: 'A', isPass: true, rank: 1 }
        ]
      }
    ],
    feeRequests: [
      { id: 'demo-fee-1', studentId: 'demo-student-1', studentName: 'आरव शर्मा', fatherName: 'मोहन शर्मा', class: '5th', medium: 'हिंदी', amount: 1500, date: new Date().toISOString().slice(0, 10), note: 'मासिक फीस', status: 'Pending', submittedBy: 'Demo Teacher', submittedByUid: 'demo-teacher', createdAt: now }
    ],
    feeLedger: [
      { id: 'demo-ledger-1', requestId: 'demo-ledger-1', studentName: 'मीरा कुमारी', class: '10th', medium: 'हिंदी', amount: 1800, date: new Date().toISOString().slice(0, 10), approvedBy: 'Demo Operator', createdAt: now - 172800000 }
    ],
    notices: [
      { id: 'demo-notice-1', title: 'स्वागत है — Demo Notice', message: 'यह नमूना डेमो डेटा है। यहाँ बनाया गया डेटा केवल इस ब्राउज़र में रहता है और Firebase से sync नहीं होता।', sender: 'Demo Principal', createdAt: now }
    ],
    users: [
      { uid: 'demo-principal', name: 'Demo Principal', email: 'principal@example.test', role: 'principal', createdAt: now },
      { uid: 'demo-teacher', name: 'Demo Teacher', email: 'teacher@example.test', role: 'teacher', createdAt: now },
      { uid: 'demo-operator', name: 'Demo Operator', email: 'operator@example.test', role: 'operator', createdAt: now }
    ]
  };
}

function readDemoData() {
  try {
    const stored = JSON.parse(localStorage.getItem(DEMO_DATA_KEY) || 'null');
    if (!stored || typeof stored !== 'object') return demoSeed();
    const seed = demoSeed();
    return {
      ...seed,
      ...stored,
      settings: { ...seed.settings, ...(stored.settings || {}) },
      students: Array.isArray(stored.students) ? stored.students : seed.students,
      results: Array.isArray(stored.results) ? stored.results : seed.results,
      feeRequests: Array.isArray(stored.feeRequests) ? stored.feeRequests : seed.feeRequests,
      feeLedger: Array.isArray(stored.feeLedger) ? stored.feeLedger : seed.feeLedger,
      notices: Array.isArray(stored.notices) ? stored.notices : seed.notices,
      users: Array.isArray(stored.users) ? stored.users : seed.users
    };
  } catch (_) {
    return demoSeed();
  }
}

function persistDemoData() {
  try {
    localStorage.setItem(DEMO_DATA_KEY, JSON.stringify({
      settings: state.settings,
      students: state.students,
      results: state.results,
      feeRequests: state.feeRequests,
      feeLedger: state.feeLedger,
      notices: state.notices,
      users: state.users
    }));
  } catch (error) {
    console.warn('Unable to save local demo data:', error);
  }
}

function applyDemoData(data) {
  state.settings = { ...structuredCloneSafe(DEFAULT_SETTINGS), ...(data.settings || {}) };
  for (const key of ['students', 'results', 'feeRequests', 'feeLedger', 'notices', 'users']) {
    state[key] = Array.isArray(data[key]) ? data[key] : [];
  }
}

function demoWrite(event, callback) {
  const result = callback();
  persistDemoData();
  emit(event || 'data', result);
  return result;
}

async function initializeFirebase() {
  if (!hasRealFirebaseConfig()) return false;
  const cdn = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/`;
  try {
    [firebaseAppSDK, firebaseAuthSDK, firebaseDbSDK] = await Promise.all([
      import(`${cdn}firebase-app.js`),
      import(`${cdn}firebase-auth.js`),
      import(`${cdn}firebase-database.js`)
    ]);
    firebaseApp = firebaseAppSDK.initializeApp(firebaseConfig);
    auth = firebaseAuthSDK.getAuth(firebaseApp);
    db = firebaseDbSDK.getDatabase(firebaseApp);
    await firebaseAuthSDK.setPersistence(auth, firebaseAuthSDK.browserLocalPersistence);
    state.configured = true;
    state.firebaseReady = true;
    infoUnsubscribe = firebaseDbSDK.onValue(
      firebaseDbSDK.ref(db, '.info/connected'),
      (snapshot) => {
        state.connected = snapshot.val() === true;
        emit('connection');
      },
      (error) => {
        state.error = error?.message || 'Realtime Database connection error.';
        emit('error');
      }
    );
    return true;
  } catch (error) {
    state.error = `Firebase could not start: ${error?.message || error}`;
    state.configured = hasRealFirebaseConfig();
    state.firebaseReady = false;
    emit('error');
    return false;
  }
}

async function activateCloudUser(user) {
  const version = ++authVersion;
  stopRealtime();
  state.authUser = user || null;
  state.currentUser = null;
  state.profileMissing = false;
  state.error = '';

  if (!user) {
    if (state.isDemo) return;
    resetCloudData();
    emit('auth');
    return;
  }

  try {
    const snapshot = await firebaseDbSDK.get(firebaseDbSDK.ref(db, rootPath(`users/${user.uid}`)));
    if (version !== authVersion) return;
    const profile = profileFromSnapshot(user.uid, user, snapshot.val());
    if (!profile) {
      state.profileMissing = true;
      state.currentUser = null;
      resetCloudData();
      emit('auth');
      return;
    }
    state.currentUser = profile;
    state.profileMissing = false;
    startRealtimeListeners();
    emit('auth');
  } catch (error) {
    if (version !== authVersion) return;
    state.profileMissing = false;
    state.error = `Could not load your school role. Check the principal setup and database rules. ${error?.message || ''}`.trim();
    state.currentUser = null;
    emit('error');
  }
}

function startRealtimeListeners() {
  stopRealtime();
  const watchCollection = (key) => {
    const unsubscribe = firebaseDbSDK.onValue(
      firebaseDbSDK.ref(db, rootPath(key)),
      (snapshot) => {
        state[key] = parseCollection(snapshot.val());
        emit(key, state[key]);
      },
      (error) => {
        state.error = `Could not sync ${key}: ${error?.message || error}`;
        emit('error');
      }
    );
    databaseUnsubscribers.push(unsubscribe);
  };
  for (const key of ['students', 'results', 'feeRequests', 'feeLedger', 'notices']) watchCollection(key);

  const settingsUnsubscribe = firebaseDbSDK.onValue(
    firebaseDbSDK.ref(db, rootPath('settings')),
    (snapshot) => {
      state.settings = { ...structuredCloneSafe(DEFAULT_SETTINGS), ...(snapshot.val() || {}) };
      emit('settings', state.settings);
    },
    (error) => {
      state.error = `Could not sync school settings: ${error?.message || error}`;
      emit('error');
    }
  );
  databaseUnsubscribers.push(settingsUnsubscribe);

  if (getRole() === 'principal') watchCollection('users');
  else state.users = [];
}

function normalizeStudent(data) {
  const clean = {};
  for (const key of ['rollNo', 'srNo', 'name', 'fatherName', 'class', 'medium']) {
    clean[key] = String(data?.[key] ?? '').trim();
  }
  if (!clean.name || !clean.class || !clean.rollNo) throw new Error('विद्यार्थी का नाम, रोल नंबर और कक्षा जरूरी हैं।');
  if (!clean.medium) clean.medium = 'हिंदी';
  return clean;
}

function newId(prefix = 'item') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function arrayFromCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const source = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const character = source[i];
    if (character === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(cell.trim()); cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[i + 1] === '\n') i++;
      row.push(cell.trim()); cell = '';
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
    } else cell += character;
  }
  row.push(cell.trim());
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}

const Shala = {
  get ready() { return state.ready; },
  get configured() { return state.configured; },
  get firebaseReady() { return state.firebaseReady; },
  get connected() { return state.connected; },
  get isDemo() { return state.isDemo; },
  get currentUser() { return state.currentUser; },
  get authUser() { return state.authUser; },
  get profileMissing() { return state.profileMissing; },
  get error() { return state.error; },
  get students() { return state.students; },
  get results() { return state.results; },
  get feeRequests() { return state.feeRequests; },
  get feeLedger() { return state.feeLedger; },
  get notices() { return state.notices; },
  get users() { return state.users; },
  get settings() { return state.settings; },
  get schoolId() { return appSettings.schoolId; },

  subscribe(event, callback) {
    const entry = { event: event || '*', callback };
    listeners.add(entry);
    return () => listeners.delete(entry);
  },

  async init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      state.configured = hasRealFirebaseConfig();
      const firebaseOk = await initializeFirebase();
      let savedDemoRole = '';
      try { savedDemoRole = localStorage.getItem(DEMO_ROLE_KEY) || ''; } catch (_) {}
      if (VALID_ROLES.includes(savedDemoRole)) {
        if (firebaseOk && auth?.currentUser) {
          try { await firebaseAuthSDK.signOut(auth); } catch (_) {}
        }
        state.isDemo = true;
        state.connected = false;
        applyDemoData(readDemoData());
        state.currentUser = { uid: `demo-${savedDemoRole}`, name: `Sample ${ROLE_LABELS[savedDemoRole]}`, email: 'sample@example.test', role: savedDemoRole };
      }

      if (firebaseOk) {
        await new Promise((resolve) => {
          let first = true;
          authUnsubscribe = firebaseAuthSDK.onAuthStateChanged(auth, async (user) => {
            if (state.isDemo) {
              if (first) { first = false; resolve(); }
              return;
            }
            await activateCloudUser(user);
            if (first) { first = false; resolve(); }
          }, (error) => {
            state.error = error?.message || 'Authentication state error.';
            if (first) { first = false; resolve(); }
            emit('error');
          });
        });
      }
      state.ready = true;
      emit('ready');
      return Shala;
    })();
    return initPromise;
  },

  async login(email, password) {
    if (!state.configured || !state.firebaseReady) throw new Error('Cloud login is not configured yet. Follow README.md to connect Firebase.');
    if (state.isDemo) {
      try { localStorage.removeItem(DEMO_ROLE_KEY); } catch (_) {}
      state.isDemo = false;
      state.currentUser = null;
      state.profileMissing = false;
    }
    state.error = '';
    const credential = await firebaseAuthSDK.signInWithEmailAndPassword(auth, String(email).trim(), password);
    const uid = credential.user.uid;
    await new Promise((resolve) => {
      let finished = false;
      let unsubscribe = () => {};
      const complete = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        unsubscribe();
        resolve();
      };
      const check = () => {
        if (state.currentUser?.uid === uid || (state.authUser?.uid === uid && (state.profileMissing || state.error))) complete();
      };
      const timer = setTimeout(complete, 15000);
      unsubscribe = Shala.subscribe('*', check);
      check();
    });
    if (!state.currentUser || state.currentUser.uid !== uid) {
      const pending = state.profileMissing;
      const message = state.error;
      try { await firebaseAuthSDK.signOut(auth); } catch (_) {}
      if (pending) throw new Error('इस ईमेल का स्कूल रोल अभी सेट नहीं है। प्रधानाचार्य से संपर्क करें।');
      throw new Error(message || 'लॉगिन प्रोफ़ाइल नहीं मिली। कृपया Firebase rules/setup जाँचें।');
    }
    return state.currentUser;
  },

  async resetPassword(email) {
    if (!state.configured || !state.firebaseReady) throw new Error('Firebase email/password login अभी configured नहीं है।');
    const value = String(email || '').trim();
    if (!value) throw new Error('पहले अपना ईमेल लिखें।');
    await firebaseAuthSDK.sendPasswordResetEmail(auth, value);
    return true;
  },

  async useDemo(role) {
    if (!VALID_ROLES.includes(role)) role = 'teacher';
    stopRealtime();
    if (auth && firebaseAuthSDK && auth.currentUser) {
      try { await firebaseAuthSDK.signOut(auth); } catch (_) {}
    }
    state.authUser = null;
    state.isDemo = true;
    state.connected = false;
    state.error = '';
    state.profileMissing = false;
    applyDemoData(readDemoData());
    state.currentUser = { uid: `demo-${role}`, name: `Sample ${ROLE_LABELS[role]}`, email: 'sample@example.test', role };
    try { localStorage.setItem(DEMO_ROLE_KEY, role); } catch (_) {}
    emit('auth');
    return state.currentUser;
  },

  async logout() {
    if (state.isDemo) {
      try { localStorage.removeItem(DEMO_ROLE_KEY); } catch (_) {}
      state.isDemo = false;
      state.currentUser = null;
      state.authUser = null;
      state.profileMissing = false;
      resetCloudData();
      emit('auth');
      return;
    }
    if (auth && firebaseAuthSDK) await firebaseAuthSDK.signOut(auth);
    else {
      state.currentUser = null;
      state.authUser = null;
      emit('auth');
    }
  },

  async addStudent(data) {
    assertRole(['teacher', 'principal']);
    const clean = normalizeStudent(data);
    if (state.isDemo) {
      const student = { id: newId('student'), ...clean, createdAt: Date.now(), updatedAt: Date.now() };
      demoWrite('students', () => state.students.unshift(student));
      return student;
    }
    const recordRef = firebaseDbSDK.push(firebaseDbSDK.ref(db, rootPath('students')));
    const student = { id: recordRef.key, ...clean, createdAt: firebaseDbSDK.serverTimestamp(), updatedAt: firebaseDbSDK.serverTimestamp() };
    await firebaseDbSDK.set(recordRef, student);
    return student;
  },

  async updateStudent(id, data) {
    assertRole(['teacher', 'principal']);
    const clean = normalizeStudent(data);
    if (state.isDemo) {
      const old = state.students.find((item) => item.id === id);
      if (!old) throw new Error('विद्यार्थी नहीं मिला।');
      demoWrite('students', () => { Object.assign(old, clean, { updatedAt: Date.now() }); });
      return old;
    }
    await firebaseDbSDK.update(firebaseDbSDK.ref(db, rootPath(`students/${id}`)), {
      ...clean,
      updatedAt: firebaseDbSDK.serverTimestamp()
    });
  },

  async deleteStudent(id) {
    assertRole('principal');
    if (state.isDemo) {
      demoWrite('students', () => { state.students = state.students.filter((item) => item.id !== id); });
      return;
    }
    await firebaseDbSDK.remove(firebaseDbSDK.ref(db, rootPath(`students/${id}`)));
  },

  async bulkImportStudentsCSV(csvText) {
    assertRole(['teacher', 'principal']);
    const rows = arrayFromCSV(csvText);
    if (rows.length < 2) throw new Error('CSV में header और कम से कम एक विद्यार्थी की row होनी चाहिए।');
    const header = rows.shift().map((v) => v.toLowerCase().replace(/[\s_-]/g, ''));
    const aliases = {
      rollno: ['rollno', 'roll', 'रोलनं'],
      srno: ['srno', 'sr', 'admissionno'],
      name: ['name', 'studentname', 'विद्यार्थीकानाम'],
      fathername: ['fathername', 'father', 'पिताकानाम'],
      class: ['class', 'कक्षा'],
      medium: ['medium', 'माध्यम']
    };
    const findIndex = (key, fallback) => {
      const found = header.findIndex((col) => aliases[key].includes(col));
      return found >= 0 ? found : fallback;
    };
    const positions = {
      rollNo: findIndex('rollno', 0), srNo: findIndex('srno', 1), name: findIndex('name', 2),
      fatherName: findIndex('fathername', 3), class: findIndex('class', 4), medium: findIndex('medium', 5)
    };
    const records = rows.map((values) => normalizeStudent({
      rollNo: values[positions.rollNo], srNo: values[positions.srNo], name: values[positions.name],
      fatherName: values[positions.fatherName], class: values[positions.class], medium: values[positions.medium] || 'हिंदी'
    }));
    if (state.isDemo) {
      const created = records.map((record) => ({ id: newId('student'), ...record, createdAt: Date.now(), updatedAt: Date.now() }));
      demoWrite('students', () => { state.students.unshift(...created); });
      return created.length;
    }
    const updates = {};
    for (const record of records) {
      const id = firebaseDbSDK.push(firebaseDbSDK.ref(db, rootPath('students'))).key;
      updates[id] = { id, ...record, createdAt: firebaseDbSDK.serverTimestamp(), updatedAt: firebaseDbSDK.serverTimestamp() };
    }
    await firebaseDbSDK.update(firebaseDbSDK.ref(db, rootPath('students')), updates);
    return records.length;
  },

  async importFeeSheetCSV(csvText) {
    assertRole('principal');
    const rows = arrayFromCSV(csvText);
    if (rows.length < 2) throw new Error('Fee CSV में header और कम से कम एक विद्यार्थी की row होनी चाहिए।');
    const normalizeHeader = (value) => String(value || '').replace(/^\uFEFF/, '').trim().toLocaleLowerCase('en-IN').replace(/[\s_.,;:()₹-]+/g, '');
    const header = rows.shift().map(normalizeHeader);
    const findColumn = (aliases) => {
      const normalized = aliases.map(normalizeHeader);
      const exact = header.findIndex((item) => normalized.includes(item));
      if (exact >= 0) return exact;
      return header.findIndex((item) => normalized.some((alias) => alias.length >= 4 && item.includes(alias)));
    };
    const columns = {
      admissionNo: findColumn(['admissionno', 'admno', 'admissionnumber', 'प्रवेशसं', 'प्रवेशसंख्या']),
      studentName: findColumn(['studentname', 'छात्रकानाम']),
      pickupPoint: findColumn(['pickuppoint', 'पिकअपपॉइंट']),
      schoolFee: findColumn(['schoolfee', 'schoolfees', 'विद्यालयशुल्क']),
      transportFee: findColumn(['annualtransportfee', 'transportfee', 'वार्षिकपरिवहनशुल्क']),
      paidBeforeSoftware: findColumn(['paidbeforesoftware', 'paidbefore', 'softwareपहलेभुगतान']),
      paidCurrent: findColumn(['paid', 'currentpaid', 'paidthissession', 'इससत्रजमा']),
      currentBalance: findColumn(['currentsessionbalance', 'currentsession', 'चालूसत्रशेष'])
    };
    const required = ['admissionNo', 'studentName', 'schoolFee', 'transportFee', 'paidBeforeSoftware', 'paidCurrent', 'currentBalance'];
    const missingHeaders = required.filter((key) => columns[key] < 0);
    if (missingHeaders.length) throw new Error(`CSV में जरूरी column नहीं मिला: ${missingHeaders.join(', ')}. Excel को CSV UTF-8 में save करें और header row पहली row रखें।`);
    if (!state.students.length) throw new Error('पहले Students में roster import करें। Fee sheet का Admission No app के Student SR number से match होना चाहिए।');

    const normalizeId = (value) => String(value || '').trim().normalize('NFKC').toLocaleLowerCase('en-IN');
    const parseMoney = (value, label, rowNumber) => {
      let text = String(value ?? '').trim();
      if (!text || ['-', '—', '–', 'na', 'n/a'].includes(text.toLocaleLowerCase('en-IN'))) return 0;
      text = text.replace(/[₹,\s\u00a0]/g, '').replace(/[−–]/g, '-');
      const parenthesized = /^\(.*\)$/.test(text);
      if (parenthesized) text = `-${text.slice(1, -1)}`;
      if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) throw new Error(`CSV row ${rowNumber}: ${label} की राशि पढ़ नहीं सकी (${value})।`);
      return Number(text);
    };
    const byAdmission = new Map();
    const ambiguous = new Set();
    for (const student of state.students) {
      const key = normalizeId(student.srNo);
      if (!key) continue;
      if (byAdmission.has(key)) ambiguous.add(key);
      else byAdmission.set(key, student);
    }
    const importedAdmissions = new Set();
    const records = [];
    const errors = [];
    const importedAt = Date.now();
    const session = String(state.settings.academicSession || DEFAULT_SETTINGS.academicSession);
    for (let index = 0; index < rows.length; index++) {
      const values = rows[index];
      const rowNumber = index + 2;
      const admissionNo = String(values[columns.admissionNo] || '').trim();
      const studentName = String(values[columns.studentName] || '').trim();
      if (!admissionNo && !studentName) continue;
      if (!admissionNo || !studentName) { errors.push(`row ${rowNumber}: Admission No और Student Name दोनों जरूरी हैं।`); continue; }
      const key = normalizeId(admissionNo);
      if (importedAdmissions.has(key)) { errors.push(`row ${rowNumber}: Admission No ${admissionNo} दो बार आया है।`); continue; }
      importedAdmissions.add(key);
      if (ambiguous.has(key)) { errors.push(`row ${rowNumber}: app में SR number ${admissionNo} duplicate है; पहले student roster ठीक करें।`); continue; }
      const student = byAdmission.get(key);
      if (!student) { errors.push(`row ${rowNumber}: Admission No ${admissionNo} किसी Student SR number से match नहीं हुआ।`); continue; }
      try {
        const schoolFee = parseMoney(values[columns.schoolFee], 'School Fee', rowNumber);
        const annualTransportFee = parseMoney(values[columns.transportFee], 'Annual Transport Fee', rowNumber);
        const paidBeforeSoftware = parseMoney(values[columns.paidBeforeSoftware], 'PAID BEFORE SOFTWARE', rowNumber);
        const paidCurrent = parseMoney(values[columns.paidCurrent], 'PAID', rowNumber);
        const currentBalance = parseMoney(values[columns.currentBalance], 'Current Session Balance', rowNumber);
        if ([schoolFee, annualTransportFee, paidBeforeSoftware, paidCurrent].some((amount) => amount < 0)) throw new Error(`row ${rowNumber}: fee और paid amounts negative नहीं हो सकते।`);
        const calculatedBalance = Math.round((schoolFee + annualTransportFee - paidCurrent) * 100) / 100;
        if (Math.abs(calculatedBalance - currentBalance) > 1) throw new Error(`row ${rowNumber}: sheet balance ₹${currentBalance} है, लेकिन School Fee + Transport Fee − PAID = ₹${calculatedBalance} होना चाहिए।`);
        const pickupPoint = columns.pickupPoint >= 0 ? String(values[columns.pickupPoint] || '').trim() : '';
        records.push({ student, feeProfile: {
          admissionNo, session, pickupPoint, schoolFee, annualTransportFee,
          paidBeforeSoftware, paidCurrent, currentBalance,
          importedAt, importedByUid: state.currentUser.uid, importedByName: state.currentUser.name
        } });
      } catch (error) {
        errors.push(error.message || `row ${rowNumber}: data जाँच में समस्या।`);
      }
    }
    if (errors.length) throw new Error(`Fee import रोक दिया गया—कोई data नहीं बदला। ${errors.slice(0, 5).join(' · ')}${errors.length > 5 ? ` · और ${errors.length - 5} errors` : ''}`);
    if (!records.length) throw new Error('CSV में import करने के लिए कोई विद्यार्थी नहीं मिला।');
    if (state.isDemo) {
      demoWrite('students', () => records.forEach(({ student, feeProfile }) => { student.feeProfile = feeProfile; student.updatedAt = importedAt; }));
      return records.length;
    }
    const updates = {};
    for (const { student, feeProfile } of records) {
      const path = rootPath(`students/${student.id}`);
      updates[`${path}/feeProfile`] = feeProfile;
      updates[`${path}/updatedAt`] = firebaseDbSDK.serverTimestamp();
    }
    await firebaseDbSDK.update(firebaseDbSDK.ref(db), updates);
    return records.length;
  },

  calculateStudentResult(scores, subjects) {
    const list = Array.isArray(subjects) ? subjects : [];
    const totalMax = list.reduce((sum, subject) => sum + Math.max(0, Number(subject.max) || 0), 0);
    const totalMarks = list.reduce((sum, subject) => {
      const value = Math.max(0, Number(scores?.[subject.name]) || 0);
      return sum + Math.min(value, Number(subject.max) || 0);
    }, 0);
    const percentage = totalMax ? Math.round((totalMarks / totalMax) * 10000) / 100 : 0;
    const isPass = list.length > 0 && list.every((subject) => {
      const max = Math.max(1, Number(subject.max) || 1);
      return (Number(scores?.[subject.name]) || 0) >= Math.ceil(max * 0.33);
    });
    const grade = percentage >= 90 ? 'A+' : percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : percentage >= 45 ? 'D' : percentage >= 33 ? 'E' : 'F';
    return { totalMarks, totalMax, percentage, grade, isPass };
  },

  rankStudents(results) {
    const ordered = [...results].sort((a, b) => (Number(b.totalMarks) || 0) - (Number(a.totalMarks) || 0));
    let lastTotal = null;
    let lastRank = 0;
    ordered.forEach((item, index) => {
      const total = Number(item.totalMarks) || 0;
      if (total !== lastTotal) lastRank = index + 1;
      item.rank = lastRank;
      lastTotal = total;
    });
    return results;
  },

  async saveResult(result) {
    assertRole(['teacher', 'principal']);
    const studentsData = Array.isArray(result.studentsData) ? result.studentsData : [];
    if (!studentsData.length) throw new Error('सहेजने के लिए विद्यार्थी नहीं हैं।');
    const passCount = studentsData.filter((student) => student.isPass).length;
    const sorted = [...studentsData].sort((a, b) => Number(b.percentage) - Number(a.percentage));
    const record = {
      ...result,
      id: state.isDemo ? newId('result') : undefined,
      title: String(result.title || 'परीक्षा परिणाम').trim(),
      totalStudents: studentsData.length,
      passCount,
      failCount: studentsData.length - passCount,
      topper: sorted[0] || null,
      publishedBy: state.currentUser.name,
      publishedByUid: state.currentUser.uid,
      date: result.date || new Date().toISOString().slice(0, 10),
      createdAt: Date.now()
    };
    if (state.isDemo) {
      demoWrite('results', () => state.results.unshift(record));
      return record;
    }
    const recordRef = firebaseDbSDK.push(firebaseDbSDK.ref(db, rootPath('results')));
    record.id = recordRef.key;
    record.createdAt = firebaseDbSDK.serverTimestamp();
    await firebaseDbSDK.set(recordRef, record);
    return record;
  },

  async submitFeeRequest(data) {
    assertRole(['teacher', 'principal']);
    const amount = Number(data.amount);
    const studentName = String(data.studentName || data.name || '').trim();
    if (!data.studentId || !studentName || !Number.isFinite(amount) || amount <= 0) throw new Error('विद्यार्थी और सही राशि दर्ज करें।');
    const request = {
      studentId: String(data.studentId),
      studentName,
      fatherName: String(data.fatherName || ''),
      class: String(data.class || ''),
      medium: String(data.medium || ''),
      amount,
      date: String(data.date || new Date().toISOString().slice(0, 10)),
      note: String(data.note || '').trim(),
      status: 'Pending',
      submittedBy: state.currentUser.name,
      submittedByUid: state.currentUser.uid,
      createdAt: Date.now()
    };
    if (state.isDemo) {
      request.id = newId('fee');
      demoWrite('feeRequests', () => state.feeRequests.unshift(request));
      return request;
    }
    const recordRef = firebaseDbSDK.push(firebaseDbSDK.ref(db, rootPath('feeRequests')));
    request.id = recordRef.key;
    request.createdAt = firebaseDbSDK.serverTimestamp();
    await firebaseDbSDK.set(recordRef, request);
    return request;
  },

  async processFeeRequest(id, decision, comment = '') {
    assertRole(['operator', 'principal']);
    const request = state.feeRequests.find((item) => item.id === id);
    if (!request || request.status !== 'Pending') throw new Error('यह अनुरोध पहले ही संसाधित हो चुका है या उपलब्ध नहीं है।');
    const approved = decision === 'approve';
    const processed = {
      ...request,
      status: approved ? 'Approved' : 'Rejected',
      comment: String(comment || '').trim(),
      approvedBy: state.currentUser.name,
      approvedByUid: state.currentUser.uid,
      processedAt: Date.now()
    };
    if (state.isDemo) {
      demoWrite('feeRequests', () => {
        const index = state.feeRequests.findIndex((item) => item.id === id);
        if (index >= 0) state.feeRequests[index] = processed;
        if (approved) state.feeLedger.unshift({
          id, requestId: id, studentId: request.studentId, studentName: request.studentName, class: request.class, medium: request.medium,
          session: state.settings.academicSession, amount: Number(request.amount), date: request.date, approvedBy: state.currentUser.name,
          approvedByUid: state.currentUser.uid, createdAt: Date.now()
        });
      });
      emit('feeLedger');
      return processed;
    }
    const patch = {};
    patch[`${rootPath(`feeRequests/${id}`)}/status`] = approved ? 'Approved' : 'Rejected';
    patch[`${rootPath(`feeRequests/${id}`)}/comment`] = processed.comment;
    patch[`${rootPath(`feeRequests/${id}`)}/approvedBy`] = processed.approvedBy;
    patch[`${rootPath(`feeRequests/${id}`)}/approvedByUid`] = processed.approvedByUid;
    patch[`${rootPath(`feeRequests/${id}`)}/processedAt`] = firebaseDbSDK.serverTimestamp();
    if (approved) {
      patch[rootPath(`feeLedger/${id}`)] = {
        id,
        requestId: id,
        studentId: request.studentId,
        studentName: request.studentName,
        class: request.class,
        medium: request.medium,
        session: state.settings.academicSession,
        amount: Number(request.amount),
        date: request.date,
        approvedBy: state.currentUser.name,
        approvedByUid: state.currentUser.uid,
        createdAt: firebaseDbSDK.serverTimestamp()
      };
    }
    await firebaseDbSDK.update(firebaseDbSDK.ref(db), patch);
    return processed;
  },

  async sendNotification(data) {
    assertRole('principal');
    const title = String(data.title || '').trim();
    const message = String(data.message || '').trim();
    if (!title || !message) throw new Error('नोटिस का शीर्षक और संदेश जरूरी है।');
    const notice = {
      title, message,
      sender: state.currentUser.name,
      senderUid: state.currentUser.uid,
      createdAt: Date.now()
    };
    if (state.isDemo) {
      notice.id = newId('notice');
      demoWrite('notices', () => state.notices.unshift(notice));
      return notice;
    }
    const recordRef = firebaseDbSDK.push(firebaseDbSDK.ref(db, rootPath('notices')));
    notice.id = recordRef.key;
    notice.createdAt = firebaseDbSDK.serverTimestamp();
    await firebaseDbSDK.set(recordRef, notice);
    return notice;
  },

  async saveSettings(updated) {
    assertRole('principal');
    const next = { ...state.settings, ...updated };
    next.classes = Array.isArray(next.classes) ? next.classes.map((item) => String(item).trim()).filter(Boolean) : [];
    if (!next.classes.length) throw new Error('कम से कम एक कक्षा दर्ज करें।');
    if (state.isDemo) {
      demoWrite('settings', () => { state.settings = next; });
      return next;
    }
    await firebaseDbSDK.set(firebaseDbSDK.ref(db, rootPath('settings')), next);
    return next;
  },

  async addUser(data) {
    assertRole('principal');
    const name = String(data.name || '').trim();
    const email = String(data.email || '').trim().toLowerCase();
    const password = String(data.password || '');
    const role = String(data.role || 'teacher');
    if (!name || !email || !email.includes('@')) throw new Error('नाम और मान्य ईमेल दर्ज करें।');
    if (!['teacher', 'operator'].includes(role)) throw new Error('यहाँ केवल शिक्षक या ऑपरेटर का खाता बनाया जा सकता है।');
    if (password.length < 6) throw new Error('पासवर्ड कम से कम 6 अक्षरों का रखें।');
    if (state.isDemo) {
      const user = { uid: newId('demo-user'), name, email, role, createdAt: Date.now() };
      demoWrite('users', () => state.users.unshift(user));
      return user;
    }
    if (!state.firebaseReady) throw new Error('Firebase Auth तैयार नहीं है।');
    let secondaryApp = null;
    let secondaryAuth = null;
    let createdUid = '';
    try {
      secondaryApp = firebaseAppSDK.initializeApp(firebaseConfig, `staff-create-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
      secondaryAuth = firebaseAuthSDK.getAuth(secondaryApp);
      await firebaseAuthSDK.setPersistence(secondaryAuth, firebaseAuthSDK.inMemoryPersistence);
      const credential = await firebaseAuthSDK.createUserWithEmailAndPassword(secondaryAuth, email, password);
      createdUid = credential.user.uid;
      await firebaseAuthSDK.signOut(secondaryAuth);
      const user = { uid: createdUid, name, email, role, createdAt: Date.now() };
      await firebaseDbSDK.set(firebaseDbSDK.ref(db, rootPath(`users/${createdUid}`)), {
        name, email, role, createdAt: firebaseDbSDK.serverTimestamp()
      });
      return user;
    } catch (error) {
      if (createdUid) {
        throw new Error(`Firebase में login account बन गया, लेकिन role profile save नहीं हो सकी। Principal profile/rules जाँचें; जरूरत पड़े तो Firebase Console में अधूरा account हटाएँ। ${error?.message || ''}`.trim());
      }
      throw error;
    } finally {
      if (secondaryApp && firebaseAppSDK) {
        try { await firebaseAppSDK.deleteApp(secondaryApp); } catch (_) {}
      }
    }
  },

  async resetStaffPassword(email) {
    assertRole('principal');
    if (state.isDemo) return true;
    if (!state.firebaseReady) throw new Error('Firebase Auth तैयार नहीं है।');
    await firebaseAuthSDK.sendPasswordResetEmail(auth, String(email || '').trim());
    return true;
  },

  buildBackup() {
    assertRole('principal');
    return {
      app: 'ShalaSetu',
      schoolId: appSettings.schoolId,
      backupDate: new Date().toISOString(),
      settings: state.settings,
      students: state.students,
      results: state.results,
      feeRequests: state.feeRequests,
      feeLedger: state.feeLedger,
      notices: state.notices
    };
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (!state.isDemo || event.key !== DEMO_DATA_KEY) return;
    applyDemoData(readDemoData());
    emit('sync');
  });
}

export { Shala, ROLE_LABELS, DEFAULT_SETTINGS, VALID_ROLES };
