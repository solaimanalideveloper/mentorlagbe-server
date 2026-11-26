# MentorLagbe Server

Express and MongoDB API for the MentorLagbe tuition and mentorship marketplace.

## Live server

Configure the deployed Vercel URL in `BETTER_AUTH_URL`.

## Client

Live client: https://mentorelagbe-client.vercel.app/

https://github.com/solaimanalideveloper/mentorlagbe-client

## Test credentials

Password for all seeded accounts: `MentorLagbe123!`

- Admin: `admin@mentorlagbe.test`
- Tutor: `rahim.tutor@mentorlagbe.test`
- Student: `arif.student@mentorlagbe.test`

## Features

- BetterAuth email/password authentication
- JWT API authentication with fresh database role lookup
- Tuition search, filtering, pagination, moderation, and tutor ownership
- Student applications and tutor applicant management
- Admin users, tuition approval, stats, and transactions
- Stripe Pro checkout and server-side verification
- Optional bookmarks and tuition reviews

## Packages

better-auth, cors, dotenv, express, jsonwebtoken, mongodb, stripe, nodemon

## Setup

1. Create or update the git-ignored `.env` with the environment variables listed below.
2. Install dependencies: `npm install`
3. Start locally: `npm run dev`
4. Seed the database: `npm run seed`

## Environment variables

PORT, NODE_ENV, MONGODB_URI, DB_NAME, BETTER_AUTH_SECRET, BETTER_AUTH_URL, JWT_SECRET, CLIENT_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PRO_TUTOR_PRICE_USD, PRO_STUDENT_PRICE_USD

For the server's Vercel Production environment, set `CLIENT_URL=https://mentorelagbe-client.vercel.app` (without a trailing slash). Keep `CLIENT_URL=http://localhost:3000` in the local `.env`.
