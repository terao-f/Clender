-- 1. usersテーブルから最初のユーザーを取得（テスト用）
SELECT id, name, email, role
FROM users
LIMIT 5;

-- 2. adminまたはpresidentロールを持つユーザーを確認
SELECT id, name, email, role
FROM users
WHERE role IN ('admin', 'president')
LIMIT 5;

-- 3. auth.usersテーブルの全ユーザーを確認
SELECT id, email
FROM auth.users
LIMIT 5;