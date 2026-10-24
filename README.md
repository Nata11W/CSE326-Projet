# WebCareBooking

**Online medical appointment booking platform** – a front-end web application built with semantic HTML, CSS and vanilla JavaScript, deployed on GitHub Pages.

> Individual project · B.Tech CSE · Lovely Professional University · Windyam Natacha ZOUNGRANA

**Live demo:** `https://<your-github-username>.github.io/webcarebooking/`

---

## The problem

Booking a doctor still mostly means phoning the clinic during office hours, waiting on hold, and hoping a slot is free. Clinic staff spend hours managing calendars by hand, and patients often forget appointments.

## The solution

WebCareBooking is a two-sided platform:

| Role | What they can do |
|---|---|
| **Patient** | Create an account, search doctors by name or specialty, see real free time slots, book 24/7, cancel, view booking history, get browser reminders |
| **Clinic admin** | Log in to a dashboard, set each doctor's weekly working hours, slot length and break, see statistics, filter appointments, mark them done or cancelled, add doctors, export to CSV |

## Features → course topics

| # | Course topic | Where it is used |
|---|---|---|
| 1 | Semantic HTML | `header`, `nav`, `main`, `section`, `article`, `footer`, `fieldset/legend`, table with `caption`/`scope`, skip link, ARIA |
| 2 | Forms & validation | Register, login, booking, working-hours and add-doctor forms; HTML5 attributes + custom JS rules in `js/validate.js`; live error messages |
| 3 | CSS | Custom properties (light/dark theme), Flexbox, Grid, `:has()`, transitions, animations |
| 4 | JavaScript fundamentals | Modules via IIFE, arrays (`map`/`filter`/`sort`), objects, template literals, `async/await`, `try/catch` |
| 5 | DOM & events | Dynamic rendering, event delegation, `input`/`change`/`submit`/`focusout`/`storage` events |
| 6 | Browser APIs | `localStorage`, `sessionStorage`, Notification API, Web Crypto (`crypto.subtle`), Blob + `URL.createObjectURL`, `Intl.DateTimeFormat`, `matchMedia` |
| 7 | Responsive design | Mobile-first CSS, breakpoints at 640px and 960px, collapsible menu, table → cards on phones |
| 8 | Debugging & testing | 22 unit tests (`tests/tests.html`), `console.error` logging, error toasts, DevTools |
| 9 | Code organisation | One file per responsibility, JSDoc comments, this README |
| 10 | Deployment | GitHub repository + GitHub Pages |

## Folder structure

```
webcarebooking/
├── index.html        Landing page
├── book.html         Patient area (login/register, booking, my appointments)
├── admin.html        Clinic dashboard
├── css/
│   └── style.css     All styles (mobile-first)
├── js/
│   ├── storage.js    Data layer (localStorage)
│   ├── slots.js      Time-slot logic (pure functions)
│   ├── validate.js   Form validation rules
│   ├── ui.js         Shared helpers (toasts, session, theme, dates, notifications)
│   ├── home.js       Landing page script
│   ├── patient.js    Patient page script
│   └── admin.js      Dashboard script
└── tests/
    ├── tests.html    Run unit tests in the browser
    ├── test-cases.js Test cases
    └── run-node.js   Run the same tests with Node.js
```

## Run it locally

Open `index.html` in a browser, or (better) start a small local server so every browser API works:

```bash
# with Python
python -m http.server 8000
# then open http://localhost:8000
```

In VS Code you can also use the **Live Server** extension.

**Demo admin login:** `admin@webcare.com` / `Admin@123`

## Run the tests

- Browser: open `tests/tests.html`
- Terminal: `node tests/run-node.js`

## Deploy on GitHub Pages

1. Create a public repository named `webcarebooking` on GitHub.
2. Push this folder:
   ```bash
   git init
   git add .
   git commit -m "Initial version of WebCareBooking"
   git branch -M main
   git remote add origin https://github.com/<username>/webcarebooking.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
4. After about a minute the site is live at `https://<username>.github.io/webcarebooking/`.

## Limitations

This is a front-end prototype: data is stored only in the user's own browser, so patients and the clinic must use the same browser for the demo to show shared bookings. Passwords are hashed in the browser but this is **not** real security. A production version would add a back-end (e.g. Node.js + a database), real authentication, e-mail/SMS reminders and online payments.

## License

Educational project – Lovely Professional University, 2026.
