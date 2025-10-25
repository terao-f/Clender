import { useState, useEffect } from 'react';
import { Bell, Mail, Smartphone, Clock, Save, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface NotificationSettings {
  id?: string;
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  reminderNotifications: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export default function NotificationSettings() {
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>({
    userId: currentUser?.id || '',
    emailNotifications: true,
    pushNotifications: true,
    reminderNotifications: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 設定を読み込み
  useEffect(() => {
    if (currentUser?.id) {
      fetchSettings();
    }
  }, [currentUser]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_notification_settings')
        .select('*')
        .eq('user_id', currentUser?.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching notification settings:', error);
        toast.error('通知設定の読み込みに失敗しました');
        return;
      }

      if (data) {
        setSettings({
          id: data.id,
          userId: data.user_id,
          emailNotifications: data.email_notifications,
          pushNotifications: data.push_notifications,
          reminderNotifications: data.reminder_notifications,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at)
        });
      }
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      toast.error('通知設定の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key: keyof NotificationSettings, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!currentUser?.id) {
      toast.error('ユーザー情報が見つかりません');
      return;
    }

    try {
      setSaving(true);
      
      const settingsData = {
        user_id: currentUser.id,
        email_notifications: settings.emailNotifications,
        push_notifications: settings.pushNotifications,
        reminder_notifications: settings.reminderNotifications
      };

      if (settings.id) {
        // 更新
        const { error } = await supabase
          .from('user_notification_settings')
          .update(settingsData)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        // 新規作成
        const { error } = await supabase
          .from('user_notification_settings')
          .insert(settingsData);

        if (error) throw error;
      }

      toast.success('通知設定を保存しました');
      setHasChanges(false);
      await fetchSettings(); // 最新の設定を再読み込み
    } catch (error: any) {
      console.error('Error saving notification settings:', error);
      toast.error(`設定の保存に失敗しました: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          {/* ヘッダー */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Bell className="h-6 w-6 text-indigo-600 mr-3" />
                <h1 className="text-2xl font-bold text-gray-900">通知設定</h1>
              </div>
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                  hasChanges && !saving
                    ? 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                {saving ? (
                  <>
                    <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    保存
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 設定内容 */}
          <div className="px-6 py-6">
            <div className="space-y-8">
              {/* メール通知設定 */}
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <Mail className="h-5 w-5 text-blue-600 mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">メール通知</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  スケジュールの作成・更新・削除時にメール通知を受け取ります
                </p>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.emailNotifications}
                    onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="ml-3 text-sm text-gray-700">
                    メール通知を有効にする
                  </span>
                </label>
              </div>

              {/* プッシュ通知設定 */}
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <Smartphone className="h-5 w-5 text-green-600 mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">プッシュ通知</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  ブラウザのプッシュ通知でリアルタイムに通知を受け取ります
                </p>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.pushNotifications}
                    onChange={(e) => handleSettingChange('pushNotifications', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="ml-3 text-sm text-gray-700">
                    プッシュ通知を有効にする
                  </span>
                </label>
              </div>

              {/* リマインダー通知設定 */}
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <Clock className="h-5 w-5 text-orange-600 mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">リマインダー通知</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  スケジュール開始前にリマインダー通知を受け取ります（15分前・5分前）
                </p>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.reminderNotifications}
                    onChange={(e) => handleSettingChange('reminderNotifications', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="ml-3 text-sm text-gray-700">
                    リマインダー通知を有効にする
                  </span>
                </label>
              </div>
            </div>

            {/* 保存状態表示 */}
            {hasChanges && (
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-2 w-2 bg-yellow-400 rounded-full"></div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-800">
                      設定が変更されています。保存ボタンをクリックして変更を保存してください。
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!hasChanges && settings.id && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Check className="h-5 w-5 text-green-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-800">
                      設定が保存されています。
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}