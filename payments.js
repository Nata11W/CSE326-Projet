/**
 * payments.js – Demo payment rules (pure functions, no DOM).
 *
 * IMPORTANT: this is a DEMONSTRATION. No money is taken and no card or
 * bank details are ever asked for. A real version needs a server that
 * creates the order with a payment provider (for example Razorpay) and
 * verifies the payment signature – which GitHub Pages cannot do.
 */
const Payments = (function () {
  'use strict';

  /** Service fee a patient pays per online booking (₹). */
  const BOOKING_FEE = 20;

  /** Hours before the appointment until which a cancelled online payment is refunded. */
  const FREE_CANCEL_HOURS = 2;

  /** Monthly plans for clinics and hospitals (₹ per month). */
  const PLANS = {
    basic: { id: 'basic', name: 'Basic', price: 999, maxDoctors: 3, text: 'Up to 3 doctors, dashboard and statistics' },
    plus: { id: 'plus', name: 'Plus', price: 1999, maxDoctors: 15, text: 'Up to 15 doctors, CSV export and priority support' }
  };

  const METHODS = {
    upi: 'UPI',
    card: 'Card',
    clinic: 'At the clinic'
  };

  /** 1999 -> "₹1,999" */
  function rupees(amount) {
    return '₹' + Number(amount || 0).toLocaleString('en-IN');
  }

  /** Demo transaction reference, e.g. "PAY-7KQ2M9XA". */
  function reference(prefix) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let ref = '';
    for (let i = 0; i < 8; i++) ref += chars[Math.floor(Math.random() * chars.length)];
    return (prefix || 'PAY') + '-' + ref;
  }

  /** Adds whole days to "YYYY-MM-DD" (local time). */
  function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T00:00');
    d.setDate(d.getDate() + days);
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /** Days from `today` until `paidUntil` (negative when expired). */
  function daysBetween(today, paidUntil) {
    return Math.round((new Date(paidUntil + 'T00:00') - new Date(today + 'T00:00')) / 86400000);
  }

  /**
   * Subscription state of a clinic.
   * @returns {{active: boolean, daysLeft: number, endsSoon: boolean}}
   */
  function subscriptionStatus(subscription, today) {
    if (!subscription || !subscription.paidUntil) return { active: false, daysLeft: -1, endsSoon: false };
    const daysLeft = daysBetween(today, subscription.paidUntil);
    return { active: daysLeft >= 0, daysLeft, endsSoon: daysLeft >= 0 && daysLeft <= 7 };
  }

  /**
   * New "paid until" date after paying for `months` (30 days each).
   * An active plan is extended from its end date; an expired one starts again today.
   */
  function renewedUntil(paidUntil, today, months) {
    const start = paidUntil && paidUntil >= today ? paidUntil : today;
    return addDays(start, 30 * (months || 1));
  }

  /**
   * Is an online payment refunded when the patient cancels?
   * Yes if it was paid online and the cancellation is at least FREE_CANCEL_HOURS before the visit.
   */
  function refundOnCancel(appointment, now) {
    if (!appointment.payment || appointment.payment.status !== 'paid' || appointment.payment.method === 'clinic') return false;
    const visit = new Date(appointment.date + 'T' + appointment.time).getTime();
    return visit - now.getTime() >= FREE_CANCEL_HOURS * 3600000;
  }

  /**
   * Totals of booking fees.
   * @returns {{received: number, toCollect: number, refunded: number}}
   */
  function totals(appointments) {
    const t = { received: 0, toCollect: 0, refunded: 0 };
    appointments.forEach((a) => {
      const p = a.payment;
      if (!p) return;
      if (p.status === 'paid') t.received += p.amount;
      else if (p.status === 'pending' && a.status === 'booked') t.toCollect += p.amount;
      else if (p.status === 'refunded') t.refunded += p.amount;
    });
    return t;
  }

  /** Short label for a payment, e.g. "Paid online (UPI)". */
  function label(payment) {
    if (!payment) return 'No payment';
    if (payment.status === 'refunded') return 'Refunded';
    if (payment.status === 'pending') return 'Pay at clinic';
    if (payment.status === 'waived') return 'No fee';
    return payment.method === 'clinic' ? 'Paid at clinic' : 'Paid online (' + METHODS[payment.method] + ')';
  }

  return {
    BOOKING_FEE, FREE_CANCEL_HOURS, PLANS, METHODS,
    rupees, reference, addDays, subscriptionStatus, renewedUntil, refundOnCancel, totals, label
  };
})();

if (typeof module !== 'undefined') module.exports = Payments;
