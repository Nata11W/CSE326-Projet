/**
 * ui.js – Shared helpers used on every page:
 * toasts, form errors, session, password hashing, dates,
 * notifications, dark mode and the mobile menu.
 */
const UI = (function () {
  'use strict';

  const SESSION_KEY = 'wcb_session';
  const THEME_KEY = 'wcb_theme';

  /** Prevents HTML injection when inserting user text with innerHTML. */
  function escapeHTML(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(str).replace(/[&<>"']/g, (c) => map[c]);
  }

  /** Small pop-up message in the corner. type: info | success | error */
  function toast(message, type) {
    let box = document.getElementById('toast-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toast-box';
      box.className = 'toast-box';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = 'toast toast-' + (type || 'info');
    t.textContent = message;
    box.appendChild(t);
    // Fade out, then remove from the DOM
    setTimeout(() => {
      t.classList.add('leaving');
      setTimeout(() => t.remove(), 300);
    }, 4000);
  }

  /** Shows (or clears) the error under an input. Returns true when valid. */
  function setError(input, message) {
    const el = document.getElementById(input.id + '-error');
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (el) el.textContent = message || '';
    return !message;
  }

  /* ---------- Session (sessionStorage = cleared when the tab closes) ---------- */
  function getSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
  }
  function setSession(obj) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(obj)); }
  function clearSession() { sessionStorage.removeItem(SESSION_KEY); }

  /** SHA-256 hash with the Web Crypto API (demo only – real apps hash on a server). */
  async function hash(text) {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    return 'plain:' + text; // fallback when opened from file://
  }

  /* ---------- Dates ---------- */
  function todayStr(date) {
    const d = date || new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T00:00');
    d.setDate(d.getDate() + days);
    return todayStr(d);
  }
  function formatDate(dateStr) {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    }).format(new Date(dateStr + 'T00:00'));
  }

  /** Notification API with a toast fallback. */
  function notify(title, body) {
    if (!('Notification' in window)) { toast(title + ': ' + body); return; }
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().then((p) => {
        if (p === 'granted') new Notification(title, { body });
        else toast(title + ': ' + body);
      });
    } else {
      toast(title + ': ' + body);
    }
  }

  /* ---------- Theme (dark / light) ---------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('.theme-toggle').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(theme === 'dark'));
    });
  }
  /* A tiny inline script in each page's <head> already sets the theme before
     the first paint; this syncs the toggle buttons and handles clicks. */
  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* storage blocked */ }
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (prefersDark ? 'dark' : 'light'));
    document.querySelectorAll('.theme-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
      });
    });
  }

  /* ---------- Mobile navigation ---------- */
  function initNav() {
    const toggle = document.querySelector('.nav-toggle');
    const menu = document.getElementById('nav-menu');
    if (!toggle || !menu) return;
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      menu.classList.toggle('open', open);
    };
    toggle.addEventListener('click', () => {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    // Close the menu on Escape, on a click outside it, or after choosing a link
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('open')) {
        setOpen(false);
        toggle.focus();
      }
    });
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
    });
    menu.addEventListener('click', (e) => {
      if (e.target.closest('a')) setOpen(false);
    });
  }

  // Scripts are loaded at the end of <body>, so the DOM is ready here
  initTheme();
  initNav();

  return {
    escapeHTML, toast, setError,
    getSession, setSession, clearSession, hash,
    todayStr, addDays, formatDate, notify
  };
})();
