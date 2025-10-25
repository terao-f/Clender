-- 1. テーブルの現在の構造を確認
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. is_hrカラムが存在しない場合は追加
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'is_hr'
    ) THEN
        ALTER TABLE public.users ADD COLUMN is_hr BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'is_hr column added successfully';
    ELSE
        RAISE NOTICE 'is_hr column already exists';
    END IF;
END $$;

-- 3. 既存のユーザーでis_hrがNULLの場合はFALSEに設定
UPDATE public.users 
SET is_hr = FALSE 
WHERE is_hr IS NULL;

-- 4. 結果を確認
SELECT id, name, email, role, is_hr
FROM public.users
ORDER BY name;