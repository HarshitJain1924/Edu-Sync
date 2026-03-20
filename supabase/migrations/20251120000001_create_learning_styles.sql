-- Create learning_styles table to store student learning style assessment results
CREATE TABLE public.learning_styles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  primary_style TEXT NOT NULL,
  secondary_style TEXT,
  visual_score INTEGER NOT NULL DEFAULT 0,
  auditory_score INTEGER NOT NULL DEFAULT 0,
  kinesthetic_score INTEGER NOT NULL DEFAULT 0,
  reading_writing_score INTEGER NOT NULL DEFAULT 0,
  quiz_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.learning_styles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for learning_styles
CREATE POLICY "Users can view their own learning style"
  ON public.learning_styles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Teachers can view all learning styles"
  ON public.learning_styles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'teacher'
    )
  );

CREATE POLICY "Admins can view all learning styles"
  ON public.learning_styles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can insert their own learning style"
  ON public.learning_styles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own learning style"
  ON public.learning_styles FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_learning_styles_updated_at
  BEFORE UPDATE ON public.learning_styles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
