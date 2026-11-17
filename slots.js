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

  /** Adds days to "YYYY-MM-DD" and returns a new "YYYY-MM-DD" (local time). */
  function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T00:00');
    d.setDate(d.getDate() + days);
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /**
   * First free slot for a doctor, searching from `fromDate` for up to `days` days.
   * @returns {{date: string, time: string} | null}
   */
  function nextFree(doctor, appointments, fromDate, days, now) {
    days = days || 14;
    for (let i = 0; i < days; i++) {
      const date = addDays(fromDate, i);
      const free = generate(doctor, date, appointments, now).find((s) => s.available);
      if (free) return { date, time: free.time };
    }
    return null;
  }

  /**
   * Token number = position of the slot in the doctor's day (1st slot = token 1),
   * like the OPD queue number printed on a clinic slip.
   */
  function tokenFor(doctor, dateStr, time) {
    const all = generate(doctor, dateStr, [], new Date(0));
    const index = all.findIndex((s) => s.time === time);
    return index === -1 ? null : index + 1;
  }

  return { toMinutes, toHHMM, dayKey, generate, addDays, nextFree, tokenFor };
})();

// Allow Node.js to import this file for quick tests (ignored by browsers)
if (typeof module !== 'undefined') module.exports = Slots;
