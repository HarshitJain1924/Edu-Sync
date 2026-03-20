-- Create ai_generated_courses table
CREATE TABLE IF NOT EXISTS public.ai_generated_courses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    topic TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    duration TEXT NOT NULL,
    learning_goal TEXT NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'community', 'official', 'private')),
    modules JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.ai_generated_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view community and official courses" 
ON public.ai_generated_courses FOR SELECT 
USING (status IN ('community', 'official'));

CREATE POLICY "Users can view their own courses" 
ON public.ai_generated_courses FOR SELECT 
USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own courses" 
ON public.ai_generated_courses FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own courses" 
ON public.ai_generated_courses FOR UPDATE 
USING (auth.uid() = created_by);

CREATE POLICY "Admins can update any course" 
ON public.ai_generated_courses FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);
