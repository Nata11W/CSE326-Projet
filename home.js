/**
 * home.js – Landing page: shows the clinic's doctors from the data layer.
 */
(function () {
  'use strict';
  const list = document.getElementById('home-doctors');
  if (!list) return;
  list.innerHTML = DB.getDoctors().map((d) => `
    <li class="doctor-card">
      <span class="avatar" aria-hidden="true">${UI.escapeHTML(d.name.replace('Dr. ', '').charAt(0))}</span>
      <div>
        <h3>${UI.escapeHTML(d.name)}</h3>
        <p class="muted">${UI.escapeHTML(d.specialty)}</p>
      </div>
    </li>`).join('');
})();
