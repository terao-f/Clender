-- 1. auth.usersテーブルの全ユーザーを確認
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;

-- 2. usersテーブルの全ユーザーを確認
SELECT 
  id,
  name,
  email,
  role,
  created_at
FROM users
ORDER BY created_at DESC;

-- 3. auth.usersに存在するがusersテーブルに存在しないユーザーを確認
SELECT 
  au.id,
  au.email,
  au.created_at
FROM auth.users au
LEFT JOIN users u ON au.id = u.id
WHERE u.id IS NULL;

-- 4. usersテーブルに存在するがauth.usersに存在しないユーザーを確認（通常は発生しないはず）
SELECT 
  u.id,
  u.name,
  u.email,
  u.created_at
FROM users u
LEFT JOIN auth.users au ON u.id = au.id
WHERE au.id IS NULL;

-- 5. 特定のIDがusersテーブルに存在するか確認
SELECT EXISTS(
  SELECT 1 
  FROM users 
  WHERE id = '550e8400-e29b-41d4-a716-446655440001'
) as user_exists;