-- Migration: Add questions column to placement_scores table
-- Run this in Supabase SQL Editor

ALTER TABLE placement_scores
ADD COLUMN IF NOT EXISTS questions jsonb;
