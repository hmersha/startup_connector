-- CollabSpace Database Schema
-- Run this in Supabase SQL Editor to set up the database

-- ============================================
-- TABLES
-- ============================================

-- Users table (extends Supabase Auth)
-- Stores member profile information
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  bio text,
  created_at timestamptz not null default now()
);

-- Posts table
-- Stores ideas and updates shared by members
create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references users(id) on delete cascade,
  title text not null,
  body text not null,
  category text not null check (category in ('idea', 'update')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Comments table
-- Flat comments on posts (no threading)
create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  author_id uuid not null references users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Invite tokens table (optional - only if not using email domain restriction)
-- Allows invite-only registration flow
create table invite_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  created_by uuid references users(id) on delete set null,
  used_by uuid references users(id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz not null
);

-- ============================================
-- INDEXES
-- ============================================

-- Speed up common queries
create index posts_author_id_idx on posts(author_id);
create index posts_created_at_idx on posts(created_at desc);
create index comments_post_id_idx on comments(post_id);
create index comments_author_id_idx on comments(author_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
alter table users enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;
alter table invite_tokens enable row level security;

-- Users policies
create policy "Users are viewable by authenticated users"
  on users for select
  to authenticated
  using (true);

create policy "Users can insert own profile"
  on users for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on users for update
  to authenticated
  using (auth.uid() = id);

-- Posts policies
create policy "Posts are viewable by authenticated users"
  on posts for select
  to authenticated
  using (true);

create policy "Users can create own posts"
  on posts for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "Users can update own posts"
  on posts for update
  to authenticated
  using (auth.uid() = author_id);

create policy "Users can delete own posts"
  on posts for delete
  to authenticated
  using (auth.uid() = author_id);

-- Comments policies
create policy "Comments are viewable by authenticated users"
  on comments for select
  to authenticated
  using (true);

create policy "Users can create own comments"
  on comments for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "Users can update own comments"
  on comments for update
  to authenticated
  using (auth.uid() = author_id);

create policy "Users can delete own comments"
  on comments for delete
  to authenticated
  using (auth.uid() = author_id);

-- Invite tokens policies (if using invite flow)
create policy "Valid tokens are checkable"
  on invite_tokens for select
  to anon, authenticated
  using (used_by is null and expires_at > now());

create policy "Tokens can be marked used"
  on invite_tokens for update
  to authenticated
  using (used_by is null)
  with check (used_by = auth.uid());
