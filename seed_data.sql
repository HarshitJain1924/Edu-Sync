-- Seed Data for Quizzes and Flashcards

-- Users (Profiles)
-- Assuming you have signed up heavily, we will rely on your user ID. 
-- However, for seeding public content, we can use a temporary admin ID or just allow NULL created_by if the schema allows (it allows NULL).
-- Schema: created_by uuid references public.profiles(id)
-- If we don't know a valid ID, we can insert NULL for created_by since the table definition says: created_by uuid references public.profiles(id)
-- It doesn't say NOT NULL.

-- 1. Insert Quiz Sets
INSERT INTO public.quiz_sets (id, title, description, topic, created_by)
VALUES 
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'General Knowledge', 'Test your general knowledge with this quiz.', 'General', NULL),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Science Basics', 'Fundamental concepts in Physics and Chemistry.', 'Science', NULL),
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'World History', 'Key events that shaped the modern world.', 'History', NULL)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Quiz Questions
INSERT INTO public.quiz_questions (quiz_id, question, options, correct_answer, order_index)
VALUES
  -- General Knowledge
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'What is the capital of France?', ARRAY['London', 'Berlin', 'Paris', 'Madrid'], 'Paris', 0),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Which planet is known as the Red Planet?', ARRAY['Venus', 'Mars', 'Jupiter', 'Saturn'], 'Mars', 1),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Who painted the Mona Lisa?', ARRAY['Van Gogh', 'Picasso', 'Leonardo da Vinci', 'Michelangelo'], 'Leonardo da Vinci', 2),
  
  -- Science Basics
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'What is the chemical symbol for Gold?', ARRAY['Ag', 'Fe', 'Au', 'Cu'], 'Au', 0),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'What is the speed of light?', ARRAY['300,000 km/s', '150,000 km/s', '1,000 km/s', 'Sound speed'], '300,000 km/s', 1),
  
  -- World History
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'In which year did World War II end?', ARRAY['1918', '1939', '1945', '1955'], '1945', 0)
ON CONFLICT DO NOTHING; -- No primary key conflict check on insert without ID unless we specify IDs, but we let uuid_generate_v4() handle them. Re-running might duplicate questions if not careful, but for seed it's fine.

-- 3. Insert Flashcard Sets
INSERT INTO public.flashcard_sets (id, title, description, topic, created_by)
VALUES
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'Spanish Vocabulary', 'Common words and phrases in Spanish.', 'Language', NULL),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', 'Periodic Table', 'Elements and their symbols.', 'Chemistry', NULL)
ON CONFLICT (id) DO NOTHING;

-- 4. Insert Flashcards
INSERT INTO public.flashcards (set_id, question, answer, order_index)
VALUES
  -- Spanish Vocabulary
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'Hello', 'Hola', 0),
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'Thank you', 'Gracias', 1),
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'Please', 'Por favor', 2),
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'Good morning', 'Buenos días', 3),
  
  -- Periodic Table
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', 'Hydrogen', 'H', 0),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', 'Helium', 'He', 1),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', 'Oxygen', 'O', 2)
ON CONFLICT DO NOTHING;
