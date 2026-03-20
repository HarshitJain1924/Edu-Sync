-- ============================================================
-- Phase 7: Teacher-Student Classroom Model - DB Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 0. Infrastructure Fixes (Ensure columns from previous phases exist)
ALTER TABLE public.study_rooms
  ADD COLUMN IF NOT EXISTS host_id UUID REFERENCES auth.users(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS room_code TEXT UNIQUE;

-- 1. Add role, hand_raised, and attendance to room_participants
ALTER TABLE public.room_participants
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student',
  ADD COLUMN IF NOT EXISTS hand_raised BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 2. Add whiteboard permission to study_rooms
ALTER TABLE public.study_rooms
  ADD COLUMN IF NOT EXISTS allow_student_drawing BOOLEAN DEFAULT false;

-- 3. Create session_materials table
CREATE TABLE IF NOT EXISTS public.session_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Create study_sessions (scheduled class sessions) table
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  room_id UUID REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'scheduled', -- scheduled | live | completed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Note: You must also create a Supabase Storage bucket named 'session-materials'
--    In the Storage settings, allow authenticated users to upload & download files.
--
--    To enable Realtime on these tables manually (if not already):
--    Go to: Supabase Dashboard → Database → Replication → select session_materials & study_sessions

-- 6. Add role constraint (with fix for existing constraint)
ALTER TABLE public.room_participants 
  DROP CONSTRAINT IF EXISTS role_check;

ALTER TABLE public.room_participants
  ADD CONSTRAINT role_check
  CHECK (role IN ('teacher', 'student', 'admin'));

-- 7. RLS Policies for session_materials
ALTER TABLE public.session_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view materials in their room" 
  ON public.session_materials FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.room_participants 
    WHERE room_id = session_materials.room_id AND user_id = auth.uid()
  ));

CREATE POLICY "Teachers can upload materials" 
  ON public.session_materials FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.room_participants 
    WHERE room_id = session_materials.room_id AND user_id = auth.uid() AND role = 'teacher'
  ));

CREATE POLICY "Teachers can delete their materials" 
  ON public.session_materials FOR DELETE 
  USING (auth.uid() = uploaded_by);

-- 8. RLS Policies for study_sessions
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view scheduled sessions" 
  ON public.study_sessions FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Teachers can manage sessions" 
  ON public.study_sessions FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('teacher', 'admin')
  ));

-- 9. Storage Policies for 'session-materials' bucket
-- Note: These must be run in the SQL editor to apply to the storage schema
/*
INSERT INTO storage.buckets (id, name, public) 
VALUES ('session-materials', 'session-materials', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload materials" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'session-materials');

CREATE POLICY "Anyone can view materials" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'session-materials');
*/
