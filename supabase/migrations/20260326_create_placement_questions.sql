-- Create placement_questions table for centralized question bank storage
CREATE TABLE IF NOT EXISTS placement_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company TEXT NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL, -- Array of strings
  correct_answer TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium', -- easy, medium, hard, placement
  explanation TEXT,
  topic TEXT, -- Optional: for future topic-based filtering
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for efficient querying
  CONSTRAINT valid_difficulty CHECK (difficulty IN ('easy', 'medium', 'hard', 'placement'))
);

-- Create index on company and difficulty for fast queries
CREATE INDEX idx_placement_questions_company_difficulty ON placement_questions(company, difficulty);
CREATE INDEX idx_placement_questions_company ON placement_questions(company);
CREATE INDEX idx_placement_questions_created_at ON placement_questions(created_at DESC);
CREATE UNIQUE INDEX idx_placement_questions_unique_company_question ON placement_questions(company, question);

-- Enable RLS (Row Level Security)
ALTER TABLE placement_questions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Everyone can read (students/teachers can consume)
CREATE POLICY "Anyone can read placement questions" 
  ON placement_questions 
  FOR SELECT 
  USING (true);

-- RLS Policy: Only admins can insert
CREATE POLICY "Only admins can insert placement questions"
  ON placement_questions
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- RLS Policy: Only admins can update
CREATE POLICY "Only admins can update placement questions"
  ON placement_questions
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- RLS Policy: Only admins can delete
CREATE POLICY "Only admins can delete placement questions"
  ON placement_questions
  FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );
