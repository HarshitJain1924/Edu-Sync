-- 1. FIX: Assign 'student' role to the specific missing user
-- Replace 'student@gmail.com' with the exact email you added if different.
DO $$
DECLARE
  target_email text := 'student@gmail.com'; 
  target_user_id uuid;
BEGIN
  -- Get the user ID from auth.users (Supabase internal table)
  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;

  IF target_user_id IS NULL THEN
    RAISE NOTICE 'User % not found in auth.users', target_email;
    RETURN;
  END IF;

  -- Ensure profile exists (manually added users might miss the trigger)
  INSERT INTO public.profiles (id, username, full_name, role)
  VALUES (
    target_user_id, 
    split_part(target_email, '@', 1), -- username from email
    'Student User', -- default name
    'student'
  )
  ON CONFLICT (id) DO UPDATE SET role = 'student';

  -- Add to user_roles table (This is likely what connects to your Dashboard view)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'student')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Successfully assigned student role to %', target_email;
END $$;


-- 2. AUTOMATION: Create a Trigger to automatically handle this in the future
-- This ensures every new user automatically gets a 'student' role in the user_roles table.

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER AS $$
BEGIN
  -- default to student role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if trigger exists before creating to avoid errors in repeated runs
DROP TRIGGER IF EXISTS on_auth_user_role_created ON public.profiles;

CREATE TRIGGER on_auth_user_role_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();
