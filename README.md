# Nyochavar

A luxury gifting marketplace built as a multi-vendor platform with four portals: a buyer storefront, a seller hub, a rider portal and a super admin console. Full stack, built solo.

> **Portfolio copy.** This is a cleaned version of a private project. Real business details, keys and customer data are removed. A few parts are left out on purpose: the WhatsApp (Baileys) bot engine and the seller payout ledger are stubbed (see [Known limitations](#known-limitations-and-roadmap)).

**Live demo:** _add link here_ &nbsp;|&nbsp; **License:** view only, all rights reserved (see [LICENSE](LICENSE))

## Screenshots

Images go in [Docs/screenshots](Docs/screenshots). See the capture list in [Docs/screenshots/README.md](Docs/screenshots/README.md).

| Storefront home | Hamper builder | Checkout |
| :---: | :---: | :---: |
| _add `01-storefront-home.png`_ | _add `02-hamper-builder.png`_ | _add `03-checkout.png`_ |

| Seller dashboard | Rider OTP screen | Admin dashboard |
| :---: | :---: | :---: |
| _add `04-seller-dashboard.png`_ | _add `05-rider-otp.png`_ | _add `06-admin-dashboard.png`_ |

## The four portals

| Portal | Path | What it does |
| :--- | :--- | :--- |
| **Buyer storefront** | `/` | Browse a catalog, build a custom hamper, check out with Razorpay or COD, track orders, see the delivery OTP in the profile. Sign in with email OTP, phone OTP or Google. |
| **Seller hub** | `/seller` | Landing page, 4-step seller registration, login, dashboard, orders, a product-listing wizard, store settings. Each seller sees only their own data. |
| **Rider portal** | `/rider` | Delivery partners log in with phone and PIN, see assigned orders, and mark an order delivered by entering the customer's doorstep OTP. |
| **Super admin** | `/admin` | Banners, categories, products, coupons, orders, rider fleet and dispatch, notification templates, audit logs. |

## Architecture

```
  React 19 + Vite (SPA)  ──REST──▶  Express 5 API  ──▶  Supabase PostgreSQL
          │                              │
          └──── Socket.io ◀──────────────┤
                                         ├──▶ Razorpay (orders, verify, webhook)
                                         ├──▶ Cloudinary (images)
                                         └──▶ SMTP / Resend (email OTP)
```

The API and Socket.io share one HTTP server. The frontend picks the API address from `VITE_API_URL`.

## Tech stack

| Layer | Technology |
| :--- | :--- |
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4, React Router 7, Motion, Lucide |
| Backend | Node.js 20+, Express 5 (ES modules, a mix of JavaScript and TypeScript) |
| Database | Supabase (PostgreSQL), SQL migrations, PL/pgSQL functions |
| Real time | Socket.io |
| Payments | Razorpay |
| Auth | JWT, bcryptjs, Google sign-in, Firebase phone auth (optional) |
| Media | Cloudinary, Multer |
| Security middleware | Helmet, CORS allow-list, rate limiting, request validation |

## Security design highlights

- **Role-separated JWT secrets.** Buyer, admin and rider tokens each use their own secret (32+ characters, all three must differ or the server refuses to start). A token from one role is not valid for another. Seller tokens use their own key too (a dedicated secret, or one derived from the admin secret).
- **httpOnly refresh tokens.** The short-lived access token (15 minutes by default) is sent in a header. The refresh token is in an `httpOnly` cookie, rotated on use and revocable, with the session tracked on the server.
- **Multi-tenant seller isolation.** Seller endpoints take the seller from the verified token and scope database queries with `seller_id`, so a seller cannot read another seller's products or orders.
- **Razorpay verification.** The payment signature is checked with HMAC SHA-256 and a constant-time compare. The webhook route is mounted with `express.raw` before the JSON parser, so the signature is computed over the exact raw body.
- **Atomic coupon claim.** Coupon usage limits are enforced inside a PostgreSQL function that locks the coupon row (`claim_coupon_atomic`, migration `026`), which prevents two simultaneous requests from overspending a limit.
- **Login hardening.** Login code runs a bcrypt comparison against a dummy hash when the account does not exist, to reduce user enumeration by timing.
- **Server-side pricing.** The Razorpay order amount is calculated on the server, never taken from the client.

## Database overview

Schema lives in [Backend/migrations](Backend/migrations) as numbered SQL files (`001` to `030`). Main tables: `users`, `sellers`, `products`, `orders`, `order_items`, `delivery_partners`, `coupons`, `banners`, `categories`, `reviews`, `notifications`, `audit_logs`, `refresh_tokens`, `user_events`, plus WhatsApp template and OTP tables. Seed data in `002_seed_data.sql` is demo product data.

## Local setup

**Requirements:** Node.js 20+, npm, a free Supabase project.

1. **Database.** In the Supabase SQL editor, run the files in `Backend/migrations/` in numeric order.
2. **Backend.**
   ```bash
   cd Backend
   npm install
   cp .env.example .env      # fill in the values
   npm run dev               # http://localhost:5000
   ```
3. **Frontend.**
   ```bash
   cd Frontend
   npm install
   cp .env.example .env
   npm run dev               # http://localhost:9000
   ```

Production builds: `npm run build` in each folder, then `npm start` in `Backend`.

### Environment variables

Every variable has a comment and a fake placeholder:

- [Backend/.env.example](Backend/.env.example)
- [Frontend/.env.example](Frontend/.env.example)

The backend will not start without Supabase credentials and the three JWT secrets. Razorpay, Cloudinary, Google and Firebase are only needed for the features that use them. With no email provider set, email OTPs are printed to the server console (non-production only), so you can try the app without SMTP.

## What I built and learned

- I built the full stack myself: the React app with four role-based areas, the Express API, and the PostgreSQL schema with migrations.
- I learned to treat payments carefully: calculating totals on the server, verifying signatures, and handling the webhook with the raw body.
- I learned how a multi-seller setup needs every query tied to the logged-in seller, and I used one table set with a `seller_id` column.
- I worked on session security: separate secrets per role, refresh-token rotation and revocation, and rate limits on login and OTP routes.
- I used a database function to fix a real race condition in coupon usage.
- I added live order updates with Socket.io and a delivery flow where the rider must enter the customer's OTP.
- I am still learning: the project has few automated tests and some files are large (see below).

## Known limitations and roadmap

**Limitations**
- Automated tests are minimal. There is one script (`Backend/scripts/testCouponAtomic.js`) and no test runner is set up.
- The backend mixes JavaScript and TypeScript. Newer parts (`Backend/src`) are TypeScript, older controllers are JavaScript.
- Some page components, such as the rider portal and checkout, are very large and should be split.
- The WhatsApp bot engine is not in this copy. WhatsApp-based messaging falls back to email OTP and click-to-send `wa.me` links.
- The seller payout ledger is not in this copy. Payouts were display-only in the full project (money was settled outside the app).
- A notification template's `send_email` option is not wired yet; only in-app and WhatsApp notifications are sent.
- Delivery is limited to a fixed list of areas in one city.
- No invoices, no refund automation beyond the manual flow.

**Roadmap**
- Add a test runner with tests for pricing, payment verification and coupon claims.
- Move the remaining JavaScript to TypeScript and split the largest components.
- Add GST invoice PDFs and wire up the email notification option.
- Add a CI workflow that runs the type check and build.

## Project structure

```
Backend/    Express API: controllers, routes, models, services, sockets, src (TypeScript core), migrations
Frontend/   React app: pages (buyer), seller, superadmin, rider, components, services
DB/         Sample product data
Docs/       Notes and the screenshots folder
```

## License

View only, all rights reserved. See [LICENSE](LICENSE).
#   N y o c h a v a r - P u b l i c  
 