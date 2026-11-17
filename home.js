/**
 * home.js – Landing page: next free appointments, doctor profiles and clinic contacts.
 */
(function () {
  'use strict';

  const esc = UI.escapeHTML;
  const nextList = document.getElementById('next-free-list');
  const doctorGrid = document.getElementById('home-doctors');
  const clinicList = document.getElementById('clinic-list');

  function renderNextFree() {
    const appts = DB.getAppointments();
    const today = UI.todayStr();
    const rows = DB.getDoctors()
      .filter((d) => Profiles.canBookOnline(d))
      .map((d) => ({ doctor: d, next: Slots.nextFree(d, appts, today, 14) }))
      .filter((r) => r.next)
      .sort((a, b) => (a.next.date + a.next.time).localeCompare(b.next.date + b.next.time));

    if (!rows.length) {
      nextList.innerHTML = '<li class="muted">No free times in the next two weeks. Call a clinic below.</li>';
      return;
    }
    nextList.innerHTML = rows.map(({ doctor, next }) => {
      const link = `book.html?doctor=${encodeURIComponent(doctor.id)}&date=${next.date}&time=${next.time}`;
      return `
        <li class="next-row">
          ${Profiles.photo(doctor, 'sm')}
          <div class="next-who">
            <strong>${esc(doctor.name)}</strong>
            <span class="muted small">${esc(doctor.specialty)}</span>
          </div>
          <a class="time-chip" href="${link}" aria-label="Book ${esc(doctor.name)} ${esc(UI.dayLabel(next.date))} at ${next.time}">
            <span>${esc(UI.dayLabel(next.date))}</span><strong>${next.time}</strong>
          </a>
        </li>`;
    }).join('');
  }

  function renderDoctors() {
    doctorGrid.innerHTML = DB.getDoctors().map((d) => {
      const clinic = Profiles.clinicOf(d);
      return `
        <li class="doctor-card">
          <figure class="doctor-figure">${Profiles.photo(d, 'lg')}</figure>
          <div class="doctor-info">
            <h3>${esc(d.name)}</h3>
            <p class="doctor-specialty">${esc(d.specialty)}</p>
            ${clinic ? `<p class="muted small">${esc(clinic.name)}</p>` : ''}
            <div class="doctor-actions">
              <button type="button" class="btn btn-small btn-ghost" data-profile="${d.id}">View profile</button>
              ${Profiles.canBookOnline(d)
                ? `<a class="btn btn-small btn-primary" href="book.html?doctor=${encodeURIComponent(d.id)}">Book</a>`
                : '<span class="muted small">Book by phone</span>'}
            </div>
          </div>
        </li>`;
    }).join('');
  }

  function renderClinics() {
    const doctors = DB.getDoctors();
    clinicList.innerHTML = DB.getClinics().map((c) => {
      const team = doctors.filter((d) => d.clinicId === c.id);
      return `
        <li class="clinic-card">
          ${Profiles.clinicBlock(c)}
          ${team.length ? `
            <div class="clinic-team">
              <p class="small muted">Doctors here</p>
              <ul class="team-list">
                ${team.map((d) => `<li><button type="button" class="team-member" data-profile="${d.id}">
                  ${Profiles.photo(d, 'sm')}<span>${esc(d.name)}<br><span class="muted small">${esc(d.specialty)}</span></span>
                </button></li>`).join('')}
              </ul>
            </div>` : ''}
        </li>`;
    }).join('');
  }

  // One listener for every "View profile" button on the page (event delegation)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-profile]');
    if (btn) Profiles.open(btn.dataset.profile);
  });

  function renderAll() {
    renderNextFree();
    renderDoctors();
    renderClinics();
  }

  // Refresh when another tab books or changes data
  window.addEventListener('storage', (e) => { if (e.key === DB.KEY) renderAll(); });

  renderAll();
})();
