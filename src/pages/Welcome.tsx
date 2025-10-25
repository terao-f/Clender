import { useNavigate } from 'react-router-dom';
import { Calendar, Car, DoorOpen, Package, Users, Rocket } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Welcome() {
  const navigate = useNavigate();
  const { switchUser } = useAuth();

  const quickStart = () => {
    // デフォルトユーザーでログイン
    const defaultUser = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      employeeId: 'E001',
      name: '山田太郎',
      nameKana: 'ヤマダタロウ',
      email: 'yamada@terao-f.co.jp',
      phone: '090-1234-5678',
      department: '本社（１階）' as const,
      role: 'president' as const,
      defaultWorkDays: [
        { day: 1, startTime: '09:00', endTime: '18:00' },
        { day: 2, startTime: '09:00', endTime: '18:00' },
        { day: 3, startTime: '09:00', endTime: '18:00' },
        { day: 4, startTime: '09:00', endTime: '18:00' },
        { day: 5, startTime: '09:00', endTime: '18:00' },
      ]
    };

    switchUser(defaultUser);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <Calendar className="h-20 w-20 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            terao-f スケジューラー
          </h1>
          <p className="text-xl text-gray-600">
            株式会社テラオ・エフ
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          {/* クイックスタート */}
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8 text-center">
            <h2 className="text-2xl font-semibold mb-4">すぐに始める</h2>
            <p className="text-gray-600 mb-6">
              認証不要ですぐにシステムを試すことができます
            </p>
            <button
              onClick={quickStart}
              className="inline-flex items-center px-8 py-4 text-lg font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200"
            >
              <Rocket className="h-6 w-6 mr-2" />
              今すぐ使ってみる
            </button>
            <p className="text-sm text-gray-500 mt-4">
              社長権限（全機能アクセス可能）でログインします
            </p>
          </div>

          {/* 機能紹介 */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center mb-4">
                <Calendar className="h-8 w-8 text-blue-600 mr-3" />
                <h3 className="text-lg font-semibold">マイカレンダー</h3>
              </div>
              <p className="text-gray-600">
                個人・チームのスケジュール管理、Google Meet連携、リマインダー機能
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center mb-4">
                <Car className="h-8 w-8 text-amber-600 mr-3" />
                <h3 className="text-lg font-semibold">車両予約</h3>
              </div>
              <p className="text-gray-600">
                社用車の予約管理、利用状況の可視化、重複防止機能
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center mb-4">
                <DoorOpen className="h-8 w-8 text-emerald-600 mr-3" />
                <h3 className="text-lg font-semibold">会議室予約</h3>
              </div>
              <p className="text-gray-600">
                会議室の予約管理、参加者管理、設備利用状況の確認
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center mb-4">
                <Package className="h-8 w-8 text-purple-600 mr-3" />
                <h3 className="text-lg font-semibold">サンプル予約</h3>
              </div>
              <p className="text-gray-600">
                サンプル作成の予約、先着順管理、進捗状況の追跡
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center mb-4">
                <Users className="h-8 w-8 text-indigo-600 mr-3" />
                <h3 className="text-lg font-semibold">業務グループ管理</h3>
              </div>
              <p className="text-gray-600">
                部署・チーム管理、権限設定、メンバー管理機能
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center mb-4">
                <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-red-600 font-bold">!</span>
                </div>
                <h3 className="text-lg font-semibold">セキュリティ</h3>
              </div>
              <p className="text-gray-600">
                ロールベースアクセス制御、監査ログ、セッション管理
              </p>
            </div>
          </div>

          {/* その他のオプション */}
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-600 mb-4">他のログイン方法</p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-2 text-sm font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200"
              >
                通常ログイン
              </button>
              <button
                onClick={() => navigate('/login-debug')}
                className="px-6 py-2 text-sm font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200"
              >
                デバッグモード
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}