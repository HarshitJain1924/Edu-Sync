-- Add realtime functionality
begin;
  -- Enable access to the realtime schema
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;

-- Add tables to the publication
alter publication supabase_realtime add table public.room_participants;
alter publication supabase_realtime add table public.room_messages;
