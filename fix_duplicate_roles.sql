-- 1. Remove duplicate roles for the same user
-- Keeps the oldest assignment (lowest ID) and deletes newer duplicates
DELETE FROM public.user_roles a
USING public.user_roles b
WHERE a.id > b.id
AND a.user_id = b.user_id
AND a.role = b.role;

-- 2. Add Unique Constraint
-- This prevents future duplicates from being created
ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
