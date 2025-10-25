-- 開発者用ログインデータ
-- このSQLを実行すると、開発・テスト用のユーザーアカウントが作成されます

-- 既存のテストデータを削除（本番環境では実行しないでください）
DELETE FROM users WHERE email LIKE '%@example.com';

-- 開発者用アカウント
INSERT INTO users (employee_id, name, name_kana, email, password, phone, department, role, default_work_days) VALUES
-- 管理者アカウント
('DEV001', '開発管理者', 'カイハツカンリシャ', 'admin@example.com', 'admin123', '080-0000-0001', '開発部', 'admin', ARRAY[1,2,3,4,5]),

-- 一般ユーザーアカウント
('DEV002', '開発太郎', 'カイハツタロウ', 'dev1@example.com', 'dev123', '080-0000-0002', '開発部', 'member', ARRAY[1,2,3,4,5]),
('DEV003', '開発花子', 'カイハツハナコ', 'dev2@example.com', 'dev123', '080-0000-0003', '開発部', 'member', ARRAY[1,2,3,4,5]),

-- 人事部アカウント
('HR001', '人事部長', 'ジンジブチョウ', 'hr@example.com', 'hr123', '080-0000-0004', '人事部', 'hr', ARRAY[1,2,3,4,5]),

-- 社長アカウント
('PRES001', '社長太郎', 'シャチョウタロウ', 'president@example.com', 'president123', '080-0000-0005', '経営企画部', 'president', ARRAY[1,2,3,4,5]),

-- 異なる部署のテストユーザー
('TEST001', '営業一郎', 'エイギョウイチロウ', 'sales1@example.com', 'test123', '080-0000-0006', '営業部', 'member', ARRAY[1,2,3,4,5]),
('TEST002', '営業二郎', 'エイギョウジロウ', 'sales2@example.com', 'test123', '080-0000-0007', '営業部', 'member', ARRAY[1,2,3,4,5]),
('TEST003', '経理三郎', 'ケイリサブロウ', 'accounting@example.com', 'test123', '080-0000-0008', '経理部', 'member', ARRAY[1,2,3,4,5]),
('TEST004', '総務四郎', 'ソウムシロウ', 'general@example.com', 'test123', '080-0000-0009', '総務部', 'member', ARRAY[1,2,3,4,5]),

-- パートタイムのテストユーザー（週3日勤務）
('PART001', 'パート花子', 'パートハナコ', 'part1@example.com', 'test123', '080-0000-0010', '営業部', 'member', ARRAY[1,3,5]),
('PART002', 'パート太郎', 'パートタロウ', 'part2@example.com', 'test123', '080-0000-0011', '総務部', 'member', ARRAY[2,3,4]);

-- ログイン情報一覧
SELECT 
  name as "名前",
  email as "メールアドレス",
  password as "パスワード",
  role as "権限",
  department as "部署"
FROM users 
WHERE email LIKE '%@example.com'
ORDER BY 
  CASE role 
    WHEN 'president' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'hr' THEN 3
    ELSE 4
  END,
  employee_id;