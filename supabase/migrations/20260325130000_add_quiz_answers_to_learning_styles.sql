-- Add quiz_answers column to learning_styles table if it doesn't exist
ALTER TABLE learning_styles
ADD COLUMN IF NOT EXISTS quiz_answers JSONB DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN learning_styles.quiz_answers IS 'Stores the raw quiz answers for audit/detailed analysis';
