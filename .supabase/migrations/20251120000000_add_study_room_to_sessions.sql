-- Drop the existing view first
DROP VIEW IF EXISTS public.sessions_with_teacher;

-- Add study_room_id column to existing sessions table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sessions' 
    AND column_name = 'study_room_id'
  ) THEN
    ALTER TABLE public.sessions 
    ADD COLUMN study_room_id UUID REFERENCES public.study_rooms(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Drop room_link column if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sessions' 
    AND column_name = 'room_link'
  ) THEN
    ALTER TABLE public.sessions DROP COLUMN room_link;
  END IF;
END $$;

-- Recreate the view with study_room_id
CREATE OR REPLACE VIEW public.sessions_with_teacher AS
SELECT 
  s.*,
  p.username as teacher_name,
  COUNT(sp.id) as enrolled_count
FROM public.sessions s
LEFT JOIN public.profiles p ON s.teacher_id = p.id
LEFT JOIN public.session_participants sp ON s.id = sp.session_id
GROUP BY s.id, p.username;

-- Grant access to the view
GRANT SELECT ON public.sessions_with_teacher TO authenticated;
