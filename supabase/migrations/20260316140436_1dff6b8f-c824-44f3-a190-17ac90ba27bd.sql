-- 1. Add missing columns to room_participants
ALTER TABLE public.room_participants
  ADD COLUMN IF NOT EXISTS mic_on boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS camera_on boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS screen_sharing boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'student',
  ADD COLUMN IF NOT EXISTS hand_raised boolean DEFAULT false;

-- 2. Add missing columns to study_rooms
ALTER TABLE public.study_rooms
  ADD COLUMN IF NOT EXISTS host_id uuid,
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS allow_student_drawing boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS room_code text;

-- 3. Create learning_styles table with FK to profiles
CREATE TABLE IF NOT EXISTS public.learning_styles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  style text NOT NULL,
  responses jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Defensive: older environments may have pre-existing tables without user_id.
ALTER TABLE public.learning_styles
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE public.learning_styles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own learning style" ON public.learning_styles;
CREATE POLICY "Users can view own learning style" ON public.learning_styles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own learning style" ON public.learning_styles;
CREATE POLICY "Users can insert own learning style" ON public.learning_styles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own learning style" ON public.learning_styles;
CREATE POLICY "Users can update own learning style" ON public.learning_styles
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DO $$
DECLARE
  roles_user_col text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'user_id'
  ) THEN
    roles_user_col := 'user_id';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'id'
  ) THEN
    roles_user_col := 'id';
  ELSE
    RAISE EXCEPTION 'user_roles requires either user_id or id column for role policies';
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS "Teachers can view all learning styles" ON public.learning_styles';
  EXECUTE format(
    'CREATE POLICY "Teachers can view all learning styles" ON public.learning_styles
       FOR SELECT TO authenticated USING (
         EXISTS (
           SELECT 1 FROM public.user_roles ur
           WHERE ur.%I = auth.uid()
             AND ur.role::text IN (''teacher'', ''admin'')
         )
       )',
    roles_user_col
  );
END $$;

-- 4. Create session_materials table
CREATE TABLE IF NOT EXISTS public.session_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id),
  title text NOT NULL,
  file_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.session_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view session materials" ON public.session_materials;
CREATE POLICY "Anyone can view session materials" ON public.session_materials
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can upload materials" ON public.session_materials;
CREATE POLICY "Authenticated users can upload materials" ON public.session_materials
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Uploaders can delete their materials" ON public.session_materials;
CREATE POLICY "Uploaders can delete their materials" ON public.session_materials
  FOR DELETE TO authenticated USING (auth.uid() = uploaded_by);

-- 5. Create study_sessions table
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id),
  room_id uuid REFERENCES public.study_rooms(id),
  title text NOT NULL,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  status text DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can view own sessions" ON public.study_sessions;
CREATE POLICY "Teachers can view own sessions" ON public.study_sessions
  FOR SELECT TO authenticated USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can create sessions" ON public.study_sessions;
CREATE POLICY "Teachers can create sessions" ON public.study_sessions
  FOR INSERT TO authenticated WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can update own sessions" ON public.study_sessions;
CREATE POLICY "Teachers can update own sessions" ON public.study_sessions
  FOR UPDATE TO authenticated USING (teacher_id = auth.uid());

-- 6. Create ai_generated_courses table
CREATE TABLE IF NOT EXISTS public.ai_generated_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  topic text NOT NULL,
  difficulty text DEFAULT 'beginner',
  duration text,
  learning_goal text,
  course_data jsonb NOT NULL DEFAULT '{}',
  thumbnail_url text,
  tags text[] DEFAULT '{}',
  status text DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Defensive: older environments may have pre-existing tables without user_id.
ALTER TABLE public.ai_generated_courses
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE public.ai_generated_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own ai courses" ON public.ai_generated_courses;
CREATE POLICY "Users can view own ai courses" ON public.ai_generated_courses
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create ai courses" ON public.ai_generated_courses;
CREATE POLICY "Users can create ai courses" ON public.ai_generated_courses
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own ai courses" ON public.ai_generated_courses;
CREATE POLICY "Users can update own ai courses" ON public.ai_generated_courses
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own ai courses" ON public.ai_generated_courses;
CREATE POLICY "Users can delete own ai courses" ON public.ai_generated_courses
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DO $$
DECLARE
  roles_user_col text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'user_id'
  ) THEN
    roles_user_col := 'user_id';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'id'
  ) THEN
    roles_user_col := 'id';
  ELSE
    RAISE EXCEPTION 'user_roles requires either user_id or id column for role policies';
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS "Admins can view all ai courses" ON public.ai_generated_courses';
  EXECUTE format(
    'CREATE POLICY "Admins can view all ai courses" ON public.ai_generated_courses
       FOR SELECT TO authenticated USING (
         EXISTS (
           SELECT 1 FROM public.user_roles ur
           WHERE ur.%I = auth.uid()
             AND ur.role::text IN (''admin'', ''teacher'')
         )
       )',
    roles_user_col
  );
END $$;

-- 7. Create placement_scores table
CREATE TABLE IF NOT EXISTS public.placement_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  test_type text NOT NULL DEFAULT 'general',
  topic text,
  questions jsonb DEFAULT '[]',
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Defensive: older environments may have pre-existing tables without user_id.
ALTER TABLE public.placement_scores
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE public.placement_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own scores" ON public.placement_scores;
CREATE POLICY "Users can view own scores" ON public.placement_scores
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own scores" ON public.placement_scores;
CREATE POLICY "Users can insert own scores" ON public.placement_scores
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 8. Create room_whiteboard_events table
CREATE TABLE IF NOT EXISTS public.room_whiteboard_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  tool text NOT NULL DEFAULT 'pen',
  points jsonb NOT NULL DEFAULT '[]',
  stroke text DEFAULT '#000000',
  stroke_width integer DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Defensive: older environments may have pre-existing tables without user_id.
ALTER TABLE public.room_whiteboard_events
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE public.room_whiteboard_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view whiteboard events" ON public.room_whiteboard_events;
CREATE POLICY "Anyone can view whiteboard events" ON public.room_whiteboard_events
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can create whiteboard events" ON public.room_whiteboard_events;
CREATE POLICY "Authenticated users can create whiteboard events" ON public.room_whiteboard_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);