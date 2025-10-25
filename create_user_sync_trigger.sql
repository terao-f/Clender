-- auth.usersにユーザーが作成されたときに、自動的にusersテーブルにもレコードを作成するトリガー

-- トリガー関数の作成
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    name,
    name_kana,
    employee_id,
    phone,
    department,
    role,
    default_work_days,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    COALESCE(new.raw_user_meta_data->>'full_name_kana', 'ユーザー'),
    COALESCE(new.raw_user_meta_data->>'employee_id', 'EMP' || substring(new.id::text, 1, 8)),
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    COALESCE(new.raw_user_meta_data->>'department', '未設定'),
    COALESCE(new.raw_user_meta_data->>'role', 'member'),
    COALESCE(
      (new.raw_user_meta_data->'default_work_days')::jsonb,
      '[1,2,3,4,5]'::jsonb
    ),
    new.created_at,
    new.created_at
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 既存のトリガーを削除（存在する場合）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- トリガーの作成
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- トリガーが正しく作成されたか確認
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users';