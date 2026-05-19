-- ============================================================================
-- SPRINTS & BUILDER SIGNAL MIGRATION
-- Phase 1: Builder Card Signal Fields
-- Phase 2: Sprints Table
-- ============================================================================

-- ============================================================================
-- 1) EXTEND users TABLE WITH BUILDER SIGNAL FIELDS
-- ============================================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS project_name text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS traction_signal text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS collaboration_intent text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS commitment_level text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS working_style text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS equity_intent text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS timezone text;

-- Expand stage constraint to include new values
DO $$ BEGIN
  ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_stage_check;
  ALTER TABLE public.users ADD CONSTRAINT users_stage_check
    CHECK (stage IS NULL OR stage IN (
      'idea', 'validating', 'prototype', 'mvp', 'users', 'launched', 'revenue'
    ));
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================================
-- 2) CREATE public.sprints TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  sprint_type text NOT NULL,
  goal text NOT NULL,
  expected_commitment text,
  duration_days integer NOT NULL DEFAULT 7,
  deliverables text[],
  status text NOT NULL DEFAULT 'proposed',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  outcome text,
  CONSTRAINT sprints_no_self_sprint CHECK (proposer_id != recipient_id)
);

DO $$ BEGIN
  ALTER TABLE public.sprints DROP CONSTRAINT IF EXISTS sprints_status_check;
  ALTER TABLE public.sprints ADD CONSTRAINT sprints_status_check
    CHECK (status IN ('proposed', 'accepted', 'declined', 'active', 'completed', 'cancelled'));
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.sprints DROP CONSTRAINT IF EXISTS sprints_type_check;
  ALTER TABLE public.sprints ADD CONSTRAINT sprints_type_check
    CHECK (sprint_type IN ('validation', 'mvp_scope', 'build', 'gtm', 'cofounder_fit'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================================
-- 3) INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sprints_proposer_id ON public.sprints (proposer_id);
CREATE INDEX IF NOT EXISTS idx_sprints_recipient_id ON public.sprints (recipient_id);
CREATE INDEX IF NOT EXISTS idx_sprints_status ON public.sprints (status);

-- ============================================================================
-- 4) RLS
-- ============================================================================

ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sprint participants can view their sprints" ON public.sprints;
CREATE POLICY "Sprint participants can view their sprints"
  ON public.sprints FOR SELECT TO authenticated
  USING (auth.uid() = proposer_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users can propose sprints" ON public.sprints;
CREATE POLICY "Users can propose sprints"
  ON public.sprints FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = proposer_id);

DROP POLICY IF EXISTS "Sprint participants can update their sprints" ON public.sprints;
CREATE POLICY "Sprint participants can update their sprints"
  ON public.sprints FOR UPDATE TO authenticated
  USING (auth.uid() = proposer_id OR auth.uid() = recipient_id);
