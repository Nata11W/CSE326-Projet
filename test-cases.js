/**
 * test-cases.js – Unit tests for the pure logic (slots.js, validate.js).
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

  ['nextFree finds the first open slot', () => {
    const appts = [{ doctorId: 'doc_test', date: MONDAY, time: '09:00', status: 'booked' }];
    assertEqual(Slots.nextFree(testDoctor, appts, MONDAY, 7, NOW), { date: MONDAY, time: '09:30' });
  }],
  ['nextFree skips a day off', () => {
    const late = new Date(MONDAY + 'T23:00');
    assertEqual(Slots.nextFree(testDoctor, [], MONDAY, 7, late), { date: '2030-01-09', time: '09:00' });
  }],
  ['tokenFor counts slots after the break', () => assertEqual(Slots.tokenFor(testDoctor, MONDAY, '10:30'), 3)],
  ['tokenFor returns null for an unknown time', () => assertEqual(Slots.tokenFor(testDoctor, MONDAY, '10:00'), null)],
  ['JPG photo passes', () => assertEqual(Validate.image({ type: 'image/jpeg', size: 200000 }), '')],
  ['PDF instead of photo fails', () => assertTrue(Validate.image({ type: 'application/pdf', size: 1000 }) !== '')],
  ['photo over 5 MB fails', () => assertTrue(Validate.image({ type: 'image/png', size: 6 * 1024 * 1024 }) !== '')],
  ['experience must be a whole number', () => assertTrue(Validate.experience('3.5') !== '')],
  ['empty optional email passes', () => assertEqual(Validate.optionalEmail(''), '')],

  // ---------- Payments (demo) ----------
  ['rupees formats Indian style', () => assertEqual(Payments.rupees(1999), '₹1,999')],
  ['active plan is extended from its end date', () =>
    assertEqual(Payments.renewedUntil('2030-01-20', '2030-01-10', 1), '2030-02-19')],
  ['expired plan starts again today', () =>
    assertEqual(Payments.renewedUntil('2030-01-05', '2030-01-10', 1), '2030-02-09')],
  ['plan ending in 5 days is active and ends soon', () =>
    assertEqual(Payments.subscriptionStatus({ paidUntil: '2030-01-15' }, '2030-01-10'), { active: true, daysLeft: 5, endsSoon: true })],
  ['plan that ended yesterday is not active', () =>
    assertEqual(Payments.subscriptionStatus({ paidUntil: '2030-01-09' }, '2030-01-10').active, false)],
  ['online fee refunded when cancelled 3 hours before', () => {
    const appt = { date: MONDAY, time: '12:00', payment: { method: 'upi', status: 'paid', amount: 20 } };
    assertEqual(Payments.refundOnCancel(appt, new Date(MONDAY + 'T09:00')), true);
  }],
  ['online fee kept when cancelled 1 hour before', () => {
    const appt = { date: MONDAY, time: '12:00', payment: { method: 'card', status: 'paid', amount: 20 } };
    assertEqual(Payments.refundOnCancel(appt, new Date(MONDAY + 'T11:00')), false);
  }],
  ['fee to pay at the clinic is never refunded', () => {
    const appt = { date: MONDAY, time: '12:00', payment: { method: 'clinic', status: 'pending', amount: 20 } };
    assertEqual(Payments.refundOnCancel(appt, new Date(MONDAY + 'T06:00')), false);
  }],
  ['totals add received, to collect and refunded fees', () => {
    const list = [
      { status: 'booked', payment: { status: 'paid', amount: 20 } },
      { status: 'completed', payment: { status: 'paid', amount: 20 } },
      { status: 'booked', payment: { status: 'pending', amount: 20 } },
      { status: 'cancelled', payment: { status: 'refunded', amount: 20 } },
      { status: 'cancelled', payment: { status: 'waived', amount: 20 } }
    ];
    assertEqual(Payments.totals(list), { received: 40, toCollect: 20, refunded: 20 });
  }],
  ['payment label for UPI', () => assertEqual(Payments.label({ method: 'upi', status: 'paid' }), 'Paid online (UPI)')],
  ['payment method is required', () => assertTrue(Validate.paymentMethod('') !== '')],
  ['pay at clinic is a valid method', () => assertEqual(Validate.paymentMethod('clinic'), '')]
];

if (typeof module !== 'undefined') module.exports = TEST_CASES;
