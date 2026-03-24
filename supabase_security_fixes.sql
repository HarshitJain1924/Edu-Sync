-- Fix: Security Definer View
-- This changes the views to run with the privileges of the user invoking them,
-- rather than the user who created them (security definer), which is safer.
ALTER VIEW public.sessions_with_teacher SET (security_invoker = on);
ALTER VIEW public.profile_with_role SET (security_invoker = on);

-- Fix: RLS Disabled in Public
-- This enables Row Level Security on tables that are currently exposed to the public schema
-- Note: Make sure you have appropriate RLS policies (CREATE POLICY) on these tables 
-- so that users can still access the data they need after enabling RLS.
ALTER TABLE public.video_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_whiteboard_events ENABLE ROW LEVEL SECURITY;
