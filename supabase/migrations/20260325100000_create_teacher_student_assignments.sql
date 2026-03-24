-- Maps students to teachers so teacher dashboards and quiz visibility are scoped.
create table if not exists public.teacher_student_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (teacher_id, student_id)
);

create index if not exists idx_teacher_student_assignments_teacher
  on public.teacher_student_assignments (teacher_id);

create index if not exists idx_teacher_student_assignments_student
  on public.teacher_student_assignments (student_id);

alter table public.teacher_student_assignments enable row level security;

-- Admins can create, update and remove mappings.
drop policy if exists "Admins manage teacher student assignments" on public.teacher_student_assignments;
DO $$
DECLARE
  roles_user_col text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'user_id'
  ) THEN
    roles_user_col := 'user_id';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'id'
  ) THEN
    roles_user_col := 'id';
  ELSE
    RAISE EXCEPTION 'user_roles requires either user_id or id column for role policies';
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS "Admins manage teacher student assignments" ON public.teacher_student_assignments';
  EXECUTE format(
    'CREATE POLICY "Admins manage teacher student assignments"
       ON public.teacher_student_assignments
       FOR ALL TO authenticated
       USING (
         EXISTS (
           SELECT 1 FROM public.user_roles ur
           WHERE ur.%I = auth.uid()
             AND ur.role::text = ''admin''
         )
       )
       WITH CHECK (
         EXISTS (
           SELECT 1 FROM public.user_roles ur
           WHERE ur.%I = auth.uid()
             AND ur.role::text = ''admin''
         )
       )',
    roles_user_col,
    roles_user_col
  );
END $$;

-- Teachers can read only their own assignments.
drop policy if exists "Teachers read own assigned students" on public.teacher_student_assignments;
create policy "Teachers read own assigned students"
  on public.teacher_student_assignments
  for select
  to authenticated
  using (teacher_id = auth.uid());

-- Students can read their own assignment rows (for quiz filtering by teacher).
drop policy if exists "Students read own assignments" on public.teacher_student_assignments;
create policy "Students read own assignments"
  on public.teacher_student_assignments
  for select
  to authenticated
  using (student_id = auth.uid());
