
-- usersテーブルの構造を確認
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- is_hrカラムが存在しない場合は追加
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'is_hr'
    ) THEN
        ALTER TABLE users ADD COLUMN is_hr BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'is_hr column added successfully';
    ELSE
        RAISE NOTICE 'is_hr column already exists';
    END IF;
END $$;