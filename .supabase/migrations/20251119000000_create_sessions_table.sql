-- Create sessions table for scheduled study sessions
CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  title TEXT NOT NULL,
  description TEXT,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  max_participants INTEGER,
  study_room_id UUID REFERENCES public.study_rooms(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled'))
);

-- Create session_participants table for tracking who's enrolled
CREATE TABLE public.session_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  UNIQUE(session_id, user_id)
);

-- Enable RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sessions
CREATE POLICY "Anyone can view sessions"
  ON public.sessions FOR SELECT
  USING (true);

CREATE POLICY "Admins and teachers can create sessions"
  ON public.sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'teacher')
    )
  );

CREATE POLICY "Admins and teachers can update sessions"
  ON public.sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'teacher')
    )
  );

CREATE POLICY "Admins can delete sessions"
  ON public.sessions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for session_participants
CREATE POLICY "Users can view their own session enrollments"
  ON public.session_participants FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can enroll in sessions"
  ON public.session_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unenroll from sessions"
  ON public.session_participants FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_sessions_scheduled_time ON public.sessions(scheduled_time);
CREATE INDEX idx_sessions_teacher_id ON public.sessions(teacher_id);
CREATE INDEX idx_sessions_status ON public.sessions(status);
CREATE INDEX idx_session_participants_session_id ON public.session_participants(session_id);
CREATE INDEX idx_session_participants_user_id ON public.session_participants(user_id);

-- Create a view for sessions with teacher info
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
