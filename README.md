# PARTY WITH DJ — Realtime

A single-round "BUZZER ROUND" event app.

## Stack
- React + Vite
- Express backend
- Supabase PostgreSQL + Realtime
- Atomic server-side buzzer ordering

## Setup

### 1. Supabase
Create a Supabase project, open SQL Editor, and run:

`supabase/schema.sql`

Then copy your project URL, anon key, and service-role key.

### 2. Backend
```bash
cd server
npm install
copy .env.example .env
```

Edit `.env`:
```env
PORT=5000
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
COORDINATOR_PASSWORD=dj2026
```

Start:
```bash
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
copy .env.example .env
```

Edit `.env`:
```env
VITE_API_URL=http://localhost:5000
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY
```

Start:
```bash
npm run dev
```

Open the URL Vite prints.

## Default coordinator password

`dj2026`

Change it in the backend `.env` before a real event.

## Event flow

Participant:
JOIN → WAITING → BUZZER ACTIVE → BUZZ → leaderboard

Coordinator:
LOGIN → START EVENT → START BUZZER → first buzz automatically closes buzzer → inspect leaderboard → RESET/REOPEN for the next song.

There are no "Round 1", "Round 2", or "Next Round" concepts.

## Important

The website does not play the song. The DJ/coordinator plays music through the event sound system.

For a public deployment, put the Express backend behind HTTPS and use a stronger coordinator authentication mechanism.
