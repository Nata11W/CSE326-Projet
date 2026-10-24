/**
 * slots.js – Pure functions that turn a doctor's working hours into
 * bookable time slots. No DOM access here, so it is easy to unit test
 * (see tests/tests.html).
 */
const Slots = (function () {
  'use strict';

  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  /** "09:30" -> 570 */
  function toMinutes(hhmm) {
    const [h, m] = String(hhmm).split(':').map(Number);
    return h * 60 + m;
  }

  /** 570 -> "09:30" */
  function toHHMM(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  /** "2026-10-12" -> "mon" (uses local time, not UTC) */
  function dayKey(dateStr) {
    return DAY_KEYS[new Date(dateStr + 'T00:00').getDay()];
  }

  /**
   * Build the list of slots for one doctor on one date.
   * @param {object} doctor        doctor object from DB
   * @param {string} dateStr       "YYYY-MM-DD"
   * @param {Array}  appointments  all appointments
   * @param {Date}   [now]         current time (injectable for tests)
   * @returns {{time: string, available: boolean}[]}
   */
  function generate(doctor, dateStr, appointments, now) {
    now = now || new Date();
    const day = doctor.hours[dayKey(dateStr)];
    if (!day || !day.on) return [];

    const start = toMinutes(day.start);
    const end = toMinutes(day.end);
    const step = Number(doctor.slotMinutes) || 30;
    const hasBreak = doctor.breakStart && doctor.breakEnd;
    const breakStart = hasBreak ? toMinutes(doctor.breakStart) : null;
    const breakEnd = hasBreak ? toMinutes(doctor.breakEnd) : null;

    const taken = new Set(
      appointments
        .filter((a) => a.doctorId === doctor.id && a.date === dateStr && a.status === 'booked')
        .map((a) => a.time)
    );

    const slots = [];
    for (let t = start; t + step <= end; t += step) {
      // Skip any slot that overlaps the break
      if (hasBreak && t < breakEnd && t + step > breakStart) continue;
      const time = toHHMM(t);
      const inFuture = new Date(dateStr + 'T' + time) > now;
      slots.push({ time, available: inFuture && !taken.has(time) });
    }
    return slots;
  }

  return { toMinutes, toHHMM, dayKey, generate };
})();

// Allow Node.js to import this file for quick tests (ignored by browsers)
if (typeof module !== 'undefined') module.exports = Slots;
