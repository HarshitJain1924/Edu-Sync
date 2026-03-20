-- Allow teachers to view all user progress for analytics
CREATE POLICY "Teachers can view all user progress"
  ON public.user_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'teacher'
    )
  );
