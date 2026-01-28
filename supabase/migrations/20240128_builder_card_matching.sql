-- ============================================================================
-- BUILDER CARD & AI MATCHING MIGRATION
-- Extends users with builder-card fields and creates match feedback system
-- ============================================================================

-- ============================================================================
-- 1) EXTEND public.users WITH BUILDER-CARD FIELDS
-- ============================================================================

-- Add one_liner field (short bio/pitch)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS one_liner text;

-- Add categories array (e.g., 'fintech', 'healthcare', 'edtech')
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS categories text[] DEFAULT '{}';

-- Add stage field with constraint
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS stage text;

-- Add stage constraint (idempotent: drop if exists, then create)
DO $$
BEGIN
  ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_stage_check;
  ALTER TABLE public.users
    ADD CONSTRAINT users_stage_check
    CHECK (stage IS NULL OR stage IN ('idea', 'prototype', 'users', 'revenue'));
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- Add looking_for array (e.g., 'cofounder', 'developer', 'designer', 'advisor')
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS looking_for text[] DEFAULT '{}';

-- Add skills array (e.g., 'frontend', 'backend', 'design', 'marketing')
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS skills text[] DEFAULT '{}';

-- Add availability field (e.g., 'full-time', 'part-time', 'weekends')
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS availability text;

-- Add visibility field for profile exposure control
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

-- Add visibility constraint (idempotent)
DO $$
BEGIN
  ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_visibility_check;
  ALTER TABLE public.users
    ADD CONSTRAINT users_visibility_check
    CHECK (visibility IN ('public', 'match_only', 'private'));
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- Add updated_at timestamp for builder card (tracks when profile was last edited)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS builder_card_updated_at timestamptz NOT NULL DEFAULT now();

-- Create trigger to auto-update builder_card_updated_at when relevant fields change
CREATE OR REPLACE FUNCTION update_builder_card_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    OLD.one_liner IS DISTINCT FROM NEW.one_liner OR
    OLD.categories IS DISTINCT FROM NEW.categories OR
    OLD.stage IS DISTINCT FROM NEW.stage OR
    OLD.looking_for IS DISTINCT FROM NEW.looking_for OR
    OLD.skills IS DISTINCT FROM NEW.skills OR
    OLD.availability IS DISTINCT FROM NEW.availability OR
    OLD.visibility IS DISTINCT FROM NEW.visibility
  ) THEN
    NEW.builder_card_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_builder_card_timestamp ON public.users;
CREATE TRIGGER trigger_update_builder_card_timestamp
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_builder_card_timestamp();


-- ============================================================================
-- 2) CREATE public.match_feedback TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.match_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  created_at timestamptz DEFAULT now(),

  -- Prevent duplicate feedback from same user to same target
  UNIQUE(user_id, target_user_id)
);

-- Add action constraint (idempotent)
DO $$
BEGIN
  ALTER TABLE public.match_feedback DROP CONSTRAINT IF EXISTS match_feedback_action_check;
  ALTER TABLE public.match_feedback
    ADD CONSTRAINT match_feedback_action_check
    CHECK (action IN ('dismiss', 'more_like_this', 'less_like_this', 'reported'));
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- Add comment for documentation
COMMENT ON TABLE public.match_feedback IS
  'Stores user feedback on AI-suggested matches for improving recommendations';

COMMENT ON COLUMN public.match_feedback.action IS
  'dismiss: hide from suggestions, more_like_this: positive signal, less_like_this: negative signal, reported: flagged for review';


-- ============================================================================
-- 3) INDEXES FOR PERFORMANCE
-- ============================================================================

-- GIN indexes for array fields (enables efficient @> and && operators)
CREATE INDEX IF NOT EXISTS idx_users_categories_gin
  ON public.users USING GIN (categories);

CREATE INDEX IF NOT EXISTS idx_users_looking_for_gin
  ON public.users USING GIN (looking_for);

CREATE INDEX IF NOT EXISTS idx_users_skills_gin
  ON public.users USING GIN (skills);

-- B-tree index on stage for filtering
CREATE INDEX IF NOT EXISTS idx_users_stage
  ON public.users (stage)
  WHERE stage IS NOT NULL;

-- Index on visibility for filtering public profiles
CREATE INDEX IF NOT EXISTS idx_users_visibility
  ON public.users (visibility);

-- Index on match_feedback for user lookups
CREATE INDEX IF NOT EXISTS idx_match_feedback_user_id
  ON public.match_feedback (user_id);

-- Composite index for checking existing feedback
CREATE INDEX IF NOT EXISTS idx_match_feedback_user_target
  ON public.match_feedback (user_id, target_user_id);


-- ============================================================================
-- 4) PUBLIC VIEW FOR SAFE FIELD EXPOSURE
-- ============================================================================

-- This view exposes only safe/public fields, respecting visibility settings
-- Application layer should use this view for /members listing
CREATE OR REPLACE VIEW public.user_public_profiles AS
SELECT
  id,
  username,
  name,
  school,
  major,
  reputation,
  stage,
  categories,
  visibility,
  last_active_at,
  created_at
FROM public.users
WHERE visibility = 'public';

COMMENT ON VIEW public.user_public_profiles IS
  'Public-safe view of user profiles. Only shows users with visibility=public. Use for /members directory.';


-- Extended view that includes more fields but still excludes sensitive data
CREATE OR REPLACE VIEW public.user_builder_cards AS
SELECT
  id,
  username,
  name,
  school,
  major,
  reputation,
  one_liner,
  categories,
  stage,
  looking_for,
  skills,
  availability,
  visibility,
  last_active_at,
  builder_card_updated_at,
  created_at
FROM public.users
WHERE visibility IN ('public', 'match_only');

COMMENT ON VIEW public.user_builder_cards IS
  'Builder card view for AI matching. Includes match_only profiles. Excludes private profiles and sensitive fields like email.';


-- ============================================================================
-- 5) RLS POLICIES
-- ============================================================================

-- Enable RLS on match_feedback (users table should already have RLS enabled)
ALTER TABLE public.match_feedback ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- match_feedback policies: users can only manage their own feedback
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own match feedback" ON public.match_feedback;
CREATE POLICY "Users can view own match feedback"
  ON public.match_feedback
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own match feedback" ON public.match_feedback;
CREATE POLICY "Users can insert own match feedback"
  ON public.match_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own match feedback" ON public.match_feedback;
CREATE POLICY "Users can update own match feedback"
  ON public.match_feedback
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own match feedback" ON public.match_feedback;
CREATE POLICY "Users can delete own match feedback"
  ON public.match_feedback
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- users table policies for builder card visibility
-- ---------------------------------------------------------------------------

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can view public profiles" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view connected profiles" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view users" ON public.users;

-- Policy: Users can always view their own full profile
CREATE POLICY "Users can view own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy: Authenticated users can view public profiles
CREATE POLICY "Users can view public profiles"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (visibility = 'public');

-- Policy: Users can view profiles of people they're connected with
-- This allows viewing 'private' and 'match_only' profiles if connected
CREATE POLICY "Users can view connected profiles"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.status = 'accepted'
      AND (
        (c.requester_id = auth.uid() AND c.addressee_id = users.id)
        OR
        (c.addressee_id = auth.uid() AND c.requester_id = users.id)
      )
    )
  );

-- Policy: Allow viewing match_only profiles for matching purposes
-- In production, you might restrict this further to only show in match results
CREATE POLICY "Users can view match_only for matching"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (visibility = 'match_only');


-- ============================================================================
-- 6) HELPER FUNCTIONS FOR MATCHING
-- ============================================================================

-- Function to get users that haven't been dismissed by the current user
-- Useful for AI matching to filter out already-reviewed profiles
CREATE OR REPLACE FUNCTION get_matchable_users(requesting_user_id uuid)
RETURNS TABLE (
  id uuid,
  username text,
  name text,
  school text,
  major text,
  reputation integer,
  one_liner text,
  categories text[],
  stage text,
  looking_for text[],
  skills text[],
  availability text,
  visibility text,
  last_active_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.username,
    u.name,
    u.school,
    u.major,
    u.reputation,
    u.one_liner,
    u.categories,
    u.stage,
    u.looking_for,
    u.skills,
    u.availability,
    u.visibility,
    u.last_active_at
  FROM public.users u
  WHERE u.id != requesting_user_id
    AND u.visibility IN ('public', 'match_only')
    -- Exclude users that have been dismissed
    AND NOT EXISTS (
      SELECT 1 FROM public.match_feedback mf
      WHERE mf.user_id = requesting_user_id
      AND mf.target_user_id = u.id
      AND mf.action = 'dismiss'
    )
    -- Exclude users that are already connected
    AND NOT EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.status = 'accepted'
      AND (
        (c.requester_id = requesting_user_id AND c.addressee_id = u.id)
        OR
        (c.addressee_id = requesting_user_id AND c.requester_id = u.id)
      )
    )
  ORDER BY u.last_active_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_matchable_users IS
  'Returns users eligible for AI matching, excluding dismissed and already-connected users';


-- Function to record match feedback (upsert pattern)
CREATE OR REPLACE FUNCTION record_match_feedback(
  p_target_user_id uuid,
  p_action text
) RETURNS uuid AS $$
DECLARE
  v_feedback_id uuid;
BEGIN
  INSERT INTO public.match_feedback (user_id, target_user_id, action)
  VALUES (auth.uid(), p_target_user_id, p_action)
  ON CONFLICT (user_id, target_user_id)
  DO UPDATE SET
    action = EXCLUDED.action,
    created_at = now()
  RETURNING id INTO v_feedback_id;

  RETURN v_feedback_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION record_match_feedback IS
  'Records or updates feedback for a suggested match. Upserts to handle re-evaluations.';


-- ============================================================================
-- 7) GRANT PERMISSIONS
-- ============================================================================

-- Grant access to views
GRANT SELECT ON public.user_public_profiles TO authenticated;
GRANT SELECT ON public.user_builder_cards TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION get_matchable_users TO authenticated;
GRANT EXECUTE ON FUNCTION record_match_feedback TO authenticated;


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
--
-- Summary of changes:
-- 1. Extended users table with builder card fields:
--    - one_liner, categories, stage, looking_for, skills, availability, visibility
--    - Added constraints for stage and visibility enum values
--    - Added builder_card_updated_at with auto-update trigger
--
-- 2. Created match_feedback table for AI matching signals
--    - Stores dismiss/more_like_this/less_like_this/reported actions
--    - Unique constraint prevents duplicate feedback
--
-- 3. Added performance indexes:
--    - GIN indexes on array fields for efficient containment queries
--    - B-tree indexes on stage, visibility, and match_feedback lookups
--
-- 4. Created views for safe data exposure:
--    - user_public_profiles: only public visibility users, safe fields
--    - user_builder_cards: public + match_only, builder card fields
--
-- 5. RLS policies enforce visibility:
--    - Own profile: always visible
--    - Public profiles: visible to all authenticated
--    - Match_only: visible for matching purposes
--    - Private: only visible to connected users
--
-- 6. Helper functions for matching:
--    - get_matchable_users(): returns candidates excluding dismissed/connected
--    - record_match_feedback(): upserts feedback actions
-- ============================================================================
