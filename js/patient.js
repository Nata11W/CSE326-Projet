/**
 * patient.js – Patient side (book.html):
 * login / register, choose doctor, pick slot, pay the booking fee (demo),
 * book, print the token slip, view & cancel.
 */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const state = { patient: null, doctorId: null, time: null, payMethod: null };

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
  const payOptions = $('#pay-options');
  const confirmHint = $('#confirm-hint');
  const payDialog = $('#pay-dialog');
  const payForm = $('#pay-form');
  const payBtn = $('#pay-btn');
  const slipDialog = $('#slip-dialog');
  const slipContent = $('#slip-content');

  const FEE = Payments.formatINR(Payments.BOOKING_FEE);

  function init() {
    // A doctor can be preselected from the home page: book.html?doctor=doc_1
    const wanted = new URLSearchParams(location.search).get('doctor');
    if (wanted && DB.getDoctor(wanted)) state.doctorId = wanted;

    $('#reg-dob').max = UI.todayStr();
    const session = UI.getSession();
    if (session && session.role === 'patient') state.patient = DB.getPatient(session.id);
    if (state.patient) showApp(); else showAuth();
  }

  /* =====================  AUTHENTICATION  ===================== */

  function showAuth() {
    authSection.hidden = false;
    appSection.hidden = true;
  }

  function switchTab(which, focusTab) {
    const isLogin = which === 'login';
    tabLogin.setAttribute('aria-selected', String(isLogin));
    tabRegister.setAttribute('aria-selected', String(!isLogin));
    // Roving tabindex: only the selected tab is in the Tab order
    tabLogin.tabIndex = isLogin ? 0 : -1;
    tabRegister.tabIndex = isLogin ? -1 : 0;
    loginForm.hidden = !isLogin;
    registerForm.hidden = isLogin;
    if (focusTab) (isLogin ? tabLogin : tabRegister).focus();
  }
  tabLogin.addEventListener('click', () => switchTab('login'));
  tabRegister.addEventListener('click', () => switchTab('register'));
  // Left/Right arrow keys move between tabs (WAI-ARIA tabs pattern)
  $('.tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    switchTab(tabLogin.getAttribute('aria-selected') === 'true' ? 'register' : 'login', true);
  });
  // "Create a free account" / "Log in" links under each form
  authSection.addEventListener('click', (e) => {
    const link = e.target.closest('[data-tab]');
    if (link) switchTab(link.dataset.tab, true);
  });

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
      doctorList.innerHTML = '<p class="info-box">No doctor matches your search.</p>';
      return;
    }
    doctorList.innerHTML = doctors.map((d) => `
      <label class="choice-card">
        <input type="radio" name="doctor" value="${d.id}" ${d.id === state.doctorId ? 'checked' : ''}>
        <span class="avatar" aria-hidden="true">${UI.escapeHTML(d.name.replace('Dr. ', '').charAt(0))}</span>
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

  const ICON_INFO = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>';
  const ICON_CLOCK = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

  /** Grey message box with an icon; text must already be escaped. */
  function infoBox(html) {
    return `<p class="info-box">${ICON_INFO}<span>${html}</span></p>`;
  }

  function renderSlots() {
    slotList.innerHTML = buildSlotsHTML();
    updateSummary();
  }

  function buildSlotsHTML() {
    const doctor = state.doctorId && DB.getDoctor(state.doctorId);
    const date = dateInput.value;
    if (!doctor) return infoBox('Choose a doctor to see free time slots.');
    if (!date || date < dateInput.min || date > dateInput.max) {
      state.time = null;
      return infoBox('Choose a date within the next 60 days.');
    }
    const slots = Slots.generate(doctor, date, DB.getAppointments());
    if (!slots.length) {
      state.time = null;
      return infoBox(`${UI.escapeHTML(doctor.name)} does not work on this day. Try another date.`);
    }
    // If the chosen slot was taken in another tab, unselect it
    if (state.time && !slots.some((s) => s.time === state.time && s.available)) state.time = null;

    const free = slots.filter((s) => s.available).length;
    if (!free) return infoBox('All slots are taken or already past on this day. Try another date.');
    return `<p class="slots-meta">${ICON_CLOCK} ${free} free slot${free === 1 ? '' : 's'} on ${UI.formatDate(date)}</p>
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
    const slotReady = Boolean(doctor && dateInput.value && state.time);
    const ready = slotReady && Boolean(state.payMethod);
    const online = state.payMethod && state.payMethod !== 'clinic';

    confirmBtn.disabled = !ready;
    confirmBtn.textContent = online ? `Continue to payment · ${FEE}` : 'Confirm booking';
    confirmHint.textContent = slotReady && !state.payMethod ? 'Choose how to pay the booking fee to continue.' : '';

    if (!slotReady) { summary.textContent = ''; return; }
    const payText = !state.payMethod ? ''
      : online ? ` Booking fee ${FEE}, paid now by ${Payments.METHODS[state.payMethod]}.`
        : ` Booking fee ${FEE}, to pay at the clinic.`;
    summary.textContent =
      `You are booking ${doctor.name} (${doctor.specialty}) on ${UI.formatDate(dateInput.value)} at ${state.time}.` + payText;
  }

  payOptions.addEventListener('change', (e) => {
    if (e.target.name === 'payment') {
      state.payMethod = e.target.value;
      updateSummary();
    }
  });

  reason.addEventListener('input', () => {
    reasonCount.textContent = reason.value.length;
  });

  bookingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!state.doctorId || !state.time || !state.payMethod) return;
    if (state.payMethod === 'clinic') book('clinic');
    else openPayment();
  });

  /** Saves the booking with its payment record, then shows the token slip. */
  function book(method) {
    try {
      const appt = DB.addAppointment({
        doctorId: state.doctorId,
        patientId: state.patient.id,
        date: dateInput.value,
        time: state.time,
        reason: reason.value.trim(),
        payment: Payments.create(method)
      });
      const doctor = DB.getDoctor(appt.doctorId);
      UI.toast(`Booked! ${doctor.name}, ${UI.formatDate(appt.date)} at ${appt.time}.`, 'success');
      UI.notify('Appointment confirmed', `${doctor.name} – ${UI.formatDate(appt.date)} at ${appt.time}`);
      state.time = null;
      reason.value = '';
      reasonCount.textContent = '0';
      renderSlots();
      renderMyAppointments();
      showSlip(appt);
      return true;
    } catch (err) {
      console.error(err);
      UI.toast(err.message, 'error');
      renderSlots();
      return false;
    }
  }

  /* =====================  DEMO PAYMENT  ===================== */

  /** <dl> rows from [label, html] pairs; values must already be escaped. */
  function detailsHTML(rows) {
    return rows.map(([dt, dd]) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`).join('');
  }

  function openPayment() {
    const doctor = DB.getDoctor(state.doctorId);
    $('#pay-method').textContent = Payments.METHODS[state.payMethod];
    $('#pay-amount').textContent = FEE;
    $('#pay-details').innerHTML = detailsHTML([
      ['Doctor', UI.escapeHTML(doctor.name)],
      ['Date', UI.formatDate(dateInput.value)],
      ['Time', state.time],
      ['Booking fee', FEE]
    ]);
    payBtn.disabled = false;
    payBtn.textContent = `Pay ${FEE} (demo)`;
    payDialog.showModal();
  }

  $('#pay-cancel').addEventListener('click', () => payDialog.close());

  // Do not let Escape close the dialog while the "payment" is processing
  payDialog.addEventListener('cancel', (e) => {
    if (payBtn.disabled) e.preventDefault();
  });

  payForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    payBtn.disabled = true;
    payBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Processing…';
    // Pretend to wait for the bank. A real app would wait for the gateway's
    // confirmation, checked on a server (see README).
    await new Promise((resolve) => setTimeout(resolve, 900));
    payDialog.close();
    payBtn.disabled = false;
    book(state.payMethod);
  });

  /* =====================  TOKEN SLIP  ===================== */

  function showSlip(appt) {
    const d = DB.getDoctor(appt.doctorId);
    const p = appt.payment;
    const rows = [
      ['Patient', UI.escapeHTML(state.patient.name)],
      ['Doctor', d ? UI.escapeHTML(d.name) : 'Doctor removed'],
      ['Specialty', d ? UI.escapeHTML(d.specialty) : '—'],
      ['Date', UI.formatDate(appt.date)],
      ['Time', appt.time],
      ['Booking fee', p ? Payments.formatINR(p.amount) : '—'],
      ['Payment', `<span class="badge badge-${Payments.badgeType(p)}">${Payments.label(p)}</span>`]
    ];
    if (p && p.ref) rows.push(['Reference', `<code>${UI.escapeHTML(p.ref)}</code>`]);
    if (appt.status !== 'booked') {
      rows.push(['Status', `<span class="badge badge-${appt.status}">${appt.status}</span>`]);
    }
    slipContent.innerHTML = `
      <div class="slip-head">
        <span class="logo-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z"/></svg></span>
        <div>
          <h2 id="slip-title">Appointment token slip</h2>
          <p class="muted small">WebCareBooking</p>
        </div>
      </div>
      <div class="slip-token">
        <span>Token</span>
        <strong>${appt.token ? Slots.formatToken(appt.token) : '—'}</strong>
      </div>
      <dl class="details-list">${detailsHTML(rows)}</dl>
      <p class="slip-note">${p && p.status === 'pay-at-clinic'
        ? `Please pay ${Payments.formatINR(p.amount)} at the reception. `
        : ''}Arrive 10 minutes early and show this token at the reception.</p>`;
    if (!slipDialog.open) slipDialog.showModal();
  }

  $('#slip-close').addEventListener('click', () => slipDialog.close());
  $('#slip-print').addEventListener('click', () => window.print());

  /* =====================  MY APPOINTMENTS  ===================== */

  function renderMyAppointments() {
    const filter = statusFilter.value;
    const list = DB.getAppointments()
      .filter((a) => a.patientId === state.patient.id && (filter === 'all' || a.status === filter))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    if (!list.length) {
      myList.innerHTML = `<li class="empty-state">${filter === 'all'
        ? 'You have no appointments yet. Book your first one!'
        : 'No ' + filter + ' appointments.'}</li>`;
      return;
    }
    const now = new Date();
    myList.innerHTML = list.map((a) => {
      const d = DB.getDoctor(a.doctorId);
      const future = new Date(a.date + 'T' + a.time) > now;
      const canCancel = a.status === 'booked' && future;
      return `
        <li class="appt appt-${a.status}">
          <div class="appt-info">
            <strong>${UI.formatDate(a.date)} · ${a.time}</strong>
            <span class="muted">${d ? UI.escapeHTML(d.name) + ' – ' + UI.escapeHTML(d.specialty) : 'Doctor removed'}</span>
            ${a.reason ? `<span class="muted small">${UI.escapeHTML(a.reason)}</span>` : ''}
            <span class="appt-meta">
              ${a.token ? `<span class="small">Token ${Slots.formatToken(a.token)}</span>` : ''}
              <span class="badge badge-${Payments.badgeType(a.payment)}" title="${Payments.describe(a.payment)}">${Payments.label(a.payment)}</span>
            </span>
          </div>
          <div class="appt-actions">
            <span class="badge badge-${a.status}">${a.status}</span>
            <button type="button" class="btn btn-small" data-slip="${a.id}">Slip</button>
            ${canCancel ? `<button type="button" class="btn btn-small btn-danger" data-cancel="${a.id}">Cancel</button>` : ''}
          </div>
        </li>`;
    }).join('');
  }

  statusFilter.addEventListener('change', renderMyAppointments);

  myList.addEventListener('click', (e) => {
    const slipBtn = e.target.closest('[data-slip]');
    if (slipBtn) {
      const appt = DB.getAppointments().find((a) => a.id === slipBtn.dataset.slip);
      if (appt) showSlip(appt);
      return;
    }
    const btn = e.target.closest('[data-cancel]');
    if (!btn) return;
    const id = btn.dataset.cancel;
    const old = DB.getAppointments().find((a) => a.id === id);
    const paid = old && old.payment && old.payment.status === 'paid';
    const fee = paid ? Payments.formatINR(old.payment.amount) : '';
    if (!confirm(paid ? `Cancel this appointment? Your ${fee} demo payment will be refunded.` : 'Cancel this appointment?')) return;
    DB.setAppointmentStatus(id, 'cancelled');
    UI.toast(paid ? `Appointment cancelled. ${fee} refunded (demo).` : 'Appointment cancelled.', 'info');
    renderMyAppointments();
    renderSlots();
  });

  /** Reminds the patient of appointments in the next 24 h (once per session). */
  function checkReminders() {
    // Keyed per patient, so a second patient logging in on the same tab still gets reminded
    const key = 'wcb_reminded_' + state.patient.id;
    if (sessionStorage.getItem(key)) return;
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
    sessionStorage.setItem(key, '1');
  }

  // "storage" fires when ANOTHER tab changes localStorage → live updates
  window.addEventListener('storage', (e) => {
    if (e.key === DB.KEY && state.patient) {
      // The account may have been erased by "Reset demo data" in the dashboard
      state.patient = DB.getPatient(state.patient.id);
      if (!state.patient) { UI.clearSession(); location.reload(); return; }
      if (state.doctorId && !DB.getDoctor(state.doctorId)) state.doctorId = null;
      renderDoctors();
      renderSlots();
      renderMyAppointments();
    }
  });

  init();
})();
