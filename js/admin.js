/**
 * admin.js – Clinic dashboard (admin.html):
 * login, statistics, appointment management, working hours, doctors, CSV export.
 */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  // Demo credentials. In a real product this check must happen on a server.
  const ADMIN_EMAIL = 'admin@webcare.com';
  const ADMIN_PASSWORD = 'Admin@123';

  const DAYS = [
    ['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'],
    ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']
  ];

  const loginSection = $('#admin-login');
  const appSection = $('#admin-app');
  const loginForm = $('#admin-login-form');
  const filterForm = $('#filter-form');
  const filterDoctor = $('#filter-doctor');
  const filterDate = $('#filter-date');
  const filterStatus = $('#filter-status');
  const tableBody = $('#appt-body');
  const tableEmpty = $('#appt-empty');
  const schedForm = $('#schedule-form');
  const schedDoctor = $('#sched-doctor');
  const hoursRows = $('#hours-rows');
  const doctorForm = $('#doctor-form');

  function init() {
    const s = UI.getSession();
    $('#today-label').textContent = 'Today is ' + UI.formatDate(UI.todayStr());
    if (s && s.role === 'admin') showDashboard(); else showLogin();
  }

  /* =====================  LOGIN  ===================== */

  function showLogin() {
    loginSection.hidden = false;
    appSection.hidden = true;
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = loginForm.elements;
    const okEmail = UI.setError(f['email'], Validate.email(f['email'].value));
    const okPass = UI.setError(f['password'], f['password'].value ? '' : 'Password is required.');
    if (!okEmail || !okPass) return;
    if (f['email'].value.trim().toLowerCase() !== ADMIN_EMAIL || f['password'].value !== ADMIN_PASSWORD) {
      UI.setError(f['password'], 'Incorrect email or password.');
      return;
    }
    UI.setSession({ role: 'admin' });
    loginForm.reset();
    showDashboard();
  });

  $('#admin-logout').addEventListener('click', () => {
    UI.clearSession();
    location.reload();
  });

  /* =====================  DASHBOARD  ===================== */

  function showDashboard() {
    loginSection.hidden = true;
    appSection.hidden = false;
    refreshAll();
  }

  function refreshAll() {
    fillDoctorSelects();
    renderStats();
    renderTable();
    renderSchedule();
  }

  function fillDoctorSelects() {
    const doctors = DB.getDoctors();
    const options = doctors.map((d) =>
      `<option value="${d.id}">${UI.escapeHTML(d.name)} – ${UI.escapeHTML(d.specialty)}</option>`).join('');
    const keepFilter = filterDoctor.value;
    const keepSched = schedDoctor.value;
    filterDoctor.innerHTML = '<option value="all">All doctors</option>' + options;
    schedDoctor.innerHTML = options;
    filterDoctor.value = doctors.some((d) => d.id === keepFilter) ? keepFilter : 'all';
    if (doctors.some((d) => d.id === keepSched)) schedDoctor.value = keepSched;
  }

  function renderStats() {
    const all = DB.getAppointments();
    const today = UI.todayStr();
    const now = new Date();
    const booked = all.filter((a) => a.status === 'booked');
    const cancelled = all.filter((a) => a.status === 'cancelled').length;
    $('#stat-today').textContent = booked.filter((a) => a.date === today).length;
    $('#stat-upcoming').textContent = booked.filter((a) => new Date(a.date + 'T' + a.time) > now).length;
    $('#stat-completed').textContent = all.filter((a) => a.status === 'completed').length;
    $('#stat-cancel').textContent = all.length ? Math.round((cancelled / all.length) * 100) + '%' : '0%';
  }

  function filteredAppointments() {
    return DB.getAppointments()
      .filter((a) => filterDoctor.value === 'all' || a.doctorId === filterDoctor.value)
      .filter((a) => !filterDate.value || a.date === filterDate.value)
      .filter((a) => filterStatus.value === 'all' || a.status === filterStatus.value)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }

  function renderTable() {
    const list = filteredAppointments();
    tableEmpty.hidden = list.length > 0;
    tableBody.innerHTML = list.map((a) => {
      const d = DB.getDoctor(a.doctorId);
      const p = DB.getPatient(a.patientId);
      const actions = a.status === 'booked'
        ? `<button type="button" class="btn btn-small" data-action="completed" data-id="${a.id}">Done</button>
           <button type="button" class="btn btn-small btn-danger" data-action="cancelled" data-id="${a.id}">Cancel</button>`
        : '<span class="muted">—</span>';
      return `
        <tr>
          <td data-label="Date">${UI.formatDate(a.date)}</td>
          <td data-label="Time">${a.time}</td>
          <td data-label="Doctor">${d ? UI.escapeHTML(d.name) : '—'}</td>
          <td data-label="Patient">${p ? `<span class="cell-stack">${UI.escapeHTML(p.name)}<span class="muted small">${UI.escapeHTML(p.phone)}</span></span>` : '—'}</td>
          <td data-label="Reason">${a.reason ? UI.escapeHTML(a.reason) : '—'}</td>
          <td data-label="Status"><span class="badge badge-${a.status}">${a.status}</span></td>
          <td data-label="Actions" class="actions">${actions}</td>
        </tr>`;
    }).join('');
  }

  filterForm.addEventListener('change', renderTable);
  filterForm.addEventListener('reset', () => setTimeout(renderTable)); // wait until fields are cleared

  tableBody.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const status = btn.dataset.action;
    if (status === 'cancelled' && !confirm('Cancel this appointment?')) return;
    DB.setAppointmentStatus(btn.dataset.id, status);
    UI.toast(status === 'completed' ? 'Marked as completed.' : 'Appointment cancelled.', 'success');
    renderStats();
    renderTable();
  });

  /* ---------- CSV export (Blob + object URL) ---------- */
  $('#export-btn').addEventListener('click', () => {
    const rows = filteredAppointments();
    if (!rows.length) { UI.toast('Nothing to export.', 'info'); return; }
    const cell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lines = [['Date', 'Time', 'Doctor', 'Specialty', 'Patient', 'Phone', 'Status', 'Reason'].map(cell).join(',')];
    rows.forEach((a) => {
      const d = DB.getDoctor(a.doctorId) || {};
      const p = DB.getPatient(a.patientId) || {};
      lines.push([a.date, a.time, d.name, d.specialty, p.name, p.phone, a.status, a.reason].map(cell).join(','));
    });
    // "\uFEFF" (byte order mark) makes Excel read accented names as UTF-8
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'appointments-' + UI.todayStr() + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoking immediately can cancel the download in some browsers
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    UI.toast('Exported ' + rows.length + ' appointment' + (rows.length === 1 ? '' : 's') + '.', 'success');
  });

  /* =====================  WORKING HOURS  ===================== */

  function renderSchedule() {
    const doctor = DB.getDoctor(schedDoctor.value);
    if (!doctor) { hoursRows.innerHTML = '<p class="muted">Add a doctor first.</p>'; return; }
    hoursRows.innerHTML = DAYS.map(([key, label]) => {
      const h = doctor.hours[key];
      return `
        <div class="hours-row">
          <label class="day-toggle">
            <input type="checkbox" name="on-${key}" data-day="${key}" ${h.on ? 'checked' : ''}>
            ${label}
          </label>
          <div class="time-pair">
            <label class="sr-only" for="start-${key}">${label} start time</label>
            <input type="time" id="start-${key}" name="start-${key}" value="${h.start}" step="900" ${h.on ? '' : 'disabled'}>
            <span aria-hidden="true">to</span>
            <label class="sr-only" for="end-${key}">${label} end time</label>
            <input type="time" id="end-${key}" name="end-${key}" value="${h.end}" step="900" ${h.on ? '' : 'disabled'}>
          </div>
          <p class="error" id="end-${key}-error" aria-live="polite"></p>
        </div>`;
    }).join('');
    $('#slot-length').value = String(doctor.slotMinutes);
    $('#break-start').value = doctor.breakStart || '';
    $('#break-end').value = doctor.breakEnd || '';
    UI.setError($('#break-end'), '');
  }

  schedDoctor.addEventListener('change', renderSchedule);

  // Enable/disable time inputs when a day is switched on/off
  hoursRows.addEventListener('change', (e) => {
    const day = e.target.dataset.day;
    if (!day) return;
    $('#start-' + day).disabled = !e.target.checked;
    $('#end-' + day).disabled = !e.target.checked;
    if (!e.target.checked) UI.setError($('#end-' + day), ''); // a day off cannot be invalid
  });

  schedForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const doctor = DB.getDoctor(schedDoctor.value);
    if (!doctor) return;
    let valid = true;
    const hours = {};
    DAYS.forEach(([key]) => {
      const on = schedForm.elements['on-' + key].checked;
      const start = $('#start-' + key).value;
      const end = $('#end-' + key).value;
      const msg = on ? Validate.timeRange(start, end) : '';
      if (!UI.setError($('#end-' + key), msg)) valid = false;
      hours[key] = { on, start, end };
    });

    const bStart = $('#break-start').value;
    const bEnd = $('#break-end').value;
    let breakMsg = '';
    if (bStart || bEnd) breakMsg = Validate.timeRange(bStart, bEnd);
    if (!UI.setError($('#break-end'), breakMsg)) valid = false;

    if (!valid) { UI.toast('Please fix the highlighted times.', 'error'); return; }

    doctor.hours = hours;
    doctor.slotMinutes = Number($('#slot-length').value);
    doctor.breakStart = bStart;
    doctor.breakEnd = bEnd;
    DB.updateDoctor(doctor);
    UI.toast('Working hours saved for ' + doctor.name + '.', 'success');
  });

  /* =====================  ADD DOCTOR  ===================== */

  doctorForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = doctorForm.elements;
    const okName = UI.setError(f['docname'], Validate.name(f['docname'].value));
    const okSpec = UI.setError(f['specialty'], f['specialty'].value ? '' : 'Choose a specialty.');
    if (!okName || !okSpec) return;
    const doctor = DB.addDoctor(f['docname'].value.trim(), f['specialty'].value);
    doctorForm.reset();
    fillDoctorSelects();
    schedDoctor.value = doctor.id;
    renderSchedule();
    UI.toast(doctor.name + ' added. Set their working hours below.', 'success');
  });

  /* =====================  RESET DEMO  ===================== */

  $('#reset-btn').addEventListener('click', () => {
    if (!confirm('Delete ALL patients, appointments and changes, and reload the demo data?')) return;
    DB.reset();
    refreshAll();
    UI.toast('Demo data restored.', 'info');
  });

  // Live update when a patient books in another tab
  window.addEventListener('storage', (e) => {
    if (e.key === DB.KEY && !appSection.hidden) {
      fillDoctorSelects(); // a doctor may have been added in the other tab
      renderStats();
      renderTable();
    }
  });

  init();
})();
