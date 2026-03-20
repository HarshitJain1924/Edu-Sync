-- 1. Ensure learning_styles table exists
-- Modified to reference public.profiles for easier joining
CREATE TABLE IF NOT EXISTS public.learning_styles (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    primary_style TEXT NOT NULL,
    secondary_style TEXT,
    visual_score INTEGER DEFAULT 0,
    auditory_score INTEGER DEFAULT 0,
    kinesthetic_score INTEGER DEFAULT 0,
    reading_writing_score INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- If table already existed, ensure the FK points to profiles
ALTER TABLE public.learning_styles 
    DROP CONSTRAINT IF EXISTS learning_styles_user_id_fkey,
    ADD CONSTRAINT learning_styles_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Add is_active to study_rooms if missing (Safe check)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='study_rooms' AND column_name='is_active') THEN
        ALTER TABLE public.study_rooms ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- 3. Enable RLS on required tables
ALTER TABLE public.learning_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for learning_styles
DROP POLICY IF EXISTS "Users can manage their own learning styles" ON public.learning_styles;
CREATE POLICY "Users can manage their own learning styles" 
    ON public.learning_styles FOR ALL 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Teachers can view all student learning styles" ON public.learning_styles;
CREATE POLICY "Teachers can view all student learning styles" 
    ON public.learning_styles FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role IN ('teacher', 'admin')
    ));

-- 5. Enhanced RLS for user_progress 
-- (Assuming user_progress already has basic user-level RLS)
DROP POLICY IF EXISTS "Teachers can view student progress" ON public.user_progress;
CREATE POLICY "Teachers can view student progress" 
    ON public.user_progress FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role IN ('teacher', 'admin')
    ));

-- 6. RLS for flashcard_sets (Fixes "Violates RLS policy" error)
ALTER TABLE public.flashcard_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own flashcards" ON public.flashcard_sets;
CREATE POLICY "Users can manage their own flashcards" 
    ON public.flashcard_sets FOR ALL 
    USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Anyone can view flashcards" ON public.flashcard_sets;
CREATE POLICY "Anyone can view flashcards" 
    ON public.flashcard_sets FOR SELECT 
    TO authenticated 
    USING (true);

-- 7. RLS for quiz_sets
ALTER TABLE public.quiz_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can manage their own quizzes" ON public.quiz_sets;
CREATE POLICY "Teachers can manage their own quizzes" 
    ON public.quiz_sets FOR ALL 
    USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Anyone can view quizzes" ON public.quiz_sets;
CREATE POLICY "Anyone can view quizzes" 
    ON public.quiz_sets FOR SELECT 
    TO authenticated 
    USING (true);

-- 8. RLS for quiz_questions
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can manage their own quiz questions" ON public.quiz_questions;
CREATE POLICY "Teachers can manage their own quiz questions" 
    ON public.quiz_questions FOR ALL 
    USING (EXISTS (
        SELECT 1 FROM public.quiz_sets 
        WHERE id = quiz_id AND created_by = auth.uid()
    ));

DROP POLICY IF EXISTS "Anyone can view quiz questions" ON public.quiz_questions;
CREATE POLICY "Anyone can view quiz questions" 
    ON public.quiz_questions FOR SELECT 
    TO authenticated 
    USING (true);

-- 9. RLS Policies for Visibility Fixes
-- room_participants
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view participants in their rooms" ON public.room_participants;
DROP POLICY IF EXISTS "Anyone can view room participants" ON public.room_participants;
CREATE POLICY "Anyone can view room participants" 
    ON public.room_participants FOR SELECT 
    TO authenticated 
    USING (true);

-- study_rooms (ensures teacher can join even if not creator)
ALTER TABLE public.study_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active study rooms" ON public.study_rooms;
CREATE POLICY "Anyone can view active study rooms" 
    ON public.study_rooms FOR SELECT 
    TO authenticated 
    USING (true);

-- profiles (ensures usernames are visible in joins)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
    ON public.profiles FOR SELECT 
    TO authenticated 
    USING (true);

-- 10. Session Materials & Storage (God Mode Fix)
-- Ensure bucket exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('session-materials', 'session-materials', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies: Extremely permissive for debugging
DROP POLICY IF EXISTS "Anyone can view materials" ON storage.objects;
CREATE POLICY "Anyone can view materials" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'session-materials');

DROP POLICY IF EXISTS "Authenticated users can upload materials" ON storage.objects;
CREATE POLICY "Authenticated users can upload materials" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'session-materials');

DROP POLICY IF EXISTS "Authenticated users can delete materials" ON storage.objects;
CREATE POLICY "Authenticated users can delete materials" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'session-materials');

-- session_materials Table Policies: Extremely permissive for debugging
ALTER TABLE public.session_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view materials in their room" ON public.session_materials;
CREATE POLICY "Anyone can view materials in their room" 
ON public.session_materials FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Teachers can upload materials" ON public.session_materials;
CREATE POLICY "Teachers can upload materials" 
ON public.session_materials FOR INSERT 
TO authenticated 
WITH CHECK (true);

DROP POLICY IF EXISTS "Teachers can delete materials" ON public.session_materials;
CREATE POLICY "Teachers can delete materials" 
ON public.session_materials FOR DELETE 
TO authenticated 
USING (auth.uid() = uploaded_by OR EXISTS (
  SELECT 1 FROM public.study_rooms 
  WHERE id = session_materials.room_id AND (created_by = auth.uid() OR host_id = auth.uid())
));

-- FIX: Update any old records that had a space in the bucket name
-- Handles both raw spaces and URL-encoded spaces
UPDATE public.session_materials 
SET file_url = REPLACE(REPLACE(file_url, 'session%20materials', 'session-materials'), 'session materials', 'session-materials')
WHERE file_url LIKE '%session%20materials%' OR file_url LIKE '%session materials%';

-- 11. Enable Realtime for Materials
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.session_materials;
