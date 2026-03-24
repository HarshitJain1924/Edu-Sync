-- Allow teacher note uploads without binding to a specific room.
ALTER TABLE public.session_materials
  ALTER COLUMN room_id DROP NOT NULL;
