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
  ['correct time range passes', () => assertEqual(Validate.timeRange('09:00', '17:00'), '')]
];

if (typeof module !== 'undefined') module.exports = TEST_CASES;
