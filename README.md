# WebCareBooking

**Online medical appointment booking platform** – a front-end web application built with semantic HTML, CSS and vanilla JavaScript, deployed on GitHub Pages.

> Individual project · B.Tech CSE · Lovely Professional University · Windyam Natacha ZOUNGRANA

**Live demo:** `https://nata11w.github.io/CSE326-Projet/` (after GitHub Pages is enabled, see below)

---

## The problem

Booking a doctor still mostly means phoning the clinic during office hours, waiting on hold, and hoping a slot is free. Clinic staff spend hours managing calendars by hand, and patients often forget appointments.

## The solution

WebCareBooking is a two-sided platform:

| Role | What they can do |
|---|---|
| **Patient** | Create an account, search doctors by name or specialty, see real free time slots, pay the ₹20 booking fee (UPI, card or at the clinic – demo), get a printable token slip, cancel, view booking history, get browser reminders |
| **Clinic admin** | Log in to a dashboard, see the ₹999/month subscription and booking-fee earnings, set each doctor's weekly working hours, slot length and break, see statistics, filter appointments, mark them done or cancelled, add doctors, export to CSV |

## Features → course topics

| # | Course topic | Where it is used |
|---|---|---|
| 1 | Semantic HTML | `header`, `nav`, `main`, `section`, `article`, `footer`, `fieldset/legend`, table with `caption`/`scope`, skip link, ARIA |
| 2 | Forms & validation | Register, login, booking (with payment choice), working-hours and add-doctor forms; HTML5 attributes + custom JS rules in `js/validate.js`; live error messages |
| 3 | CSS | Custom properties (light/dark theme), Flexbox, Grid, `:has()`, `backdrop-filter`, gradients, inline SVG icons, transitions, animations |
| 4 | JavaScript fundamentals | Modules via IIFE, arrays (`map`/`filter`/`sort`), objects, template literals, `async/await`, `try/catch` |
| 5 | DOM & events | Dynamic rendering, event delegation, `input`/`change`/`submit`/`focusout`/`storage` events |
| 6 | Browser APIs | `localStorage`, `sessionStorage`, Notification API, Web Crypto (`crypto.subtle`), Blob + `URL.createObjectURL`, `Intl.DateTimeFormat` / `Intl.NumberFormat` (₹), `<dialog>` + `showModal()`, `window.print()` with print CSS, `matchMedia` |
| 7 | Responsive design | Mobile-first CSS, breakpoints at 640px and 960px, collapsible menu, table → cards on phones |
| 8 | Debugging & testing | 42 unit tests (`tests/tests.html`), `console.error` logging, error toasts, DevTools |
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
│   ├── slots.js      Time-slot and token-number logic (pure functions)
│   ├── payments.js   Booking fee & subscription rules (pure functions, demo only)
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

## Payments (demo)

> **No real money is ever taken.** The payment screens exist to show the flow; there are no card-number, UPI ID or PIN fields.

### Patient: booking fee (₹20)

```
Choose doctor → date & time → reason → payment method
                                          │
              ┌───────────────────────────┼──────────────────────────┐
             UPI                        Card                 Pay at the clinic
              └──────────┬────────────────┘                          │
      "Demo payment – no money is taken" screen                      │
         (summary + Pay ₹20 button, ~1 s "Processing…")              │
                         │                                           │
                 booking saved, payment = Paid          booking saved, payment = Pay at clinic
                         └──────────────────┬─────────────────────────┘
                                   Token slip (printable)
```

- Each booking gets a **token number**: the doctor's queue number for that day (`01`, `02`, …). Cancelled bookings keep their number, so a token is never reused.
- The **token slip** shows the token, patient, doctor, date, time, fee and payment status (Paid / Pay at clinic) plus a demo reference such as `DEMO-K3X9A2`. It can be printed (print CSS prints only the slip) and reopened from **My appointments**, which also shows the payment badge.

### Payment rules (`js/payments.js`)

| Event | Payment status becomes |
|---|---|
| Booked with UPI or Card | `paid` (with a demo reference) |
| Booked with "Pay at the clinic" | `pay-at-clinic` |
| Paid booking cancelled (by patient or clinic) | `refunded` |
| Pay-at-clinic booking cancelled | `no-charge` |
| Pay-at-clinic booking marked **Done** by the clinic | `paid` (fee collected at the reception) |

These rules are pure functions, so they are covered by unit tests without a browser.

### Clinic: subscription (₹999/month) and earnings

- The **Subscription & earnings** card shows the plan, its price, whether it is **Active** or **Expired**, the end date and the days left.
- **Renew (demo)** adds one month. An active plan is extended from its end date (no days are lost); an expired plan restarts from today.
- **Booking-fee earnings** = the sum of fees with status `paid` (refunds excluded). **To collect at the clinic** = upcoming bookings still marked `pay-at-clinic`.
- The appointments table has a **Payment** column, and the CSV export adds **Token**, **Payment**, **Fee (INR)** and **Payment ref** columns. Cells that start like a formula (`=`, `@`) are escaped so a spreadsheet cannot run them.

### Why a real version needs a server

In this prototype the "payment" is a flag written to `localStorage` by JavaScript running in the patient's own browser. That is fine for a demo, but it cannot be trusted with real money:

1. **The browser cannot be trusted.** Anyone can open DevTools and set `payment.status = 'paid'` in `localStorage`. A real system must decide whether a booking is paid on a **server**, never in the browser.
2. **Secret keys must stay secret.** Payment gateways (Razorpay, PayU, Paytm, Stripe…) give the merchant a secret API key. Anything sent to the browser is public, so the key can only live on a server.
3. **Payments are confirmed server-to-server.** The real flow is: the server creates an order → the patient pays on the gateway's own secure page or app (UPI intent / card form hosted by the gateway) → the gateway notifies the server through a signed **webhook** → the server **verifies the signature** and only then marks the booking as paid.
4. **Card data rules (PCI-DSS).** Handling card numbers yourself requires strict security certification. Using the gateway's hosted checkout keeps card numbers away from our code entirely – which is also why this demo has no card fields.
5. **One shared database.** Bookings, tokens and earnings must be the same for every patient and the clinic, and two patients must not grab the same slot at the same moment. That needs a central database with transactions, not one `localStorage` per browser.
6. **Refunds, renewals and invoices.** Refunds go through the gateway's refund API; the monthly subscription needs recurring payments (e.g. UPI AutoPay / e-mandate) and GST invoices; all of these need records kept on a server.

A production version would therefore add a back-end (for example Node.js + Express + a database such as PostgreSQL) with endpoints like `POST /api/orders`, `POST /api/payments/webhook` and `POST /api/subscription/renew`, and the front end would only display what the server confirms.

### Tests for payments

`tests/test-cases.js` adds 20 tests: token numbers, the ₹20 fee, each payment method, refunds, pay-at-clinic collection, labels, the earnings totals, and the subscription's active/expired/renew rules. Run them with `node tests/run-node.js` or by opening `tests/tests.html` (42 tests in total).

## Limitations

This is a front-end prototype: data is stored only in the user's own browser, so patients and the clinic must use the same browser for the demo to show shared bookings. Passwords are hashed in the browser but this is **not** real security. Payments and the subscription are simulated (see **Payments (demo)** above). A production version would add a back-end (e.g. Node.js + a database), real authentication, a real payment gateway, and e-mail/SMS reminders.

## License

Educational project – Lovely Professional University, 2026.
