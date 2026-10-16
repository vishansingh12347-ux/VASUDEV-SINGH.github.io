import { Shala, ROLE_LABELS } from './app-core.js';

const root = document.getElementById('app');
const page = document.body.dataset.page === 'principal' ? 'principal' : 'staff';
const validTabs = page === 'principal'
  ? ['overview', 'students', 'fees', 'notices', 'staff', 'settings']
  : ['students', 'results', 'fees', 'notices'];
let activeTab = validTabs.includes(location.hash.slice(1)) ? location.hash.slice(1) : (page === 'principal' ? 'overview' : 'students');
let modal = null;
let toastTimer = 0;
let studentSearch = '';
let studentClassFilter = '';
let feeSearch = '';
let feeClassFilter = '';
let feeRouteFilter = '';
let feeView = 'students';
let resultDraft = null;
let resultSubjectClass = '';
let isBusy = false;

const money = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(value) || 0);
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const escapeAttr = escapeHTML;
const currentDate = () => { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 10); };
const niceDate = (value, includeTime = false) => {
  if (!value) return '—';
  let date;
  if (typeof value === 'number') date = new Date(value);
  else if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) date = new Date(`${value}T00:00:00`);
  else date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', includeTime ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};
const initials = (name) => String(name || 'S').trim().slice(0, 1).toUpperCase();
const selected = (value, expected) => String(value ?? '') === String(expected ?? '') ? 'selected' : '';
const disabled = (condition) => condition ? 'disabled' : '';

function toast(message, kind = '') {
  let element = document.getElementById('global-toast');
  if (!element) {
    element = document.createElement('div');
    element.id = 'global-toast';
    document.body.appendChild(element);
  }
  element.className = `toast ${kind}`.trim();
  element.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.remove(), 3800);
}

function connectionStatus() {
  if (Shala.isDemo) return { text: 'DEMO · इस ब्राउज़र में', css: 'demo' };
  if (Shala.error && !Shala.connected) return { text: 'Sync error', css: 'error' };
  if (Shala.connected) return { text: 'Live sync · connected', css: '' };
  if (Shala.currentUser) return { text: 'Connecting to live sync…', css: 'offline' };
  if (Shala.configured) return { text: 'Cloud ready · sign in', css: 'offline' };
  return { text: 'Firebase setup needed', css: 'offline' };
}

function roleName(role) { return ROLE_LABELS[role] || 'School staff'; }
function isPrincipal() { return Shala.currentUser?.role === 'principal'; }
function canEditStudents() { return ['teacher', 'principal'].includes(Shala.currentUser?.role); }

function renderLogin() {
  const configured = Shala.configured && Shala.firebaseReady;
  const roleMissing = Shala.profileMissing;
  const setup = !Shala.configured
    ? `<div class="notice-box warn"><strong>Cloud connection is not set up yet.</strong><br>Fill in <code>firebase-config.js</code>, create the free Firebase project, and follow <a class="inline-link" href="./README.md">the setup guide</a>. Until then, use the clearly marked local sample below.</div>`
    : Shala.error
      ? `<div class="notice-box error"><strong>Firebase setup needs attention.</strong><br>${escapeHTML(Shala.error)}</div>`
      : `<div class="notice-box success"><strong>Cloud login is ready.</strong><br>Sign in with the email and password created in Firebase Authentication.</div>`;
  const accountNotice = roleMissing
    ? `<div class="notice-box warn" style="margin-bottom:14px"><strong>Account not assigned to this school.</strong><br>The login exists, but it has no school role profile. Ask the principal to add/approve it, then sign in again. <button class="inline-link" data-action="logout">Sign out</button></div>`
    : '';
  return `
    <main class="login-view">
      <section class="login-copy">
        <div class="brand-lockup"><div class="brand-mark">SS</div><div><div class="brand-word">शाला-सेतु <span class="muted">/ ShalaSetu</span></div><div class="brand-caption">Shared school workspace · Staff app + principal dashboard</div></div></div>
        <div class="eyebrow" style="margin-top:38px">School operations, together</div>
        <h1>एक स्कूल। एक डेटा। सबके लिए एक ही लाइव अपडेट।</h1>
        <p>विद्यार्थी सूची, परीक्षा परिणाम, फीस अनुरोध और स्कूल नोटिस—शिक्षक ऐप और प्रधानाचार्य डैशबोर्ड एक ही सुरक्षित डेटा से sync होते हैं।</p>
        <ul class="feature-list">
          <li><span class="feature-check">✓</span><span>ईमेल + पासवर्ड से Firebase Authentication लॉगिन</span></li>
          <li><span class="feature-check">✓</span><span>Teacher, Operator और Principal के अलग अधिकार</span></li>
          <li><span class="feature-check">✓</span><span>फोन/कंप्यूटर पर install होने वाला PWA</span></li>
          <li><span class="feature-check">✓</span><span>CSV export—Google Sheets में खोलें</span></li>
        </ul>
      </section>
      <section class="login-card">
        <div class="brand-lockup"><div class="brand-mark">SS</div><div><div class="brand-word">Staff sign in</div><div class="brand-caption">शिक्षक / ऑपरेटर / प्रधानाचार्य</div></div></div>
        <h2>${roleMissing ? 'School role required' : 'अपने स्कूल खाते से लॉगिन करें'}</h2>
        <p class="muted small">पासवर्ड Firebase संभालता है; ऐप में password की सूची सेव नहीं होती।</p>
        ${accountNotice}
        <form data-form="login" class="section-stack">
          <div class="field"><label for="login-email">ईमेल / Email</label><input id="login-email" class="control" name="email" type="email" autocomplete="username" placeholder="name@school.in" required ${disabled(!configured)}></div>
          <div class="field"><label for="login-password">पासवर्ड / Password</label><input id="login-password" class="control" name="password" type="password" autocomplete="current-password" placeholder="अपना पासवर्ड दर्ज करें" required ${disabled(!configured)}></div>
          <button class="btn btn-primary wide" type="submit" ${disabled(!configured || isBusy)}>${isBusy ? 'जाँच हो रही है…' : 'सुरक्षित लॉगिन करें →'}</button>
          <button class="btn btn-secondary wide" type="button" data-action="forgot-password" ${disabled(!configured)}>पासवर्ड भूल गए? Reset email भेजें</button>
        </form>
        <div style="margin-top:16px">${setup}</div>
        <div class="login-divider">केवल स्क्रीन का नमूना देखने के लिए</div>
        <div class="demo-grid">
          <button class="btn btn-dark" data-action="demo-login" data-role="principal">Principal demo</button>
          <button class="btn btn-secondary" data-action="demo-login" data-role="teacher">Teacher demo</button>
          <button class="btn btn-secondary" data-action="demo-login" data-role="operator">Operator demo</button>
        </div>
        <div class="fine-print">Demo में दिया गया डेटा नमूना है, इस डिवाइस के browser storage में ही रहता है—वह live cloud sync या असली login नहीं है। असली विद्यार्थियों का डेटा demo में न डालें।</div>
      </section>
    </main>`;
}

const staffTabs = [
  ['students', '👨‍🎓', 'विद्यार्थी'],
  ['results', '📝', 'परिणाम'],
  ['fees', '₹', 'फीस कार्यप्रवाह'],
  ['notices', '📢', 'नोटिस']
];
const principalTabs = [
  ['overview', '▦', 'Overview'],
  ['students', '👨‍🎓', 'विद्यार्थी'],
  ['fees', '₹', 'Fees & ledger'],
  ['notices', '📢', 'Notices'],
  ['staff', '👥', 'Staff accounts'],
  ['settings', '⚙', 'School settings']
];

function renderShell() {
  const status = connectionStatus();
  const tabs = page === 'principal' ? principalTabs : staffTabs;
  const appHref = page === 'principal' ? './index.html' : './dashboard.html';
  const appText = page === 'principal' ? '📱 Staff app' : '▦ Principal dashboard';
  const canOpenPrincipal = isPrincipal();
  const dataPage = page === 'principal' && !canOpenPrincipal
    ? `<main class="page-wrap"><section class="card card-pad denied-card"><div class="empty-icon">🔒</div><h1>Principal access only</h1><p class="muted">इस dashboard के लिए प्रधानाचार्य की अनुमति चाहिए। Principal account से लॉगिन करें।</p><a class="btn btn-primary" href="./index.html">Staff app खोलें</a></section></main>`
    : `<main class="page-wrap">${page === 'principal' ? renderPrincipalTab() : renderStaffTab()}<div class="footer-note">शाला-सेतु · Shared live school workspace · CSV backups नियमित रूप से रखें</div></main>`;
  return `
    <header class="topbar"><div class="topbar-inner">
      <a class="brand" href="./index.html"><div class="brand-mark">SS</div><div><div class="brand-word">शाला-सेतु <span style="color:#b9c8dc;font-weight:600">/ ShalaSetu</span></div><div class="brand-caption">${escapeHTML(Shala.settings.schoolName || 'School management workspace')}</div></div></a>
      <div class="topbar-right">
        <span class="sync-pill ${status.css}" title="${escapeAttr(status.text)}"><i class="sync-dot"></i>${escapeHTML(status.text)}</span>
        <div class="user-badge"><div class="avatar">${escapeHTML(initials(Shala.currentUser.name))}</div><div><div class="user-name">${escapeHTML(Shala.currentUser.name)}</div><div class="user-role">${escapeHTML(roleName(Shala.currentUser.role))}${Shala.isDemo ? ' · Demo' : ''}</div></div></div>
        <a class="btn btn-ghost btn-sm" href="${appHref}" ${page === 'staff' && !canOpenPrincipal ? 'style="display:none"' : ''}>${appText}</a>
        <button class="btn btn-ghost btn-sm" data-action="logout">लॉगआउट</button>
      </div>
    </div></header>
    ${!(page === 'principal' && !canOpenPrincipal) ? `<nav class="nav-strip"><div class="nav-inner">${tabs.map(([id, icon, label]) => `<button class="nav-link ${activeTab === id ? 'active' : ''}" data-tab="${id}"><span>${icon}</span>${label}</button>`).join('')}</div></nav>` : ''}
    ${dataPage}
    ${modal ? renderModal() : ''}`;
}

function pageHeading(title, subtitle, actions = '') {
  return `<div class="page-header"><div><div class="eyebrow-small">${page === 'principal' ? 'PRINCIPAL CONTROL DESK' : 'SCHOOL STAFF APP'}</div><h1>${title}</h1><p>${subtitle}</p></div><div class="page-actions">${actions}</div></div>`;
}

function demoBanner() {
  return Shala.isDemo ? `<div class="demo-banner">DEMO MODE — local browser data only. This is not a real school login and does not sync to Firebase or other devices.</div>` : '';
}

function classOptions(value = '') {
  const classes = Shala.settings.classes?.length ? Shala.settings.classes : ['5th', '8th', '10th'];
  return classes.map((item) => `<option value="${escapeAttr(item)}" ${selected(item, value)}>${escapeHTML(item)}</option>`).join('');
}

function studentRows(list = null) {
  const students = list || filteredStudents();
  if (!students.length) return `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🎒</div><h3>अभी कोई विद्यार्थी नहीं मिला</h3><p>Search/filter बदलें या अधिकृत खाते से विद्यार्थी जोड़ें।</p></div></td></tr>`;
  return students.map((student) => `
    <tr>
      <td class="primary-cell">${escapeHTML(student.rollNo || '—')}</td>
      <td>${escapeHTML(student.srNo || '—')}</td>
      <td><div class="primary-cell">${escapeHTML(student.name)}</div><div class="small muted">${escapeHTML(student.fatherName || '')}</div></td>
      <td><span class="badge blue">${escapeHTML(student.class)}</span></td>
      <td>${escapeHTML(student.medium || '—')}</td>
      <td class="small">${escapeHTML(student.updatedAt ? niceDate(student.updatedAt) : student.createdAt ? niceDate(student.createdAt) : '—')}</td>
      <td><div class="table-actions">${canEditStudents() ? `<button class="icon-btn" title="Edit" data-action="edit-student" data-id="${escapeAttr(student.id)}">✎</button>` : ''}${isPrincipal() ? `<button class="icon-btn" title="Delete" data-action="delete-student" data-id="${escapeAttr(student.id)}">×</button>` : ''}</div></td>
    </tr>`).join('');
}

function filteredStudents() {
  const q = studentSearch.toLocaleLowerCase();
  return [...Shala.students]
    .filter((student) => !studentClassFilter || student.class === studentClassFilter)
    .filter((student) => !q || [student.name, student.fatherName, student.rollNo, student.srNo, student.class].some((value) => String(value || '').toLocaleLowerCase().includes(q)))
    .sort((a, b) => String(a.class).localeCompare(String(b.class), undefined, { numeric: true }) || String(a.rollNo).localeCompare(String(b.rollNo), undefined, { numeric: true }));
}

function studentsPanel() {
  const actions = `${canEditStudents() ? `<button class="btn btn-primary" data-action="open-add-student">＋ नया विद्यार्थी</button><button class="btn btn-secondary" data-action="open-import">CSV Import</button>` : ''}<button class="btn btn-secondary" data-action="export-students">CSV Export</button>`;
  return `${pageHeading('विद्यार्थी सूची', 'एक साझा master list—यहाँ बदलाव शिक्षक ऐप और प्रधानाचार्य dashboard दोनों में दिखेंगे।', actions)}${demoBanner()}
    <section class="card"><div class="card-header"><div><h2>Student master list</h2><p>${Shala.students.length} विद्यार्थी · search, class filter और CSV export</p></div><span class="badge blue">Live records</span></div>
      <div class="card-body"><div class="toolbar" style="margin-bottom:14px"><div class="search-control"><span class="search-icon">⌕</span><input class="control" id="student-search" value="${escapeAttr(studentSearch)}" placeholder="नाम, पिता, रोल या SR नंबर खोजें"></div><div class="field"><select id="student-class-filter" class="control"><option value="">सभी कक्षाएं</option>${classOptions(studentClassFilter)}</select></div></div>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Roll</th><th>SR No.</th><th>विद्यार्थी / पिता</th><th>कक्षा</th><th>माध्यम</th><th>Updated</th><th></th></tr></thead><tbody id="students-table-body">${studentRows()}</tbody></table></div>
      </div>
    </section>`;
}

function ensureResultDraft() {
  const classes = Shala.settings.classes?.length ? Shala.settings.classes : ['5th', '8th', '10th'];
  const defaultClass = classes.includes(resultDraft?.class) ? resultDraft.class : classes[0];
  if (!resultDraft || resultDraft.class !== defaultClass) {
    resultDraft = {
      title: resultDraft?.title || `अर्धवार्षिक परीक्षा ${Shala.settings.academicSession}`,
      class: defaultClass,
      medium: resultDraft?.medium || 'हिंदी',
      subjects: structuredClone(Shala.settings.subjectsByClass?.[defaultClass] || [
        { name: 'हिंदी', max: 100 }, { name: 'English', max: 100 }, { name: 'गणित', max: 100 }, { name: 'विज्ञान', max: 100 }
      ]),
      marks: {}
    };
    resultSubjectClass = defaultClass;
  }
  if (resultSubjectClass !== resultDraft.class) {
    resultDraft.subjects = structuredClone(Shala.settings.subjectsByClass?.[resultDraft.class] || [
      { name: 'हिंदी', max: 100 }, { name: 'English', max: 100 }, { name: 'गणित', max: 100 }, { name: 'विज्ञान', max: 100 }
    ]);
    resultDraft.marks = {};
    resultSubjectClass = resultDraft.class;
  }
  return resultDraft;
}

function studentsForResult() {
  const draft = ensureResultDraft();
  return Shala.students.filter((student) => student.class === draft.class && (student.medium || 'हिंदी') === draft.medium)
    .sort((a, b) => String(a.rollNo).localeCompare(String(b.rollNo), undefined, { numeric: true }));
}

function resultDataForDraft() {
  const draft = ensureResultDraft();
  const students = studentsForResult();
  const rows = students.map((student) => {
    const marks = {};
    for (const subject of draft.subjects) marks[subject.name] = Number(draft.marks?.[student.id]?.[subject.name] ?? 0) || 0;
    return {
      studentId: student.id, rollNo: student.rollNo || '', srNo: student.srNo || '', name: student.name,
      fatherName: student.fatherName || '', marks, ...Shala.calculateStudentResult(marks, draft.subjects)
    };
  });
  return Shala.rankStudents(rows);
}

function resultGridRows() {
  const draft = ensureResultDraft();
  const students = studentsForResult();
  const computed = resultDataForDraft();
  if (!students.length) return `<tr><td colspan="${draft.subjects.length + 8}"><div class="empty-state"><div class="empty-icon">📝</div><h3>इस कक्षा और माध्यम में कोई विद्यार्थी नहीं है</h3><p>पहले विद्यार्थी सूची में छात्र जोड़ें या सही filter चुनें।</p></div></td></tr>`;
  return students.map((student, index) => {
    const result = computed[index];
    const marksCells = draft.subjects.map((subject) => {
      const value = draft.marks?.[student.id]?.[subject.name] ?? '';
      return `<td><input class="control marks-input" type="number" min="0" max="${Number(subject.max) || 100}" step="1" inputmode="numeric" data-mark="1" data-student-id="${escapeAttr(student.id)}" data-subject="${escapeAttr(subject.name)}" value="${escapeAttr(value)}" aria-label="${escapeAttr(student.name)} ${escapeAttr(subject.name)}" placeholder="—"></td>`;
    }).join('');
    return `<tr id="result-row-${escapeAttr(student.id)}"><td class="primary-cell">${escapeHTML(student.rollNo || index + 1)}</td><td>${escapeHTML(student.srNo || '—')}</td><td class="primary-cell">${escapeHTML(student.name)}</td>${marksCells}<td class="cell-total numeric primary-cell">${result.totalMarks}/${result.totalMax}</td><td class="cell-percent numeric">${result.percentage}%</td><td class="cell-grade"><span class="badge ${result.isPass ? 'green' : 'red'}">${result.grade}</span></td><td class="cell-rank">${result.rank}</td></tr>`;
  }).join('');
}

function resultArchiveItems() {
  if (!Shala.results.length) return `<div class="empty-state"><div class="empty-icon">📚</div><h3>अभी कोई परिणाम प्रकाशित नहीं है</h3><p>पहला परिणाम बनाकर प्रकाशित करें।</p></div>`;
  return `<div class="result-list">${Shala.results.slice(0, 12).map((result) => `
    <article class="result-item"><div class="toolbar" style="justify-content:space-between"><div class="result-item-title">${escapeHTML(result.title || 'परीक्षा परिणाम')} <span class="badge blue">Class ${escapeHTML(result.class || '—')}</span> <span class="badge">${escapeHTML(result.medium || '—')}</span></div><span class="small muted">${escapeHTML(niceDate(result.date || result.createdAt))}</span></div>
      <div class="result-summary"><span class="badge">${Number(result.totalStudents) || 0} विद्यार्थी</span><span class="badge green">${Number(result.passCount) || 0} pass</span><span class="badge red">${Number(result.failCount) || 0} need review</span><span class="badge amber">Topper: ${escapeHTML(result.topper?.name || '—')} ${result.topper?.percentage != null ? `· ${escapeHTML(result.topper.percentage)}%` : ''}</span></div>
      <div class="result-item-meta"><span>Published by ${escapeHTML(result.publishedBy || 'School staff')}</span><div class="toolbar"><button class="btn btn-secondary btn-sm" data-action="download-result-csv" data-id="${escapeAttr(result.id)}">CSV</button><button class="btn btn-secondary btn-sm" data-action="print-result" data-id="${escapeAttr(result.id)}">Print / PDF</button></div></div>
    </article>`).join('')}</div>`;
}

function resultsPanel() {
  ensureResultDraft();
  const draft = resultDraft;
  const subjects = draft.subjects.map((subject, index) => `<span class="badge blue" style="padding:7px 9px">${escapeHTML(subject.name)} · max ${Number(subject.max) || 100}<button class="icon-btn" style="height:22px;width:22px;margin-left:4px" data-action="edit-subject-max" data-index="${index}" title="Change maximum marks" aria-label="Change max marks for ${escapeAttr(subject.name)}">✎</button><button class="icon-btn" style="height:22px;width:22px;margin-left:2px" data-action="remove-subject" data-index="${index}" aria-label="Remove subject">×</button></span>`).join('');
  const students = studentsForResult();
  return `${pageHeading('परीक्षा परिणाम', 'अंक भरें—कुल, प्रतिशत, grade और rank स्वतः गणना होंगे। Publish के बाद principal dashboard पर भी दिखेगा।')}${demoBanner()}
    <div class="section-stack">
      <section class="card"><div class="card-header"><div><h2>नया परिणाम बनाएं</h2><p>एक बार में चुनी हुई कक्षा और माध्यम के सभी विद्यार्थियों के अंक दर्ज करें।</p></div><span class="badge blue">${students.length} students</span></div>
        <div class="card-body">
          <div class="form-grid three" style="margin-bottom:17px">
            <div class="field"><label for="result-class">कक्षा / Class</label><select id="result-class" class="control">${classOptions(draft.class)}</select></div>
            <div class="field"><label for="result-medium">माध्यम / Medium</label><select id="result-medium" class="control"><option value="हिंदी" ${selected(draft.medium, 'हिंदी')}>हिंदी</option><option value="English" ${selected(draft.medium, 'English')}>English</option></select></div>
            <div class="field"><label for="result-title">परीक्षा का नाम</label><input id="result-title" class="control" value="${escapeAttr(draft.title)}" placeholder="वार्षिक परीक्षा 2026-27"></div>
          </div>
          <div class="toolbar" style="justify-content:space-between;margin-bottom:12px"><div class="toolbar"><span class="small muted" style="font-weight:800">विषय और पूर्णांक / Subject max marks:</span>${subjects}<span class="small muted">✎ से max बदलें</span></div><button class="btn btn-secondary btn-sm" data-action="add-subject">＋ विषय जोड़ें</button></div>
          <div class="table-wrap result-grid-wrap"><table class="data-table marks-table"><thead><tr><th>Roll</th><th>SR</th><th>विद्यार्थी</th>${draft.subjects.map((subject) => `<th>${escapeHTML(subject.name)}<br><span class="muted">max ${Number(subject.max) || 100}</span></th>`).join('')}<th>Total</th><th>%</th><th>Grade</th><th>Rank</th></tr></thead><tbody id="result-grid-body">${resultGridRows()}</tbody></table></div>
          <div class="toolbar" style="justify-content:space-between;margin-top:14px"><div class="summary-strip"><span class="summary-chip">Pass <b id="result-pass">0</b></span><span class="summary-chip">Review <b id="result-fail">0</b></span><span class="summary-chip">Class average <b id="result-average">0%</b></span><span class="summary-chip">Topper <b id="result-topper">—</b></span></div><button class="btn btn-primary" data-action="save-result" ${disabled(!canEditStudents())}>Publish result →</button></div>
          ${!canEditStudents() ? `<p class="field-hint" style="margin-top:10px">केवल शिक्षक या प्रधानाचार्य परिणाम बना/प्रकाशित कर सकते हैं।</p>` : ''}
        </div>
      </section>
      <section class="card"><div class="card-header"><div><h2>प्रकाशित परिणाम / Archive</h2><p>Teacher app और principal dashboard में साझा archive।</p></div><span class="badge">${Shala.results.length} saved</span></div><div class="card-body">${resultArchiveItems()}</div></section>
    </div>`;
}

function feeRequestCards({ dashboard = false } = {}) {
  const pending = Shala.feeRequests.filter((request) => request.status === 'Pending');
  if (!pending.length) return `<div class="empty-state"><div class="empty-icon">✓</div><h3>कोई pending fee request नहीं</h3><p>नई request आने पर यहाँ दिखाई देगी।</p></div>`;
  return `<div class="queue-list">${pending.map((request) => `
    <article class="queue-item"><div class="queue-item-info"><div class="queue-item-title">${escapeHTML(request.studentName)} <span class="badge blue">${escapeHTML(request.class)} · ${escapeHTML(request.medium)}</span> <span class="currency">₹${money(request.amount)}</span></div><div class="queue-item-meta">पिता: ${escapeHTML(request.fatherName || '—')} · ${escapeHTML(niceDate(request.date))}${request.note ? ` · ${escapeHTML(request.note)}` : ''}<br>Submitted by ${escapeHTML(request.submittedBy || 'Teacher')}</div></div>
      ${['principal', 'operator'].includes(Shala.currentUser?.role) ? `<div class="queue-actions"><button class="btn btn-success btn-sm" data-action="process-fee" data-id="${escapeAttr(request.id)}" data-decision="approve">✓ Approve</button><button class="btn btn-danger btn-sm" data-action="process-fee" data-id="${escapeAttr(request.id)}" data-decision="reject">Reject</button></div>` : `<span class="badge amber">Awaiting approval</span>`}
    </article>`).join('')}</div>`;
}

function feeLedgerTable() {
  if (!Shala.feeLedger.length) return `<div class="empty-state"><div class="empty-icon">₹</div><h3>अभी ledger खाली है</h3><p>Approved fee requests यहाँ रिकॉर्ड होंगी।</p></div>`;
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>दिनांक</th><th>विद्यार्थी</th><th>कक्षा</th><th class="right">राशि</th><th>Approved by</th></tr></thead><tbody>${Shala.feeLedger.map((record) => `<tr><td>${escapeHTML(niceDate(record.date || record.createdAt))}</td><td class="primary-cell">${escapeHTML(record.studentName)}</td><td>${escapeHTML(record.class || '—')} · ${escapeHTML(record.medium || '—')}</td><td class="numeric currency">₹${money(record.amount)}</td><td>${escapeHTML(record.approvedBy || '—')}</td></tr>`).join('')}</tbody></table></div>`;
}

function feeProfileImportPanel() {
  if (!isPrincipal()) return '';
  return `<section class="card"><div class="card-header"><div><h2>विद्यार्थी फीस CSV Import</h2><p>Excel से fee structure, current paid और balance import करें।</p></div><span class="badge blue">Principal only</span></div><div class="card-body section-stack">
    <div class="notice-box info">Excel में <strong>Save As → CSV UTF-8</strong> करें। Sheet का Admission No app के student <strong>SR number</strong> से match होना चाहिए। जरूरी headers: Admission No, Student Name, School Fee, Annual Transport Fee, PAID BEFORE SOFTWARE, PAID, Current Session. <strong>Mobile</strong> optional है—WhatsApp reminders के लिए। Reminder WhatsApp में message draft खोलेगा; staff को Send दबाना होगा। Current balance = School Fee + Transport Fee − PAID; “PAID BEFORE SOFTWARE” अलग historical amount रहेगा। Import/re-import matched students की fee snapshot बदल देगा; हर row में अलग receipt नहीं बनेगी।</div>
    <form data-form="fee-import" class="section-stack"><div class="field"><label>Fee CSV file चुनें</label><input class="control" type="file" accept=".csv,text/csv" data-fee-import-file></div><div class="field"><label>या CSV text paste करें</label><textarea class="control control-textarea" name="feeCsv" rows="4" placeholder="admissionNo,studentName,pickupPoint,schoolFee,annualTransportFee,paidBeforeSoftware,paid,currentSessionBalance"></textarea></div><div class="toolbar"><button class="btn btn-secondary" type="button" data-action="download-fee-template">⬇ CSV template</button><button class="btn btn-primary" type="submit">Import fee data</button></div></form>
  </div></section>`;
}

function feeProfileRecords() {
  return Shala.students.filter((student) => student.feeProfile && typeof student.feeProfile === 'object').map((student) => {
    const profile = student.feeProfile;
    const importedAt = Number(profile.importedAt) || 0;
    const extraPaid = Shala.feeLedger.filter((entry) => entry.studentId === student.id && String(entry.session || '') === String(profile.session || '') && (Number(entry.createdAt) || 0) >= importedAt)
      .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
    const schoolFee = Number(profile.schoolFee) || 0;
    const transportFee = Number(profile.annualTransportFee) || 0;
    const total = schoolFee + transportFee;
    const currentPaid = (Number(profile.paidCurrent) || 0) + extraPaid;
    return { student, profile, schoolFee, transportFee, total, currentPaid, due: total - currentPaid };
  }).sort((a, b) => String(a.student.class).localeCompare(String(b.student.class), undefined, { numeric: true }) || String(a.student.name).localeCompare(String(b.student.name)));
}

function filteredFeeProfiles() {
  const query = feeSearch.trim().toLocaleLowerCase('en-IN');
  return feeProfileRecords().filter((record) => {
    const { student, profile, due } = record;
    if (feeView === 'followup' && due <= 0) return false;
    if (feeClassFilter && student.class !== feeClassFilter) return false;
    if (feeRouteFilter && profile.pickupPoint !== feeRouteFilter) return false;
    if (!query) return true;
    return [student.name, student.fatherName, student.srNo, student.rollNo, profile.admissionNo, profile.pickupPoint, profile.parentMobile]
      .some((value) => String(value || '').toLocaleLowerCase('en-IN').includes(query));
  });
}

function feeProfileRows() {
  const records = filteredFeeProfiles();
  if (!records.length) return `<tr><td colspan="10"><div class="empty-state"><div class="empty-icon">₹</div><h3>${feeView === 'followup' ? 'कोई बकाया विद्यार्थी नहीं' : 'कोई matching fee profile नहीं'}</h3><p>Search/filter बदलें या Principal से fee CSV import करवाएं।</p></div></td></tr>`;
  return records.map(({ student, profile, schoolFee, transportFee, currentPaid, due }) => {
    const mobile = String(profile.parentMobile || '').trim();
    const reminder = due > 0
      ? mobile ? `<button class="btn btn-success btn-sm" data-action="fee-whatsapp-reminder" data-id="${escapeAttr(student.id)}">WhatsApp reminder</button>` : `<span class="badge amber">Mobile missing</span>`
      : `<span class="badge green">Settled</span>`;
    return `<tr><td>${escapeHTML(profile.admissionNo || student.srNo || '—')}</td><td class="primary-cell">${escapeHTML(student.name)}<br><span class="small muted">${escapeHTML(student.fatherName || '')}</span></td><td>${escapeHTML(student.class || '—')}</td><td>${escapeHTML(profile.pickupPoint || '—')}</td><td class="numeric currency">₹${money(schoolFee)}</td><td class="numeric currency">₹${money(transportFee)}</td><td class="numeric currency">₹${money(profile.paidBeforeSoftware)}</td><td class="numeric currency">₹${money(currentPaid)}</td><td class="numeric currency">₹${money(due)}</td><td>${reminder}</td></tr>`;
  }).join('');
}

function updateFeeProfileTable() {
  const body = document.getElementById('fee-profile-body');
  if (!body) return;
  body.innerHTML = feeProfileRows();
  const count = document.getElementById('fee-profile-count');
  if (count) count.textContent = `${filteredFeeProfiles().length} shown · ${feeProfileRecords().length} imported`;
}

function feeProfileTable() {
  const profiles = feeProfileRecords();
  const classes = [...new Set(profiles.map(({ student }) => student.class).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  const routes = [...new Set(profiles.map(({ profile }) => profile.pickupPoint).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  const title = feeView === 'followup' ? 'Due follow-up' : 'Student fee balances';
  return `<section class="card"><div class="card-header"><div><h2>${title}</h2><p>Search by student, Admission/SR number, parent, route or mobile. Balances update with approved payments.</p></div><span class="badge blue" id="fee-profile-count">${filteredFeeProfiles().length} shown · ${profiles.length} imported</span></div><div class="card-body">
    <div class="toolbar" style="margin-bottom:14px"><div class="search-control"><span class="search-icon">⌕</span><input class="control" id="fee-search" value="${escapeAttr(feeSearch)}" placeholder="Name, Adm/SR, father, route or mobile"></div><div class="field"><select id="fee-class-filter" class="control"><option value="">All classes</option>${classes.map((item) => `<option value="${escapeAttr(item)}" ${selected(feeClassFilter, item)}>${escapeHTML(item)}</option>`).join('')}</select></div><div class="field"><select id="fee-route-filter" class="control"><option value="">All routes</option>${routes.map((item) => `<option value="${escapeAttr(item)}" ${selected(feeRouteFilter, item)}>${escapeHTML(item)}</option>`).join('')}</select></div></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Adm No</th><th>Student / Father</th><th>Class</th><th>Pickup point</th><th>School fee</th><th>Annual transport</th><th>Paid before software</th><th>Paid this session</th><th>Balance due</th><th>Reminder</th></tr></thead><tbody id="fee-profile-body">${feeProfileRows()}</tbody></table></div>
  </div></section>`;
}

function feeReportsPanel() {
  const records = feeProfileRecords();
  const totalFee = records.reduce((sum, row) => sum + row.total, 0);
  const totalPaid = records.reduce((sum, row) => sum + row.currentPaid, 0);
  const totalDue = records.reduce((sum, row) => sum + Math.max(0, row.due), 0);
  const dueCount = records.filter((row) => row.due > 0).length;
  const settledCount = records.filter((row) => row.due <= 0).length;
  const collectionRate = totalFee > 0 ? Math.min(100, Math.max(0, totalPaid / totalFee * 100)) : 0;
  const byClass = new Map();
  for (const row of records) byClass.set(row.student.class || 'Other', (byClass.get(row.student.class || 'Other') || 0) + Math.max(0, row.due));
  const classRows = [...byClass.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }));
  const maxClassDue = Math.max(1, ...classRows.map(([, amount]) => amount));
  const classChart = classRows.length ? classRows.map(([className, amount]) => `<div style="display:grid;grid-template-columns:62px 1fr auto;align-items:center;gap:10px;margin:10px 0"><strong class="small">${escapeHTML(className)}</strong><div style="height:10px;border-radius:99px;background:#edf1f6;overflow:hidden"><div style="height:100%;width:${amount ? Math.max(2, amount / maxClassDue * 100) : 0}%;background:#d88938;border-radius:99px"></div></div><span class="small currency">₹${money(amount)}</span></div>`).join('') : `<div class="empty-state"><p>Fee data import करें, फिर class-wise outstanding यहाँ दिखेगा।</p></div>`;
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, label: new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(date), amount: 0 };
  });
  const monthMap = new Map(months.map((month) => [month.key, month]));
  for (const entry of Shala.feeLedger) {
    if (entry.session && String(entry.session) !== String(Shala.settings.academicSession)) continue;
    let key = String(entry.date || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(key) && entry.createdAt) key = new Date(Number(entry.createdAt)).toISOString().slice(0, 7);
    if (monthMap.has(key)) monthMap.get(key).amount += Number(entry.amount) || 0;
  }
  const maxMonth = Math.max(1, ...months.map((month) => month.amount));
  const monthChart = months.map((month) => `<div title="${escapeAttr(month.label)} · ₹${money(month.amount)}" style="height:100%;flex:1;min-width:38px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:6px"><span class="small muted">₹${money(month.amount)}</span><div style="height:${month.amount ? Math.max(4, month.amount / maxMonth * 68) : 2}%;min-height:${month.amount ? 8 : 2}px;width:28px;background:#2f8b69;border-radius:7px 7px 2px 2px"></div><span class="small muted">${escapeHTML(month.label)}</span></div>`).join('');
  return `<div class="section-stack"><div class="grid-stats"><div class="stat-card amber"><div class="stat-top"><span class="stat-label">Outstanding</span><span class="stat-icon">₹</span></div><div class="stat-value">₹${money(totalDue)}</div><div class="stat-foot">${dueCount} students with due</div></div><div class="stat-card green"><div class="stat-top"><span class="stat-label">Paid this session</span><span class="stat-icon">✓</span></div><div class="stat-value">₹${money(totalPaid)}</div><div class="stat-foot">Imported opening paid + approved payments</div></div><div class="stat-card"><div class="stat-top"><span class="stat-label">Fee profiles</span><span class="stat-icon">▤</span></div><div class="stat-value">${records.length}</div><div class="stat-foot">${settledCount} settled · session ${escapeHTML(Shala.settings.academicSession)}</div></div></div>
    <div class="dashboard-grid"><section class="card"><div class="card-header"><div><h2>Outstanding by class</h2><p>Current balance due, live from student profiles.</p></div></div><div class="card-body">${classChart}</div></section><section class="card"><div class="card-header"><div><h2>Collections by month</h2><p>Approved transactions recorded in the last six months.</p></div></div><div class="card-body"><div style="height:190px;display:flex;align-items:stretch;gap:8px;border-bottom:1px solid #e5eaf1;padding:0 4px">${monthChart}</div><p class="small muted" style="margin:10px 0 0">Imported “PAID” totals have no receipt date, so they are not assigned to a month.</p></div></section></div>
    <section class="card"><div class="card-header"><div><h2>Collection analysis</h2><p>Current-session fee collected against imported school and transport charges.</p></div><strong>${collectionRate.toFixed(1)}%</strong></div><div class="card-body"><div style="height:12px;border-radius:99px;background:#edf1f6;overflow:hidden"><div style="height:100%;width:${collectionRate}%;background:#2f8b69;border-radius:99px"></div></div><div class="toolbar" style="justify-content:space-between;margin-top:10px"><span class="small muted">Collected ₹${money(totalPaid)}</span><span class="small muted">Charged ₹${money(totalFee)}</span><span class="small muted">Outstanding ₹${money(totalDue)}</span></div></div></section></div>`;
}

function feeRequestForm() {
  if (!['teacher', 'principal'].includes(Shala.currentUser?.role)) return '';
  const students = [...Shala.students].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const options = students.map((student) => `<option value="${escapeAttr(student.id)}">${escapeHTML(student.name)} · ${escapeHTML(student.class)} · Roll ${escapeHTML(student.rollNo)}</option>`).join('');
  return `<section class="card"><div class="card-header"><div><h2>नई फीस अनुरोध / New fee request</h2><p>Submit करने के बाद operator या principal approve/reject करेगा।</p></div><span class="badge blue">Teacher workflow</span></div><div class="card-body"><form data-form="fee-request" class="form-grid three">
    <div class="field span-2"><label>विद्यार्थी</label><select class="control" name="studentId" required><option value="">विद्यार्थी चुनें</option>${options}</select></div>
    <div class="field"><label>राशि (₹)</label><input class="control" type="number" name="amount" min="1" step="1" required placeholder="1500"></div>
    <div class="field"><label>दिनांक</label><input class="control" type="date" name="date" value="${currentDate()}" required></div>
    <div class="field span-2"><label>नोट / विवरण</label><input class="control" name="note" maxlength="160" placeholder="मासिक फीस / रसीद विवरण"></div>
    <div class="field" style="align-self:end"><button class="btn btn-primary wide" type="submit" ${disabled(!students.length)}>Request approval</button></div>
  </form>${!students.length ? `<p class="field-hint" style="margin-top:12px">पहले विद्यार्थी सूची में विद्यार्थी जोड़ें।</p>` : ''}</div></section>`;
}

function feesPanel({ dashboard = false } = {}) {
  const pending = Shala.feeRequests.filter((request) => request.status === 'Pending');
  const profiles = feeProfileRecords();
  const totalOutstanding = profiles.reduce((sum, row) => sum + Math.max(0, row.due), 0);
  const totalCollected = profiles.length ? profiles.reduce((sum, row) => sum + row.currentPaid, 0) : Shala.feeLedger.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const dueCount = profiles.filter((row) => row.due > 0).length;
  const heading = pageHeading(dashboard ? 'Student fee dashboard' : 'Fee management', 'Live balances, fee reminders and collection reports · Session ' + Shala.settings.academicSession);
  const nav = `<div class="toolbar" style="margin:16px 0"><button class="btn ${feeView === 'students' ? 'btn-primary' : 'btn-secondary'}" data-action="fee-view" data-view="students">Students</button><button class="btn ${feeView === 'reports' ? 'btn-primary' : 'btn-secondary'}" data-action="fee-view" data-view="reports">Reports</button><button class="btn ${feeView === 'followup' ? 'btn-primary' : 'btn-secondary'}" data-action="fee-view" data-view="followup">Due follow-up</button></div>`;
  const mainView = feeView === 'reports'
    ? feeReportsPanel()
    : `${feeView === 'students' ? feeProfileImportPanel() : ''}${feeProfileTable()}`;
  const workflow = feeView === 'students' ? `<div class="section-stack">${feeRequestForm()}<section class="card"><div class="card-header"><div><h2>Approval queue</h2><p>Fee requests from staff; decisions sync live.</p></div><span class="badge amber">${pending.length} pending</span></div><div class="card-body">${feeRequestCards({ dashboard })}</div></section><section class="card"><div class="card-header"><div><h2>Transaction ledger</h2><p>Approved fee entries; exportable to Excel or Google Sheets.</p></div><button class="btn btn-secondary btn-sm" data-action="export-ledger">CSV Export</button></div><div class="card-body">${feeLedgerTable()}</div></section></div>` : '';
  return `${heading}${demoBanner()}<div class="grid-stats"><div class="stat-card"><div class="stat-top"><span class="stat-label">Active students</span><span class="stat-icon">👨‍🎓</span></div><div class="stat-value">${Shala.students.length}</div><div class="stat-foot">School roster</div></div><div class="stat-card amber"><div class="stat-top"><span class="stat-label">Total outstanding</span><span class="stat-icon">₹</span></div><div class="stat-value currency">₹${money(totalOutstanding)}</div><div class="stat-foot">${dueCount} students with balance</div></div><div class="stat-card green"><div class="stat-top"><span class="stat-label">Paid this session</span><span class="stat-icon">✓</span></div><div class="stat-value currency">₹${money(totalCollected)}</div><div class="stat-foot">Fee profile + approved payments</div></div><div class="stat-card blue"><div class="stat-top"><span class="stat-label">Pending approvals</span><span class="stat-icon">⏳</span></div><div class="stat-value">${pending.length}</div><div class="stat-foot">Operator / Principal review</div></div></div>${nav}<div class="section-stack">${mainView}${workflow}</div>`;
}

function noticeCards() {
  if (!Shala.notices.length) return `<div class="empty-state"><div class="empty-icon">📢</div><h3>अभी कोई स्कूल नोटिस नहीं</h3><p>प्रधानाचार्य का साझा संदेश यहाँ दिखाई देगा।</p></div>`;
  return `<div class="notice-list">${Shala.notices.map((notice) => `<article class="notice-item"><div class="notice-item-title">${escapeHTML(notice.title)}</div><div class="notice-item-body">${escapeHTML(notice.message)}</div><div class="notice-item-meta"><span>From ${escapeHTML(notice.sender || 'Principal')}</span><span>${escapeHTML(niceDate(notice.createdAt, true))}</span></div></article>`).join('')}</div>`;
}

function noticeComposer() {
  if (!isPrincipal()) return '';
  return `<section class="card"><div class="card-header"><div><h2>नया notice प्रसारित करें</h2><p>यह notice सभी authorized staff dashboards पर live दिखाई देगा।</p></div><span class="badge blue">Principal only</span></div><div class="card-body"><form data-form="notice" class="section-stack"><div class="field"><label>शीर्षक / Title</label><input class="control" name="title" maxlength="100" required placeholder="उदा. परीक्षा समय-सारणी"></div><div class="field"><label>संदेश / Message</label><textarea class="control control-textarea" name="message" maxlength="2000" required placeholder="पूरा संदेश लिखें"></textarea></div><div><button class="btn btn-primary" type="submit">📢 सभी को भेजें</button></div></form></div></section>`;
}

function noticesPanel() {
  return `${pageHeading('स्कूल नोटिस', 'Principal द्वारा भेजे गए संदेश सभी logged-in staff को एक ही feed में मिलेंगे。')}${demoBanner()}<div class="split-grid">${noticeComposer()}<section class="card"><div class="card-header"><div><h2>Notice feed</h2><p>${Shala.notices.length} shared notices</p></div></div><div class="card-body">${noticeCards()}</div></section></div>`;
}

function staffPanel() {
  const users = [...Shala.users].sort((a, b) => String(a.role).localeCompare(String(b.role)) || String(a.name).localeCompare(String(b.name)));
  return `${pageHeading('स्टाफ खाते', 'नए teacher/operator accounts बनाएं। पासवर्ड सूची में नहीं दिखता; reset link भेजा जा सकता है।')}${demoBanner()}
    <div class="settings-layout"><section class="card"><div class="card-header"><div><h2>नया स्टाफ खाता</h2><p>Principal login बना रहता है; staff account अलग से बनाया जाता है।</p></div></div><div class="card-body"><form data-form="staff" class="section-stack">
      <div class="field"><label>पूरा नाम</label><input class="control" name="name" maxlength="100" required placeholder="उदा. सीमा शर्मा"></div>
      <div class="field"><label>Staff email / Login ID</label><input class="control" name="email" type="email" required placeholder="staff@school.in"></div>
      <div class="field"><label>Temporary password (कम से कम 6 अक्षर)</label><input class="control" name="password" type="password" minlength="6" autocomplete="new-password" required placeholder="एक अस्थायी पासवर्ड दें"></div>
      <div class="field"><label>Role</label><select class="control" name="role"><option value="teacher">शिक्षक · Teacher</option><option value="operator">कंप्यूटर ऑपरेटर · Operator</option></select></div>
      <div class="notice-box info">Password केवल Firebase Authentication में भेजा जाता है, database में सेव नहीं होता और बाद में यहाँ नहीं दिखेगा। Staff को पहली बार login के बाद password reset करने को कहें।</div>
      <button class="btn btn-primary" type="submit">＋ Account बनाएं</button>
    </form></div></section>
    <section class="card"><div class="card-header"><div><h2>Authorized staff</h2><p>${users.length} profiles</p></div></div><div class="card-body">${users.length ? users.map((user) => `<div class="staff-row"><div class="staff-person"><div class="avatar">${escapeHTML(initials(user.name))}</div><div class="staff-meta"><strong>${escapeHTML(user.name)}</strong><small>${escapeHTML(user.email || '')} · ${escapeHTML(roleName(user.role))}</small></div></div><button class="btn btn-secondary btn-sm" data-action="reset-staff-password" data-email="${escapeAttr(user.email || '')}" ${disabled(!user.email)}>Send reset</button></div>`).join('') : `<div class="empty-state"><div class="empty-icon">👥</div><h3>अभी staff profile नहीं</h3><p>नया account बनाने के बाद role यहाँ दिखेगा।</p></div>`}</div></section></div>`;
}

function settingsPanel() {
  const settings = Shala.settings;
  return `${pageHeading('स्कूल सेटिंग्स व backup', 'यहाँ school name/session बदलें; JSON backup डाउनलोड कर अलग सुरक्षित रखें।')}${demoBanner()}
    <div class="settings-layout"><section class="card"><div class="card-header"><div><h2>स्कूल प्रोफ़ाइल</h2><p>बदलाव teacher app और principal dashboard दोनों में sync होंगे।</p></div></div><div class="card-body"><form data-form="settings" class="section-stack">
      <div class="field"><label>School name (हिंदी)</label><input class="control" name="schoolName" value="${escapeAttr(settings.schoolName)}" required></div>
      <div class="field"><label>School name (English)</label><input class="control" name="schoolNameEn" value="${escapeAttr(settings.schoolNameEn)}"></div>
      <div class="field"><label>पता / Address</label><input class="control" name="schoolAddress" value="${escapeAttr(settings.schoolAddress)}"></div>
      <div class="form-grid"><div class="field"><label>Academic session</label><input class="control" name="academicSession" value="${escapeAttr(settings.academicSession)}" required></div><div class="field"><label>Classes (comma-separated)</label><input class="control" name="classes" value="${escapeAttr((settings.classes || []).join(', '))}" required></div></div>
      <div class="notice-box info">Classes edit करने के बाद नई student/result forms में वही सूची आएगी। पुराने records नहीं हटेंगे।</div>
      <button class="btn btn-primary" type="submit">सेटिंग्स सेव करें</button>
    </form></div></section>
    <section class="card"><div class="card-header"><div><h2>Backup & app updates</h2><p>अपने स्कूल के डेटा की अतिरिक्त प्रति रखें।</p></div></div><div class="card-body section-stack">
      <div class="notice-box success"><strong>Automatic app update:</strong> सभी users को एक ही hosted PWA URL दें। App publish होने के बाद अगली online visit/reload पर नई version मिलेगी—हर phone के लिए अलग APK update नहीं करना होगा।</div>
      <button class="btn btn-secondary" data-action="export-backup">⬇ Full JSON backup</button>
      <div class="danger-zone"><strong class="small" style="color:#963743">Student-data safety</strong><p class="small muted" style="line-height:1.6;margin-bottom:0">Demo mode में असली डेटा न डालें। Cloud database में public access न दें और staff passwords साझा/सूचीबद्ध न करें। Backup file को private और सुरक्षित जगह रखें।</p></div>
    </div></section></div>`;
}

function overviewPanel() {
  const studentsByClass = {};
  Shala.students.forEach((student) => { studentsByClass[student.class] = (studentsByClass[student.class] || 0) + 1; });
  const classSummary = Object.entries(studentsByClass).map(([name, count]) => `${name}: ${count}`).join(' · ') || 'No student records yet';
  const monthPrefix = currentDate().slice(0, 7);
  const monthly = Shala.feeLedger.filter((item) => String(item.date || '').startsWith(monthPrefix)).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const totalFees = Shala.feeLedger.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const pending = Shala.feeRequests.filter((request) => request.status === 'Pending').length;
  return `${pageHeading('प्रधानाचार्य डैशबोर्ड', `${escapeHTML(Shala.settings.schoolName)} · Academic session ${escapeHTML(Shala.settings.academicSession)}`, `<button class="btn btn-primary" data-tab="notices">＋ नया notice</button>`)}${demoBanner()}
    <div class="grid-stats">
      <div class="stat-card blue"><div class="stat-top"><span class="stat-label">कुल विद्यार्थी</span><span class="stat-icon">👨‍🎓</span></div><div class="stat-value">${Shala.students.length}</div><div class="stat-foot">${escapeHTML(classSummary)}</div></div>
      <div class="stat-card"><div class="stat-top"><span class="stat-label">Published results</span><span class="stat-icon">📝</span></div><div class="stat-value">${Shala.results.length}</div><div class="stat-foot">Shared exam archive</div></div>
      <div class="stat-card amber"><div class="stat-top"><span class="stat-label">Pending fee requests</span><span class="stat-icon">⏳</span></div><div class="stat-value">${pending}</div><div class="stat-foot">Approve or reject below</div></div>
      <div class="stat-card green"><div class="stat-top"><span class="stat-label">Fee collected · this month</span><span class="stat-icon">₹</span></div><div class="stat-value">₹${money(monthly)}</div><div class="stat-foot">All-time ledger: ₹${money(totalFees)}</div></div>
    </div>
    <div class="dashboard-grid"><div class="stack">
      <section class="card"><div class="card-header"><div><h2>Pending fee queue</h2><p>Approvals update the teacher app and shared ledger live.</p></div><button class="btn btn-secondary btn-sm" data-tab="fees">Open queue</button></div><div class="card-body">${feeRequestCards({ dashboard: true })}</div></section>
      <section class="card"><div class="card-header"><div><h2>हाल ही के परिणाम</h2><p>${Shala.results.length} saved exam records</p></div><button class="btn btn-secondary btn-sm" data-href="./index.html#results">Open staff app</button></div><div class="card-body">${resultArchiveItems()}</div></section>
    </div><div class="stack">
      <section class="card"><div class="card-header"><div><h2>Live notices</h2><p>सभी authorized staff के लिए</p></div><button class="icon-btn" data-tab="notices" title="New notice">＋</button></div><div class="card-body">${noticeCards()}</div></section>
      <section class="card"><div class="card-header"><div><h2>Latest ledger entries</h2><p>Approved fee records</p></div><button class="btn btn-secondary btn-sm" data-tab="fees">View all</button></div><div class="card-body">${Shala.feeLedger.length ? `<div class="section-stack">${Shala.feeLedger.slice(0, 5).map((item) => `<div class="staff-row"><div class="staff-meta"><strong>${escapeHTML(item.studentName)}</strong><small>${escapeHTML(item.class)} · ${escapeHTML(niceDate(item.date))}</small></div><span class="currency">₹${money(item.amount)}</span></div>`).join('')}</div>` : `<div class="empty-state"><div class="empty-icon">₹</div><h3>Ledger खाली है</h3><p>Approved entries यहाँ आएँगी।</p></div>`}</div></section>
    </div></div>`;
}

function renderStaffTab() {
  switch (activeTab) {
    case 'results': return resultsPanel();
    case 'fees': return feesPanel();
    case 'notices': return noticesPanel();
    case 'students':
    default: return studentsPanel();
  }
}

function renderPrincipalTab() {
  if (!isPrincipal()) return '';
  switch (activeTab) {
    case 'students': return studentsPanel();
    case 'fees': return feesPanel({ dashboard: true });
    case 'notices': return noticesPanel();
    case 'staff': return staffPanel();
    case 'settings': return settingsPanel();
    case 'overview':
    default: return overviewPanel();
  }
}

function renderModal() {
  if (modal.type === 'student') {
    const student = modal.student || {};
    const isEdit = Boolean(student.id);
    return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="student-modal-title"><div class="modal-head"><div><h2 id="student-modal-title">${isEdit ? 'विद्यार्थी विवरण बदलें' : 'नया विद्यार्थी जोड़ें'}</h2><p>Record save होते ही shared list में दिखाई देगा।</p></div><button class="icon-btn" data-action="close-modal" aria-label="Close">×</button></div><form data-form="student"><div class="modal-body"><input type="hidden" name="id" value="${escapeAttr(student.id || '')}"><div class="form-grid">
      <div class="field"><label>Roll number *</label><input class="control" name="rollNo" required value="${escapeAttr(student.rollNo || '')}" placeholder="1"></div><div class="field"><label>SR number</label><input class="control" name="srNo" value="${escapeAttr(student.srNo || '')}" placeholder="SR-101"></div>
      <div class="field span-2"><label>विद्यार्थी का नाम *</label><input class="control" name="name" required maxlength="120" value="${escapeAttr(student.name || '')}" placeholder="पूरा नाम"></div>
      <div class="field span-2"><label>पिता का नाम</label><input class="control" name="fatherName" value="${escapeAttr(student.fatherName || '')}" placeholder="अभिभावक का नाम"></div>
      <div class="field"><label>कक्षा *</label><select class="control" name="class" required>${classOptions(student.class || Shala.settings.classes?.[0])}</select></div>
      <div class="field"><label>माध्यम</label><select class="control" name="medium"><option value="हिंदी" ${selected(student.medium || 'हिंदी', 'हिंदी')}>हिंदी</option><option value="English" ${selected(student.medium, 'English')}>English</option></select></div>
      </div><div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">रद्द करें</button><button class="btn btn-primary" type="submit">${isEdit ? 'बदलाव सेव करें' : 'विद्यार्थी सेव करें'}</button></div></div></form></section></div>`;
  }
  if (modal.type === 'import') {
    return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><div><h2>विद्यार्थियों का CSV import</h2><p>CSV export भी Google Sheets में खुलता है।</p></div><button class="icon-btn" data-action="close-modal">×</button></div><form data-form="import"><div class="modal-body section-stack"><div class="notice-box info">Header format: <code>rollNo,srNo,name,fatherName,class,medium</code><br>किसी भी extra column को अनदेखा किया जाएगा।</div><div class="field"><label>CSV file चुनें</label><input class="control" type="file" accept=".csv,text/csv" data-file-csv></div><div class="field"><label>या CSV टेक्स्ट paste करें</label><textarea class="control control-textarea" name="csv" rows="8" placeholder="rollNo,srNo,name,fatherName,class,medium&#10;1,SR-101,आरव शर्मा,मोहन शर्मा,5th,हिंदी"></textarea></div><div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">रद्द करें</button><button class="btn btn-primary" type="submit">Import करें</button></div></div></form></section></div>`;
  }
  return '';
}

function render() {
  if (!Shala.ready) {
    root.innerHTML = `<div class="boot-screen"><div class="loader"></div><p>शाला-सेतु लोड हो रहा है…</p></div>`;
    return;
  }
  if (!Shala.currentUser) {
    root.innerHTML = renderLogin();
    return;
  }
  root.innerHTML = renderShell();
  if (activeTab === 'results') updateResultSummary();
}

function activateTab(tab) {
  if (!validTabs.includes(tab)) return;
  activeTab = tab;
  history.replaceState(null, '', `#${tab}`);
  modal = null;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateStudentRows() {
  const tbody = document.getElementById('students-table-body');
  if (!tbody) return;
  tbody.innerHTML = studentRows();
  const count = tbody.closest('.card')?.querySelector('.card-header p');
  if (count) count.textContent = `${filteredStudents().length} of ${Shala.students.length} विद्यार्थी · search, class filter और CSV export`;
}

function updateResultSummary() {
  const pass = document.getElementById('result-pass');
  if (!pass || !resultDraft) return;
  const data = resultDataForDraft();
  const passed = data.filter((item) => item.isPass).length;
  const failed = data.length - passed;
  const average = data.length ? data.reduce((sum, item) => sum + item.percentage, 0) / data.length : 0;
  const topper = [...data].sort((a, b) => b.percentage - a.percentage)[0];
  pass.textContent = String(passed);
  document.getElementById('result-fail').textContent = String(failed);
  document.getElementById('result-average').textContent = `${average.toFixed(1)}%`;
  document.getElementById('result-topper').textContent = topper ? `${topper.name} · ${topper.percentage}%` : '—';
  data.forEach((item) => {
    const row = document.getElementById(`result-row-${item.studentId}`);
    if (!row) return;
    row.querySelector('.cell-total').textContent = `${item.totalMarks}/${item.totalMax}`;
    row.querySelector('.cell-percent').textContent = `${item.percentage}%`;
    row.querySelector('.cell-grade').innerHTML = `<span class="badge ${item.isPass ? 'green' : 'red'}">${escapeHTML(item.grade)}</span>`;
    row.querySelector('.cell-rank').textContent = String(item.rank);
  });
}

function getCurrentResult() {
  const draft = ensureResultDraft();
  const students = studentsForResult();
  if (!students.length) throw new Error('इस कक्षा और माध्यम में कोई विद्यार्थी नहीं है।');
  for (const student of students) {
    for (const subject of draft.subjects) {
      const value = draft.marks?.[student.id]?.[subject.name];
      if (value === undefined || String(value).trim() === '') throw new Error(`${student.name} के ${subject.name} के अंक भरें।`);
      if (Number(value) < 0 || Number(value) > Number(subject.max)) throw new Error(`${student.name} के ${subject.name} के अंक 0 से ${subject.max} के बीच होने चाहिए।`);
    }
  }
  const studentsData = resultDataForDraft();
  return {
    title: String(draft.title || '').trim() || 'परीक्षा परिणाम',
    class: draft.class,
    medium: draft.medium,
    session: Shala.settings.academicSession,
    date: currentDate(),
    subjects: draft.subjects.map((subject) => ({ name: subject.name, max: Number(subject.max) || 100 })),
    studentsData
  };
}

function csvCell(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
function downloadText(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1200);
}
function downloadStudentsCSV() {
  const rows = [['rollNo', 'srNo', 'name', 'fatherName', 'class', 'medium'], ...Shala.students.map((s) => [s.rollNo, s.srNo, s.name, s.fatherName, s.class, s.medium])];
  downloadText('ShalaSetu_students.csv', `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`, 'text/csv;charset=utf-8');
}
function downloadLedgerCSV() {
  const rows = [['date', 'studentName', 'class', 'medium', 'amount', 'approvedBy'], ...Shala.feeLedger.map((r) => [r.date, r.studentName, r.class, r.medium, r.amount, r.approvedBy])];
  downloadText('ShalaSetu_fee_ledger.csv', `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`, 'text/csv;charset=utf-8');
}
function downloadResultCSV(result) {
  const subjects = result.subjects || [];
  const headers = ['rollNo', 'srNo', 'studentName', 'fatherName', ...subjects.map((subject) => subject.name), 'total', 'max', 'percentage', 'grade', 'rank', 'status'];
  const rows = (result.studentsData || []).map((student) => [student.rollNo, student.srNo, student.name, student.fatherName, ...subjects.map((subject) => student.marks?.[subject.name] ?? ''), student.totalMarks, student.totalMax, student.percentage, student.grade, student.rank, student.isPass ? 'Pass' : 'Review']);
  const safeTitle = String(result.title || 'result').replace(/[^\p{L}\p{N}_-]+/gu, '_');
  downloadText(`Result_${safeTitle}_${result.class || ''}.csv`, `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`, 'text/csv;charset=utf-8');
}
function printResult(result) {
  const subjects = result.subjects || [];
  const rows = result.studentsData || [];
  const popup = window.open('', '_blank');
  if (!popup) { toast('Print window blocked. Allow pop-ups, then try again.', 'error'); return; }
  popup.opener = null;
  const table = `<table><thead><tr><th>Roll</th><th>SR No.</th><th>Student</th>${subjects.map((subject) => `<th>${escapeHTML(subject.name)}<br>(${Number(subject.max) || 100})</th>`).join('')}<th>Total</th><th>%</th><th>Grade</th><th>Rank</th></tr></thead><tbody>${rows.map((student) => `<tr><td>${escapeHTML(student.rollNo)}</td><td>${escapeHTML(student.srNo)}</td><td>${escapeHTML(student.name)}</td>${subjects.map((subject) => `<td>${escapeHTML(student.marks?.[subject.name] ?? '')}</td>`).join('')}<td>${escapeHTML(student.totalMarks)}/${escapeHTML(student.totalMax)}</td><td>${escapeHTML(student.percentage)}%</td><td>${escapeHTML(student.grade)}</td><td>${escapeHTML(student.rank)}</td></tr>`).join('')}</tbody></table>`;
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(result.title)}</title><style>body{font-family:Arial,"Noto Sans Devanagari",sans-serif;color:#172338;padding:24px}h1{font-size:20px;margin:0 0 5px}p{font-size:12px;color:#596981}table{border-collapse:collapse;width:100%;font-size:11px;margin-top:18px}th,td{border:1px solid #bcc7d4;padding:7px;text-align:center}th{background:#edf2f7}td:nth-child(3){text-align:left;font-weight:bold}.school{text-align:center;border-bottom:2px solid #172338;padding-bottom:13px} @media print{body{padding:0}}</style></head><body><div class="school"><h1>${escapeHTML(Shala.settings.schoolName)}</h1><p>${escapeHTML(Shala.settings.schoolAddress)} · Session ${escapeHTML(result.session || Shala.settings.academicSession)}</p><h2>${escapeHTML(result.title)} · Class ${escapeHTML(result.class)} · ${escapeHTML(result.medium)}</h2><p>${escapeHTML(niceDate(result.date))} · ${Number(result.totalStudents) || rows.length} students</p></div>${table}<script>window.onload=()=>window.print()<\/script></body></html>`);
  popup.document.close();
}

function exportBackup() {
  const backup = Shala.buildBackup();
  downloadText(`ShalaSetu_Backup_${currentDate()}.json`, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8');
}

function setBusy(value) {
  isBusy = value;
  const button = root.querySelector('form button[type="submit"]');
  if (button) button.disabled = value;
  root.classList.toggle('loading-overlay', value);
}

async function runAction(callback, successMessage = '') {
  try {
    const result = await callback();
    if (successMessage) toast(successMessage, 'success');
    return result;
  } catch (error) {
    toast(error?.message || 'कुछ गलत हुआ। फिर कोशिश करें।', 'error');
    return null;
  }
}

async function handleSubmit(event) {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  const type = form.dataset.form;
  const values = Object.fromEntries(new FormData(form).entries());
  if (type === 'login') {
    setBusy(true);
    await runAction(async () => {
      const user = await Shala.login(values.email, values.password);
      modal = null;
      if (page === 'principal' && user.role !== 'principal') toast('इस account को Principal dashboard की अनुमति नहीं है।', 'error');
      return user;
    });
    setBusy(false);
    render();
    return;
  }
  if (type === 'student') {
    await runAction(async () => {
      const payload = { rollNo: values.rollNo, srNo: values.srNo, name: values.name, fatherName: values.fatherName, class: values.class, medium: values.medium };
      if (values.id) await Shala.updateStudent(values.id, payload);
      else await Shala.addStudent(payload);
      modal = null;
      render();
      toast(values.id ? 'विद्यार्थी record अपडेट हुआ।' : 'विद्यार्थी जोड़ा गया।', 'success');
    });
    return;
  }
  if (type === 'import') {
    await runAction(async () => {
      const count = await Shala.bulkImportStudentsCSV(values.csv);
      modal = null;
      render();
      toast(`${count} विद्यार्थियों का CSV import पूरा हुआ।`, 'success');
    });
    return;
  }
  if (type === 'fee-import') {
    await runAction(async () => {
      const count = await Shala.importFeeSheetCSV(values.feeCsv);
      form.reset();
      render();
      toast(`${count} विद्यार्थियों की fee structure और balance import हुई।`, 'success');
    });
    return;
  }
  if (type === 'fee-request') {
    await runAction(async () => {
      const student = Shala.students.find((item) => item.id === values.studentId);
      if (!student) throw new Error('विद्यार्थी चुनें।');
      await Shala.submitFeeRequest({ ...student, studentId: student.id, amount: values.amount, date: values.date, note: values.note });
      form.reset();
      render();
      toast('Fee request approval queue में भेजी गई।', 'success');
    });
    return;
  }
  if (type === 'notice') {
    await runAction(async () => {
      await Shala.sendNotification({ title: values.title, message: values.message });
      form.reset();
      render();
      toast('Notice सभी staff के लिए भेज दिया गया।', 'success');
    });
    return;
  }
  if (type === 'staff') {
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    await runAction(async () => {
      await Shala.addUser({ name: values.name, email: values.email, password: values.password, role: values.role });
      form.reset();
      render();
      toast(Shala.isDemo ? 'Demo profile जोड़ी गई (इसमें असली login नहीं बनता)।' : 'Staff login बनाया गया; password सूची में store नहीं किया गया।', 'success');
    });
    if (submitButton?.isConnected) submitButton.disabled = false;
    return;
  }
  if (type === 'settings') {
    await runAction(async () => {
      const classes = values.classes.split(',').map((item) => item.trim()).filter(Boolean);
      await Shala.saveSettings({ schoolName: values.schoolName.trim(), schoolNameEn: values.schoolNameEn.trim(), schoolAddress: values.schoolAddress.trim(), academicSession: values.academicSession.trim(), classes });
      render();
      toast('स्कूल सेटिंग्स सेव हुईं।', 'success');
    });
  }
}

async function handleClick(event) {
  const tab = event.target.closest('[data-tab]');
  if (tab) { activateTab(tab.dataset.tab); return; }
  const href = event.target.closest('[data-href]');
  if (href) { location.href = href.dataset.href; return; }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id, role, decision, email } = button.dataset;
  if (action === 'backdrop-close' && event.target !== button) return;
  if (action === 'backdrop-close' || action === 'close-modal') { modal = null; render(); return; }
  if (action === 'logout') { await runAction(() => Shala.logout()); modal = null; render(); return; }
  if (action === 'demo-login') {
    await runAction(() => Shala.useDemo(role), 'Sample demo opened. This browser only.');
    modal = null;
    if (role === 'principal' && page === 'staff') location.href = './dashboard.html#overview';
    else if (role !== 'principal' && page === 'principal') location.href = './index.html#students';
    else render();
    return;
  }
  if (action === 'forgot-password') {
    const emailField = document.getElementById('login-email');
    const address = emailField?.value || prompt('अपना login email दर्ज करें:');
    if (address) await runAction(() => Shala.resetPassword(address), 'Password reset email भेजा गया।');
    return;
  }
  if (action === 'open-add-student') { modal = { type: 'student', student: null }; render(); return; }
  if (action === 'edit-student') {
    const student = Shala.students.find((item) => item.id === id);
    if (student) { modal = { type: 'student', student }; render(); }
    return;
  }
  if (action === 'delete-student') {
    const student = Shala.students.find((item) => item.id === id);
    if (!student || !confirm(`क्या ${student.name} को विद्यार्थी सूची से हटाना है? पुराने results नहीं हटेंगे।`)) return;
    await runAction(() => Shala.deleteStudent(id), 'विद्यार्थी हटाया गया।');
    render();
    return;
  }
  if (action === 'open-import') { modal = { type: 'import' }; render(); return; }
  if (action === 'export-students') { downloadStudentsCSV(); return; }
  if (action === 'export-ledger') { downloadLedgerCSV(); return; }
  if (action === 'fee-view') {
    if (['students', 'reports', 'followup'].includes(button.dataset.view)) feeView = button.dataset.view;
    render();
    return;
  }
  if (action === 'fee-whatsapp-reminder') {
    const record = feeProfileRecords().find((row) => row.student.id === id);
    if (!record || record.due <= 0) { toast('इस विद्यार्थी की फीस बकाया नहीं है।', 'error'); return; }
    let number = String(record.profile.parentMobile || '').replace(/\D/g, '');
    if (number.length === 10) number = `91${number}`;
    else if (number.length === 11 && number.startsWith('0')) number = `91${number.slice(1)}`;
    if (!/^\d{11,15}$/.test(number)) { toast('सही parent mobile number import करें।', 'error'); return; }
    const parent = record.student.fatherName ? `${record.student.fatherName} जी` : 'अभिभावक जी';
    const message = `नमस्कार ${parent}, ${Shala.settings.schoolName} की ओर से सूचना: ${record.student.name} (कक्षा ${record.student.class}) की सत्र ${record.profile.session} फीस में ₹${money(record.due)} शेष है। कृपया सुविधा अनुसार जमा करें। यदि भुगतान हो चुका है, तो इस संदेश को अनदेखा करें। धन्यवाद।`;
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    return;
  }
  if (action === 'download-fee-template') {
    const headers = ['admissionNo', 'studentName', 'mobile', 'pickupPoint', 'schoolFee', 'annualTransportFee', 'paidBeforeSoftware', 'paid', 'currentSessionBalance'];
    downloadText('ShalaSetu_fee_import_template.csv', `\uFEFF${headers.map(csvCell).join(',')}\r\n`, 'text/csv;charset=utf-8');
    return;
  }
  if (action === 'export-backup') { await runAction(() => exportBackup(), 'JSON backup डाउनलोड शुरू हुआ।'); return; }
  if (action === 'add-subject') {
    const name = prompt('विषय का नाम लिखें:');
    if (!name?.trim()) return;
    const maxValue = prompt('पूर्णांक / maximum marks:', '100');
    if (maxValue === null) return;
    const max = Number(maxValue);
    if (!Number.isFinite(max) || max <= 0 || max > 1000) { toast('Max marks 1 से 1000 के बीच रखें।', 'error'); return; }
    ensureResultDraft().subjects.push({ name: name.trim(), max });
    render();
    return;
  }
  if (action === 'edit-subject-max') {
    const subject = ensureResultDraft().subjects[Number(button.dataset.index)];
    if (!subject) return;
    const maxValue = prompt(`पूर्णांक / maximum marks for ${subject.name}:`, String(Number(subject.max) || 100));
    if (maxValue === null) return;
    const max = Number(maxValue);
    if (!Number.isFinite(max) || max <= 0 || max > 1000) { toast('Max marks 1 से 1000 के बीच रखें।', 'error'); return; }
    const hasOverLimitMark = Object.values(resultDraft.marks || {}).some((studentMarks) => Number(studentMarks?.[subject.name]) > max);
    if (hasOverLimitMark) { toast(`पहले ${subject.name} के दर्ज अंक नए max ${max} से कम करें।`, 'error'); return; }
    subject.max = max;
    render();
    return;
  }
  if (action === 'remove-subject') {
    if (ensureResultDraft().subjects.length <= 1) { toast('कम से कम एक subject जरूरी है।', 'error'); return; }
    resultDraft.subjects.splice(Number(button.dataset.index), 1);
    render();
    return;
  }
  if (action === 'save-result') {
    if (!canEditStudents()) { toast('केवल Teacher/Principal परिणाम प्रकाशित कर सकते हैं।', 'error'); return; }
    await runAction(async () => {
      const saved = await Shala.saveResult(getCurrentResult());
      toast(`परिणाम प्रकाशित: Class ${saved.class}, ${saved.totalStudents} students.`, 'success');
      activeTab = 'results';
      render();
    });
    return;
  }
  if (action === 'process-fee') {
    let comment = '';
    if (decision === 'reject') {
      const entered = prompt('अस्वीकृति का कारण लिखें:');
      if (entered === null) return;
      comment = entered;
    }
    await runAction(() => Shala.processFeeRequest(id, decision, comment), decision === 'approve' ? 'Fee request approved and added to ledger.' : 'Fee request rejected.');
    render();
    return;
  }
  if (action === 'download-result-csv' || action === 'print-result') {
    const result = Shala.results.find((item) => item.id === id);
    if (!result) { toast('यह result नहीं मिला।', 'error'); return; }
    if (action === 'download-result-csv') downloadResultCSV(result);
    else printResult(result);
    return;
  }
  if (action === 'reset-staff-password') {
    if (!email) return;
    if (!confirm(`${email} पर password reset email भेजें?`)) return;
    await runAction(() => Shala.resetStaffPassword(email), 'Password reset email भेजा गया।');
  }
}

function handleInput(event) {
  const target = event.target;
  if (target.id === 'student-search') {
    studentSearch = target.value;
    updateStudentRows();
    return;
  }
  if (target.id === 'fee-search') {
    feeSearch = target.value;
    updateFeeProfileTable();
    return;
  }
  if (target.id === 'result-title' && resultDraft) {
    resultDraft.title = target.value;
    return;
  }
  if (target.dataset.mark) {
    const studentId = target.dataset.studentId;
    const subject = target.dataset.subject;
    const max = Number(target.max) || 100;
    let value = target.value;
    if (value !== '' && Number(value) > max) { value = String(max); target.value = value; }
    if (value !== '' && Number(value) < 0) { value = '0'; target.value = value; }
    if (!resultDraft.marks[studentId]) resultDraft.marks[studentId] = {};
    resultDraft.marks[studentId][subject] = value;
    updateResultSummary();
  }
}

function handleChange(event) {
  const target = event.target;
  if (target.id === 'student-class-filter') {
    studentClassFilter = target.value;
    updateStudentRows();
    return;
  }
  if (target.id === 'fee-class-filter') {
    feeClassFilter = target.value;
    updateFeeProfileTable();
    return;
  }
  if (target.id === 'fee-route-filter') {
    feeRouteFilter = target.value;
    updateFeeProfileTable();
    return;
  }
  if (target.id === 'result-class') {
    ensureResultDraft();
    resultDraft.class = target.value;
    resultSubjectClass = '';
    ensureResultDraft();
    render();
    return;
  }
  if (target.id === 'result-medium') {
    ensureResultDraft();
    resultDraft.medium = target.value;
    render();
    return;
  }
  if (target.dataset.feeImportFile && target.files?.[0]) {
    const reader = new FileReader();
    reader.onload = () => {
      const textarea = target.form?.querySelector('textarea[name="feeCsv"]');
      if (textarea) textarea.value = String(reader.result || '');
    };
    reader.onerror = () => toast('Fee CSV file नहीं पढ़ सकी; CSV UTF-8 में फिर से save करें।', 'error');
    reader.readAsText(target.files[0]);
    return;
  }
  if (target.dataset.fileCsv && target.files?.[0]) {
    const reader = new FileReader();
    reader.onload = () => {
      const textarea = root.querySelector('textarea[name="csv"]');
      if (textarea) textarea.value = String(reader.result || '');
    };
    reader.readAsText(target.files[0]);
  }
}

root.addEventListener('submit', handleSubmit);
root.addEventListener('click', handleClick);
root.addEventListener('input', handleInput);
root.addEventListener('change', handleChange);
root.addEventListener('click', (event) => {
  if (event.target.classList.contains('modal-backdrop')) { modal = null; render(); }
});
window.addEventListener('hashchange', () => {
  const tab = location.hash.slice(1);
  if (validTabs.includes(tab) && tab !== activeTab) { activeTab = tab; render(); }
});
Shala.subscribe('*', (event) => {
  if (!Shala.ready) return;
  if (modal && !['auth', 'ready', 'error'].includes(event)) return;
  if (event === 'students' && activeTab === 'students') {
    updateStudentRows();
    if (page === 'principal') render();
    return;
  }
  render();
});

await Shala.init();
render();
