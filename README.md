# CollabSpace

A private, trust-based prototype for sharing startup ideas and updates among a small group.

## Overview

CollabSpace is a minimal collaboration platform designed for 10-20 UC Berkeley students and recent alumni. The focus is on sharing early, unfinished ideas and getting thoughtful responses.

**Core principles:**
- Trust and simplicity over features
- No likes, followers, or vanity metrics
- Chronological feed only
- Private by default

## Tech Stack

- **Frontend:** Next.js 14 (App Router)
- **Backend:** Supabase (Postgres + Auth)
- **Hosting:** Vercel
- **Auth:** Email magic links

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon key from Settings > API

### 2. Configure Supabase Auth

In Supabase Dashboard > Authentication > Settings:

1. Enable email provider
2. Enable "Confirm email" for magic links
3. Set Site URL to `http://localhost:3000`
4. Add `http://localhost:3000/auth/callback` to Redirect URLs

**Optional:** To restrict to @berkeley.edu emails:
- Under "Restrict email domains", add `berkeley.edu`

### 3. Set Up Database

1. Go to SQL Editor in Supabase Dashboard
2. Copy contents of `supabase-schema.sql`
3. Run the SQL to create tables and policies

### 4. Configure Environment

1. Copy `.env.local.example` to `.env.local`
2. Fill in your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 5. Install and Run

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`

## Deployment to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Deploy on Vercel

1. Import project from GitHub at [vercel.com](https://vercel.com)
2. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy

### 3. Update Supabase Redirect URLs

Add your production URL to Supabase:
- Site URL: `https://your-app.vercel.app`
- Redirect URL: `https://your-app.vercel.app/auth/callback`

## Project Structure

```
src/
├── app/
│   ├── auth/callback/     # Magic link handler
│   ├── login/             # Login page
│   ├── onboarding/        # New user profile setup
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home/Feed
│   └── globals.css
├── components/            # Shared components
├── lib/
│   ├── supabase/         # Supabase clients
│   └── utils.ts          # Utility functions
└── middleware.ts         # Auth protection
```

## Features (v0)

- [x] Magic link authentication
- [x] @berkeley.edu domain restriction (optional)
- [x] User profiles with name and bio
- [ ] Feed showing all posts
- [ ] Create posts (Ideas and Updates)
- [ ] Comments on posts
- [ ] Member directory
- [ ] Profile pages
- [ ] Settings page

## Not Included (by design)

- Likes, reactions, or upvotes
- Followers or following
- DMs or private messages
- Search or discovery
- Notifications
- Public pages
- Analytics
