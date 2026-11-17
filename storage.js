/**
 * storage.js – Data layer for WebCareBooking.
 * All data lives in the browser's localStorage (Web Storage API),
 * so the app works on GitHub Pages without a server.
 *
 * Data shape:
 *   { version, clinics: Clinic[], doctors: Doctor[], patients: Patient[], appointments: Appointment[] }
 */
const DB = (function () {
  'use strict';

  const KEY = 'wcb_data_v1';
  const VERSION = 3;
  const BOOKING_FEE = 20; // same value as Payments.BOOKING_FEE

  /** Today as "YYYY-MM-DD" (local time). */
  function today() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function plusDays(dateStr, days) {
    const d = new Date(dateStr + 'T00:00');
    d.setDate(d.getDate() + days);
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /** Demo subscription: plan paid until `days` from today. */
  function demoSubscription(plan, days) {
    return { plan, paidUntil: plusDays(today(), days), history: [] };
  }

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

  /* Demo clinics. Phone numbers are placeholders – replace them in the dashboard. */
  const SEED_CLINICS = [
    {
      id: 'cli_1',
      name: 'Sunrise Family Clinic',
      phone: '+91 00000 10001',
      email: 'contact@sunrise-clinic.example',
      address: 'Model Town, Phagwara, Punjab 144401',
      hours: 'Mon to Sat, 9:00 am to 5:00 pm'
    },
    {
      id: 'cli_2',
      name: 'CityCare Hospital',
      phone: '+91 00000 20002',
      email: 'help@citycare-hospital.example',
      address: 'GT Road, Jalandhar, Punjab 144001',
      hours: 'Open every day, 8:00 am to 8:00 pm'
    }
  ];

  /* Demo doctors. Photos are illustrations in img/doctors/ – replace with real photos. */
  const SEED_DOCTORS = [
    {
      id: 'doc_1', name: 'Dr. Aicha Ouedraogo', specialty: 'General Medicine', clinicId: 'cli_1',
      photo: 'img/doctors/aicha-ouedraogo.svg', experience: 12, languages: 'French, English',
      bio: 'Family doctor for adults: fevers, infections, check-ups, diabetes and blood pressure follow-up.'
    },
    {
      id: 'doc_2', name: 'Dr. Rahul Mehta', specialty: 'Pediatrics', clinicId: 'cli_2',
      photo: 'img/doctors/rahul-mehta.svg', experience: 9, languages: 'Hindi, Punjabi, English',
      bio: 'Cares for babies, children and teenagers, from vaccinations to growth and nutrition advice.'
    },
    {
      id: 'doc_3', name: 'Dr. Fatima Kabore', specialty: 'Dermatology', clinicId: 'cli_1',
      photo: 'img/doctors/fatima-kabore.svg', experience: 7, languages: 'French, English',
      bio: 'Skin, hair and nail problems: acne, eczema, allergies and skin checks.'
    },
    {
      id: 'doc_4', name: 'Dr. Arjun Sharma', specialty: 'Cardiology', clinicId: 'cli_2',
      photo: 'img/doctors/arjun-sharma.svg', experience: 15, languages: 'Hindi, English',
      bio: 'Heart specialist: chest pain, palpitations, high blood pressure and heart check-ups.'
    }
  ];

  function seedDoctor(base) {
    return Object.assign({ hours: defaultHours(), slotMinutes: 30, breakStart: '13:00', breakEnd: '14:00' }, base);
  }

  /** Demo data loaded the first time the app opens. */
  function seedClinics() {
    // Clinic 2 ends soon, so the "renew" reminder is visible in the demo
    const subs = { cli_1: demoSubscription('plus', 24), cli_2: demoSubscription('basic', 5) };
    return SEED_CLINICS.map((c) => Object.assign({}, c, { subscription: subs[c.id] }));
  }

  function seed() {
    return {
      version: VERSION,
      clinics: seedClinics(),
      doctors: SEED_DOCTORS.map(seedDoctor),
      patients: [],
      appointments: []
    };
  }

  /**
   * Upgrades data saved by an older version of the app (before clinics and photos existed),
   * so existing patients and appointments are kept.
   */
  function migrate(data) {
    if (data.version === VERSION) return false;
    const from = data.version || 1;

    // Version 1 -> 2: clinics, photos and profiles
    if (from < 2) {
      if (!Array.isArray(data.clinics) || !data.clinics.length) data.clinics = seedClinics();
      data.doctors.forEach((doc) => {
        const s = SEED_DOCTORS.find((d) => d.id === doc.id) || {};
        if (!doc.clinicId) doc.clinicId = s.clinicId || data.clinics[0].id;
        if (doc.photo === undefined) doc.photo = s.photo || '';
        if (doc.bio === undefined) doc.bio = s.bio || '';
        if (doc.experience === undefined) doc.experience = s.experience || '';
        if (doc.languages === undefined) doc.languages = s.languages || '';
      });
      if (!data.doctors.some((d) => d.id === 'doc_4')) data.doctors.push(seedDoctor(SEED_DOCTORS[3]));
    }

    // Version 2 -> 3: payments and clinic subscriptions
    if (from < 3) {
      data.clinics.forEach((c) => {
        if (!c.subscription) c.subscription = demoSubscription('basic', 30);
      });
      data.appointments.forEach((a) => {
        if (a.payment) return;
        const status = a.status === 'completed' ? 'paid' : a.status === 'cancelled' ? 'waived' : 'pending';
        a.payment = { method: 'clinic', status, amount: BOOKING_FEE };
      });
    }

    data.version = VERSION;
    return true;
  }

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (migrate(data)) write(data);
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
      throw new Error('Saving failed. Browser storage is full or turned off. Try a smaller photo.');
    }
  }

  /** Short unique id, e.g. "apt_lx3k9a2f". */
  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  return {
    KEY,
    defaultHours,

    /* ---------- Clinics ---------- */
    getClinics() {
      return read().clinics;
    },
    getClinic(id) {
      return read().clinics.find((c) => c.id === id) || null;
    },
    saveClinic(clinic) {
      const data = read();
      if (!clinic.id && !clinic.subscription) {
        clinic = Object.assign({}, clinic, { subscription: demoSubscription('basic', 30) });
      }
      if (clinic.id) {
        data.clinics = data.clinics.map((c) => (c.id === clinic.id ? Object.assign({}, c, clinic) : c));
      } else {
        clinic = Object.assign({}, clinic, { id: uid('cli') });
        data.clinics.push(clinic);
      }
      write(data);
      return clinic;
    },

    /* ---------- Doctors ---------- */
    getDoctors() {
      return read().doctors;
    },
    getDoctor(id) {
      return read().doctors.find((d) => d.id === id) || null;
    },
    /** Creates a doctor (no id) or updates an existing one (with id). */
    saveDoctor(fields) {
      const data = read();
      let doctor;
      if (fields.id) {
        doctor = data.doctors.find((d) => d.id === fields.id);
        if (!doctor) throw new Error('Doctor not found.');
        Object.assign(doctor, fields);
      } else {
        doctor = Object.assign({
          id: uid('doc'), hours: defaultHours(), slotMinutes: 30,
          breakStart: '13:00', breakEnd: '14:00'
        }, fields);
        data.doctors.push(doctor);
      }
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
      if (clash) throw new Error('This time was just taken by someone else. Choose another time.');
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

    /** Saves the payment of an appointment (demo). */
    setPayment(id, payment) {
      const data = read();
      const appt = data.appointments.find((a) => a.id === id);
      if (!appt) throw new Error('Appointment not found.');
      appt.payment = Object.assign({}, appt.payment, payment);
      write(data);
      return appt;
    },

    /** Records a (demo) subscription payment and moves the end date. */
    renewSubscription(clinicId, plan, paidUntil, record) {
      const data = read();
      const clinic = data.clinics.find((c) => c.id === clinicId);
      if (!clinic) throw new Error('Clinic not found.');
      const sub = clinic.subscription || { history: [] };
      sub.plan = plan;
      sub.paidUntil = paidUntil;
      sub.history = [record].concat(sub.history || []).slice(0, 12);
      clinic.subscription = sub;
      write(data);
      return clinic;
    },

    /** Deletes everything and reloads the demo data. */
    reset() {
      localStorage.removeItem(KEY);
      read();
    }
  };
})();
