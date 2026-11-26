# AGENTS.md — MentorLagbe SERVER (Express + MongoDB)

> You are the coding agent for the **server** repo of MentorLagbe.
> This file is the single source of truth. Read it fully before every task.
> The client repo has its own `AGENTS.md`. The API contract (section 8) must match it exactly.

---

## 0. Agent Operating Rules (MOST IMPORTANT)

1. **Read this file first, every session.** Then read the "Progress Log" (section 16).
2. **After finishing any task, update section 16**: tick the checkbox, add a dated line under "Change Log", record decisions under "Decisions". Never skip this.
3. **A working production server beats extra features.** Any CORS / 404 / 504 error on production = score 0.
4. **Never commit secrets.** `.env` is git-ignored; never commit local environment files.
5. **Minimum 12 meaningful commits.** Conventional Commits: `feat: add verifyToken middleware`, `fix: cors credentials`, `chore: add vercel.json`. Suggest a commit message after each completed unit. No giant commits.
6. **Never trust the client.** Validate all input, check roles and ownership on the server, enforce business rules here (plan limits, duplicates, role restrictions).
7. **Do not change the API contract** without updating section 8 and logging it in the Change Log (the client agent depends on it).
8. **Do not add collections.** Business data lives in exactly 4 collections (section 4).
9. If a requirement is ambiguous, pick the simplest option, log it under "Decisions", continue.
10. Keep code simple: routes → controllers → db. No over-engineering.

---

## 1. Project Summary

**MentorLagbe** — tuition & mentorship marketplace. Roles: `student`, `tutor`, `admin`.
This server provides: BetterAuth (MongoDB adapter), JWT issuing and verification, role middlewares, tuition CRUD with moderation, applications, Stripe Checkout and verification, admin stats, seed script.
Deployed on Vercel (serverless). Client is a separate Next.js repo.

---

## 2. Tech Stack and Packages

Language: **JavaScript, ES Modules** (`"type": "module"` in package.json). Reason: `better-auth` is ESM-first.
`express`, `cors`, `dotenv`, `mongodb`, `better-auth`, `jsonwebtoken`, `stripe`, `cookie-parser`, `nodemon` (dev).
Optional: `zod` for request validation.
All packages must be listed in README.md.

---

## 3. Environment Variables (`.env`)

```
PORT=8000
NODE_ENV=development
MONGODB_URI=
DB_NAME=mentorlagb
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:8000
JWT_SECRET=
CLIENT_URL=http://localhost:3000
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PRO_TUTOR_PRICE_USD=15
PRO_STUDENT_PRICE_USD=10
```

- Production: `BETTER_AUTH_URL` = deployed server URL, `CLIENT_URL` = deployed client URL (no trailing slash).
- Production client URL: `https://mentorelagbe-client.vercel.app` (set as `CLIENT_URL` in the server's Vercel Production environment).
- ImgBB upload happens on the client (key in client `.env.local`), so the server needs no ImgBB key.

---

## 4. Database (exactly 4 business collections)

Database: MongoDB Atlas. Allow `0.0.0.0/0` in Network Access (required for Vercel).

**1. `users`** (BetterAuth user model renamed to `users`)
`_id, name, email, image, role ('student'|'tutor'|'admin'), phone, bio, plan ('free'|'pro'), createdAt`
Optional features store inside this doc: `savedTuitions: ObjectId[]` (bookmarks).

**2. `tuitions`**
`_id, title, subject, classLevel, mode ('Online'|'Offline'), location, monthlyFee, daysPerWeek, bannerImage, description, tutorName, tutorEmail, approvalStatus ('pending'|'approved'|'rejected'), isActive, createdAt`
Optional: `reviews: [{ studentEmail, studentName, rating, feedback, createdAt }]` embedded (no new collection).

**3. `applications`**
`_id, tuitionId, tuitionTitle, subject, monthlyFee, tutorEmail, studentName, studentEmail, studentPhone, preferredSchedule, studentNote, status ('pending'|'accepted'|'rejected'), appliedAt`

**4. `payments`**
`_id, userEmail, userName, userRole, planName, amount, currency, transactionId, stripeSessionId, paymentStatus ('paid'), paidAt`

**Indexes (create at startup or in seed):**
- `users.email` unique
- `applications` unique compound `{ tuitionId: 1, studentEmail: 1 }` (blocks duplicates)
- `payments.stripeSessionId` unique (blocks duplicate payment records)
- `tuitions` index on `{ approvalStatus: 1, isActive: 1, createdAt: -1 }`
- `tuitions` text or regex-friendly fields: `title`, `subject`

**Note:** BetterAuth also creates its own internal collections (`session`, `account`, `verification`). These are allowed. "4 collections" refers to business data.

---

## 5. Folder Structure

```
mentorlagbe-server/
├── .env  (git-ignored)
├── .gitignore
├── AGENTS.md
├── README.md
├── vercel.json
├── package.json
├── index.js                 # exports app for Vercel; listens only when run locally
└── src/
    ├── app.js               # express app: cors, parsers, routes, error handlers
    ├── config/
    │   ├── db.js            # cached MongoClient (serverless safe), getCollections()
    │   └── auth.js          # BetterAuth config
    ├── middlewares/
    │   ├── verifyToken.js
    │   ├── verifyStudent.js
    │   ├── verifyTutor.js
    │   ├── verifyAdmin.js
    │   └── errorHandler.js  # notFound + central error handler (JSON)
    ├── routes/
    │   ├── token.routes.js
    │   ├── user.routes.js
    │   ├── tuition.routes.js
    │   ├── application.routes.js
    │   ├── payment.routes.js
    │   ├── tutor.routes.js
    │   ├── student.routes.js
    │   └── admin.routes.js
    ├── controllers/         # one file per route group
    ├── utils/
    │   └── jwt.js           # signToken / verify helpers
    └── seed/
        └── seed.js          # 10–12+ approved tuitions, tutors, sample applications
```

---

## 6. Core Setup Rules

### Vercel / serverless (CRITICAL)
- `index.js` must `export default app` (and call `app.listen` only if not on Vercel).
- `vercel.json` routes all paths to `index.js`:
```json
{ "version": 2, "builds": [{ "src": "index.js", "use": "@vercel/node" }], "routes": [{ "src": "/(.*)", "dest": "index.js" }] }
```
- **Cache the Mongo connection** on a module-level variable. Never reconnect per request. Await the connection before handling requests (middleware that ensures DB is ready).
- Root `GET /` returns `{ status: "ok", name: "MentorLagbe API" }` for quick health checking.
- Never let the server crash or hang: wrap async handlers (use an `asyncHandler` helper) and send JSON errors. A hung request = 504.

### CORS (CRITICAL)
```js
app.use(cors({
  origin: [process.env.CLIENT_URL, "http://localhost:3000"],
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
}));
```
- Handle preflight (`OPTIONS`) for all routes.
- Mount CORS **before** the BetterAuth handler and all routes.

### Body parsing order
1. `POST /api/payments/webhook` uses `express.raw({ type: "application/json" })` (mounted **before** `express.json()`), only if the webhook is implemented.
2. BetterAuth handler is mounted **before** `express.json()` (`app.all("/api/auth/*splat", toNodeHandler(auth))`; if the installed Express version uses a different wildcard syntax, adapt and log it).
3. Then `express.json()`.

### BetterAuth (`config/auth.js`)
- `betterAuth({ database: mongodbAdapter(db), secret, baseURL, trustedOrigins: [CLIENT_URL, localhost], emailAndPassword: { enabled: true }, ... })`
- `user: { modelName: "users", additionalFields: { role: { type: "string", defaultValue: "student", input: true }, plan: { type: "string", defaultValue: "free", input: false }, phone: { type: "string", required: false }, bio: { type: "string", required: false } } }`
- **Security:** in `databaseHooks.user.create.before`, force `role` to `"student"` unless the value is exactly `"tutor"`. **Never allow `admin` from sign-up.** Force `plan = "free"`.
- Cross-domain cookies (client and server on different Vercel domains): `advanced: { defaultCookieAttributes: { sameSite: "none", secure: true } }` in production. Required for login to work on production.
- Optional: Google social login (`socialProviders.google`).
- The admin account is created by signing up normally, then setting `role: "admin"` directly in MongoDB (or via the seed script). Document the credentials in README.

---

## 7. Authentication, JWT, and Middlewares (Challenge 2)

### Token endpoint
`GET /api/token`: reads the BetterAuth session from the request cookies (`auth.api.getSession({ headers: fromNodeHeaders(req.headers) })`). If no session → 401. Otherwise sign a JWT `{ id, email, role }` with `JWT_SECRET`, expiry `1h`, and return `{ token }`.

### Middlewares (`src/middlewares/`)
- **`verifyToken`**: read `Authorization: Bearer <token>`; verify; 401 on missing/invalid/expired. Then **load the user from the `users` collection by email** and attach to `req.user` (so role/plan are always fresh, not stale from the token). 401 if user not found.
- **`verifyStudent`**: after verifyToken; `req.user.role === "student"` else 403.
- **`verifyTutor`**: role `tutor` else 403.
- **`verifyAdmin`**: role `admin` else 403.
- Use as `router.get("/x", verifyToken, verifyTutor, handler)`.
- Ownership checks (tutor owns tuition, student owns application) happen in the controller; 403 if not owner.

### Standard responses
Success: JSON data. Error: `{ message: "..." }` with the correct status: 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 500 server.

---

## 8. API Contract (must match client AGENTS.md)

| Method | Path | Auth | Behavior |
|---|---|---|---|
| ALL | `/api/auth/*` | – | BetterAuth |
| GET | `/api/token` | session cookie | `{ token }` |
| GET | `/api/users/me` | verifyToken | current user |
| PATCH | `/api/users/me` | verifyToken | update `name, phone, bio, image` only. Never role/plan/email |
| GET | `/api/tuitions` | public | **server-side** search/filter/pagination (below) |
| GET | `/api/tuitions/featured` | public | 6 latest approved+active |
| GET | `/api/tuitions/filters` | public | distinct `subject` and `classLevel` of approved+active |
| GET | `/api/tuitions/:id` | public | approved+active only, else 404. Validate ObjectId (400/404, never 500) |
| POST | `/api/tuitions` | verifyToken, verifyTutor | create; **free plan max 2 tuitions** (count all tutor's tuitions; 403 with clear message); set `approvalStatus:"pending"`, `isActive:true`, tutorName/Email from `req.user`, `createdAt` |
| GET | `/api/tutor/tuitions` | tutor | my tuitions (all statuses) |
| PATCH | `/api/tuitions/:id` | tutor (owner) | edit allowed fields only; if edited after approval, reset to `pending` (log decision) |
| PATCH | `/api/tuitions/:id/toggle-active` | tutor (owner) | flip `isActive` |
| DELETE | `/api/tuitions/:id` | tutor (owner) | delete; also delete its pending applications |
| GET | `/api/tutor/applicants` | tutor | applications where `tutorEmail` = me |
| PATCH | `/api/applications/:id/status` | tutor (owner of tuition) | `accepted` or `rejected` only |
| GET | `/api/tutor/stats` | tutor | `{ totalTuitions, activeApproved, totalApplicants, plan }` |
| POST | `/api/applications` | verifyToken, verifyStudent | body: `tuitionId, studentPhone, preferredSchedule, studentNote`. Tuition must be approved+active. Copy `tuitionTitle, subject, monthlyFee, tutorEmail` from the tuition; student name/email from `req.user`. **Duplicate → 409** |
| GET | `/api/applications/my` | student | my applications |
| GET | `/api/applications/check/:tuitionId` | student | `{ applied }` |
| DELETE | `/api/applications/:id` | student (owner) | only if `pending`, else 400 |
| GET | `/api/student/stats` | student | `{ total, accepted, pending, plan }` |
| POST | `/api/bookmarks/:tuitionId` | student | toggle in `users.savedTuitions` (optional) |
| GET | `/api/bookmarks` | student | saved tuitions (optional) |
| POST | `/api/reviews/:tuitionId` | student | only if an `accepted` application exists; one review per student; rating 1–5 (optional) |
| POST | `/api/payments/create-checkout-session` | verifyToken (student/tutor) | Stripe Checkout `mode: "payment"`; price by role (tutor 15, student 10 USD); metadata `{ email, role, plan }`; `success_url = CLIENT_URL/payment/success?session_id={CHECKOUT_SESSION_ID}`, `cancel_url = CLIENT_URL/payment/cancel`; reject if already `pro`; returns `{ url }` |
| GET | `/api/payments/verify` | verifyToken | query `session_id`. Retrieve session from Stripe; ensure `payment_status === "paid"` and session email matches `req.user.email`; **idempotent**: upsert on `stripeSessionId`; insert payment record; set `users.plan = "pro"`; return `{ success, plan }` |
| POST | `/api/payments/webhook` | Stripe signature | optional; same logic as verify, `checkout.session.completed` |
| GET | `/api/admin/stats` | admin | `{ totalUsers, totalTutors, totalStudents, pendingTuitions, approvedTuitions, totalRevenue }` |
| GET | `/api/admin/users` | admin | all users |
| PATCH | `/api/admin/users/:id/role` | admin | role in student/tutor/admin; admin cannot change own role |
| GET | `/api/admin/tuitions` | admin | all tuitions; optional `?approvalStatus=` |
| PATCH | `/api/admin/tuitions/:id/approval` | admin | `approved` or `rejected` |
| GET | `/api/admin/transactions` | admin | all payments, newest first |

### `GET /api/tuitions` (Challenge 1 + pagination)
Query: `q` (search title OR subject, case-insensitive, **escape regex special characters**), `subject`, `classLevel`, `mode`, `page` (default 1), `limit` (default 9, max 24).
Base filter ALWAYS: `{ approvalStatus: "approved", isActive: true }`.
Use `.sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit)` plus `countDocuments` for `total`.
Response: `{ data, total, page, limit, totalPages }`.

---

## 9. Business Rules Checklist

- Sign-up role: only `student` or `tutor`. Plan always `free` at creation.
- Only approved + active tuitions are publicly visible.
- Free tutor: max 2 tuitions. Pro: unlimited. Enforced in POST `/api/tuitions`.
- Only students apply. One application per student per tuition (unique index + 409).
- Student can cancel only while `pending`.
- Only the tuition's tutor can accept/reject its applications.
- Admin approves/rejects tuitions and manages roles. Admin cannot demote self.
- Pro purchase: record in `payments` and set `users.plan = "pro"`. Never create duplicate payment records. Never downgrade or charge a user who is already pro.
- Pro price: Tutor $15, Student $10. Admin cannot purchase.
- Convert `ObjectId` carefully; invalid ids return 400/404, never a crash.
- Never return sensitive fields (no password hashes, tokens, secrets).

---

## 10. Stripe Notes

- Use `new Stripe(process.env.STRIPE_SECRET_KEY)`. Test mode only.
- Create the session with `line_items[].price_data` (currency `usd`, `unit_amount` in cents, product name "MentorLagbe Pro Tutor/Student Plan").
- **Primary flow = verification endpoint** (reliable on Vercel). Webhook is optional hardening; if implemented, use the raw body and `stripe.webhooks.constructEvent`.
- `payments` doc: `transactionId` = `payment_intent` id, `amount` in dollars, `currency`, `paymentStatus: "paid"`, `paidAt: new Date()`.

---

## 11. Seed Script (`src/seed/seed.js`)

Run with `node src/seed/seed.js` (add npm script `seed`). Must be safe to re-run (upsert by email/title, do not duplicate).
Create:
- **1 admin**, **2–3 tutors**, **2–3 students** (known passwords, documented in README). Create credentials users through BetterAuth's API (`auth.api.signUpEmail`) so passwords are hashed correctly, then set `role` in the DB.
- **10–12+ approved, active tuitions** across Math, Physics, Chemistry, Biology, English, IELTS, Programming, ICT, Bangla, Accounting, etc. Realistic titles, class levels (Class 6–10, SSC, HSC, University, Professional), mode mix of Online/Offline, locations in Bangladesh (Dhaka, Chattogram, Sylhet...), fees in a believable BDT range, banner images from Unsplash URLs, proper `tutorName/tutorEmail` matching seeded tutors.
- A few `pending` and `rejected` tuitions (so admin dashboard looks alive).
- A handful of sample applications in mixed statuses, and 2–3 sample payments.

---

## 12. Deployment (Vercel) — Score 0 if broken

- Set all env vars in Vercel. Atlas Network Access `0.0.0.0/0`.
- Set the server project's Production `CLIENT_URL` to `https://mentorelagbe-client.vercel.app` (without a trailing slash); keep the local `.env` URL at `http://localhost:3000` for development.
- After deploy, test with the **production client**: sign up, sign in, load tuitions, protected calls. Check the browser console for CORS errors.
- Verify `GET /` health route returns JSON, and an unknown route returns a JSON 404 (not an HTML crash page).
- Test cross-domain login on production (cookies `sameSite: none; secure`).
- Add the production client URL to `CLIENT_URL` and `trustedOrigins`.
- **Deploy a minimal server on day 1** and redeploy often.

---

## 13. Known Pitfalls (do not repeat)

1. Reconnecting to MongoDB on every request → timeouts (504) on Vercel.
2. CORS without `credentials: true` or with wildcard origin → login breaks.
3. Cookies without `sameSite: none; secure` across domains → session lost in production.
4. Mounting `express.json()` before the BetterAuth handler → auth breaks.
5. Trusting the role inside the JWT only → stale roles. Always reload the user from DB.
6. Not escaping user input in `$regex` → crashes or injection.
7. Invalid ObjectId → 500 crash.
8. Allowing `role: "admin"` on sign-up → security hole.
9. No unique index on applications / payments → duplicates.
10. Marking plan pro from the client's success page without server-side Stripe verification → fraud risk.
11. Committing `.env` → critical.

---

## 14. Optional Features (server side)

1. Pagination (included in `/api/tuitions`, required in plan).
2. Seed script (required anyway for 10–12 tuitions).
3. Bookmarks (`users.savedTuitions`).
4. Reviews (embedded in `tuitions.reviews`).
(Dark mode is client only.)

---

## 15. README.md Requirements (server)

Project name, purpose, **live server URL**, **Admin credentials**, tutor and student test credentials, key features, **all npm packages used**, env var names (no values), setup and seed instructions, link to client repo.

---

## 16. Progress Log (AGENT MUST KEEP THIS UPDATED)

### Build Order
1. Init repo, `.gitignore`, Express, `/` health route, CORS. **Deploy to Vercel immediately.**
2. Mongo cached connection + indexes.
3. BetterAuth (users model, role hook, cookies) + `/api/token`.
4. Middlewares: verifyToken, verifyStudent, verifyTutor, verifyAdmin.
5. Users routes. Tuition routes (public query with search/filter/pagination, then tutor CRUD).
6. Admin tuition approval, admin users/stats/transactions.
7. Applications (student and tutor sides).
8. Stripe checkout + verify (+ optional webhook).
9. Seed script. 10. Optional features. 11. README, production testing.

### Checklist
- [x] Repo, `.gitignore`, health route, CORS, first deploy live
- [x] Mongo cached connection + indexes
- [x] BetterAuth + MongoDB adapter (users model)
- [x] Role hook (no admin via sign-up) + plan default
- [x] `/api/token` JWT
- [x] verifyToken / verifyStudent / verifyTutor / verifyAdmin
- [x] Users: me
- [x] Users: update
- [x] Tuitions public: list (server-side search/filter/pagination), filters, details
- [x] Tuitions featured (latest six approved + active)
- [x] Tuitions tutor: create (free limit 2), my list, edit, toggle, delete
- [x] Applications: apply (409 duplicate), my, check, cancel
- [x] Tutor: applicants, status update, stats
- [x] Student stats
- [x] Admin: stats, users, role change, tuitions approval, transactions
- [x] Stripe: create session, verify (idempotent), webhook (optional)
- [x] Seed script (10–12+ approved tuitions, users, applications, payments)
- [x] Bookmarks (optional)
- [x] Reviews (optional)
- [x] JSON 404 + central error handler
- [ ] Production test with deployed client (no CORS/404/504)
- [x] README complete
- [ ] 12+ commits

### Decisions
- JavaScript with ES Modules (better-auth is ESM-first).
- JWT is issued by `/api/token` from a valid BetterAuth session; `verifyToken` reloads the user from DB each request.
- Stripe uses Checkout `mode: "payment"` (one-time Pro purchase) with a server-side verify endpoint as the primary sync; webhook optional.
- Bookmarks and reviews are embedded in existing collections to keep exactly 4 business collections.
- 2026-11-21 — Removed the unrelated one-file bookstore routes and kept the implementation aligned to the MentorLagbe API contract in this file.
- 2026-11-21 — Protected Tutor, Student, and Admin contract routes use database-reloaded JWT users and server-side role/ownership checks.
- 2026-11-21 — Lazily connect to MongoDB on Better Auth and featured-tuition requests so health checks remain available during startup; sign-up roles are restricted to student/tutor and plans start free.
- 2026-11-21 — Added `/api/token` to exchange a valid Better Auth session for the client API JWT.
- 2026-11-21 — API JWTs are verified with `JWT_SECRET`, and the user role is reloaded from MongoDB on protected requests instead of trusting the token role.
- 2026-11-21 — Local Better Auth and JWT secrets are configured in the ignored backend `.env`.
- 2026-11-21 — Browser sign-up created a student account and issued a valid Better Auth session and API JWT; `/api/student/stats` remains unimplemented.
- 2026-11-24 — Confirmed `seeded_session_student` is a hard-coded sample payment record from the seed script, not proof of a real Stripe payment; the script sets seeded users to `free`.
- 2026-11-26 — Merged environment template keys into the ignored local `.env`, preserving existing values, and removed `.env.example` as requested.
- 2026-11-26 — Production CORS and BetterAuth trusted origins use the configured client URL only; localhost origins and URL fallbacks are development-only.
- 2026-11-26 — Full-stack readiness check confirmed local client/server URLs align and builds pass, but tutor stats response fields differ between the server and client; live database and Vercel production settings remain unverified.
- 2026-11-26 — Recorded the deployed client URL for production `CLIENT_URL`; kept the ignored local `.env` pointed at localhost to preserve local auth/CORS and Stripe return behavior.
- 2026-11-26 — Set the client origin in both Vercel Production projects and removed server-only auth/database variables from the client project; server production secrets still need manual configuration.
- 2026-11-26 — Standardized the MongoDB database name to `mentorlagb` in local config, server fallback, and Vercel Production.
- 2026-11-26 — Aligned the server `.gitignore` with the ignore patterns provided for the client, including environment-file protection and the `.env.example` exception.
- 2026-11-26 — Set the local server `CLIENT_URL` to the client's localhost origin; kept `BETTER_AUTH_URL` and database credentials server-side rather than copying the client's server-only entries.
- 2026-11-26 — Added the supplied live client and server URLs to the README and documented their production environment-variable mapping.
- (Agent: add new decisions here with date.)

### Change Log
- 2026-11-26 — Documented the live client/server URLs and their production `CLIENT_URL`/`BETTER_AUTH_URL` settings — `README.md`, `AGENTS.md`.
- 2026-11-26 — Aligned local server CORS/return URLs with the client's localhost origin; kept production origin configuration for Vercel and did not copy server-only settings from the client `.env` — `.env`, `AGENTS.md`.
- 2026-11-26 — Matched the server `.gitignore` to the client-provided dependency, build, environment, Vercel, and tooling ignore patterns — `.gitignore`, `AGENTS.md`.
- 2026-11-26 — Verified the client `/dashboard/tutor` route after the Next.js instant-navigation fix: HTTP 200 and production build pass; no server API or contract changes were required.
- 2026-11-26 — Set `DB_NAME=mentorlagb` locally and in Vercel Production; aligned the MongoDB fallback and this configuration guide — `.env`, `src/config/db.js`, `AGENTS.md`.
- 2026-11-26 — Set server `CLIENT_URL` and client `NEXT_PUBLIC_SITE_URL` on their Vercel Production projects; removed `MONGODB_URI`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` from the client project. Vercel still lacks server runtime environment values — `AGENTS.md`, `README.md`, Vercel project environments.
- 2026-11-26 — Added the deployed client URL to server deployment guidance and README; retained localhost in the local `.env` and documented the required Vercel Production `CLIENT_URL` setting — `AGENTS.md`, `README.md`.
- 2026-11-26 — Cross-checked client/server wiring and build gates; recorded tutor stats contract mismatch and production configuration/live-connection verification still needed — `AGENTS.md`.
- 2026-11-26 — Audited Vercel serverless configuration and syntax; restricted localhost CORS/auth/payment URL fallbacks to development and require `CLIENT_URL` in production. JavaScript syntax and production-mode health/404/CORS smoke checks passed — `src/app.js`, `src/config/auth.js`, `src/routes/payment.routes.js`, `AGENTS.md`.
- 2026-11-26 — Merged missing configuration keys into local `.env`, removed `.env.example`, and updated setup guidance — `.env`, `README.md`, `AGENTS.md`.
- 2026-11-24 — Traced the seeded student payment record to the sample-data upsert in `src/seed/seed.js`; no live database was accessed or changed.
- 2026-11-21 — Implemented contract-aligned tuition CRUD/list/filter routes, application and tutor/student/admin route groups, Stripe checkout/verify, optional bookmarks/reviews, Mongo indexes, seed script, and README — `src/app.js`, `src/routes/`, `src/config/db.js`, `src/seed/seed.js`, `README.md`, `package.json`, `AGENTS.md`.
- 2026-11-21 — Removed `/add-books`, `/all-books`, `/borrow-book`, `/borrowed-books`, and `/return-book` compatibility routes; the server now follows only the MentorLagbe API contract — `src/app.js`, `AGENTS.md`.
- 2026-11-21 — Added one-file bookstore compatibility routes and connected protected mutations to the existing JWT middleware; reused `tuitions` for storage and hardened ObjectId/copy-count handling — `src/app.js`, `AGENTS.md`.
- 2026-11-20 — Added the first deployable API slice: health route, localhost/3000 CORS, JSON 404/error handling, Vercel export/config, environment example, start/dev scripts, and nodemon — `index.js`, `src/app.js`, `vercel.json`, `.env.example`, `package.json`, `package-lock.json`, `AGENTS.md`.
- 2026-11-21 — Registered Better Auth on the Express 5 auth wildcard before JSON parsing and added the Mongo-backed featured tuition endpoint — `src/app.js`, `src/config/auth.js`, `src/config/db.js`, `src/routes/tuition.routes.js`, `package.json`, `package-lock.json`, `AGENTS.md`.
- 2026-11-21 — Added the authenticated-session JWT exchange endpoint and aligned backend local defaults with port 8000 — `src/app.js`, `src/routes/token.routes.js`, `.env.example`, `AGENTS.md`.
- 2026-11-21 — Added JWT verification and fresh-user lookup middleware, role guards, and the protected current-user endpoint — `src/middlewares/verifyToken.js`, `src/middlewares/verifyStudent.js`, `src/middlewares/verifyTutor.js`, `src/middlewares/verifyAdmin.js`, `src/routes/user.routes.js`, `src/app.js`, `AGENTS.md`.
- 2026-11-21 — Verified local Better Auth session, JWT exchange unauthenticated response, featured endpoint, and localhost client CORS with configured ignored environment — `src/config/auth.js`, `src/routes/token.routes.js`, `src/routes/tuition.routes.js`, `.env`.
- 2026-11-21 — Verified real local student sign-up, cookie-backed session, and JWT exchange; found the dashboard stats route still returns 404 — `src/app.js`, `src/config/auth.js`, `src/routes/token.routes.js`, `src/routes/student.routes.js`.

### Open Questions / Blockers

- Tutor stats contract mismatch: server returns `totalTuitions` and `plan`; client expects `totalPosted` and `currentPlan`. Align client/server before release.
- Server Vercel Production is missing `MONGODB_URI`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `JWT_SECRET`, and `STRIPE_SECRET_KEY`; enter these manually in Vercel. `DB_NAME=mentorlagb` is configured. Rotate the database/auth credentials removed from the client project because removing Vercel variables does not revoke them.
- Verify client `NEXT_PUBLIC_API_URL` points to the deployed server, then redeploy both projects and test production auth/API flows.