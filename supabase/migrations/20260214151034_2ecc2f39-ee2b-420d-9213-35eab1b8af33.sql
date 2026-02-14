
-- Remove overly permissive policies from compounds (now read-only library)
DROP POLICY IF EXISTS "Anyone can insert compounds" ON public.compounds;
DROP POLICY IF EXISTS "Anyone can update compounds" ON public.compounds;
DROP POLICY IF EXISTS "Anyone can delete compounds" ON public.compounds;

-- Fix orders table - add user_id and lock down
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Allow all access to orders" ON public.orders;

CREATE POLICY "Users can view their own orders"
ON public.orders FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own orders"
ON public.orders FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own orders"
ON public.orders FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own orders"
ON public.orders FOR DELETE
USING (auth.uid() = user_id);
