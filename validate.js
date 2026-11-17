/**
 * validate.js – Form validation rules.
 * Every function returns an error message, or '' when the value is valid.
 */
const Validate = (function () {
  'use strict';

  function name(value) {
    const v = String(value).trim();
    if (!v) return 'Name is required.';
    if (v.length < 3) return 'Name must be at least 3 characters.';
    if (!/^[A-Za-zÀ-ÿ.' -]+$/.test(v)) return 'Use letters only.';
    return '';
  }

  function email(value) {
    const v = String(value).trim();
    if (!v) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Enter a valid email, e.g. name@mail.com.';
    return '';
  }

  function phone(value) {
    const v = String(value).trim();
    if (!v) return 'Phone number is required.';
    if (!/^\+?[0-9 ]{8,15}$/.test(v)) return 'Use 8–15 digits, optionally starting with +.';
    return '';
  }

  function password(value) {
    const v = String(value);
    if (!v) return 'Password is required.';
    if (v.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Za-z]/.test(v) || !/[0-9]/.test(v)) return 'Use at least one letter and one number.';
    return '';
  }

  function match(original, confirm) {
    if (!confirm) return 'Please confirm your password.';
    return original === confirm ? '' : 'Passwords do not match.';
  }

  /** Date of birth: required, not in the future, realistic age. */
  function dob(value, today) {
    if (!value) return 'Date of birth is required.';
    today = today || new Date();
    const birth = new Date(value + 'T00:00');
    if (isNaN(birth)) return 'Enter a valid date.';
    if (birth > today) return 'Date of birth cannot be in the future.';
    if (today.getFullYear() - birth.getFullYear() > 120) return 'Please check the year.';
    return '';
  }

  /** Working-hours range "09:00" → "17:00". */
  function timeRange(start, end) {
    if (!start || !end) return 'Both times are required.';
    if (start >= end) return 'End time must be after start time.';
    return '';
  }

  const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const MAX_IMAGE_MB = 5;

  /** Doctor photo chosen with <input type="file">. Empty = keep current photo. */
  function image(file) {
    if (!file) return '';
    if (!IMAGE_TYPES.includes(file.type)) return 'Choose a JPG, PNG, WebP or GIF image.';
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) return 'The photo must be smaller than ' + MAX_IMAGE_MB + ' MB.';
    return '';
  }

  /** Years of experience: optional, whole number 0–60. */
  function experience(value) {
    if (value === '' || value === null || value === undefined) return '';
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 60) return 'Enter a whole number of years between 0 and 60.';
    return '';
  }

  /** Clinic or hospital name. */
  function clinicName(value) {
    const v = String(value).trim();
    if (!v) return 'Clinic name is required.';
    if (v.length < 3) return 'Clinic name must be at least 3 characters.';
    return '';
  }

  /** Optional email (empty is allowed). */
  function optionalEmail(value) {
    return String(value).trim() ? email(value) : '';
  }

  /** Booking payment choice: upi | card | clinic. */
  function paymentMethod(value) {
    return ['upi', 'card', 'clinic'].includes(value) ? '' : 'Choose how you want to pay the booking fee.';
  }

  return { name, email, phone, password, match, dob, timeRange, image, experience, clinicName, optionalEmail, paymentMethod };
})();

if (typeof module !== 'undefined') module.exports = Validate;
