/**
 * patient.js – Patient side (book.html):
 * login / register, choose doctor, pick slot, book, view & cancel.
 */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const state = { patient: null, doctorId: null, time: null };

  // ---------- DOM references ----------
  const authSection = $('#auth-section');
  const appSection = $('#app-section');
  const loginForm = $('#login-form');
  const registerForm = $('#register-form');
  const tabLogin = $('#tab-login');
  const tabRegister = $('#tab-register');
  const doctorList = $('#doctor-list');
  const doctorSearch = $('#doctor-search');
  const dateInput = $('#booking-date');
  const slotList = $('#slot-list');
  const reason = $('#reason');
  const reasonCount = $('#reason-count');
  const summary = $('#booking-summary');
  const confirmBtn = $('#confirm-btn');
  const bookingForm = $('#booking-form');
  const myList = $('#my-appointments');
  const statusFilter = $('#status-filter');

  function init() {
    const session = UI.getSession();
    if (session && session.role === 'patient') state.patient = DB.getPatient(session.id);
    if (state.patient) showApp(); else showAuth();
  }

  /* =====================  AUTHENTICATION  ===================== */

  function showAuth() {
    authSection.hidden = false;
    appSection.hidden = true;
  }

  function switchTab(which) {
    const isLogin = which === 'login';
    tabLogin.setAttribute('aria-selected', String(isLogin));
    tabRegister.setAttribute('aria-selected', String(!isLogin));
    loginForm.hidden = !isLogin;
    registerForm.hidden = isLogin;
  }
  tabLogin.addEventListener('click', () => switchTab('login'));
  tabRegister.addEventListener('click', () => switchTab('register'));

  /** Validates one register field and shows its message. */
  function validateRegisterField(input) {
    const f = registerForm.elements;
    let msg = '';
    switch (input.name) {
      case 'fullname': msg = Validate.name(input.value); break;
      case 'email': msg = Validate.email(input.value); break;
      case 'phone': msg = Validate.phone(input.value); break;
      case 'dob': msg = Validate.dob(input.value); break;
      case 'password': msg = Validate.password(input.value); break;
      case 'confirm': msg = Validate.match(f['password'].value, input.value); break;
      case 'consent': msg = input.checked ? '' : 'Please accept to continue.'; break;
      default: return true;
    }
    return UI.setError(input, msg);
  }

  // Validate each field when the user leaves it (focusout bubbles, blur does not)
  registerForm.addEventListener('focusout', (e) => {
    if (e.target.matches('input') && e.target.value) validateRegisterField(e.target);
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputs = Array.from(registerForm.querySelectorAll('input'));
    const allValid = inputs.map(validateRegisterField).every(Boolean); // map first: show ALL errors
    if (!allValid) {
      registerForm.querySelector('[aria-invalid="true"]').focus();
      return;
    }
    const f = registerForm.elements;
    const email = f['email'].value.trim().toLowerCase();
    if (DB.findPatientByEmail(email)) {
      UI.setError(f['email'], 'An account with this email already exists. Please log in.');
      f['email'].focus();
      return;
    }
    const patient = DB.addPatient({
      name: f['fullname'].value.trim(),
      email,
      phone: f['phone'].value.trim(),
      dob: f['dob'].value,
      passwordHash: await UI.hash(f['password'].value)
    });
    UI.setSession({ role: 'patient', id: patient.id });
    state.patient = patient;
    registerForm.reset();
    UI.toast('Account created. Welcome!', 'success');
    showApp();
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = loginForm.elements;
    const okEmail = UI.setError(f['email'], Validate.email(f['email'].value));
    const okPass = UI.setError(f['password'], f['password'].value ? '' : 'Password is required.');
    if (!okEmail || !okPass) return;

    const patient = DB.findPatientByEmail(f['email'].value);
    const hashed = await UI.hash(f['password'].value);
    if (!patient || patient.passwordHash !== hashed) {
      UI.setError(f['password'], 'Incorrect email or password.');
      return;
    }
    UI.setSession({ role: 'patient', id: patient.id });
    state.patient = patient;
    loginForm.reset();
    showApp();
  });

  $('#logout-btn').addEventListener('click', () => {
    UI.clearSession();
    state.patient = null;
    location.reload();
  });

  /* =====================  BOOKING  ===================== */

  function showApp() {
    authSection.hidden = true;
    appSection.hidden = false;
    $('#patient-name').textContent = state.patient.name.split(' ')[0];
    const today = UI.todayStr();
    dateInput.min = today;
    dateInput.max = UI.addDays(today, 60);
    if (!dateInput.value) dateInput.value = today;
    renderDoctors();
    renderSlots();
    renderMyAppointments();
    checkReminders();
  }

  function renderDoctors() {
    const q = doctorSearch.value.trim().toLowerCase();
    const doctors = DB.getDoctors().filter((d) =>
      (d.name + ' ' + d.specialty).toLowerCase().includes(q));
    if (!doctors.length) {
      doctorList.innerHTML = '<p class="muted">No doctor matches your search.</p>';
      return;
    }
    doctorList.innerHTML = doctors.map((d) => `
      <label class="choice-card">
        <input type="radio" name="doctor" value="${d.id}" ${d.id === state.doctorId ? 'checked' : ''}>
        <span class="choice-body">
          <strong>${UI.escapeHTML(d.name)}</strong>
          <span class="muted">${UI.escapeHTML(d.specialty)}</span>
        </span>
      </label>`).join('');
  }

  doctorSearch.addEventListener('input', renderDoctors);

  // Event delegation: one listener for all doctor radio buttons
  doctorList.addEventListener('change', (e) => {
    if (e.target.name === 'doctor') {
      state.doctorId = e.target.value;
      state.time = null;
      renderSlots();
    }
  });

  dateInput.addEventListener('change', () => {
    state.time = null;
    renderSlots();
  });

  function renderSlots() {
    slotList.innerHTML = buildSlotsHTML();
    updateSummary();
  }

  function buildSlotsHTML() {
    const doctor = state.doctorId && DB.getDoctor(state.doctorId);
    const date = dateInput.value;
    if (!doctor) return '<p class="muted">Choose a doctor to see free time slots.</p>';
    if (!date || date < dateInput.min || date > dateInput.max) {
      state.time = null;
      return '<p class="muted">Choose a date within the next 60 days.</p>';
    }
    const slots = Slots.generate(doctor, date, DB.getAppointments());
    if (!slots.length) {
      state.time = null;
      return `<p class="muted">${UI.escapeHTML(doctor.name)} does not work on this day. Try another date.</p>`;
    }
    // If the chosen slot was taken in another tab, unselect it
    if (state.time && !slots.some((s) => s.time === state.time && s.available)) state.time = null;

    const free = slots.filter((s) => s.available).length;
    return `<p class="muted">${free} free slot${free === 1 ? '' : 's'}</p>
      <div class="slot-grid">
        ${slots.map((s) => `
          <label class="slot${s.available ? '' : ' slot-taken'}">
            <input type="radio" name="slot" value="${s.time}"
              ${s.available ? '' : 'disabled'} ${s.time === state.time ? 'checked' : ''}>
            <span>${s.time}</span>
          </label>`).join('')}
      </div>`;
  }

  slotList.addEventListener('change', (e) => {
    if (e.target.name === 'slot') {
      state.time = e.target.value;
      updateSummary();
    }
  });

  function updateSummary() {
    const doctor = state.doctorId && DB.getDoctor(state.doctorId);
    const ready = Boolean(doctor && dateInput.value && state.time);
    confirmBtn.disabled = !ready;
    summary.textContent = ready
      ? `You are booking ${doctor.name} (${doctor.specialty}) on ${UI.formatDate(dateInput.value)} at ${state.time}.`
      : '';
  }

  reason.addEventListener('input', () => {
    reasonCount.textContent = reason.value.length;
  });

  bookingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!state.doctorId || !state.time) return;
    try {
      const appt = DB.addAppointment({
        doctorId: state.doctorId,
        patientId: state.patient.id,
        date: dateInput.value,
        time: state.time,
        reason: reason.value.trim()
      });
      const doctor = DB.getDoctor(appt.doctorId);
      UI.toast(`Booked! ${doctor.name}, ${UI.formatDate(appt.date)} at ${appt.time}.`, 'success');
      UI.notify('Appointment confirmed', `${doctor.name} – ${UI.formatDate(appt.date)} at ${appt.time}`);
      state.time = null;
      reason.value = '';
      reasonCount.textContent = '0';
      renderSlots();
      renderMyAppointments();
    } catch (err) {
      console.error(err);
      UI.toast(err.message, 'error');
      renderSlots();
    }
  });

  /* =====================  MY APPOINTMENTS  ===================== */

  function renderMyAppointments() {
    const filter = statusFilter.value;
    const list = DB.getAppointments()
      .filter((a) => a.patientId === state.patient.id && (filter === 'all' || a.status === filter))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    if (!list.length) {
      myList.innerHTML = '<li class="muted">No appointments to show.</li>';
      return;
    }
    const now = new Date();
    myList.innerHTML = list.map((a) => {
      const d = DB.getDoctor(a.doctorId);
      const future = new Date(a.date + 'T' + a.time) > now;
      const canCancel = a.status === 'booked' && future;
      return `
        <li class="appt">
          <div class="appt-info">
            <strong>${UI.formatDate(a.date)} · ${a.time}</strong>
            <span class="muted">${d ? UI.escapeHTML(d.name) + ' – ' + UI.escapeHTML(d.specialty) : 'Doctor removed'}</span>
            ${a.reason ? `<span class="muted small">${UI.escapeHTML(a.reason)}</span>` : ''}
          </div>
          <div class="appt-actions">
            <span class="badge badge-${a.status}">${a.status}</span>
            ${canCancel ? `<button type="button" class="btn btn-small btn-danger" data-cancel="${a.id}">Cancel</button>` : ''}
          </div>
        </li>`;
    }).join('');
  }

  statusFilter.addEventListener('change', renderMyAppointments);

  myList.addEventListener('click', (e) => {
    const id = e.target.dataset.cancel;
    if (!id) return;
    if (!confirm('Cancel this appointment?')) return;
    DB.setAppointmentStatus(id, 'cancelled');
    UI.toast('Appointment cancelled.', 'info');
    renderMyAppointments();
    renderSlots();
  });

  /** Reminds the patient of appointments in the next 24 h (once per session). */
  function checkReminders() {
    if (sessionStorage.getItem('wcb_reminded')) return;
    const now = Date.now();
    const in24h = now + 24 * 60 * 60 * 1000;
    DB.getAppointments()
      .filter((a) => a.patientId === state.patient.id && a.status === 'booked')
      .filter((a) => {
        const t = new Date(a.date + 'T' + a.time).getTime();
        return t > now && t <= in24h;
      })
      .forEach((a) => {
        const d = DB.getDoctor(a.doctorId);
        UI.notify('Reminder: appointment soon', `${d ? d.name : 'Doctor'} – ${UI.formatDate(a.date)} at ${a.time}`);
      });
    sessionStorage.setItem('wcb_reminded', '1');
  }

  // "storage" fires when ANOTHER tab changes localStorage → live updates
  window.addEventListener('storage', (e) => {
    if (e.key === DB.KEY && state.patient) {
      renderDoctors();
      renderSlots();
      renderMyAppointments();
    }
  });

  init();
})();
