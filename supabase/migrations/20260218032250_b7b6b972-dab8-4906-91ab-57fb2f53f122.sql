
-- Step 1: Create is_household_linked security-definer function
CREATE OR REPLACE FUNCTION public.is_household_linked(user_a uuid, user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_links
    WHERE status = 'accepted'
      AND (
        (requester_id = user_a AND member_id = user_b)
        OR
        (requester_id = user_b AND member_id = user_a)
      )
  )
$$;

-- Step 2: Drop and recreate find_user_for_household with email column
DROP FUNCTION IF EXISTS public.find_user_for_household(text);

CREATE FUNCTION public.find_user_for_household(lookup_email text)
RETURNS TABLE(display_name text, user_id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      p.display_name,
      au.id AS user_id,
      au.email::text
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.user_id = au.id
    WHERE au.email = lookup_email;
END;
$$;

-- Step 3: Update RLS on dose_check_offs to use the new efficient function
DROP POLICY IF EXISTS "Household members can view linked member dose check offs" ON public.dose_check_offs;

CREATE POLICY "Household members can view linked member dose check offs"
  ON public.dose_check_offs
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_household_linked(auth.uid(), user_id)
  );
