-- Fix missing column in study_rooms table
ALTER TABLE public.study_rooms 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Ensure the column is visible/usable (grant permissions if needed, though usually automatic for owner)
-- Force usage of this column for existing rows
UPDATE public.study_rooms SET is_active = true WHERE is_active IS NULL;
