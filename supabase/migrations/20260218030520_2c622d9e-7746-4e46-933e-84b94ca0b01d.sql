
-- Create household_links table for multi-user household syncing
CREATE TABLE public.household_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL,
  member_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'accepted', 'rejected'
  invite_token TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT household_links_unique UNIQUE (requester_id, member_id),
  CONSTRAINT household_links_no_self CHECK (requester_id <> member_id),
  CONSTRAINT household_links_status_check CHECK (status IN ('pending', 'accepted', 'rejected'))
);

-- Enable RLS
ALTER TABLE public.household_links ENABLE ROW LEVEL SECURITY;

-- Users can view links where they are either the requester or the member
CREATE POLICY "Users can view their household links"
  ON public.household_links
  FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = member_id);

-- Users can create link requests (they are the requester)
CREATE POLICY "Users can create household link requests"
  ON public.household_links
  FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

-- Users can update links where they are the member (accept/reject)
-- Or the requester can delete/cancel their own requests
CREATE POLICY "Members can update household links"
  ON public.household_links
  FOR UPDATE
  USING (auth.uid() = member_id OR auth.uid() = requester_id);

-- Requesters can delete their own pending requests
CREATE POLICY "Requesters can delete their household links"
  ON public.household_links
  FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = member_id);

-- Create trigger for updated_at
CREATE TRIGGER update_household_links_updated_at
  BEFORE UPDATE ON public.household_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create a function to look up a user by email for household linking
-- This is a security definer function to safely expose only the user_id
CREATE OR REPLACE FUNCTION public.find_user_for_household(lookup_email TEXT)
RETURNS TABLE(user_id UUID, display_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.user_id, p.display_name
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE lower(u.email) = lower(lookup_email)
    AND p.user_id <> auth.uid()
  LIMIT 1;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.find_user_for_household(TEXT) TO authenticated;
