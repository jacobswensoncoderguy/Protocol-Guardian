
-- Returns per-compound check-off counts for a given user.
-- The client uses these counts to calculate actual consumption
-- (checked_doses × dose_per_use) instead of theoretical depletion.
CREATE OR REPLACE FUNCTION public.get_compound_compliance(p_user_id UUID)
RETURNS TABLE(
  compound_id UUID,
  checked_doses BIGINT,
  first_check_date DATE,
  last_check_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.compound_id::UUID,
    COUNT(*)::BIGINT as checked_doses,
    MIN(dc.check_date::DATE) as first_check_date,
    MAX(dc.check_date::DATE) as last_check_date
  FROM dose_check_offs dc
  WHERE dc.user_id = p_user_id
  GROUP BY dc.compound_id;
END;
$$;
