-- retained_players was missing INSERT and DELETE policies
-- This caused RandomTeamGenerator saves to silently fail

CREATE POLICY IF NOT EXISTS "Retained players can be inserted by anyone"
  ON public.retained_players
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Retained players can be deleted by anyone"
  ON public.retained_players
  FOR DELETE
  USING (true);

CREATE POLICY IF NOT EXISTS "Retained players can be updated by anyone"
  ON public.retained_players
  FOR UPDATE
  USING (true);
