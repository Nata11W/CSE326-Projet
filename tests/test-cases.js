/**
 * test-cases.js – Unit tests for the pure logic (slots.js, validate.js, payments.js).
 * Runs in the browser (tests.html) or in Node:  node tests/run-node.js
 */
function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error((label || '') + ' expected ' + e + ' but got ' + a);
}
function assertTrue(value, label) {
  if (!value) throw new Error(label || 'expected true');
}

// A test doctor: Monday 09:00–12:00, 30-min slots, break 10:00–10:30
const testDoctor = {
  id: 'doc_test',
  slotMinutes: 30,
  breakStart: '10:00',
  breakEnd: '10:30',
  hours: {
    mon: { on: true, start: '09:00', end: '12:00' },
    tue: { on: false, start: '09:00', end: '12:00' },
    wed: { on: true, start: '09:00', end: '12:00' },
    thu: { on: true, start: '09:00', end: '12:00' },
    fri: { on: true, start: '09:00', end: '12:00' },
    sat: { on: false, start: '09:00', end: '12:00' },
    sun: { on: false, start: '09:00', end: '12:00' }
  }
};
// 2030-01-07 is a Monday; "now" is set before it so every slot is in the future
const MONDAY = '2030-01-07';
const TUESDAY = '2030-01-08';
const NOW = new Date('2030-01-01T08:00');

const TEST_CASES = [
  ['toMinutes converts HH:MM', () => assertEqual(Slots.toMinutes('09:30'), 570)],
  ['toHHMM pads with zeros', () => assertEqual(Slots.toHHMM(545), '09:05')],
  ['dayKey finds Monday', () => assertEqual(Slots.dayKey(MONDAY), 'mon')],

  ['generate skips the break and respects the end time', () => {
    const times = Slots.generate(testDoctor, MONDAY, [], NOW).map((s) => s.time);
    assertEqual(times, ['09:00', '09:30', '10:30', '11:00', '11:30']);
  }],
  ['generate returns nothing on a day off', () => {
    assertEqual(Slots.generate(testDoctor, TUESDAY, [], NOW), []);
  }],
  ['booked slot is unavailable', () => {
    const appts = [{ doctorId: 'doc_test', date: MONDAY, time: '09:30', status: 'booked' }];
    const slot = Slots.generate(testDoctor, MONDAY, appts, NOW).find((s) => s.time === '09:30');
    assertEqual(slot.available, false);
  }],
  ['cancelled booking frees the slot again', () => {
    const appts = [{ doctorId: 'doc_test', date: MONDAY, time: '09:30', status: 'cancelled' }];
    const slot = Slots.generate(testDoctor, MONDAY, appts, NOW).find((s) => s.time === '09:30');
    assertEqual(slot.available, true);
  }],
  ['booking of another doctor does not block the slot', () => {
    const appts = [{ doctorId: 'other', date: MONDAY, time: '09:30', status: 'booked' }];
    const slot = Slots.generate(testDoctor, MONDAY, appts, NOW).find((s) => s.time === '09:30');
    assertEqual(slot.available, true);
  }],
  ['past slots are unavailable', () => {
    const later = new Date(MONDAY + 'T10:45');
    const free = Slots.generate(testDoctor, MONDAY, [], later).filter((s) => s.available).map((s) => s.time);
    assertEqual(free, ['11:00', '11:30']);
  }],

  ['valid name passes', () => assertEqual(Validate.name('Natacha Zoungrana'), '')],
  ['short name fails', () => assertTrue(Validate.name('Al') !== '')],
  ['name with digits fails', () => assertTrue(Validate.name('John3') !== '')],
  ['valid email passes', () => assertEqual(Validate.email('user@lpu.in'), '')],
  ['email without @ fails', () => assertTrue(Validate.email('user.lpu.in') !== '')],
  ['phone with + passes', () => assertEqual(Validate.phone('+91 98765 43210'), '')],
  ['phone with letters fails', () => assertTrue(Validate.phone('98765abc') !== '')],
  ['weak password fails', () => assertTrue(Validate.password('abcdefgh') !== '')],
  ['strong password passes', () => assertEqual(Validate.password('care2026'), '')],
  ['passwords must match', () => assertTrue(Validate.match('a1b2c3d4', 'a1b2c3d5') !== '')],
  ['future birth date fails', () => assertTrue(Validate.dob('2099-01-01') !== '')],
  ['end before start fails', () => assertTrue(Validate.timeRange('17:00', '09:00') !== '')],
  ['correct time range passes', () => assertEqual(Validate.timeRange('09:00', '17:00'), '')],

  /* ---------- Token numbers ---------- */
  ['first token of the day is 1', () => assertEqual(Slots.nextToken([], 'doc_test', MONDAY), 1)],
  ['tokens count per doctor and day, cancelled included', () => {
    const appts = [
      { doctorId: 'doc_test', date: MONDAY, status: 'booked' },
      { doctorId: 'doc_test', date: MONDAY, status: 'cancelled' },
      { doctorId: 'other', date: MONDAY, status: 'booked' },
      { doctorId: 'doc_test', date: TUESDAY, status: 'booked' }
    ];
    assertEqual(Slots.nextToken(appts, 'doc_test', MONDAY), 3);
  }],
  ['token is shown with two digits', () => assertEqual(Slots.formatToken(7), '07')],

  /* ---------- Booking fee (demo payments) ---------- */
  ['booking fee is ₹20', () => assertEqual(Payments.formatINR(Payments.BOOKING_FEE), '₹20')],
  ['UPI payment is marked paid with a demo reference', () => {
    const p = Payments.create('upi', NOW);
    assertEqual([p.status, p.amount, p.paidAt], ['paid', 20, NOW.toISOString()]);
    assertTrue(/^DEMO-/.test(p.ref), 'reference starts with DEMO-');
  }],
  ['card payment is marked paid', () => assertEqual(Payments.create('card', NOW).status, 'paid')],
  ['pay at clinic is not paid yet', () => {
    const p = Payments.create('clinic', NOW);
    assertEqual([p.status, p.paidAt, p.ref], ['pay-at-clinic', null, null]);
  }],
  ['unknown payment method is refused', () => {
    let failed = false;
    try { Payments.create('bitcoin', NOW); } catch (e) { failed = true; }
    assertTrue(failed, 'expected an error');
  }],
  ['cancelling a paid booking refunds it', () => {
    const p = Payments.afterStatusChange(Payments.create('upi', NOW), 'cancelled', NOW);
    assertEqual(p.status, 'refunded');
  }],
  ['cancelling a pay-at-clinic booking costs nothing', () => {
    const p = Payments.afterStatusChange(Payments.create('clinic', NOW), 'cancelled', NOW);
    assertEqual(p.status, 'no-charge');
  }],
  ['completing a pay-at-clinic booking collects the fee', () => {
    const p = Payments.afterStatusChange(Payments.create('clinic', NOW), 'completed', NOW);
    assertEqual([p.status, p.method], ['paid', 'clinic']);
  }],
  ['status change does not modify the original payment', () => {
    const original = Payments.create('upi', NOW);
    Payments.afterStatusChange(original, 'cancelled', NOW);
    assertEqual(original.status, 'paid');
  }],
  ['payment labels for patients and staff', () => {
    assertEqual([
      Payments.label(Payments.create('upi', NOW)),
      Payments.label(Payments.create('clinic', NOW)),
      Payments.label(undefined)
    ], ['Paid', 'Pay at clinic', 'Not recorded']);
  }],
  ['payment description names the method', () => {
    assertEqual(Payments.describe(Payments.create('card', NOW)), 'Paid by Card');
  }],
  ['earnings count only fees actually received', () => {
    const appts = [
      { status: 'booked', payment: Payments.create('upi', NOW) },
      { status: 'completed', payment: Payments.afterStatusChange(Payments.create('clinic', NOW), 'completed', NOW) },
      { status: 'booked', payment: Payments.create('clinic', NOW) },
      { status: 'cancelled', payment: Payments.afterStatusChange(Payments.create('card', NOW), 'cancelled', NOW) },
      { status: 'booked' } // old booking without a payment record
    ];
    assertEqual(Payments.earnings(appts), { total: 40, count: 2, due: 20, dueCount: 1 });
  }],

  /* ---------- Clinic subscription ---------- */
  ['plan costs ₹999 per month', () => assertEqual(Payments.formatINR(Payments.PLAN.price), '₹999')],
  ['new subscription is active for 30 days', () => {
    const sub = Payments.newSubscription(NOW);
    assertEqual(Payments.subscriptionStatus(sub, NOW), { active: true, daysLeft: 30 });
  }],
  ['subscription expires after 30 days', () => {
    const sub = Payments.newSubscription(NOW);
    const later = new Date(NOW.getTime() + 31 * 86400000);
    assertEqual(Payments.subscriptionStatus(sub, later), { active: false, daysLeft: 0 });
  }],
  ['renewing an active plan adds 30 days to its end date', () => {
    const sub = Payments.newSubscription(NOW);
    const tenDaysLater = new Date(NOW.getTime() + 10 * 86400000);
    const renewed = Payments.renew(sub, tenDaysLater);
    assertEqual(Payments.subscriptionStatus(renewed, tenDaysLater).daysLeft, 50);
  }],
  ['renewing an expired plan restarts from today', () => {
    const sub = Payments.newSubscription(NOW);
    const later = new Date(NOW.getTime() + 45 * 86400000);
    assertEqual(Payments.subscriptionStatus(Payments.renew(sub, later), later).daysLeft, 30);
  }]
];

if (typeof module !== 'undefined') module.exports = TEST_CASES;
