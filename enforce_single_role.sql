-- 1. CLEANUP: Keep only one role per user
-- Priority: Admin > Teacher > Student
-- We will use a temporary table or CTE logic to identifying which row to keep.

-- Create a temporary table to store the 'best' role for each user
CREATE TEMP TABLE user_best_roles AS
SELECT DISTINCT ON (user_id) user_id, role
FROM public.user_roles
ORDER BY user_id, 
  CASE role 
    WHEN 'admin' THEN 1 
    WHEN 'teacher' THEN 2 
    ELSE 3 
  END;

-- Delete ALL roles
TRUNCATE public.user_roles;

-- Re-insert only the best roles
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, role FROM user_best_roles;

-- 2. CONSTRAINT: Enforce one role per user
-- First, drop the constraint we added in the previous step (if it exists)
ALTER TABLE public.user_roles 
DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;

-- Now add a constraint that ensures user_id is unique
ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);

-- 3. SYNC: Update profiles table to match (optional but good for consistency)
UPDATE public.profiles p
SET role = ur.role
FROM public.user_roles ur
WHERE p.id = ur.user_id;
