-- ============================================================================
-- SAVED BUILDERS MIGRATION
-- Allows users to bookmark/save other builder profiles
-- ============================================================================

-- ============================================================================
-- 1) CREATE public.saved_builders TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.saved_builders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  saved_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),

  -- Prevent duplicate saves
  UNIQUE(user_id, saved_user_id)
);

-- Add constraint to prevent saving yourself
ALTER TABLE public.saved_builders
ADD CONSTRAINT saved_builders_no_self_save
CHECK (user_id != saved_user_id);

-- Add comment for documentation
COMMENT ON TABLE public.saved_builders IS
  'Stores bookmarked/saved builder profiles for the Discover page';


-- ============================================================================
-- 2) INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for user's saved list
CREATE INDEX IF NOT EXISTS idx_saved_builders_user_id
  ON public.saved_builders (user_id);

-- Index for checking if a specific user is saved
CREATE INDEX IF NOT EXISTS idx_saved_builders_user_saved
  ON public.saved_builders (user_id, saved_user_id);


-- ============================================================================
-- 3) RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.saved_builders ENABLE ROW LEVEL SECURITY;

-- Users can view their own saved builders
DROP POLICY IF EXISTS "Users can view own saved builders" ON public.saved_builders;
CREATE POLICY "Users can view own saved builders"
  ON public.saved_builders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can save builders (insert)
DROP POLICY IF EXISTS "Users can save builders" ON public.saved_builders;
CREATE POLICY "Users can save builders"
  ON public.saved_builders
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can unsave builders (delete)
DROP POLICY IF EXISTS "Users can unsave builders" ON public.saved_builders;
CREATE POLICY "Users can unsave builders"
  ON public.saved_builders
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ============================================================================
-- 4) HELPER FUNCTION
-- ============================================================================

-- Function to toggle save status (upsert/delete pattern)
CREATE OR REPLACE FUNCTION toggle_saved_builder(p_saved_user_id uuid)
RETURNS json AS $$
DECLARE
  v_existing_id uuid;
  v_result json;
BEGIN
  -- Check if already saved
  SELECT id INTO v_existing_id
  FROM public.saved_builders
  WHERE user_id = auth.uid() AND saved_user_id = p_saved_user_id;

  IF v_existing_id IS NOT NULL THEN
    -- Unsave
    DELETE FROM public.saved_builders WHERE id = v_existing_id;
    v_result := json_build_object('action', 'unsaved', 'saved_user_id', p_saved_user_id);
  ELSE
    -- Save
    INSERT INTO public.saved_builders (user_id, saved_user_id)
    VALUES (auth.uid(), p_saved_user_id);
    v_result := json_build_object('action', 'saved', 'saved_user_id', p_saved_user_id);
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION toggle_saved_builder IS
  'Toggles saved/unsaved state for a builder profile. Returns action taken.';

-- Grant execute on function
GRANT EXECUTE ON FUNCTION toggle_saved_builder TO authenticated;


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
