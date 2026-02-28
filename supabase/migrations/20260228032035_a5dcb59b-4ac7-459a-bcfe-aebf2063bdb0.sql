
CREATE OR REPLACE FUNCTION public.increment_sign_in_count(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE profiles
  SET sign_in_count = sign_in_count + 1,
      last_sign_in_at = now(),
      last_active_at = now()
  WHERE user_id = p_user_id;
$$;
