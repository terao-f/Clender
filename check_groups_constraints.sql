-- 1. groupsテーブルの全ての制約を確認
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'groups'::regclass;

-- 2. インデックスを確認
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'groups';

-- 3. トリガーを確認
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'groups';

-- 4. 最近のグループデータを確認（IDの形式をチェック）
SELECT 
  id,
  name,
  type,
  created_by,
  created_at,
  LENGTH(id::text) as id_length
FROM groups
ORDER BY created_at DESC
LIMIT 5;

-- 5. 重複している可能性のあるグループ名を確認
SELECT 
  name,
  COUNT(*) as count
FROM groups
GROUP BY name
HAVING COUNT(*) > 1;