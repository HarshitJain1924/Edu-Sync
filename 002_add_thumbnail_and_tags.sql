-- Migration: Add thumbnail_url and tags columns to ai_generated_courses
ALTER TABLE public.ai_generated_courses
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

ALTER TABLE public.ai_generated_courses
ADD COLUMN IF NOT EXISTS tags TEXT[];
