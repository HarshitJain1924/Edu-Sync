-- Migration: Create placement_scores table for tracking quiz/test results
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS placement_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  score integer NOT NULL,
  total integer NOT NULL,
  test_type text NOT NULL,       -- 'topic', 'company', 'mock'
  topic text,                    -- 'DSA', 'OS', 'TCS Digital / NQT', etc.
  time_taken integer,            -- seconds taken to complete
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE placement_scores ENABLE ROW LEVEL SECURITY;

-- Users can insert their own scores
CREATE POLICY "Users can insert own scores"
  ON placement_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Everyone can view all scores (for leaderboard)
CREATE POLICY "Users can view all scores"
  ON placement_scores FOR SELECT
  USING (true);

-- Index for faster user queries
CREATE INDEX IF NOT EXISTS idx_placement_scores_user
  ON placement_scores (user_id, created_at DESC);
