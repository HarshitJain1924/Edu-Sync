-- Run this in your Supabase SQL Editor to support the new Google Meet / Zoom style Study Room features

-- 1. Add Host tracking to study rooms
ALTER TABLE public.study_rooms
ADD COLUMN IF NOT EXISTS host_id UUID REFERENCES public.profiles(id) DEFAULT NULL;

-- 2. Add rich participant tracking
ALTER TABLE public.room_participants
ADD COLUMN IF NOT EXISTS mic_on BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS camera_on BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS screen_sharing BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT current_timestamp;

-- 3. Create whiteboard events table for drawing persistence
CREATE TABLE IF NOT EXISTS public.room_whiteboard_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.study_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    stroke JSONB NOT NULL,
    color TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Add Room Code for easy joining shortcodes
ALTER TABLE public.study_rooms
ADD COLUMN IF NOT EXISTS room_code TEXT UNIQUE;

-- Note: Ensure Realtime is enabled for the 'room_whiteboard_events' and 'room_participants' tables so Broadcasts and CDC work correctly!
