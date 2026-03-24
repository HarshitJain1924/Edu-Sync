-- 1. Add new columns to support Decentralized "Free" Rooms
ALTER TABLE public.study_rooms
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'teacher' CHECK (type IN ('teacher', 'free')),
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS is_scheduled boolean DEFAULT false;

-- 2. Add the missing UPDATE policy for room_participants so role sync works
DROP POLICY IF EXISTS "Users can update own participants" ON public.room_participants;
CREATE POLICY "Users can update own participants" ON public.room_participants
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
