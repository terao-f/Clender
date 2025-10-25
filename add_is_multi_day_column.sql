-- Add is_multi_day column to schedules table
ALTER TABLE schedules 
ADD COLUMN IF NOT EXISTS is_multi_day BOOLEAN DEFAULT FALSE;

-- Update existing multi-day schedules
UPDATE schedules 
SET is_multi_day = TRUE
WHERE DATE(end_time) > DATE(start_time);

-- Add comment for clarity
COMMENT ON COLUMN schedules.is_multi_day IS 'Indicates if the schedule spans multiple days';