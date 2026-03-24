-- Fix RLS for quiz/flashcard progress writes and teacher visibility.
-- This resolves "new row violates row-level security policy for table user_progress".

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

-- Remove known conflicting policies from older migrations.
DROP POLICY IF EXISTS "Users can view their own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can insert their own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can update their own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can delete their own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can manage their own progress" ON public.user_progress;
DROP POLICY IF EXISTS "Teachers can view student progress" ON public.user_progress;
DROP POLICY IF EXISTS "Teachers/Admins can view student progress" ON public.user_progress;

-- Authenticated users can fully manage only their own progress rows.
CREATE POLICY "Users can view their own progress"
  ON public.user_progress
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress"
  ON public.user_progress
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress"
  ON public.user_progress
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own progress"
  ON public.user_progress
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Teachers/admins can read student progress.
-- Uses schema-tolerant role-column detection for user_roles (user_id vs id).
DO $$
DECLARE
  roles_user_col text;
  teacher_scope_clause text;
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

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'teacher_student_assignments'
  ) THEN
    teacher_scope_clause := '(
      EXISTS (
        SELECT 1
        FROM public.teacher_student_assignments tsa
        WHERE tsa.teacher_id = auth.uid()
          AND tsa.student_id = public.user_progress.user_id
      )
      OR public.user_progress.user_id = auth.uid()
    )';
  ELSE
    -- Fallback for older environments without assignment table.
    teacher_scope_clause := 'true';
  END IF;

  EXECUTE format(
    'CREATE POLICY "Teachers/Admins can view student progress"
       ON public.user_progress
       FOR SELECT TO authenticated
       USING (
         EXISTS (
           SELECT 1
           FROM public.user_roles ur
           WHERE ur.%1$I = auth.uid()
             AND ur.role::text = ''admin''
         )
         OR (
           EXISTS (
             SELECT 1
             FROM public.user_roles ur
             WHERE ur.%1$I = auth.uid()
               AND ur.role::text = ''teacher''
           )
           AND %2$s
         )
       )',
    roles_user_col,
    teacher_scope_clause
  );
END $$;
