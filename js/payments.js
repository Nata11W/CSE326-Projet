/**
 * payments.js – Booking fee and clinic subscription rules (DEMO ONLY).
 * Pure functions with no DOM or storage access, so they can be unit tested
 * (see tests/tests.html). No real money is ever taken: a real version must
 * confirm payments on a server through a payment gateway (see README).
 */
const Payments = (function () {
  'use strict';

  const BOOKING_FEE = 20; // ₹ per appointment
  const PLAN = { name: 'Clinic Plan', price: 999, days: 30 }; // ₹ per month
  const METHODS = { upi: 'UPI', card: 'Card', clinic: 'Pay at the clinic' };
  const DAY_MS = 24 * 60 * 60 * 1000;

  /** 999 -> "₹999" (Indian number format, no decimals) */
  function formatINR(amount) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', maximumFractionDigits: 0
    }).format(amount);
  }

  /** Fake transaction reference, e.g. "DEMO-K3X9A2". */
  function reference(now) {
    return 'DEMO-' + now.getTime().toString(36).slice(-4).toUpperCase() +
      Math.random().toString(36).slice(2, 4).toUpperCase();
  }

  /**
   * Payment record for a new booking.
   * UPI / Card are marked paid at once (demo); "clinic" is paid on the day.
   * @param {string} method  'upi' | 'card' | 'clinic'
   * @param {Date}   [now]   current time (injectable for tests)
   */
  function create(method, now) {
    if (!METHODS[method]) throw new Error('Please choose a payment method.');
    now = now || new Date();
    const online = method !== 'clinic';
    return {
      method,
      amount: BOOKING_FEE,
      status: online ? 'paid' : 'pay-at-clinic',
      paidAt: online ? now.toISOString() : null,
      ref: online ? reference(now) : null
    };
  }

  /**
   * How a payment changes when its appointment changes status:
   *   cancelled + paid          -> refunded (demo refund)
   *   cancelled + pay-at-clinic -> no-charge (nothing is owed)
   *   completed + pay-at-clinic -> paid (collected at the reception)
   * Returns a new object; the original is not modified.
   */
  function afterStatusChange(payment, apptStatus, now) {
    if (!payment) return payment;
    now = now || new Date();
    if (apptStatus === 'cancelled' && payment.status === 'paid') {
      return Object.assign({}, payment, { status: 'refunded', refundedAt: now.toISOString() });
    }
    if (apptStatus === 'cancelled' && payment.status === 'pay-at-clinic') {
      return Object.assign({}, payment, { status: 'no-charge' });
    }
    if (apptStatus === 'completed' && payment.status === 'pay-at-clinic') {
      return Object.assign({}, payment, { status: 'paid', paidAt: now.toISOString() });
    }
    return payment;
  }

  /** Short label for badges, e.g. "Paid" or "Pay at clinic". */
  function label(payment) {
    if (!payment) return 'Not recorded'; // bookings made before payments existed
    return {
      'paid': 'Paid',
      'pay-at-clinic': 'Pay at clinic',
      'refunded': 'Refunded',
      'no-charge': 'No charge'
    }[payment.status] || 'Not recorded';
  }

  /** Longer description, e.g. "Paid by UPI" or "Paid at the clinic". */
  function describe(payment) {
    if (!payment) return 'Not recorded';
    if (payment.status === 'paid') {
      return payment.method === 'clinic' ? 'Paid at the clinic' : 'Paid by ' + METHODS[payment.method];
    }
    if (payment.status === 'refunded') return 'Refunded to ' + METHODS[payment.method];
    return label(payment);
  }

  /** CSS modifier for the badge: paid | due | refunded | none */
  function badgeType(payment) {
    if (!payment) return 'none';
    return { 'paid': 'paid', 'pay-at-clinic': 'due', 'refunded': 'refunded' }[payment.status] || 'none';
  }

  /**
   * Booking-fee totals for the dashboard.
   * @returns {{total:number, count:number, due:number, dueCount:number}}
   *   total/count: fees actually received; due/dueCount: still to collect at the clinic.
   */
  function earnings(appointments) {
    const result = { total: 0, count: 0, due: 0, dueCount: 0 };
    appointments.forEach((a) => {
      if (!a.payment) return;
      if (a.payment.status === 'paid') {
        result.total += a.payment.amount;
        result.count++;
      } else if (a.payment.status === 'pay-at-clinic' && a.status === 'booked') {
        result.due += a.payment.amount;
        result.dueCount++;
      }
    });
    return result;
  }

  /* ---------- Clinic subscription ---------- */

  /** A new subscription starting now, valid for one billing period. */
  function newSubscription(now) {
    now = now || new Date();
    return {
      plan: PLAN.name,
      price: PLAN.price,
      startedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + PLAN.days * DAY_MS).toISOString()
    };
  }

  /** @returns {{active: boolean, daysLeft: number}} */
  function subscriptionStatus(sub, now) {
    now = now || new Date();
    const left = new Date(sub.expiresAt).getTime() - now.getTime();
    return { active: left > 0, daysLeft: Math.max(0, Math.ceil(left / DAY_MS)) };
  }

  /**
   * Renew for one more period. An active plan is extended from its expiry
   * date (no days are lost); an expired plan restarts from today.
   */
  function renew(sub, now) {
    now = now || new Date();
    const base = Math.max(now.getTime(), new Date(sub.expiresAt).getTime());
    return Object.assign({}, sub, {
      expiresAt: new Date(base + PLAN.days * DAY_MS).toISOString(),
      renewedAt: now.toISOString()
    });
  }

  return {
    BOOKING_FEE, PLAN, METHODS,
    formatINR, create, afterStatusChange, label, describe, badgeType, earnings,
    newSubscription, subscriptionStatus, renew
  };
})();

// Allow Node.js to import this file for quick tests (ignored by browsers)
if (typeof module !== 'undefined') module.exports = Payments;
