-- 1. groupsテーブルの構造を確認
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'groups'
ORDER BY ordinal_position;

-- 2. groupsテーブルの制約を確認
SELECT 
  tc.constraint_name, 
  tc.constraint_type, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'groups';

-- 3. RLSポリシーを確認
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'groups';

-- 4. RLSが有効か確認
SELECT 
  schemaname,
  tablename,
  rowsecurity,
  forcerowsecurity
FROM pg_tables
WHERE tablename = 'groups';

-- 5. 既存のグループを確認
SELECT id, name, type, created_by, created_at
FROM groups
ORDER BY created_at DESC
LIMIT 10;