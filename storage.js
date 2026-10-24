/**
 * storage.js – Data layer for WebCareBooking.
 * All data lives in the browser's localStorage (Web Storage API),
 * so the app works on GitHub Pages without a server.
 *
 * Data shape:
 *   { doctors: Doctor[], patients: Patient[], appointments: Appointment[] }
 */
const DB = (function () {
  'use strict';

  const KEY = 'wcb_data_v1';

  /** Default weekly working hours for a new doctor. */
  function defaultHours() {
    return {
      mon: { on: true, start: '09:00', end: '17:00' },
      tue: { on: true, start: '09:00', end: '17:00' },
      wed: { on: true, start: '09:00', end: '17:00' },
      thu: { on: true, start: '09:00', end: '17:00' },
      fri: { on: true, start: '09:00', end: '17:00' },
      sat: { on: true, start: '09:00', end: '13:00' },
      sun: { on: false, start: '09:00', end: '13:00' }
    };
  }

  /** Demo data loaded the first time the app opens. */
  function seed() {
    const doctor = (id, name, specialty) => ({
      id, name, specialty,
      hours: defaultHours(),
      slotMinutes: 30,
      breakStart: '13:00',
      breakEnd: '14:00'
    });
    return {
      doctors: [
        doctor('doc_1', 'Dr. Aicha Ouedraogo', 'General Medicine'),
        doctor('doc_2', 'Dr. Rahul Mehta', 'Pediatrics'),
        doctor('doc_3', 'Dr. Fatima Kabore', 'Dermatology')
      ],
      patients: [],
      appointments: []
    };
  }

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (err) {
      console.warn('[DB] Stored data is unreadable, loading demo data.', err);
    }
    const fresh = seed();
    write(fresh);
    return fresh;
  }

  function write(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (err) {
      console.error('[DB] Could not save data.', err);
      throw new Error('Saving failed. Your browser storage may be full or disabled.');
    }
  }

  /** Short unique id, e.g. "apt_lx3k9a2f". */
  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  return {
    KEY,
    defaultHours,

    /* ---------- Doctors ---------- */
    getDoctors() {
      return read().doctors;
    },
    getDoctor(id) {
      return read().doctors.find((d) => d.id === id) || null;
    },
    addDoctor(name, specialty) {
      const data = read();
      const doctor = {
        id: uid('doc'), name, specialty,
        hours: defaultHours(), slotMinutes: 30,
        breakStart: '13:00', breakEnd: '14:00'
      };
      data.doctors.push(doctor);
      write(data);
      return doctor;
    },
    updateDoctor(updated) {
      const data = read();
      data.doctors = data.doctors.map((d) => (d.id === updated.id ? updated : d));
      write(data);
    },

    /* ---------- Patients ---------- */
    getPatient(id) {
      return read().patients.find((p) => p.id === id) || null;
    },
    findPatientByEmail(email) {
      const e = String(email).trim().toLowerCase();
      return read().patients.find((p) => p.email === e) || null;
    },
    addPatient(patient) {
      const data = read();
      const saved = Object.assign({}, patient, { id: uid('pat'), createdAt: new Date().toISOString() });
      data.patients.push(saved);
      write(data);
      return saved;
    },

    /* ---------- Appointments ---------- */
    getAppointments() {
      return read().appointments;
    },
    /** Adds a booking. Throws if the slot is already taken (prevents double booking). */
    addAppointment(appt) {
      const data = read();
      const clash = data.appointments.some((a) =>
        a.doctorId === appt.doctorId && a.date === appt.date &&
        a.time === appt.time && a.status === 'booked');
      if (clash) throw new Error('Sorry, this slot was just taken. Please choose another time.');
      const saved = Object.assign({}, appt, {
        id: uid('apt'), status: 'booked', createdAt: new Date().toISOString()
      });
      data.appointments.push(saved);
      write(data);
      return saved;
    },
    setAppointmentStatus(id, status) {
      const data = read();
      const appt = data.appointments.find((a) => a.id === id);
      if (!appt) throw new Error('Appointment not found.');
      appt.status = status;
      write(data);
      return appt;
    },

    /** Deletes everything and reloads the demo data. */
    reset() {
      localStorage.removeItem(KEY);
      read();
    }
  };
})();
