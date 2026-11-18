/**
 * home.js – Landing page:
 * live figures, featured "next free appointment", specialty cards,
 * doctor listing with filters and sorting, clinic contact cards.
 */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const esc = UI.escapeHTML;

  const matchCard = $('#match-card');
  const categories = $('#categories');
  const cards = $('#cards-container');
  const resultsCount = $('#results-count');
  const clinicList = $('#clinic-list');
  const filterPanel = $('#filter-panel');
  const filterToggle = $('#filter-mobile-toggle');
  const searchInput = $('#search-input');
  const sortBy = $('#sort-by');
  const fSpecialty = $('#filter-specialty');
  const fClinic = $('#filter-clinic');
  const fLanguage = $('#filter-language');
  const fDays = $('#filter-days');
  const fExp = $('#filter-exp');
  const fOnline = $('#filter-online');

  /* Small icons for the specialty cards (fallback: medical cross) */
  const ICONS = {
    Cardiology: '<path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.4 2.9 4.5 6.6 4.5c2.1 0 3.5 1.1 4.4 2.5.9-1.4 2.3-2.5 4.4-2.5 3.7 0 5.7 3.9 4.2 7.2C19.5 16.4 12 21 12 21z"/>',
    Pediatrics: '<circle cx="12" cy="7" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8z"/>',
    Dermatology: '<path d="M12 2s7 7.6 7 12.5A7 7 0 0 1 5 14.5C5 9.6 12 2 12 2z"/>',
    default: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>'
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">${ICONS[name] || ICONS.default}</svg>`;

  /** Doctor + clinic + next free time, computed once per render. */
  function enrich() {
    const appts = DB.getAppointments();
    const today = UI.todayStr();
    return DB.getDoctors().map((d) => {
      const online = Profiles.canBookOnline(d);
      return {
        doctor: d,
        clinic: Profiles.clinicOf(d),
        online,
        next: online ? Slots.nextFree(d, appts, today, 14) : null
      };
    });
  }

  /** Days from today until a "YYYY-MM-DD" date. */
  function daysFromToday(date) {
    return Math.round((new Date(date + 'T00:00') - new Date(UI.todayStr() + 'T00:00')) / 86400000);
  }

  function languagesOf(d) {
    return String(d.languages || '').split(',').map((l) => l.trim()).filter(Boolean);
  }

  /* =====================  HERO  ===================== */

  function renderStats(rows) {
    const appts = DB.getAppointments();
    const today = UI.todayStr();
    let free = 0;
    rows.filter((r) => r.online).forEach((r) => {
      for (let i = 0; i < 7; i++) {
        free += Slots.generate(r.doctor, UI.addDays(today, i), appts).filter((s) => s.available).length;
      }
    });
    $('#stat-doctors').textContent = rows.length;
    $('#stat-clinics').textContent = DB.getClinics().length;
    $('#stat-free').textContent = free;
  }

  function bookLink(r) {
    return `book.html?doctor=${encodeURIComponent(r.doctor.id)}&date=${r.next.date}&time=${r.next.time}`;
  }

  function renderMatch(rows) {
    const withTime = rows.filter((r) => r.next)
      .sort((a, b) => (a.next.date + a.next.time).localeCompare(b.next.date + b.next.time));
    if (!withTime.length) {
      matchCard.innerHTML = `
        <div class="match-card-header"><h2 id="match-title">Next free appointment</h2></div>
        <p>No free times online in the next two weeks. Call a clinic instead.</p>
        <a class="btn btn-call btn-block" href="#clinics">See clinic phone numbers</a>`;
      return;
    }
    const top = withTime[0];
    const d = top.doctor;
    const langs = languagesOf(d);
    matchCard.innerHTML = `
      <div class="match-card-header">
        <h2 id="match-title">Next free appointment</h2>
        <p class="match-time"><strong>${top.next.time}</strong><span>${esc(UI.dayLabel(top.next.date))}</span></p>
      </div>
      <div class="match-doctor">
        ${Profiles.photo(d, 'sm')}
        <div>
          <p class="match-name">${esc(d.name)}</p>
          <p class="match-meta">${esc(d.specialty)}${top.clinic ? ', ' + esc(top.clinic.name) : ''}</p>
        </div>
      </div>
      <div class="match-badges">
        <span class="badge-soft badge-gold">${esc(d.specialty)}</span>
        ${d.experience !== '' && d.experience != null ? `<span class="badge-soft">${esc(d.experience)} years</span>` : ''}
        ${langs.slice(0, 2).map((l) => `<span class="badge-soft">${esc(l)}</span>`).join('')}
      </div>
      <div class="match-stats-grid">
        <div class="match-stat-item"><span class="stat-val">${Payments.rupees(Payments.BOOKING_FEE)}</span><span class="stat-lbl">Booking fee</span></div>
        <div class="match-stat-item"><span class="stat-val">${esc(d.slotMinutes)} min</span><span class="stat-lbl">Visit length</span></div>
      </div>
      <div class="match-divider"></div>
      <a class="btn btn-gold btn-block" href="${bookLink(top)}">Book ${esc(top.next.time)} with ${esc(d.name)}</a>
      ${withTime.length > 1 ? `
        <ul class="match-others" aria-label="Other free times">
          ${withTime.slice(1, 4).map((r) => `
            <li><a href="${bookLink(r)}">
              ${Profiles.photo(r.doctor, 'xs')}
              <span class="who"><strong>${esc(r.doctor.name)}</strong><br><span class="muted small">${esc(r.doctor.specialty)}</span></span>
              <span class="when">${esc(UI.dayLabel(r.next.date))}, ${r.next.time}</span>
            </a></li>`).join('')}
        </ul>` : ''}`;
  }

  /* =====================  SPECIALTIES  ===================== */

  function renderCategories(rows) {
    const counts = {};
    rows.forEach((r) => { counts[r.doctor.specialty] = (counts[r.doctor.specialty] || 0) + 1; });
    const current = fSpecialty.value;
    categories.innerHTML = Object.keys(counts).sort().map((spec) => `
      <button type="button" class="category-card" data-specialty="${esc(spec)}" aria-pressed="${spec === current}">
        <span class="category-icon">${icon(spec)}</span>
        <h3>${esc(spec)}</h3>
        <span class="category-count">${counts[spec]} doctor${counts[spec] === 1 ? '' : 's'}</span>
        <span class="category-arrow" aria-hidden="true">↗</span>
      </button>`).join('');
  }

  categories.addEventListener('click', (e) => {
    const card = e.target.closest('[data-specialty]');
    if (!card) return;
    const spec = card.dataset.specialty;
    fSpecialty.value = fSpecialty.value === spec ? 'all' : spec; // click again to clear
    renderListing();
    document.getElementById('doctors').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* =====================  FILTERS & LISTING  ===================== */

  function fillFilterOptions(rows) {
    const keep = { s: fSpecialty.value, c: fClinic.value, l: fLanguage.value };
    const specs = [...new Set(rows.map((r) => r.doctor.specialty))].sort();
    const langs = [...new Set(rows.flatMap((r) => languagesOf(r.doctor)))].sort();
    fSpecialty.innerHTML = '<option value="all">All specialties</option>' + specs.map((s) => `<option>${esc(s)}</option>`).join('');
    fClinic.innerHTML = '<option value="all">All clinics</option>' + DB.getClinics().map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    fLanguage.innerHTML = '<option value="all">Any language</option>' + langs.map((l) => `<option>${esc(l)}</option>`).join('');
    if (keep.s && [...fSpecialty.options].some((o) => o.value === keep.s)) fSpecialty.value = keep.s;
    if (keep.c && [...fClinic.options].some((o) => o.value === keep.c)) fClinic.value = keep.c;
    if (keep.l && [...fLanguage.options].some((o) => o.value === keep.l)) fLanguage.value = keep.l;
  }

  function matches(r) {
    const d = r.doctor;
    const q = searchInput.value.trim().toLowerCase();
    if (q && !(d.name + ' ' + d.specialty + ' ' + (r.clinic ? r.clinic.name : '')).toLowerCase().includes(q)) return false;
    if (fSpecialty.value !== 'all' && d.specialty !== fSpecialty.value) return false;
    if (fClinic.value !== 'all' && d.clinicId !== fClinic.value) return false;
    if (fLanguage.value !== 'all' && !languagesOf(d).includes(fLanguage.value)) return false;
    const days = Number(fDays.value);
    if (days > 0 && (!r.next || daysFromToday(r.next.date) >= days)) return false;
    if (Number(fExp.value) > 0 && !(Number(d.experience) >= Number(fExp.value))) return false;
    if (fOnline.checked && !r.online) return false;
    return true;
  }

  function sortRows(list) {
    const by = sortBy.value;
    return list.sort((a, b) => {
      if (by === 'name') return a.doctor.name.localeCompare(b.doctor.name);
      if (by === 'experience') return (Number(b.doctor.experience) || 0) - (Number(a.doctor.experience) || 0);
      // soonest free time first; doctors without a free time go last
      const ka = a.next ? a.next.date + a.next.time : '9999';
      const kb = b.next ? b.next.date + b.next.time : '9999';
      return ka.localeCompare(kb);
    });
  }

  function cardHTML(r) {
    const d = r.doctor;
    const langs = languagesOf(d);
    let when;
    if (!r.online) when = '<span class="badge-soft">Book by phone</span>';
    else if (r.next) when = `<span class="badge-soft badge-green">Free ${esc(UI.dayLabel(r.next.date))}, ${r.next.time}</span>`;
    else when = '<span class="badge-soft">No free time in 2 weeks</span>';
    return `
      <li class="doc-card">
        <div class="doc-card-photo">
          ${Profiles.photo(d, 'lg')}
          <span class="doc-card-tag">${esc(d.specialty)}</span>
        </div>
        <div class="doc-card-body">
          <h3>${esc(d.name)}</h3>
          ${r.clinic ? `<p class="muted small">${esc(r.clinic.name)}</p>` : ''}
          <div class="doc-card-badges">
            ${when}
            ${d.experience !== '' && d.experience != null ? `<span class="badge-soft">${esc(d.experience)} yrs</span>` : ''}
            ${langs.length ? `<span class="badge-soft">${esc(langs.join(', '))}</span>` : ''}
          </div>
        </div>
        <div class="doc-card-actions">
          <button type="button" class="btn btn-small btn-ghost" data-profile="${d.id}">Profile</button>
          ${r.online
            ? `<a class="btn btn-small btn-gold" href="${r.next ? bookLink(r) : 'book.html?doctor=' + encodeURIComponent(d.id)}">Book</a>`
            : (r.clinic ? `<a class="btn btn-small btn-call" href="${UI.telHref(r.clinic.phone)}">Call</a>` : '')}
        </div>
      </li>`;
  }

  let allRows = [];

  function renderListing() {
    const shown = sortRows(allRows.filter(matches));
    cards.innerHTML = shown.length
      ? shown.map(cardHTML).join('')
      : '<li class="empty-state">No doctor matches these filters. Reset the filters or call a clinic below.</li>';
    resultsCount.innerHTML = `Showing <strong>${shown.length}</strong> of ${allRows.length} doctor${allRows.length === 1 ? '' : 's'}`;
    // keep the specialty cards in sync with the filter
    categories.querySelectorAll('[data-specialty]').forEach((c) => {
      c.setAttribute('aria-pressed', String(c.dataset.specialty === fSpecialty.value));
    });
  }

  function updateExpLabel() {
    $('#exp-value').textContent = Number(fExp.value) > 0 ? fExp.value + '+ years' : 'Any';
  }

  filterPanel.addEventListener('change', renderListing);
  fExp.addEventListener('input', () => { updateExpLabel(); renderListing(); });
  filterPanel.addEventListener('reset', () => setTimeout(() => { updateExpLabel(); renderListing(); }));
  searchInput.addEventListener('input', renderListing);
  sortBy.addEventListener('change', renderListing);

  // Phones: the filter panel opens and closes with a button
  filterToggle.addEventListener('click', () => {
    const open = filterPanel.hidden;
    filterPanel.hidden = !open;
    filterToggle.setAttribute('aria-expanded', String(open));
    filterToggle.textContent = open ? 'Hide filters' : 'Show filters';
  });

  // Hero search: copy the text into the listing search and jump there
  $('#hero-search').addEventListener('submit', (e) => {
    e.preventDefault();
    searchInput.value = $('#hero-search-input').value;
    renderListing();
    document.getElementById('doctors').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* =====================  CLINICS  ===================== */

  function renderClinics() {
    const doctors = DB.getDoctors();
    clinicList.innerHTML = DB.getClinics().map((c) => {
      const team = doctors.filter((d) => d.clinicId === c.id);
      return `
        <li class="contact-card">
          <span class="clinic-avatar" aria-hidden="true">${esc(c.name.charAt(0))}</span>
          <h3>${esc(c.name)}</h3>
          <address>${esc(c.address)}<br>${esc(c.hours)}</address>
          ${team.length ? `<div class="team-avatars" aria-label="Doctors at ${esc(c.name)}">
            ${team.map((d) => `<button type="button" data-profile="${d.id}" title="${esc(d.name)}">${Profiles.photo(d, 'sm')}</button>`).join('')}
          </div>` : ''}
          ${Profiles.callButton(c, 'Call the clinic')}
          <span class="phone-number">${esc(c.phone)}</span>
          ${c.email ? `<a class="small" href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}
        </li>`;
    }).join('');
  }

  // One listener for every "Profile" button on the page (event delegation)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-profile]');
    if (btn) Profiles.open(btn.dataset.profile);
  });

  /* =====================  START  ===================== */

  function renderAll() {
    allRows = enrich();
    renderStats(allRows);
    renderMatch(allRows);
    fillFilterOptions(allRows);
    renderCategories(allRows);
    renderListing();
    renderClinics();
  }

  // ?q=… opens the page with a search already typed
  const q = new URLSearchParams(location.search).get('q');
  if (q) { searchInput.value = q; $('#hero-search-input').value = q; }

  // Refresh when another tab books or changes data
  window.addEventListener('storage', (e) => { if (e.key === DB.KEY) renderAll(); });

  updateExpLabel();
  renderAll();
})();
