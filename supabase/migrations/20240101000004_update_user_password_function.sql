-- パスワード更新用のRPC関数を作成
-- 社長権限または管理者権限のユーザーのみが他のユーザーのパスワードを変更可能

CREATE OR REPLACE FUNCTION update_user_password(
  user_id UUID,
  new_password TEXT
) RETURNS VOID AS $$
DECLARE
  current_user_role TEXT;
BEGIN
  -- 現在のユーザーの権限を取得
  SELECT role INTO current_user_role
  FROM users
  WHERE id = auth.uid();
  
  -- 社長または管理者権限チェック
  IF current_user_role != 'president' AND current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: Only president or admin can update passwords';
  END IF;
  
  -- パスワードを更新（Supabase Authのユーザー）
  -- 注意: この関数はSupabase Auth Admin APIを使用する必要があるため、
  -- 実際の実装ではEdge Functionを使用することを推奨
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = user_id;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 関数の権限設定
GRANT EXECUTE ON FUNCTION update_user_password TO authenticated;