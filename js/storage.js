/**
 * storage.js – Data layer for WebCareBooking.
 * All data lives in the browser's localStorage (Web Storage API),
 * so the app works on GitHub Pages without a server.
 *
 * Data shape:
 *   { doctors: Doctor[], patients: Patient[], appointments: Appointment[],
 *     subscription: Subscription }
 * Uses Payments (payments.js) and Slots (slots.js) for pure business rules.
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
      appointments: [],
      subscription: Payments.newSubscription()
    };
  }

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw);
        // Data saved before subscriptions existed: start a plan now
        if (!data.subscription) {
          data.subscription = Payments.newSubscription();
          write(data);
        }
        return data;
      }
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
    /**
     * Adds a booking with its payment record (see Payments.create) and a token number.
     * Throws if the slot is already taken (prevents double booking).
     */
    addAppointment(appt) {
      const data = read();
      const clash = data.appointments.some((a) =>
        a.doctorId === appt.doctorId && a.date === appt.date &&
        a.time === appt.time && a.status === 'booked');
      if (clash) throw new Error('Sorry, this slot was just taken. Please choose another time.');
      const busy = data.appointments.some((a) =>
        a.patientId === appt.patientId && a.date === appt.date &&
        a.time === appt.time && a.status === 'booked');
      if (busy) throw new Error('You already have another appointment at this time.');
      const saved = Object.assign({}, appt, {
        id: uid('apt'),
        status: 'booked',
        token: Slots.nextToken(data.appointments, appt.doctorId, appt.date),
        createdAt: new Date().toISOString()
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
      // Cancelling refunds a paid fee; completing collects a "pay at clinic" fee
      appt.payment = Payments.afterStatusChange(appt.payment, status);
      write(data);
      return appt;
    },

    /* ---------- Clinic subscription ---------- */
    getSubscription() {
      return read().subscription;
    },
    /** Demo renewal: extends the plan by one period, no money is taken. */
    renewSubscription() {
      const data = read();
      data.subscription = Payments.renew(data.subscription);
      write(data);
      return data.subscription;
    },

    /** Deletes everything and reloads the demo data. */
    reset() {
      try { localStorage.removeItem(KEY); } catch (err) { console.error('[DB] Could not reset data.', err); }
      read();
    }
  };
})();
