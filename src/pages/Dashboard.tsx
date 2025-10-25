import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users, Clock, Car, DoorOpen, Box } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import { useCalendar } from '../contexts/CalendarContext';
import { usePermissions } from '../hooks/usePermissions';

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { getSchedulesForDate, refreshSchedules } = useCalendar();
  const { canAccessSampleReservation } = usePermissions();
  
  // Refresh schedules when dashboard loads
  React.useEffect(() => {
    refreshSchedules();
  }, [refreshSchedules]);
  
  const today = new Date();
  const todaySchedules = getSchedulesForDate(today);
  const userSchedules = todaySchedules.filter(schedule => 
    schedule.participants.includes(currentUser?.id || '') || 
    schedule.createdBy === currentUser?.id
  );

  const cards = [
    {
      name: 'マイカレンダー',
      description: '自分と他のメンバーのスケジュールを確認できます',
      icon: <Calendar className="h-8 w-8 text-white" />,
      href: '/calendar/my',
      color: 'bg-blue-600',
    },
    {
      name: '車両予約',
      description: '会社の車両の予約状況を確認できます',
      icon: <Car className="h-8 w-8 text-white" />,
      href: '/calendar/vehicle',
      color: 'bg-amber-600',
    },
    {
      name: '会議室予約',
      description: '会議室の予約状況を確認できます',
      icon: <DoorOpen className="h-8 w-8 text-white" />,
      href: '/calendar/room',
      color: 'bg-emerald-600',
    },
    // サンプル予約は権限がある場合のみ表示
    ...(canAccessSampleReservation() ? [{
      name: 'サンプル予約',
      description: 'サンプル設備の予約状況を確認できます',
      icon: <Box className="h-8 w-8 text-white" />,
      href: '/calendar/sample',
      color: 'bg-purple-600',
    }] : []),
    {
      name: '休暇申請',
      description: '休暇、遅刻、早退の申請ができます',
      icon: <Clock className="h-8 w-8 text-white" />,
      href: '/leave',
      color: 'bg-rose-600',
    },
  ];

  // Add admin cards if user is admin or president
  if (currentUser?.role === 'admin' || currentUser?.role === 'president') {
    cards.push({
      name: 'ユーザー管理',
      description: 'ユーザーの追加、編集、削除ができます',
      icon: <Users className="h-8 w-8 text-white" />,
      href: '/admin/users',
      color: 'bg-indigo-600',
    });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">ダッシュボード</h1>
        <p className="mt-1 text-sm text-gray-500">
          {format(today, 'yyyy年M月d日（EEEE）', { locale: ja })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.name}
            className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow duration-200"
            onClick={() => navigate(card.href)}
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className={`flex-shrink-0 rounded-md p-3 ${card.color}`}>
                  {card.icon}
                </div>
                <div className="ml-5">
                  <h3 className="text-lg font-medium text-gray-900">{card.name}</h3>
                  <p className="text-sm text-gray-500">{card.description}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">今日のスケジュール</h2>
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {userSchedules.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {userSchedules.map((schedule) => (
                <li key={schedule.id}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`
                          flex-shrink-0 h-10 w-10 rounded-md flex items-center justify-center
                          ${schedule.type === '会議' ? 'bg-blue-100 text-blue-600' : 
                            schedule.type === 'オンライン商談' ? 'bg-purple-100 text-purple-600' : 
                            schedule.type === '来訪' ? 'bg-amber-100 text-amber-600' : 
                            schedule.type === '工事' ? 'bg-emerald-100 text-emerald-600' : 
                            'bg-gray-100 text-gray-600'}
                        `}>
                          <Calendar className="h-6 w-6" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{schedule.title}</div>
                          <div className="text-sm text-gray-500">
                            {format(schedule.startTime, 'HH:mm')} - {format(schedule.endTime, 'HH:mm')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        {schedule.equipment.map((eq) => (
                          <span 
                            key={eq.id}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 mr-2"
                          >
                            {eq.type === 'room' ? '会議室' : eq.type === 'vehicle' ? '車両' : 'サンプル'}
                          </span>
                        ))}
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {schedule.type}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-5 sm:px-6 text-center text-gray-500">
              今日の予定はありません
            </div>
          )}
        </div>
      </div>
    </div>
  );
}