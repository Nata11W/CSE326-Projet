# WebCareBooking

**Online medical appointment booking platform** – a front-end web application built with semantic HTML, CSS and vanilla JavaScript, deployed on GitHub Pages.

> **CSE326 – Internet Programming** · Individual project · Lovely Professional University
> Windyam Natacha ZOUNGRANA · Reg. No. 12600261 · Section K2P26AC
> Submitted to **Dr. Parminder Singh** · 06 November 2026

**Live demo:** https://nata11w.github.io/webcarebooking/  
**Repository:** https://github.com/Nata11W/webcarebooking

---

## The problem

Booking a doctor still mostly means phoning the clinic during office hours, waiting on hold, and hoping a slot is free. Clinic staff spend hours managing calendars by hand, and patients often forget appointments.

## The solution

WebCareBooking is a two-sided platform:

| Role | What they can do |
|---|---|
| **Patient** | See each doctor's photo and profile, search by name or specialty, see real free time slots, book 24/7 and get a token slip with a queue number, cancel, view booking history, get browser reminders, pay the ₹20 booking fee online or at the clinic (**demo payment**), get a refund when cancelling early, or **call the clinic directly** with one tap (no account needed) |
| **Clinic admin** | Log in to a dashboard, add or edit doctors and **upload their photos**, edit clinic and hospital contact details, set each doctor's weekly working hours, slot length and break, see statistics, filter appointments, mark them done or cancelled, mark fees paid at the reception, see fee totals, pay the clinic's monthly plan (**demo payment**), export to CSV |

## Features → course topics

| # | Course topic | Where it is used |
|---|---|---|
| 1 | Semantic HTML | `header`, `nav`, `main`, `section`, `article`, `aside`, `figure`, `address`, `dialog`, `dl`, `footer`, `fieldset/legend`, table with `caption`/`scope`, `tel:`/`mailto:` links, skip link, ARIA |
| 2 | Forms & validation | Register, login, booking, working-hours, doctor (with photo upload) and clinic forms; HTML5 attributes + custom JS rules in `js/validate.js`; live error messages |
| 3 | CSS | Custom properties (light/dark theme), Flexbox, Grid, `:has()`, CSS counters, `mask` (perforated token slip), `::backdrop`, print styles, animations |
| 4 | JavaScript fundamentals | Modules via IIFE, arrays (`map`/`filter`/`sort`), objects, template literals, `async/await`, `try/catch` |
| 5 | DOM & events | Dynamic rendering, event delegation, `input`/`change`/`submit`/`focusout`/`storage` events, `error` event in the capture phase (missing photos) |
| 6 | Browser APIs | `localStorage`, `sessionStorage`, Notification API, Web Crypto (`crypto.subtle`), **FileReader** + **Canvas** (photo upload and crop), `<dialog>` `showModal()`, `URLSearchParams`, `window.print()`, Blob + `URL.createObjectURL`, `Intl.DateTimeFormat`, `matchMedia` |
| 7 | Responsive design | Mobile-first CSS, breakpoints at 640px and 960px, collapsible menu, two-column doctor grid on phones, table → stacked rows on phones |
| 8 | Debugging & testing | 43 unit tests (`tests/tests.html`), `console.error` logging, error toasts, DevTools |
| 9 | Code organisation | One file per responsibility, JSDoc comments, this README |
| 10 | Deployment | GitHub repository + GitHub Pages |

## Folder structure

```
webcarebooking/
├── index.html        Landing page
├── book.html         Patient area (login/register, booking, my appointments)
├── admin.html        Clinic dashboard
├── img/doctors/      Doctor portraits (illustrations – replace with real photos)
├── css/
│   └── style.css     All styles (mobile-first)
├── js/
│   ├── storage.js    Data layer (localStorage)
│   ├── slots.js      Time-slot logic (pure functions)
│   ├── validate.js   Form validation rules
│   ├── ui.js         Shared helpers (toasts, session, theme, dates, notifications)
│   ├── profiles.js   Doctor photos, profile dialog, clinic contact block
│   ├── payments.js   Demo payment rules (fees, refunds, clinic plans)
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

## Design

The interface takes its inspiration from my other project, **CURSUS BF** (an education guide for Burkina Faso): a deep navy navbar, hero and footer with a gold accent, a highlighted headline, live figures, a search bar, a featured "next free appointment" card, specialty cards, and a doctor list with a filter sidebar, sorting and a results count. Clinics are shown as contact cards with a green call button. The booking confirmation keeps its OPD-style token slip.

## Payments (demo)

Both sides of the revenue model work as a **clearly labelled demo**. **No money is taken and no card or bank details are ever asked for.**

| Who | What happens |
|---|---|
| **Patient** | Step 4 of the booking form: choose **UPI**, **Card** or **Pay at the clinic**. UPI or card opens a "Demo payment" window; after a short processing step the booking is saved with a reference (e.g. `PAY-7KQ2M9XA`). Cancelling at least 2 hours before refunds the ₹20 fee. |
| **Clinic** | Dashboard → **Payments**: fees received, fees to collect, refunds. "Fee received" button for pay-at-clinic bookings. Each clinic has a **Basic** (₹999/month, up to 3 doctors) or **Plus** (₹1,999/month, up to 15 doctors) plan with a demo "Pay next month" button and payment history. When a plan ends, online booking for that clinic is paused and patients are shown its phone number. |

A real version would need a server: the server creates the order with a provider such as Razorpay using a secret key, the provider's own checkout collects the payment, and the server verifies the signed confirmation. GitHub Pages cannot do this, so the app simulates it.

## Doctor photos and clinic numbers

- The four demo doctors use **illustrated portraits** from `img/doctors/`.
- To use real photos, log in to the **Clinic dashboard**, click **Edit** next to a doctor and choose a photo. It is cropped to a square and saved in the browser.
- To change the default photo for everyone, replace the file in `img/doctors/` (or change the `photo` path in `js/storage.js`) and upload it to GitHub.
- Only use photos with the person's permission, or free stock photos (for example from Unsplash or Pexels).
- Clinic phone numbers in the demo are **placeholders** (`+91 00000 …`). Change them in **Clinic dashboard → Clinics and hospitals**.

## Run the tests

- Browser: open `tests/tests.html`
- Terminal: `node tests/run-node.js`

## Deploy on GitHub Pages

1. Sign in to GitHub as **Nata11W** and create a public repository named `webcarebooking`.
2. Push this folder:
   ```bash
   git init
   git add .
   git commit -m "Initial version of WebCareBooking"
   git branch -M main
   git remote add origin https://github.com/Nata11W/webcarebooking.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
4. After about a minute the site is live at https://nata11w.github.io/webcarebooking/.

## Limitations

This is a front-end prototype: data is stored only in the user's own browser, so patients and the clinic must use the same browser for the demo to show shared bookings. Passwords are hashed in the browser but this is **not** real security. Payments are simulated. A production version would add a back-end (e.g. Node.js + a database), real authentication, e-mail/SMS reminders and online payments.

## License

Educational project – CSE326 Internet Programming, Lovely Professional University, 2026.
