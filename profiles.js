/**
 * profiles.js – Shared doctor & clinic UI pieces:
 * photo (with initials fallback), clinic contact block, and the
 * doctor profile <dialog>. Used by the home, booking and admin pages.
 */
const Profiles = (function () {
  'use strict';

  const esc = (s) => UI.escapeHTML(s == null ? '' : s);

  /** Initials from "Dr. Aicha Ouedraogo" -> "AO". */
  function initials(name) {
    return String(name).replace(/^Dr\.?\s*/i, '').split(/\s+/).filter(Boolean)
      .slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  }

  /** Doctor photo, or initials when there is no photo. size: sm | md | lg */
  function photo(doctor, size) {
    const cls = 'photo photo-' + (size || 'md');
    if (doctor.photo) {
      return `<img class="${cls}" src="${esc(doctor.photo)}" alt="Photo of ${esc(doctor.name)}"
        data-initials="${esc(initials(doctor.name))}" loading="lazy" width="400" height="400">`;
    }
    return `<span class="${cls} photo-initials" role="img" aria-label="${esc(doctor.name)}">${esc(initials(doctor.name))}</span>`;
  }

  // If an image file is missing, show initials instead of a broken icon.
  // "error" does not bubble, so we listen in the capture phase.
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('photo')) return;
    const span = document.createElement('span');
    span.className = img.className + ' photo-initials';
    span.setAttribute('role', 'img');
    span.setAttribute('aria-label', img.alt);
    span.textContent = img.dataset.initials || '?';
    img.replaceWith(span);
  }, true);

  function clinicOf(doctor) {
    return (doctor && DB.getClinic(doctor.clinicId)) || null;
  }

  /** False when the clinic's subscription has ended (online booking paused). */
  function canBookOnline(doctor) {
    const clinic = clinicOf(doctor);
    return !clinic || Payments.subscriptionStatus(clinic.subscription, UI.todayStr()).active;
  }

  /** Click-to-call button. */
  function callButton(clinic, label) {
    if (!clinic || !clinic.phone) return '';
    return `<a class="btn btn-call" href="${UI.telHref(clinic.phone)}">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>
      ${esc(label || clinic.phone)}</a>`;
  }

  /** Clinic contact details: name, address, hours, phone, email. */
  function clinicBlock(clinic, options) {
    if (!clinic) return '';
    options = options || {};
    const heading = options.heading || 'h3';
    return `
      <div class="clinic-block">
        <${heading} class="clinic-name">${esc(clinic.name)}</${heading}>
        <address>
          ${esc(clinic.address)}<br>
          <span class="muted">${esc(clinic.hours)}</span>
          ${clinic.email ? `<br><a href="mailto:${esc(clinic.email)}">${esc(clinic.email)}</a>` : ''}
        </address>
        ${callButton(clinic, 'Call ' + clinic.phone)}
      </div>`;
  }

  /* ---------- Profile dialog ---------- */

  let dialog = null;

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'profile-dialog';
    dialog.setAttribute('aria-labelledby', 'profile-title');
    document.body.appendChild(dialog);
    // Close when clicking the dark backdrop (outside the dialog box)
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) dialog.close();
    });
    return dialog;
  }

  /**
   * Opens the profile of a doctor.
   * @param {string} doctorId
   * @param {{onBook?: function}} [options] onBook replaces the "Book" link (used on book.html)
   */
  function open(doctorId, options) {
    const doctor = DB.getDoctor(doctorId);
    if (!doctor) return;
    options = options || {};
    const clinic = clinicOf(doctor);
    const online = canBookOnline(doctor);
    const next = online ? Slots.nextFree(doctor, DB.getAppointments(), UI.todayStr(), 14) : null;
    const facts = [
      doctor.experience !== '' && doctor.experience != null ? `<div><dt>Experience</dt><dd>${esc(doctor.experience)} years</dd></div>` : '',
      doctor.languages ? `<div><dt>Speaks</dt><dd>${esc(doctor.languages)}</dd></div>` : '',
      `<div><dt>Next free time</dt><dd>${!online ? 'Book by phone' : next ? esc(UI.dayLabel(next.date) + ', ' + next.time) : 'None in the next 2 weeks'}</dd></div>`
    ].join('');

    const d = ensureDialog();
    d.innerHTML = `
      <article class="profile">
        <button type="button" class="dialog-close" data-close aria-label="Close profile">&times;</button>
        <div class="profile-photo">${photo(doctor, 'lg')}</div>
        <div class="profile-body">
          <p class="profile-specialty">${esc(doctor.specialty)}</p>
          <h2 id="profile-title">${esc(doctor.name)}</h2>
          ${doctor.bio ? `<p>${esc(doctor.bio)}</p>` : ''}
          <dl class="facts">${facts}</dl>
          <div class="profile-actions">
            ${!online
              ? `<p class="notice">Online booking is paused for this clinic. Call them to book.</p>`
              : options.onBook
              ? `<button type="button" class="btn btn-primary" data-book>Book with ${esc(doctor.name)}</button>`
              : `<a class="btn btn-primary" href="book.html?doctor=${encodeURIComponent(doctor.id)}">Book with ${esc(doctor.name)}</a>`}
          </div>
          ${clinic ? `<section class="profile-clinic" aria-label="Clinic contact"><p class="muted small">Prefer to talk to someone? Call the clinic.</p>${clinicBlock(clinic)}</section>` : ''}
        </div>
      </article>`;

    if (options.onBook && online) {
      d.querySelector('[data-book]').addEventListener('click', () => {
        d.close();
        options.onBook(doctor.id);
      });
    }
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', ''); // very old browsers
  }

  return { initials, photo, clinicOf, canBookOnline, callButton, clinicBlock, open };
})();
