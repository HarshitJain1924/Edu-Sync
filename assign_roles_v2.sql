
-- Fix Admin User
DO $$
DECLARE
  admin_uid UUID;
BEGIN
  -- Get the UUID for admin@gmail.com
  SELECT id INTO admin_uid FROM auth.users WHERE email = 'admin@gmail.com';

  IF admin_uid IS NOT NULL THEN
    -- 1. Ensure Profile Exists
    INSERT INTO public.profiles (id, username, role)
    VALUES (admin_uid, 'AdminUser', 'admin')
    ON CONFLICT (id) DO UPDATE 
    SET role = 'admin', username = 'AdminUser';

    -- 2. Assign Role in user_roles (Check if exists first to avoid duplicate errors if constraints are loose)
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = admin_uid AND role = 'admin') THEN
        INSERT INTO public.user_roles (user_id, role) VALUES (admin_uid, 'admin');
    END IF;
  END IF;
END $$;

-- Fix Teacher User
DO $$
DECLARE
  teacher_uid UUID;
BEGIN
  -- Get the UUID for teacher@gmail.com
  SELECT id INTO teacher_uid FROM auth.users WHERE email = 'teacher@gmail.com';

  IF teacher_uid IS NOT NULL THEN
    -- 1. Ensure Profile Exists
    INSERT INTO public.profiles (id, username, role)
    VALUES (teacher_uid, 'TeacherUser', 'teacher')
    ON CONFLICT (id) DO UPDATE 
    SET role = 'teacher', username = 'TeacherUser';

    -- 2. Assign Role in user_roles
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = teacher_uid AND role = 'teacher') THEN
        INSERT INTO public.user_roles (user_id, role) VALUES (teacher_uid, 'teacher');
    END IF;
  END IF;
END $$;
