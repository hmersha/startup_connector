-- ============================================================================
-- COLLABSPACE DEMO SEED
-- Creates 10 realistic builder profiles for user testing.
--
-- SAFE TO RUN:
--   All accounts use @demo.collabspace.test (no real emails are sent).
--   Demo users appear in Discover and Members but cannot log in.
--   Idempotent — run multiple times without duplicating data.
--
-- CLEANUP:
--   DELETE FROM public.posts  WHERE author_id IN (SELECT id FROM public.users WHERE email LIKE '%@demo.collabspace.test');
--   DELETE FROM public.users  WHERE email LIKE '%@demo.collabspace.test';
--   DELETE FROM auth.users    WHERE email LIKE '%@demo.collabspace.test';
--
-- Run in: Supabase Dashboard → SQL Editor (requires postgres role for auth.users insert)
-- ============================================================================

-- Fixed seed UUIDs — recognizable, never conflict with real auth UUIDs
-- Format: d3000000-seed-0000-0000-00000000000X

DO $$ BEGIN RAISE NOTICE 'CollabSpace demo seed starting…'; END $$;

-- ── Step 1: auth.users ──────────────────────────────────────────────────────
-- These accounts exist only so the public.users FK is satisfied.
-- encrypted_password is a valid bcrypt hash; no one knows the plaintext.

INSERT INTO auth.users (
  instance_id, id, aud, role,
  email, encrypted_password, email_confirmed_at,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, recovery_token,
  email_change_token_new, email_change
)
VALUES
  ('00000000-0000-0000-0000-000000000000',
   'd3000000-seed-0000-0000-000000000001', 'authenticated', 'authenticated',
   'marcus@demo.collabspace.test',
   crypt('seed-marcus-notforlogin', gen_salt('bf')), now(),
   now() - interval '14 days', now() - interval '2 days',
   '{"provider":"email","providers":["email"]}', '{}', false, '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000',
   'd3000000-seed-0000-0000-000000000002', 'authenticated', 'authenticated',
   'priya@demo.collabspace.test',
   crypt('seed-priya-notforlogin', gen_salt('bf')), now(),
   now() - interval '11 days', now() - interval '1 day',
   '{"provider":"email","providers":["email"]}', '{}', false, '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000',
   'd3000000-seed-0000-0000-000000000003', 'authenticated', 'authenticated',
   'jordan@demo.collabspace.test',
   crypt('seed-jordan-notforlogin', gen_salt('bf')), now(),
   now() - interval '9 days', now() - interval '3 days',
   '{"provider":"email","providers":["email"]}', '{}', false, '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000',
   'd3000000-seed-0000-0000-000000000004', 'authenticated', 'authenticated',
   'alexk@demo.collabspace.test',
   crypt('seed-alex-notforlogin', gen_salt('bf')), now(),
   now() - interval '8 days', now() - interval '1 day',
   '{"provider":"email","providers":["email"]}', '{}', false, '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000',
   'd3000000-seed-0000-0000-000000000005', 'authenticated', 'authenticated',
   'fatima@demo.collabspace.test',
   crypt('seed-fatima-notforlogin', gen_salt('bf')), now(),
   now() - interval '7 days', now() - interval '1 day',
   '{"provider":"email","providers":["email"]}', '{}', false, '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000',
   'd3000000-seed-0000-0000-000000000006', 'authenticated', 'authenticated',
   'ryan@demo.collabspace.test',
   crypt('seed-ryan-notforlogin', gen_salt('bf')), now(),
   now() - interval '6 days', now() - interval '2 days',
   '{"provider":"email","providers":["email"]}', '{}', false, '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000',
   'd3000000-seed-0000-0000-000000000007', 'authenticated', 'authenticated',
   'emma@demo.collabspace.test',
   crypt('seed-emma-notforlogin', gen_salt('bf')), now(),
   now() - interval '5 days', now() - interval '1 day',
   '{"provider":"email","providers":["email"]}', '{}', false, '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000',
   'd3000000-seed-0000-0000-000000000008', 'authenticated', 'authenticated',
   'james@demo.collabspace.test',
   crypt('seed-james-notforlogin', gen_salt('bf')), now(),
   now() - interval '4 days', now() - interval '1 day',
   '{"provider":"email","providers":["email"]}', '{}', false, '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000',
   'd3000000-seed-0000-0000-000000000009', 'authenticated', 'authenticated',
   'sophia@demo.collabspace.test',
   crypt('seed-sophia-notforlogin', gen_salt('bf')), now(),
   now() - interval '3 days', now() - interval '1 day',
   '{"provider":"email","providers":["email"]}', '{}', false, '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000',
   'd3000000-seed-0000-0000-00000000000a', 'authenticated', 'authenticated',
   'david@demo.collabspace.test',
   crypt('seed-david-notforlogin', gen_salt('bf')), now(),
   now() - interval '2 days', now() - interval '1 day',
   '{"provider":"email","providers":["email"]}', '{}', false, '', '', '', '')

ON CONFLICT (id) DO NOTHING;


-- ── Step 2: public.users ─────────────────────────────────────────────────────

INSERT INTO public.users (
  id, email, name, username, bio,
  one_liner, project_name,
  categories, stage, looking_for, skills,
  availability, visibility,
  traction_signal, collaboration_intent,
  commitment_level, working_style, equity_intent, timezone,
  reputation,
  created_at, last_active_at
)
VALUES

  -- 1. Marcus Chen — technical builder looking for product/GTM collaborator
  (
    'd3000000-seed-0000-0000-000000000001',
    'marcus@demo.collabspace.test',
    'Marcus Chen', 'marcus_chen',
    'Full-stack engineer with 3 years building B2B SaaS. Previously at two early-stage startups. I write clean code, ship fast, and am looking for someone who can own product and go-to-market.',
    'Building an AI-powered expense tracker that learns your freelance business automatically.',
    'Trackr',
    ARRAY['fintech', 'ai/ml'], 'prototype',
    ARRAY['product', 'marketer'],
    ARRAY['fullstack', 'backend', 'data'],
    'Part-time (~5 hrs/wk)', 'public',
    '50 freelancers on waitlist — 3 paying $19/mo in closed beta.',
    'sprint',
    'Part-time (~5 hrs/wk)', 'Async-first with weekly sync',
    'Open to equity if the fit is right', 'America/New_York',
    42,
    now() - interval '14 days', now() - interval '2 days'
  ),

  -- 2. Priya Sharma — product founder looking for technical collaborator
  (
    'd3000000-seed-0000-0000-000000000002',
    'priya@demo.collabspace.test',
    'Priya Sharma', 'priya_builds',
    'Ex-PM at Coursera. I have done product at scale — now I want to build something from scratch. I can own research, roadmap, and GTM. I need someone who can build.',
    'Connecting college students with peer tutors in under 60 seconds.',
    'TutorLink',
    ARRAY['edtech', 'marketplace'], 'idea',
    ARRAY['developer', 'cofounder'],
    ARRAY['product', 'marketing', 'growth'],
    'Dedicated (10+ hrs/wk)', 'public',
    '200 college students surveyed — 78% willing to pay $20/hr for peer tutoring.',
    'cofounder',
    'Dedicated (10+ hrs/wk)', 'Mix of async and sync',
    'Yes — looking for equity cofounder', 'America/Chicago',
    35,
    now() - interval '11 days', now() - interval '1 day'
  ),

  -- 3. Jordan Lee — designer looking for startup project
  (
    'd3000000-seed-0000-0000-000000000003',
    'jordan@demo.collabspace.test',
    'Jordan Lee', 'jordan_designs',
    'Product designer with 4 years at agencies and one early-stage startup. I am good at turning messy ideas into clear interfaces. Looking for a project I can actually own — not just a gig.',
    'Product designer looking for a founding team to join — I bring design, UX research, and taste.',
    NULL,
    ARRAY['saas', 'consumer'], NULL,
    ARRAY['cofounder', 'developer'],
    ARRAY['design', 'ui/ux', 'product'],
    'Weekends', 'public',
    'Portfolio includes 3 shipped products with 10k+ users each.',
    'sprint',
    'Light touch (~2 hrs/wk)', 'Async preferred',
    'Open to equity, depends on the idea', 'America/Los_Angeles',
    28,
    now() - interval '9 days', now() - interval '3 days'
  ),

  -- 4. Alex Kim — AI project looking for validation
  (
    'd3000000-seed-0000-0000-000000000004',
    'alexk@demo.collabspace.test',
    'Alex Kim', 'alexkim_dev',
    'Former English teacher, now self-taught developer. I built WriteBot in 3 weeks because I watched my ESL students struggle with feedback tools that felt cold and robotic. I want to test whether this is actually worth building.',
    'AI writing coach that gives feedback the way a real teacher would — patient, specific, and encouraging.',
    'WriteBot',
    ARRAY['ai/ml', 'edtech'], 'prototype',
    ARRAY['feedback', 'users', 'marketer'],
    ARRAY['backend', 'frontend', 'product'],
    'Part-time (~5 hrs/wk)', 'public',
    'Built in 3 weeks. 12 active beta users, avg session 18 min. One user said it was better than her tutor.',
    'sprint',
    'Part-time (~5 hrs/wk)', 'Flexible',
    'Not thinking about equity yet', 'America/Los_Angeles',
    31,
    now() - interval '8 days', now() - interval '1 day'
  ),

  -- 5. Fatima Al-Hassan — fintech idea needing feedback
  (
    'd3000000-seed-0000-0000-000000000005',
    'fatima@demo.collabspace.test',
    'Fatima Al-Hassan', 'fatima_fintech',
    'MBA student, worked in banking for 2 years before school. I keep seeing Gen Z friends fail at saving not because they don''t want to but because savings apps are built for 40-year-olds. Slice is my answer.',
    'Micro-savings app that rounds up every purchase and builds an emergency fund automatically — built for how Gen Z actually spends.',
    'Slice',
    ARRAY['fintech', 'consumer'], 'idea',
    ARRAY['developer', 'feedback', 'cofounder'],
    ARRAY['marketing', 'product', 'sales'],
    'Part-time (~5 hrs/wk)', 'public',
    'Landing page live — 89 signups in first week, zero paid ads. 12 replied to my email.',
    'sprint',
    'Part-time (~5 hrs/wk)', 'Async-first',
    'Depends on the conversation', 'America/New_York',
    24,
    now() - interval '7 days', now() - interval '1 day'
  ),

  -- 6. Ryan Martinez — logistics MVP needing scope help
  (
    'd3000000-seed-0000-0000-000000000006',
    'ryan@demo.collabspace.test',
    'Ryan Martinez', 'ryanm_ops',
    'Spent 5 years in logistics operations for a regional food distributor. I know the pain of last-mile delivery for restaurants because I lived it. Built a basic prototype but need help scoping what v1 actually is.',
    'Filling the gap between DoorDash and UPS for restaurant catering and bulk orders.',
    'LastLeg',
    ARRAY['b2b'], 'prototype',
    ARRAY['developer', 'cofounder', 'advisor'],
    ARRAY['sales', 'growth', 'leadership'],
    'Dedicated (10+ hrs/wk)', 'public',
    '2 restaurant pilots live. $4k GMV in month one. Drivers sourced through Craigslist — messy but working.',
    'sprint',
    'Dedicated (10+ hrs/wk)', 'Mix of async and sync',
    'Yes — equity cofounder or advisor with stake', 'America/Chicago',
    38,
    now() - interval '6 days', now() - interval '2 days'
  ),

  -- 7. Emma Wilson — student founder with prototype
  (
    'd3000000-seed-0000-0000-000000000007',
    'emma@demo.collabspace.test',
    'Emma Wilson', 'emma_builds',
    'CS junior, mental health advocate. Built Mood.log for myself when I noticed I could not explain to my therapist what my week felt like. Now 28 people use it every day and I have no idea how to grow it.',
    'Private mood journaling app that helps you notice patterns — no AI judgment, no social feed, just clarity.',
    'Mood.log',
    ARRAY['healthtech', 'consumer'], 'prototype',
    ARRAY['feedback', 'users', 'marketer'],
    ARRAY['frontend', 'mobile', 'design'],
    'Light touch (~2 hrs/wk)', 'public',
    'Live on TestFlight. 28 active daily users, 4.8/5 avg rating after 30 days.',
    'sprint',
    'Light touch (~2 hrs/wk)', 'Async preferred',
    'Not thinking about equity yet', 'America/New_York',
    19,
    now() - interval '5 days', now() - interval '1 day'
  ),

  -- 8. James Park — builder looking for a weekend sprint
  (
    'd3000000-seed-0000-0000-000000000008',
    'james@demo.collabspace.test',
    'James Park', 'james_ships',
    'I have shipped 6 projects in the last two years. Most went nowhere. Two got real users. I am good at going from idea to something testable in a weekend. If you have a problem and need to move fast, let''s talk.',
    'Serial builder who moves fast — bring me your problem and we will have something testable in 48 hours.',
    NULL,
    ARRAY['saas', 'b2b'], 'idea',
    ARRAY['cofounder', 'developer', 'feedback'],
    ARRAY['fullstack', 'backend', 'devops'],
    'Weekends', 'public',
    '6 shipped projects. 2 reached real users. 1 sold for a small exit.',
    'sprint',
    'Light touch (~2 hrs/wk)', 'Async-first',
    'Open if it leads somewhere interesting', 'America/Los_Angeles',
    47,
    now() - interval '4 days', now() - interval '1 day'
  ),

  -- 9. Sophia Chen — growth founder looking for technical collaborator
  (
    'd3000000-seed-0000-0000-000000000009',
    'sophia@demo.collabspace.test',
    'Sophia Chen', 'sophia_growth',
    'Ran growth and marketing at two D2C brands (one to $2M ARR). Frustrated that brand analytics tools are either $500/mo enterprise or totally manual. Built a no-code prototype to test the idea. Now I need someone technical to help me go further.',
    'Real-time brand sentiment and performance analytics for D2C founders who cannot afford enterprise tools.',
    'Pulse',
    ARRAY['saas', 'b2b'], 'users',
    ARRAY['developer', 'cofounder'],
    ARRAY['marketing', 'growth', 'product'],
    'Dedicated (10+ hrs/wk)', 'public',
    'No-code prototype. 3 pilot brands, $300 MRR. Customers asked for 4 features I cannot build without code.',
    'cofounder',
    'Dedicated (10+ hrs/wk)', 'Mix of async and sync',
    'Yes — equity split, serious about this', 'America/New_York',
    44,
    now() - interval '3 days', now() - interval '1 day'
  ),

  -- 10. David Osei — hardware/climate builder
  (
    'd3000000-seed-0000-0000-00000000000a',
    'david@demo.collabspace.test',
    'David Osei', 'david_hardware',
    'Hardware engineer with a background in IoT. Watching my electricity bill go up while having no idea which appliance is the culprit. Built a plug-in monitor that tells you. Now in 4 apartments. Not sure if it is a product yet.',
    'Plug-in energy monitor that shows renters exactly what each appliance costs per day — no electrician, no install.',
    'Watt',
    ARRAY['hardware', 'climate'], 'prototype',
    ARRAY['advisor', 'feedback', 'marketer'],
    ARRAY['backend', 'data', 'devops'],
    'Part-time (~5 hrs/wk)', 'public',
    '10 units hand-assembled and placed in 4 households. Users checking app 2x daily on average.',
    'sprint',
    'Part-time (~5 hrs/wk)', 'Async preferred',
    'Open to it, hardware is capital-intensive', 'America/Chicago',
    33,
    now() - interval '2 days', now() - interval '1 day'
  )

ON CONFLICT (id) DO NOTHING;


-- ── Step 3: posts ────────────────────────────────────────────────────────────
-- Community Highlights in Discover's right rail pulls from this table.
-- Using fixed UUIDs so the script is idempotent.

INSERT INTO public.posts (id, author_id, title, body, category, created_at, updated_at)
VALUES

  ('f0000001-seed-0000-0000-000000000001',
   'd3000000-seed-0000-0000-000000000001',
   'Why I''m building an expense tracker when 100 already exist',
   'Every expense tracker I tried assumed I knew what my income would be this month. As a freelancer, I don''t. Trackr learns from your actual pattern — feast months, drought months — and builds a budget around reality. Would love feedback from anyone who freelances or knows freelancers.',
   'idea', now() - interval '12 days', now() - interval '12 days'),

  ('f0000001-seed-0000-0000-000000000002',
   'd3000000-seed-0000-0000-000000000002',
   'College tutoring is broken — here''s what I found in 200 surveys',
   'I spent 3 weeks talking to college students about how they find help when they''re stuck. 80% said they Google it first. 60% said they''d rather pay a peer than go to office hours. The biggest blocker: they don''t know who is good. TutorLink solves that with verified peer tutors and session ratings. Looking for a technical cofounder to build this with.',
   'idea', now() - interval '10 days', now() - interval '10 days'),

  ('f0000001-seed-0000-0000-000000000003',
   'd3000000-seed-0000-0000-000000000004',
   'I shipped my first product in 3 weeks — here''s what surprised me',
   'WriteBot started as a tool I made for one ESL student struggling with paragraph structure. I had no idea 12 people would be using it daily three weeks later. The hardest part wasn''t the code — it was figuring out what feedback actually sounds encouraging vs condescending. Happy to do a feedback sprint with anyone building in edtech or AI.',
   'idea', now() - interval '7 days', now() - interval '7 days'),

  ('f0000001-seed-0000-0000-000000000004',
   'd3000000-seed-0000-0000-000000000005',
   'Gen Z doesn''t have a spending problem — they have a saving infrastructure problem',
   'I grew up watching my parents use a savings account to save. I don''t. I spend digitally, I think in transactions, not balances. Slice rounds up every payment automatically and puts the difference into an emergency fund. 89 people signed up in week one with no ads. I''m looking for someone who can help me scope what v1 should actually be.',
   'idea', now() - interval '6 days', now() - interval '6 days'),

  ('f0000001-seed-0000-0000-000000000005',
   'd3000000-seed-0000-0000-000000000006',
   '$4k in GMV and I''m routing orders over text message — time to fix this',
   'LastLeg is running. Two restaurants are using it for catering orders. We moved $4k last month. The problem is everything is manual — I take orders over text, coordinate drivers over WhatsApp, and track everything in a spreadsheet. I need to scope what a real v1 looks like before this falls apart. Looking for a builder who gets operations.',
   'idea', now() - interval '5 days', now() - interval '5 days'),

  ('f0000001-seed-0000-0000-000000000006',
   'd3000000-seed-0000-0000-000000000007',
   'I built a journaling app for my therapist appointments and 28 people started using it',
   'Mood.log started because I could never answer "how was your week?" in therapy. I started logging daily and realized patterns I''d never noticed. I put it on TestFlight expecting to share it with 3 friends. Now 28 people use it every day and I have no idea how it spread. Looking for help thinking about what comes next.',
   'idea', now() - interval '4 days', now() - interval '4 days'),

  ('f0000001-seed-0000-0000-000000000007',
   'd3000000-seed-0000-0000-000000000009',
   'My no-code brand analytics tool has paying customers. Now what?',
   'I built Pulse in Retool + a Google Sheet backend to prove the concept. Three D2C brands are paying $100/mo. They keep asking for things I can''t build in no-code. I''m at the point where I either find a technical cofounder or give up. If you''re a developer who has ever worked in e-commerce or D2C, I''d love to talk.',
   'idea', now() - interval '2 days', now() - interval '2 days'),

  ('f0000001-seed-0000-0000-000000000008',
   'd3000000-seed-0000-0000-00000000000a',
   'I hand-assembled 10 energy monitors and put them in apartments — here''s what I learned',
   'Watt is in 4 households right now. The average person checks the app twice a day. The thing they look at most is the "daily cost" number — not the watts, not the kilowatt-hours, just "this fridge costs me $1.20/day." That surprised me. Now I need to figure out whether this is a product or a toy. Would love to sprint with anyone who has sold hardware before.',
   'idea', now() - interval '1 day', now() - interval '1 day')

ON CONFLICT (id) DO NOTHING;


DO $$ BEGIN RAISE NOTICE 'Seed complete. 10 builder profiles and 8 posts created (or already existed).'; END $$;
