/**
 * admin.js – Clinic dashboard (admin.html):
 * login, statistics, appointments, doctors (with photos), working hours,
 * clinic contact details, CSV export.
 */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const esc = UI.escapeHTML;

  // Demo credentials. In a real product this check must happen on a server.
  const ADMIN_EMAIL = 'admin@webcare.com';
  const ADMIN_PASSWORD = 'Admin@123';

  const DAYS = [
    ['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'],
    ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']
  ];
  const PHOTO_SIZE = 360; // photos are stored as 360×360 JPEG

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
  const doctorAdminList = $('#doctor-admin-list');
  const photoInput = $('#doc-photo');
  const photoPreview = $('#doc-photo-preview');
  const photoRemove = $('#doc-photo-remove');
  const clinicForm = $('#clinic-form');
  const clinicSelect = $('#clinic-select');
  const subList = $('#sub-list');
  const subDialog = $('#sub-dialog');

  // Photo chosen in the doctor form: undefined = unchanged, '' = removed, 'data:…' = new
  let pendingPhoto;

  function init() {
    const s = UI.getSession();
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
      UI.setError(f['password'], 'Email or password is incorrect.');
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
    fillSelects();
    renderStats();
    renderTable();
    renderSchedule();
    renderDoctorList();
    loadClinicIntoForm();
    renderPayments();
  }

  function fillSelects() {
    const doctors = DB.getDoctors();
    const options = doctors.map((d) =>
      `<option value="${d.id}">${esc(d.name)} (${esc(d.specialty)})</option>`).join('');
    const keepFilter = filterDoctor.value;
    const keepSched = schedDoctor.value;
    filterDoctor.innerHTML = '<option value="all">All doctors</option>' + options;
    schedDoctor.innerHTML = options;
    filterDoctor.value = doctors.some((d) => d.id === keepFilter) ? keepFilter : 'all';
    if (doctors.some((d) => d.id === keepSched)) schedDoctor.value = keepSched;

    const clinics = DB.getClinics();
    const clinicOptions = clinics.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    const keepDocClinic = $('#doc-clinic').value;
    $('#doc-clinic').innerHTML = clinicOptions;
    if (clinics.some((c) => c.id === keepDocClinic)) $('#doc-clinic').value = keepDocClinic;

    const keepClinic = clinicSelect.value;
    clinicSelect.innerHTML = clinicOptions + '<option value="new">+ Add a new clinic</option>';
    if (keepClinic && (keepClinic === 'new' || clinics.some((c) => c.id === keepClinic))) clinicSelect.value = keepClinic;
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
      const pay = a.payment;
      const canCollect = pay && pay.status === 'pending' && a.status !== 'cancelled';
      const actions = [
        canCollect ? `<button type="button" class="btn btn-small btn-ghost" data-action="collect" data-id="${a.id}">Fee received</button>` : '',
        a.status === 'booked' ? `<button type="button" class="btn btn-small btn-ghost" data-action="completed" data-id="${a.id}">Mark done</button>
           <button type="button" class="btn btn-small btn-danger" data-action="cancelled" data-id="${a.id}">Cancel</button>` : ''
      ].join('') || '<span class="muted">None</span>';
      return `
        <tr>
          <td data-label="Date">${UI.formatDate(a.date)}</td>
          <td data-label="Time">${a.time}</td>
          <td data-label="Token">${a.token ? String(a.token).padStart(2, '0') : '–'}</td>
          <td data-label="Doctor">${d ? `<span class="cell-doctor">${Profiles.photo(d, 'xs')}${esc(d.name)}</span>` : '–'}</td>
          <td data-label="Patient">${p ? esc(p.name) + '<br><a class="small" href="' + UI.telHref(p.phone) + '">' + esc(p.phone) + '</a>' : '–'}</td>
          <td data-label="Reason">${a.reason ? esc(a.reason) : '–'}</td>
          <td data-label="Status"><span class="badge badge-${a.status}">${a.status}</span></td>
          <td data-label="Booking fee">${pay ? `<span class="pay-badge pay-${pay.status}">${esc(Payments.label(pay))}</span>` : '–'}</td>
          <td data-label="Actions" class="actions">${actions}</td>
        </tr>`;
    }).join('');
  }

  filterForm.addEventListener('change', renderTable);
  filterForm.addEventListener('reset', () => setTimeout(renderTable)); // wait until fields are cleared

  tableBody.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const appt = DB.getAppointments().find((a) => a.id === id);
    if (action === 'collect') {
      DB.setPayment(id, { status: 'paid', method: 'clinic', ref: Payments.reference('CASH'), paidAt: new Date().toISOString() });
      UI.toast('Booking fee marked as received at the reception.', 'success');
    } else if (action === 'cancelled') {
      const paidOnline = appt.payment && appt.payment.status === 'paid' && appt.payment.method !== 'clinic';
      const question = 'Cancel this appointment?' + (paidOnline ? '\nThe patient paid online, so the fee is refunded.' : '');
      if (!confirm(question)) return;
      DB.setAppointmentStatus(id, 'cancelled');
      // When the clinic cancels, an online payment is always refunded
      if (paidOnline) DB.setPayment(id, { status: 'refunded', refundedAt: new Date().toISOString() });
      else if (appt.payment && appt.payment.status === 'pending') DB.setPayment(id, { status: 'waived' });
      UI.toast(paidOnline ? 'Appointment cancelled and fee refunded (demo).' : 'Appointment cancelled.', 'success');
    } else {
      DB.setAppointmentStatus(id, action);
      UI.toast('Marked as done.', 'success');
    }
    renderStats();
    renderTable();
    renderPayments();
  });

  /* ---------- CSV export (Blob + object URL) ---------- */
  $('#export-btn').addEventListener('click', () => {
    const rows = filteredAppointments();
    if (!rows.length) { UI.toast('No appointments to export with these filters.', 'info'); return; }
    const cell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lines = [['Date', 'Time', 'Token', 'Doctor', 'Specialty', 'Clinic', 'Patient', 'Phone', 'Status', 'Reason', 'Fee (INR)', 'Payment', 'Payment ref'].map(cell).join(',')];
    rows.forEach((a) => {
      const d = DB.getDoctor(a.doctorId) || {};
      const c = DB.getClinic(d.clinicId) || {};
      const p = DB.getPatient(a.patientId) || {};
      const pay = a.payment || {};
      lines.push([a.date, a.time, a.token, d.name, d.specialty, c.name, p.name, p.phone, a.status, a.reason,
        pay.amount, a.payment ? Payments.label(pay) : '', pay.ref].map(cell).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'appointments-' + UI.todayStr() + '.csv';
    link.click();
    URL.revokeObjectURL(url);
  });

  /* =====================  DOCTORS (with photos)  ===================== */

  function renderDoctorList() {
    doctorAdminList.innerHTML = DB.getDoctors().map((d) => {
      const c = DB.getClinic(d.clinicId);
      return `
        <li class="doctor-admin-row">
          ${Profiles.photo(d, 'sm')}
          <div class="doctor-admin-info">
            <strong>${esc(d.name)}</strong>
            <span class="muted small">${esc(d.specialty)}${c ? ', ' + esc(c.name) : ''}</span>
          </div>
          <button type="button" class="btn btn-small btn-ghost" data-edit="${d.id}">Edit</button>
        </li>`;
    }).join('');
  }

  function showPhotoPreview(src, name) {
    const fake = { name: name || $('#doc-name').value || 'New doctor', photo: src };
    photoPreview.innerHTML = Profiles.photo(fake, 'md');
    photoRemove.hidden = !src;
  }

  function resetDoctorForm() {
    doctorForm.reset();
    $('#doc-id').value = '';
    pendingPhoto = undefined;
    $('#doctor-form-title').textContent = 'Add a doctor';
    $('#doc-submit').textContent = 'Add doctor';
    $('#doc-cancel').hidden = true;
    doctorForm.querySelectorAll('.error').forEach((el) => { el.textContent = ''; });
    doctorForm.querySelectorAll('[aria-invalid]').forEach((el) => el.setAttribute('aria-invalid', 'false'));
    showPhotoPreview('', 'New doctor');
  }

  function editDoctor(id) {
    const d = DB.getDoctor(id);
    if (!d) return;
    resetDoctorForm();
    $('#doc-id').value = d.id;
    $('#doc-name').value = d.name;
    // Keep specialties that are not in the list (e.g. added in an older version)
    const spec = $('#doc-specialty');
    if (![...spec.options].some((o) => o.value === d.specialty)) spec.add(new Option(d.specialty, d.specialty));
    spec.value = d.specialty;
    $('#doc-clinic').value = d.clinicId;
    $('#doc-experience').value = d.experience;
    $('#doc-languages').value = d.languages || '';
    $('#doc-bio').value = d.bio || '';
    showPhotoPreview(d.photo, d.name);
    $('#doctor-form-title').textContent = 'Edit ' + d.name;
    $('#doc-submit').textContent = 'Save changes';
    $('#doc-cancel').hidden = false;
    doctorForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#doc-name').focus({ preventScroll: true });
  }

  doctorAdminList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-edit]');
    if (btn) editDoctor(btn.dataset.edit);
  });
  $('#doc-cancel').addEventListener('click', resetDoctorForm);

  /**
   * Reads an image file and returns a square JPEG data URL (center crop).
   * Uses the FileReader API and the Canvas API.
   */
  function fileToSquarePhoto(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('The photo could not be read. Try another file.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('This file is not a valid image.'));
        img.onload = () => {
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = Math.max(0, (img.height - side) / 3); // keep more of the top (the face)
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = PHOTO_SIZE;
          canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  photoInput.addEventListener('change', async () => {
    const file = photoInput.files[0];
    if (!UI.setError(photoInput, Validate.image(file))) { photoInput.value = ''; return; }
    if (!file) return;
    try {
      pendingPhoto = await fileToSquarePhoto(file);
      showPhotoPreview(pendingPhoto);
    } catch (err) {
      console.error(err);
      UI.setError(photoInput, err.message);
      photoInput.value = '';
    }
  });

  photoRemove.addEventListener('click', () => {
    pendingPhoto = '';
    photoInput.value = '';
    showPhotoPreview('');
  });

  doctorForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = doctorForm.elements;
    const checks = [
      UI.setError(f['docname'], Validate.name(f['docname'].value)),
      UI.setError(f['specialty'], f['specialty'].value ? '' : 'Choose a specialty.'),
      UI.setError(f['clinic'], f['clinic'].value ? '' : 'Add a clinic first, below.'),
      UI.setError(f['experience'], Validate.experience(f['experience'].value))
    ];
    if (!checks.every(Boolean)) {
      doctorForm.querySelector('[aria-invalid="true"]').focus();
      return;
    }
    // The clinic's plan limits how many doctors it can have
    const clinicForDoc = DB.getClinic(f['clinic'].value);
    const plan = clinicForDoc && clinicForDoc.subscription && Payments.PLANS[clinicForDoc.subscription.plan];
    const editingId = $('#doc-id').value;
    const doctorsThere = DB.getDoctors().filter((d) => d.clinicId === f['clinic'].value && d.id !== editingId).length;
    if (plan && doctorsThere >= plan.maxDoctors) {
      UI.setError(f['clinic'], `The ${plan.name} plan allows up to ${plan.maxDoctors} doctors. Upgrade the plan in Payments.`);
      f['clinic'].focus();
      return;
    }
    const fields = {
      name: f['docname'].value.trim(),
      specialty: f['specialty'].value,
      clinicId: f['clinic'].value,
      experience: f['experience'].value === '' ? '' : Number(f['experience'].value),
      languages: f['languages'].value.trim(),
      bio: f['bio'].value.trim()
    };
    const id = $('#doc-id').value;
    if (id) fields.id = id;
    if (pendingPhoto !== undefined) fields.photo = pendingPhoto;
    else if (!id) fields.photo = '';

    try {
      const doctor = DB.saveDoctor(fields);
      UI.toast(id ? 'Changes saved for ' + doctor.name + '.' : doctor.name + ' added. Set their working hours next.', 'success');
      resetDoctorForm();
      fillSelects();
      renderDoctorList();
      renderTable();
      if (!id) { schedDoctor.value = doctor.id; renderSchedule(); }
    } catch (err) {
      console.error(err);
      UI.toast(err.message, 'error');
    }
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
  }

  schedDoctor.addEventListener('change', renderSchedule);

  // Enable/disable time inputs when a day is switched on/off
  hoursRows.addEventListener('change', (e) => {
    const day = e.target.dataset.day;
    if (!day) return;
    $('#start-' + day).disabled = !e.target.checked;
    $('#end-' + day).disabled = !e.target.checked;
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

    if (!valid) { UI.toast('Fix the times marked in red, then save again.', 'error'); return; }

    doctor.hours = hours;
    doctor.slotMinutes = Number($('#slot-length').value);
    doctor.breakStart = bStart;
    doctor.breakEnd = bEnd;
    DB.updateDoctor(doctor);
    UI.toast('Working hours saved for ' + doctor.name + '.', 'success');
  });

  /* =====================  CLINICS  ===================== */

  function loadClinicIntoForm() {
    const isNew = clinicSelect.value === 'new';
    const c = isNew ? {} : (DB.getClinic(clinicSelect.value) || {});
    $('#clinic-name').value = c.name || '';
    $('#clinic-phone').value = c.phone || '';
    $('#clinic-email').value = c.email || '';
    $('#clinic-address').value = c.address || '';
    $('#clinic-hours').value = c.hours || '';
    $('#clinic-submit').textContent = isNew ? 'Add clinic' : 'Save clinic';
    clinicForm.querySelectorAll('.error').forEach((el) => { el.textContent = ''; });
  }

  clinicSelect.addEventListener('change', loadClinicIntoForm);

  clinicForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = clinicForm.elements;
    const checks = [
      UI.setError(f['name'], Validate.clinicName(f['name'].value)),
      UI.setError(f['phone'], Validate.phone(f['phone'].value)),
      UI.setError(f['email'], Validate.optionalEmail(f['email'].value)),
      UI.setError(f['address'], f['address'].value.trim() ? '' : 'Address is required.')
    ];
    if (!checks.every(Boolean)) {
      clinicForm.querySelector('[aria-invalid="true"]').focus();
      return;
    }
    const isNew = clinicSelect.value === 'new';
    const clinic = DB.saveClinic({
      id: isNew ? undefined : clinicSelect.value,
      name: f['name'].value.trim(),
      phone: f['phone'].value.trim(),
      email: f['email'].value.trim(),
      address: f['address'].value.trim(),
      hours: f['hours'].value.trim()
    });
    UI.toast(isNew ? clinic.name + ' added.' : 'Clinic details saved.', 'success');
    fillSelects();
    clinicSelect.value = clinic.id;
    loadClinicIntoForm();
    renderDoctorList();
    renderPayments();
  });

  /* =====================  PAYMENTS & SUBSCRIPTIONS (demo)  ===================== */

  function renderPayments() {
    const t = Payments.totals(DB.getAppointments());
    $('#fees-received').textContent = Payments.rupees(t.received);
    $('#fees-collect').textContent = Payments.rupees(t.toCollect);
    $('#fees-refunded').textContent = Payments.rupees(t.refunded);

    const today = UI.todayStr();
    const doctors = DB.getDoctors();
    subList.innerHTML = DB.getClinics().map((c) => {
      const sub = c.subscription || { plan: 'basic', history: [] };
      const plan = Payments.PLANS[sub.plan] || Payments.PLANS.basic;
      const st = Payments.subscriptionStatus(sub, today);
      const until = sub.paidUntil ? UI.formatDate(sub.paidUntil) : '–';
      let state;
      if (!st.active) state = `<span class="sub-state sub-expired">Ended on ${esc(until)}. Online booking is paused.</span>`;
      else if (st.endsSoon) state = `<span class="sub-state sub-soon">Ends in ${st.daysLeft} day${st.daysLeft === 1 ? '' : 's'} (${esc(until)})</span>`;
      else state = `<span class="sub-state sub-active">Active until ${esc(until)}</span>`;
      const count = doctors.filter((d) => d.clinicId === c.id).length;
      const history = (sub.history || []).slice(0, 3);
      return `
        <li class="sub-card">
          <div class="sub-main">
            <h4>${esc(c.name)}</h4>
            <p class="small muted">${esc(plan.name)} plan, ${Payments.rupees(plan.price)} per month. ${count} of ${plan.maxDoctors} doctors.</p>
            ${state}
          </div>
          <div class="sub-actions">
            <label class="sr-only" for="plan-${c.id}">Plan for ${esc(c.name)}</label>
            <select id="plan-${c.id}" data-plan-for="${c.id}">
              ${Object.values(Payments.PLANS).map((p) => `<option value="${p.id}" ${p.id === plan.id ? 'selected' : ''}>${esc(p.name)}, ${Payments.rupees(p.price)}/month</option>`).join('')}
            </select>
            <button type="button" class="btn btn-small btn-primary" data-renew="${c.id}">${st.active ? 'Pay next month' : 'Renew now'}</button>
          </div>
          ${history.length ? `
            <table class="sub-history">
              <caption class="sr-only">Last payments of ${esc(c.name)}</caption>
              <thead><tr><th scope="col">Date</th><th scope="col">Plan</th><th scope="col">Amount</th><th scope="col">Reference</th></tr></thead>
              <tbody>${history.map((h) => `<tr><td>${esc(UI.formatDate(h.date))}</td><td>${esc((Payments.PLANS[h.plan] || {}).name || h.plan)}</td><td>${Payments.rupees(h.amount)}</td><td>${esc(h.ref)}</td></tr>`).join('')}</tbody>
            </table>` : '<p class="small muted">No plan payments recorded in this browser yet.</p>'}
        </li>`;
    }).join('');
  }

  let subPaying = false;

  subList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-renew]');
    if (!btn) return;
    const clinic = DB.getClinic(btn.dataset.renew);
    const planId = subList.querySelector(`[data-plan-for="${clinic.id}"]`).value;
    const plan = Payments.PLANS[planId];
    const count = DB.getDoctors().filter((d) => d.clinicId === clinic.id).length;
    if (count > plan.maxDoctors) {
      UI.toast(`${clinic.name} has ${count} doctors. The ${plan.name} plan allows ${plan.maxDoctors}. Choose a bigger plan.`, 'error');
      return;
    }
    const newUntil = Payments.renewedUntil(clinic.subscription && clinic.subscription.paidUntil, UI.todayStr(), 1);
    subDialog.innerHTML = `
      <div class="pay-box">
        <div class="pay-head">
          <h2 id="sub-pay-title">Pay ${Payments.rupees(plan.price)}</h2>
          <span class="demo-flag">Demo payment</span>
        </div>
        <p class="demo-note">This is a student project. No money is taken, and no card or bank details are asked for.</p>
        <dl class="pay-facts">
          <div><dt>Clinic</dt><dd>${esc(clinic.name)}</dd></div>
          <div><dt>Plan</dt><dd>${esc(plan.name)}: ${esc(plan.text)}</dd></div>
          <div><dt>Period</dt><dd>1 month, until ${esc(UI.formatDate(newUntil))}</dd></div>
          <div class="pay-total"><dt>Total</dt><dd>${Payments.rupees(plan.price)}</dd></div>
        </dl>
        <p class="pay-status" aria-live="polite"></p>
        <div class="pay-actions">
          <button type="button" class="btn btn-ghost" data-pay-cancel>Cancel</button>
          <button type="button" class="btn btn-primary" data-pay-now>Pay ${Payments.rupees(plan.price)} (demo)</button>
        </div>
      </div>`;
    subDialog.dataset.clinic = clinic.id;
    subDialog.dataset.plan = plan.id;
    subDialog.dataset.until = newUntil;
    subDialog.showModal();
  });

  subDialog.addEventListener('click', (e) => {
    if (subPaying) return;
    if (e.target === subDialog || e.target.closest('[data-pay-cancel]')) { subDialog.close(); return; }
    if (!e.target.closest('[data-pay-now]')) return;
    subPaying = true;
    subDialog.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    const status = subDialog.querySelector('.pay-status');
    status.className = 'pay-status is-processing';
    status.textContent = 'Processing payment…';
    setTimeout(() => {
      const plan = Payments.PLANS[subDialog.dataset.plan];
      const clinic = DB.renewSubscription(subDialog.dataset.clinic, plan.id, subDialog.dataset.until, {
        date: UI.todayStr(), plan: plan.id, amount: plan.price, ref: Payments.reference('SUB')
      });
      status.className = 'pay-status is-done';
      status.textContent = 'Payment successful';
      setTimeout(() => {
        subPaying = false;
        subDialog.close();
        renderPayments();
        UI.toast(`${clinic.name}: ${plan.name} plan paid until ${UI.formatDate(subDialog.dataset.until)}.`, 'success');
      }, 600);
    }, 1200);
  });

  // Escape must not close the window while the payment is processing
  subDialog.addEventListener('cancel', (e) => { if (subPaying) e.preventDefault(); });

  /* =====================  RESET DEMO  ===================== */

  $('#reset-btn').addEventListener('click', () => {
    if (!confirm('Delete ALL patients, appointments and changes, and load the demo data again?')) return;
    DB.reset();
    resetDoctorForm();
    clinicSelect.value = '';
    refreshAll();
    UI.toast('Demo data restored.', 'info');
  });

  // Live update when a patient books in another tab
  window.addEventListener('storage', (e) => {
    if (e.key === DB.KEY && !appSection.hidden) {
      renderStats();
      renderTable();
      renderPayments();
    }
  });

  resetDoctorForm();
  init();
})();
