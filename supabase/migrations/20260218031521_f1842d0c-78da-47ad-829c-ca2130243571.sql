-- Enable realtime for dose_check_offs so household members can see each other's check-off status live
ALTER PUBLICATION supabase_realtime ADD TABLE public.dose_check_offs;

-- Ensure household members can read each other's dose check-offs (for combined view)
-- Add a policy that allows reading dose_check_offs for linked household members
CREATE POLICY "Household members can view each other's dose check-offs"
  ON public.dose_check_offs
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.household_links
      WHERE status = 'accepted'
        AND (
          (requester_id = auth.uid() AND member_id = dose_check_offs.user_id)
          OR (member_id = auth.uid() AND requester_id = dose_check_offs.user_id)
        )
    )
  );
