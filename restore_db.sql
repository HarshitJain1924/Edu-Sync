
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles (Users)
create table public.profiles (
  id uuid references auth.users not null primary key,
  username text unique,
  full_name text,
  avatar_url text,
  website text,
  role text default 'student' check (role in ('student', 'teacher', 'admin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Videos
create table public.videos (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  url text not null,
  thumbnail_url text,
  duration integer default 0,
  topic text,
  difficulty text,
  tags text[],
  views_count integer default 0,
  likes_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Video Interactions (Likes, Saves)
create table public.video_interactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  video_id uuid references public.videos(id) not null,
  liked boolean default false,
  saved boolean default false,
  rating integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, video_id)
);

-- 4. Video Notes
create table public.video_notes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  video_id uuid references public.videos(id) not null,
  timestamp_seconds integer not null,
  note_text text,
  is_bookmark boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Video Progress
create table public.video_progress (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  video_id uuid references public.videos(id) not null,
  progress_seconds integer default 0,
  completed boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, video_id)
);

-- 6. Quiz Sets
create table public.quiz_sets (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  topic text,
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Quiz Questions
create table public.quiz_questions (
  id uuid default uuid_generate_v4() primary key,
  quiz_id uuid references public.quiz_sets(id) on delete cascade not null,
  question text not null,
  options text[] not null, -- JSONB can also be used, but text[] is simpler
  correct_answer text not null,
  order_index integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Flashcard Sets
create table public.flashcard_sets (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  topic text,
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. Flashcards
create table public.flashcards (
  id uuid default uuid_generate_v4() primary key,
  set_id uuid references public.flashcard_sets(id) on delete cascade not null,
  question text not null,
  answer text not null,
  order_index integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 10. Study Rooms
create table public.study_rooms (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  topic text,
  created_by uuid references public.profiles(id),
  is_active boolean default true,  -- Added is_active to match App code
  max_participants integer default 10,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 10b. Room Participants
create table public.room_participants (
  id uuid default uuid_generate_v4() primary key,
  room_id uuid references public.study_rooms(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  is_online boolean default true,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(room_id, user_id)
);

-- 10c. Room Messages
create table public.room_messages (
  id uuid default uuid_generate_v4() primary key,
  room_id uuid references public.study_rooms(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  message text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Study Rooms
alter table public.study_rooms enable row level security;
create policy "Study rooms are viewable by everyone" on public.study_rooms for select using (true);
create policy "Authenticated users can create rooms" on public.study_rooms for insert with check (auth.role() = 'authenticated');
create policy "Users can update their own rooms" on public.study_rooms for update using (auth.uid() = created_by);

-- RLS for Room Participants
alter table public.room_participants enable row level security;
create policy "Participants are viewable by everyone" on public.room_participants for select using (true);
create policy "Authenticated users can join" on public.room_participants for insert with check (auth.role() = 'authenticated');
create policy "Users can leave (delete)" on public.room_participants for delete using (auth.uid() = user_id);

-- RLS for Room Messages
alter table public.room_messages enable row level security;
create policy "Messages are viewable by everyone in the room" on public.room_messages for select using (true);
create policy "Authenticated users can send messages" on public.room_messages for insert with check (auth.role() = 'authenticated');

-- 11. User Progress (General)
create table public.user_progress (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  content_type text not null, -- 'quiz_set', 'flashcard_set', etc.
  content_id uuid not null,
  progress_data jsonb default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, content_type, content_id)
);

-- 12. User Roles (Explicit table often used in your code)
create table public.user_roles (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  role text not null check (role in ('student', 'teacher', 'admin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS POLICIES (Basic security)
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

-- VIEW for profile_with_role (referenced in AdminDashboard)
create or replace view public.profile_with_role as
select p.id, p.username, p.full_name, p.avatar_url, p.created_at, ur.role
from public.profiles p
left join public.user_roles ur on p.id = ur.user_id;

-- Enable RLS for other tables (Optional but recommended)
alter table public.videos enable row level security;
create policy "Videos are viewable by everyone" on public.videos for select using (true);


alter table public.quiz_sets enable row level security;
create policy "Quizzes are viewable by everyone" on public.quiz_sets for select using (true);

alter table public.quiz_questions enable row level security;
create policy "Quiz questions are viewable by everyone" on public.quiz_questions for select using (true);

alter table public.flashcard_sets enable row level security;
create policy "Flashcards are viewable by everyone" on public.flashcard_sets for select using (true);

alter table public.flashcards enable row level security;
create policy "Flashcard items are viewable by everyone" on public.flashcards for select using (true);


