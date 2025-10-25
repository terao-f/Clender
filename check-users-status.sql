-- 現在のユーザー状況を確認するSQLクエリ
-- SupabaseのSQL Editorで実行してください

-- 1. heartssh950@gmail.com の現在の状況
SELECT 
  id, 
  email, 
  role, 
  name,
  created_at
FROM users 
WHERE email = 'heartssh950@gmail.com';

-- 2. terao.form@gmail.com の現在の状況
SELECT 
  id, 
  email, 
  role, 
  name,
  created_at
FROM users 
WHERE email = 'terao.form@gmail.com';

-- 3. 管理者ロールのユーザー一覧
SELECT 
  id, 
  email, 
  role, 
  name,
  created_at
FROM users 
WHERE role = 'admin'
ORDER BY created_at DESC;

-- 4. 全ユーザー一覧（最初の20件）
SELECT 
  id, 
  email, 
  role, 
  name,
  created_at
FROM users 
ORDER BY created_at DESC
LIMIT 20;

-- 5. ユーザーテーブルの構造確認
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
