import { useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function MyCalendarSimple() {
  const { currentUser } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');

  const goToToday = () => setCurrentDate(new Date());
  const goToPreviousPeriod = () => {
    const newDate = new Date(currentDate);
    if (view === 'day') newDate.setDate(newDate.getDate() - 1);
    else if (view === 'week') newDate.setDate(newDate.getDate() - 7);
    else newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
  };
  const goToNextPeriod = () => {
    const newDate = new Date(currentDate);
    if (view === 'day') newDate.setDate(newDate.getDate() + 1);
    else if (view === 'week') newDate.setDate(newDate.getDate() + 7);
    else newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  return (
    <div className="h-full">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-gray-900">
              {format(currentDate, 'yyyy年M月', { locale: ja })}
            </h1>
            <div className="flex items-center space-x-1">
              <button
                onClick={goToPreviousPeriod}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-1 text-sm hover:bg-gray-100 rounded"
              >
                今日
              </button>
              <button
                onClick={goToNextPeriod}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex rounded-lg border">
              {(['day', 'week', 'month'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1 text-sm ${
                    view === v
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {v === 'day' ? '日' : v === 'week' ? '週' : '月'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8 text-center">
        <CalendarIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">
          カレンダー機能（簡易版）
        </h2>
        <p className="text-gray-500">
          現在、カレンダー機能を修復中です
        </p>
        {currentUser && (
          <p className="mt-4 text-sm text-gray-600">
            ログインユーザー: {currentUser.name}
          </p>
        )}
      </div>
    </div>
  );
}