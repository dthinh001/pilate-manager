# Pilates Booking MVP

A small Next.js + Supabase MVP for a Pilates studio.

## Features included

- Public landing page with studio images and a trial-class Zalo CTA.
- Email/password login.
- Three roles: admin, teacher, student.
- Admin invites users and assigns roles.
- Admin manages student session balance manually.
- Teachers create flexible class slots with custom start/end time and capacity.
- Students book, cancel, and reschedule classes.
- Teachers mark attendance: completed or absent.
- Admin sees users, schedules, and booking history.
- Supabase RLS policies and RPC functions for safe booking rules.

## What is intentionally not included in v1

- Online payments.
- SMS or Zalo automated reminders.
- Mobile app.
- Complex membership packages.

## Setup

### 1. Create a Supabase project

Create a project at Supabase, then open SQL Editor and run:

```sql
-- paste db/schema.sql here
```

### 2. Configure Auth redirects

In Supabase Dashboard > Authentication > URL Configuration:

- Site URL: `http://localhost:3000` for local dev.
- Redirect URL: `http://localhost:3000/auth/callback`.
- Add your deployed domain callback later, for example: `https://your-domain.com/auth/callback`.

### 3. Create `.env.local`

Copy `.env.example` to `.env.local` and fill the values.

Important: `SUPABASE_SERVICE_ROLE_KEY` is server-only. Never expose it to browser code.

### 4. Bootstrap the first admin

Because public sign-up is disabled in this app, create the first admin from Supabase Dashboard:

1. Go to Authentication > Users.
2. Add a user with your admin email.
3. Run this SQL:

```sql
update public.profiles
set role = 'admin', full_name = 'Studio Admin'
where email = 'your-admin-email@example.com';
```

Then login at `/login`.

### 5. Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## User flow

### Admin

- Invite teacher/student by email.
- Set role: admin/teacher/student.
- Update student total and remaining sessions.
- View all classes and booking history.

### Teacher

- Create a class slot using any start/end time.
- Set capacity per class.
- See enrolled students.
- Cancel class.
- Mark students completed or absent.

### Student

- See available class slots.
- Book a class if remaining sessions > 0.
- Cancel a booking.
- Reschedule by choosing another available slot.
- See weekly schedule/history.

## Booking rules

- Booking consumes 1 remaining session immediately.
- Cancel before the studio cancellation window refunds 1 session.
- Late cancel does not refund the session.
- Reschedule is allowed only before the cancellation window and does not consume an extra session.
- Teacher/admin class cancellation refunds all booked students.
- A student cannot book two overlapping classes.
- A class cannot exceed its capacity.

Default cancellation window is 6 hours. You can change it in `studio_settings`.
