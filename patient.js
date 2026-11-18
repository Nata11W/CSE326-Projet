/**
 * patient.js – Patient side (book.html):
 * login / register, choose doctor (with photo & profile), pick slot,
 * book, token slip, view & cancel, call the clinic instead.
 */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const esc = UI.escapeHTML;
  const state = { patient: null, doctorId: null, time: null };

  // ---------- DOM references ----------
  const authSection = $('#auth-section');
  const appSection = $('#app-section');
  const loginForm = $('#login-form');
  const registerForm = $('#register-form');
  const tabLogin = $('#tab-login');
  const tabRegister = $('#tab-register');
  const authClinics = $('#auth-clinics');
  const doctorList = $('#doctor-list');
  const doctorSearch = $('#doctor-search');
  const dateInput = $('#booking-date');
  const slotList = $('#slot-list');
  const reason = $('#reason');
  const reasonCount = $('#reason-count');
  const summary = $('#booking-summary');
  const confirmBtn = $('#confirm-btn');
  const bookingForm = $('#booking-form');
  const callBox = $('#call-box');
  const myList = $('#my-appointments');
  const statusFilter = $('#status-filter');
  const tokenDialog = $('#token-dialog');
  const payDialog = $('#pay-dialog');
  const payError = $('#pay-method-error');
  const FEE = Payments.BOOKING_FEE;

  /** Reads ?doctor=doc_2&date=2026-10-27&time=09:30 (links from the home page). */
  function readUrlChoice() {
    const params = new URLSearchParams(location.search);
    const doctorId = params.get('doctor');
    if (doctorId && DB.getDoctor(doctorId)) state.doctorId = doctorId;
    const date = params.get('date');
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) dateInput.value = date;
    const time = params.get('time');
    if (time && /^\d{2}:\d{2}$/.test(time)) state.time = time;
    const q = params.get('q');
    if (q) doctorSearch.value = q;
  }

  function init() {
    readUrlChoice();
    const session = UI.getSession();
    if (session && session.role === 'patient') state.patient = DB.getPatient(session.id);
    if (state.patient) showApp(); else showAuth();
  }

  /* =====================  AUTHENTICATION  ===================== */

  function showAuth() {
    authSection.hidden = false;
    appSection.hidden = true;
    authClinics.innerHTML = DB.getClinics().map((c) => Profiles.clinicBlock(c)).join('');
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
      case 'consent': msg = input.checked ? '' : 'Tick the box to continue.'; break;
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
      UI.setError(f['email'], 'An account with this email already exists. Log in instead.');
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
      UI.setError(f['password'], 'Email or password is incorrect.');
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
    location.href = 'book.html';
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
    const doctors = DB.getDoctors().filter((d) => {
      const clinic = Profiles.clinicOf(d);
      return (d.name + ' ' + d.specialty + ' ' + (clinic ? clinic.name : '')).toLowerCase().includes(q);
    });
    if (!doctors.length) {
      doctorList.innerHTML = '<p class="muted">No doctor matches your search. Try a specialty such as "Pediatrics".</p>';
      return;
    }
    doctorList.innerHTML = doctors.map((d) => {
      const clinic = Profiles.clinicOf(d);
      return `
        <div class="choice-card">
          <label class="choice-main">
            <input type="radio" name="doctor" value="${d.id}" ${d.id === state.doctorId ? 'checked' : ''}>
            ${Profiles.photo(d, 'sm')}
            <span class="choice-body">
              <strong>${esc(d.name)}</strong>
              <span class="muted small">${esc(d.specialty)}${clinic ? '<br>' + esc(clinic.name) : ''}</span>
            </span>
          </label>
          <button type="button" class="link-btn" data-profile="${d.id}" aria-label="View profile of ${esc(d.name)}">Profile</button>
        </div>`;
    }).join('');
  }

  doctorSearch.addEventListener('input', renderDoctors);

  function selectDoctor(id) {
    state.doctorId = id;
    state.time = null;
    renderDoctors();
    renderSlots();
  }

  // Event delegation: one listener for all doctor radio buttons
  doctorList.addEventListener('change', (e) => {
    if (e.target.name === 'doctor') selectDoctor(e.target.value);
  });
  doctorList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-profile]');
    if (btn) Profiles.open(btn.dataset.profile, { onBook: selectDoctor });
  });

  dateInput.addEventListener('change', () => {
    state.time = null;
    renderSlots();
  });

  function renderSlots() {
    slotList.innerHTML = buildSlotsHTML();
    updateSummary();
    renderCallBox();
  }

  function buildSlotsHTML() {
    const doctor = state.doctorId && DB.getDoctor(state.doctorId);
    const date = dateInput.value;
    if (!doctor) return '<p class="muted">Choose a doctor to see their free times.</p>';
    if (!date || date < dateInput.min || date > dateInput.max) {
      state.time = null;
      return '<p class="muted">Choose a date within the next 60 days.</p>';
    }
    const clinic = Profiles.clinicOf(doctor);
    if (clinic && !Payments.subscriptionStatus(clinic.subscription, UI.todayStr()).active) {
      state.time = null;
      return `<p class="notice">Online booking is paused for ${esc(clinic.name)}. Call the clinic to book ${esc(doctor.name)}.</p>`;
    }
    const slots = Slots.generate(doctor, date, DB.getAppointments());
    if (!slots.length) {
      state.time = null;
      return `<p class="muted">${esc(doctor.name)} doesn't work on this day. Choose another date.</p>`;
    }
    // If the chosen slot was taken in another tab, unselect it
    if (state.time && !slots.some((s) => s.time === state.time && s.available)) state.time = null;

    const free = slots.filter((s) => s.available).length;
    return `<p class="muted">${free} free time${free === 1 ? '' : 's'} on ${esc(UI.formatDate(date))}</p>
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

  function chosenMethod() {
    const checked = bookingForm.querySelector('input[name="payMethod"]:checked');
    return checked ? checked.value : '';
  }

  function updateSummary() {
    const doctor = state.doctorId && DB.getDoctor(state.doctorId);
    const ready = Boolean(doctor && dateInput.value && state.time);
    const method = chosenMethod();
    confirmBtn.disabled = !ready;
    confirmBtn.textContent = method === 'upi' || method === 'card'
      ? `Pay ${Payments.rupees(FEE)} and book`
      : 'Confirm booking';
    summary.textContent = ready
      ? `${doctor.name} (${doctor.specialty}), ${UI.formatDate(dateInput.value)} at ${state.time}. Booking fee ${Payments.rupees(FEE)}${method === 'clinic' ? ', paid at the clinic' : ''}.`
      : '';
  }

  // Payment choice changed: update the button text and clear the error
  bookingForm.addEventListener('change', (e) => {
    if (e.target.name === 'payMethod') {
      payError.textContent = '';
      updateSummary();
    }
  });

  /** "Prefer to call?" box for the selected doctor's clinic. */
  function renderCallBox() {
    const doctor = state.doctorId && DB.getDoctor(state.doctorId);
    const clinic = Profiles.clinicOf(doctor);
    callBox.innerHTML = clinic
      ? `<p><strong>Rather talk to someone?</strong> ${esc(clinic.name)} can book ${esc(doctor.name)} for you by phone.</p>
         ${Profiles.callButton(clinic, 'Call ' + clinic.phone)}`
      : '';
  }

  reason.addEventListener('input', () => {
    reasonCount.textContent = reason.value.length;
  });

  bookingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!state.doctorId || !state.time) return;
    const method = chosenMethod();
    const msg = Validate.paymentMethod(method);
    payError.textContent = msg;
    if (msg) {
      bookingForm.querySelector('input[name="payMethod"]').focus();
      return;
    }
    // Check the time is still free before asking for payment
    const doctor = DB.getDoctor(state.doctorId);
    const stillFree = Slots.generate(doctor, dateInput.value, DB.getAppointments())
      .some((s) => s.time === state.time && s.available);
    if (!stillFree) {
      UI.toast('This time was just taken by someone else. Choose another time.', 'error');
      renderSlots();
      return;
    }
    if (method === 'clinic') {
      createBooking({ method: 'clinic', status: 'pending' });
    } else {
      openPayment(method);
    }
  });

  /** Saves the appointment with its payment, then shows the token slip. */
  function createBooking(payment) {
    try {
      const doctor = DB.getDoctor(state.doctorId);
      const appt = DB.addAppointment({
        doctorId: doctor.id,
        patientId: state.patient.id,
        date: dateInput.value,
        time: state.time,
        token: Slots.tokenFor(doctor, dateInput.value, state.time),
        reason: reason.value.trim(),
        payment: Object.assign({ amount: FEE }, payment)
      });
      UI.notify('Appointment booked', `${doctor.name}, ${UI.formatDate(appt.date)} at ${appt.time}`);
      state.time = null;
      reason.value = '';
      reasonCount.textContent = '0';
      bookingForm.querySelectorAll('input[name="payMethod"]').forEach((r) => { r.checked = false; });
      renderSlots();
      renderMyAppointments();
      showToken(appt);
    } catch (err) {
      console.error(err);
      UI.toast(err.message, 'error');
      renderSlots();
    }
  }

  /* =====================  DEMO PAYMENT  ===================== */

  let paying = false;

  function openPayment(method) {
    const doctor = DB.getDoctor(state.doctorId);
    payDialog.innerHTML = `
      <div class="pay-box">
        <div class="pay-head">
          <h2 id="pay-title">Pay ${Payments.rupees(FEE)}</h2>
          <span class="demo-flag">Demo payment</span>
        </div>
        <p class="demo-note">This is a student project. No money is taken, and you are not asked for any card or bank details.</p>
        <dl class="pay-facts">
          <div><dt>For</dt><dd>Booking fee, ${esc(doctor.name)}</dd></div>
          <div><dt>When</dt><dd>${esc(UI.formatDate(dateInput.value))} at ${state.time}</dd></div>
          <div><dt>Method</dt><dd>${Payments.METHODS[method]}</dd></div>
          <div class="pay-total"><dt>Total</dt><dd>${Payments.rupees(FEE)}</dd></div>
        </dl>
        <p class="pay-status" aria-live="polite"></p>
        <div class="pay-actions">
          <button type="button" class="btn btn-ghost" data-pay-cancel>Cancel</button>
          <button type="button" class="btn btn-primary" data-pay-now>Pay ${Payments.rupees(FEE)} (demo)</button>
        </div>
      </div>`;
    payDialog.dataset.method = method;
    if (typeof payDialog.showModal === 'function') payDialog.showModal();
    else payDialog.setAttribute('open', '');
    payDialog.querySelector('[data-pay-now]').focus();
  }

  payDialog.addEventListener('click', (e) => {
    if (paying) return;
    if (e.target === payDialog || e.target.closest('[data-pay-cancel]')) {
      payDialog.close();
      UI.toast('Payment cancelled. Nothing was booked.', 'info');
      return;
    }
    if (!e.target.closest('[data-pay-now]')) return;

    // Simulate the payment provider: show "processing" for a moment, then succeed
    paying = true;
    payDialog.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    const status = payDialog.querySelector('.pay-status');
    status.className = 'pay-status is-processing';
    status.textContent = 'Processing payment…';
    setTimeout(() => {
      status.className = 'pay-status is-done';
      status.textContent = 'Payment successful';
      setTimeout(() => {
        paying = false;
        payDialog.close();
        createBooking({
          method: payDialog.dataset.method,
          status: 'paid',
          ref: Payments.reference('PAY'),
          paidAt: new Date().toISOString()
        });
      }, 600);
    }, 1200);
  });

  // Escape key must not close the window while the payment is processing
  payDialog.addEventListener('cancel', (e) => {
    if (paying) e.preventDefault();
  });

  /* =====================  TOKEN SLIP  ===================== */

  function tokenText(appt) {
    return appt.token ? String(appt.token).padStart(2, '0') : '–';
  }

  function slipHTML(appt) {
    const doctor = DB.getDoctor(appt.doctorId);
    const clinic = Profiles.clinicOf(doctor);
    return `
      <article class="slip">
        <header class="slip-head">
          <span class="slip-brand">WebCareBooking</span>
          <span class="slip-kind">Appointment slip</span>
        </header>
        <div class="slip-main">
          <div class="slip-token">
            <span class="slip-token-label">Token</span>
            <span class="slip-token-no">${tokenText(appt)}</span>
          </div>
          <div class="slip-when">
            <span class="slip-date">${esc(UI.formatDate(appt.date))}</span>
            <span class="slip-time">${appt.time}</span>
          </div>
        </div>
        ${doctor ? `
        <div class="slip-doctor">
          ${Profiles.photo(doctor, 'sm')}
          <div><strong>${esc(doctor.name)}</strong><br><span class="muted small">${esc(doctor.specialty)}</span></div>
        </div>` : ''}
        <dl class="slip-facts">
          <div><dt>Patient</dt><dd>${esc(state.patient.name)}</dd></div>
          ${appt.reason ? `<div><dt>Reason</dt><dd>${esc(appt.reason)}</dd></div>` : ''}
          ${appt.payment ? `<div><dt>Booking fee</dt><dd>${paymentText(appt.payment)}</dd></div>` : ''}
        </dl>
        ${clinic ? `<div class="slip-clinic">${Profiles.clinicBlock(clinic, { heading: 'h3' })}</div>` : ''}
        <p class="slip-note small">Please arrive 10 minutes early. To change the time, cancel online or call the clinic.</p>
      </article>`;
  }

  function paymentText(p) {
    const amount = Payments.rupees(p.amount);
    if (p.status === 'paid' && p.method !== 'clinic') return `${amount} paid online (${Payments.METHODS[p.method]})<br><span class="muted small">Ref. ${esc(p.ref || '')}</span>`;
    if (p.status === 'paid') return `${amount} paid at the clinic`;
    if (p.status === 'pending') return `${amount} to pay at the reception`;
    if (p.status === 'refunded') return `${amount} refunded`;
    return 'No fee';
  }

  function showToken(appt) {
    tokenDialog.innerHTML = `
      <h2 id="token-title" class="sr-only">Appointment booked</h2>
      <p class="token-done">Appointment booked</p>
      ${slipHTML(appt)}
      <div class="token-actions">
        <button type="button" class="btn btn-ghost" data-print>Print slip</button>
        <button type="button" class="btn btn-primary" data-close>Done</button>
      </div>`;
    if (typeof tokenDialog.showModal === 'function') tokenDialog.showModal();
    else tokenDialog.setAttribute('open', '');
  }

  tokenDialog.addEventListener('click', (e) => {
    if (e.target === tokenDialog || e.target.closest('[data-close]')) tokenDialog.close();
    if (e.target.closest('[data-print]')) window.print();
  });

  /* =====================  MY APPOINTMENTS  ===================== */

  function renderMyAppointments() {
    const filter = statusFilter.value;
    const list = DB.getAppointments()
      .filter((a) => a.patientId === state.patient.id && (filter === 'all' || a.status === filter))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    if (!list.length) {
      myList.innerHTML = '<li class="empty muted">No appointments here yet. Choose a doctor on the left to book one.</li>';
      return;
    }
    const now = new Date();
    myList.innerHTML = list.map((a) => {
      const d = DB.getDoctor(a.doctorId);
      const clinic = Profiles.clinicOf(d);
      const future = new Date(a.date + 'T' + a.time) > now;
      const canCancel = a.status === 'booked' && future;
      return `
        <li class="mini-slip status-${a.status}">
          <div class="mini-token" aria-label="Token ${tokenText(a)}"><span>Token</span><strong>${tokenText(a)}</strong></div>
          <div class="mini-body">
            <p class="mini-when"><strong>${esc(UI.formatDate(a.date))}, ${a.time}</strong></p>
            <p class="mini-who">${d ? esc(d.name) + ', ' + esc(d.specialty) : 'Doctor removed'}</p>
            ${clinic ? `<p class="muted small">${esc(clinic.name)}</p>` : ''}
            ${a.reason ? `<p class="muted small">${esc(a.reason)}</p>` : ''}
            <div class="mini-actions">
              <span class="badge badge-${a.status}">${a.status}</span>
              ${a.payment ? `<span class="pay-badge pay-${a.payment.status}">${esc(Payments.label(a.payment))}</span>` : ''}
              ${canCancel && clinic ? `<a class="link-btn" href="${UI.telHref(clinic.phone)}">Call clinic</a>` : ''}
              ${a.status === 'booked' ? `<button type="button" class="link-btn" data-slip="${a.id}">Show slip</button>` : ''}
              ${canCancel ? `<button type="button" class="link-btn link-danger" data-cancel="${a.id}">Cancel</button>` : ''}
            </div>
          </div>
        </li>`;
    }).join('');
  }

  statusFilter.addEventListener('change', renderMyAppointments);

  myList.addEventListener('click', (e) => {
    const slipId = e.target.dataset.slip;
    if (slipId) {
      const appt = DB.getAppointments().find((a) => a.id === slipId);
      if (appt) showToken(appt);
      return;
    }
    const id = e.target.dataset.cancel;
    if (!id) return;
    const appt = DB.getAppointments().find((a) => a.id === id);
    const refund = Payments.refundOnCancel(appt, new Date());
    const paidOnline = appt.payment && appt.payment.status === 'paid' && appt.payment.method !== 'clinic';
    let question = 'Cancel this appointment?';
    if (refund) question += `\nYour ${Payments.rupees(appt.payment.amount)} booking fee will be refunded.`;
    else if (paidOnline) question += `\nIt is less than ${Payments.FREE_CANCEL_HOURS} hours before the visit, so the booking fee is not refunded.`;
    if (!confirm(question)) return;
    DB.setAppointmentStatus(id, 'cancelled');
    if (refund) {
      DB.setPayment(id, { status: 'refunded', refundedAt: new Date().toISOString() });
      UI.toast(`Appointment cancelled. ${Payments.rupees(appt.payment.amount)} refunded (demo).`, 'success');
    } else {
      if (appt.payment && appt.payment.status === 'pending') DB.setPayment(id, { status: 'waived' });
      UI.toast('Appointment cancelled.', 'info');
    }
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
        UI.notify('Reminder: appointment soon', `${d ? d.name : 'Doctor'}, ${UI.formatDate(a.date)} at ${a.time}`);
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
