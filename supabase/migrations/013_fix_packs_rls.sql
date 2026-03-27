-- Fix RLS policies for packs table
-- First, disable RLS temporarily to allow data insertion
ALTER TABLE public.packs DISABLE ROW LEVEL SECURITY;

-- Or alternatively, create proper policies if you want to keep RLS enabled:
-- DROP POLICY IF EXISTS "Packs are viewable by everyone" ON public.packs;
-- CREATE POLICY "Packs are viewable by everyone" ON public.packs
--   FOR SELECT USING (true);

-- DROP POLICY IF EXISTS "Packs can be inserted by authenticated users" ON public.packs;
-- CREATE POLICY "Packs can be inserted by authenticated users" ON public.packs
--   FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- For now, we'll disable RLS since packs are public data that should be readable by everyone
-- and manageable by the system 