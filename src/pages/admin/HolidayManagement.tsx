import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Holiday, HolidayType } from '../../types';
import { HolidayService } from '../../services/holidayService';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useConfirmation } from '../../hooks/useConfirmation';
import toast from 'react-hot-toast';

const HolidayManagement: React.FC = () => {
  const { currentUser } = useAuth();
  const { confirm, confirmationState, handleConfirm, handleCancel } = useConfirmation();
  
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [formData, setFormData] = useState({
    date: '',
    name: ''
  });

  // 管理者権限チェック
  const isAdmin = currentUser?.role === 'president' || currentUser?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      fetchHolidays();
    }
  }, [isAdmin]);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const currentYear = new Date().getFullYear();
      const startDate = new Date(currentYear, 0, 1);
      const endDate = new Date(currentYear + 1, 11, 31);
      
      const holidayData = await HolidayService.getAllHolidays(startDate, endDate);
      setHolidays(holidayData);
    } catch (error) {
      console.error('Error fetching holidays:', error);
      toast.error('祝日・休日の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingHoliday) {
        // 更新
        const updated = await HolidayService.updateCompanyHoliday(editingHoliday.id, {
          name: formData.name
        });
        
        if (updated) {
          toast.success('会社休日を更新しました');
          await fetchHolidays();
          setShowAddModal(false);
          setEditingHoliday(null);
          setFormData({ date: '', name: '' });
        } else {
          toast.error('会社休日の更新に失敗しました');
        }
      } else {
        // 新規作成
        const newHoliday = await HolidayService.addCompanyHoliday(
          new Date(formData.date),
          formData.name
        );
        
        if (newHoliday) {
          toast.success('会社休日を追加しました');
          await fetchHolidays();
          setShowAddModal(false);
          setFormData({ date: '', name: '' });
        } else {
          toast.error('会社休日の追加に失敗しました');
        }
      }
    } catch (error) {
      console.error('Error saving holiday:', error);
      toast.error('保存に失敗しました');
    }
  };

  const handleEdit = (holiday: Holiday) => {
    if (holiday.type === 'company_holiday') {
      setEditingHoliday(holiday);
      setFormData({
        date: holiday.date.toISOString().split('T')[0],
        name: holiday.name
      });
      setShowAddModal(true);
    }
  };

  const handleDelete = async (holiday: Holiday) => {
    if (holiday.type !== 'company_holiday') {
      toast.error('祝日は削除できません');
      return;
    }

    const confirmed = await confirm({
      title: '会社休日の削除',
      message: `「${holiday.name}」を削除しますか？`,
      confirmText: '削除',
      cancelText: 'キャンセル',
      type: 'danger'
    });

    if (confirmed) {
      try {
        const success = await HolidayService.deleteCompanyHoliday(holiday.id);
        if (success) {
          toast.success('会社休日を削除しました');
          await fetchHolidays();
        } else {
          toast.error('会社休日の削除に失敗しました');
        }
      } catch (error) {
        console.error('Error deleting holiday:', error);
        toast.error('削除に失敗しました');
      }
    }
  };

  const handleToggleActive = async (holiday: Holiday) => {
    if (holiday.type !== 'company_holiday') {
      toast.error('祝日のON/OFFは変更できません');
      return;
    }

    try {
      const updated = await HolidayService.updateCompanyHoliday(holiday.id, {
        isActive: !holiday.isActive
      });
      
      if (updated) {
        toast.success(`会社休日を${updated.isActive ? '有効' : '無効'}にしました`);
        await fetchHolidays();
      } else {
        toast.error('更新に失敗しました');
      }
    } catch (error) {
      console.error('Error toggling holiday:', error);
      toast.error('更新に失敗しました');
    }
  };

  const resetForm = () => {
    setFormData({ date: '', name: '' });
    setEditingHoliday(null);
    setShowAddModal(false);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">アクセス権限がありません</h1>
          <p className="text-gray-600">このページは管理者のみアクセス可能です。</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  const nationalHolidays = holidays.filter(h => h.type === 'national_holiday');
  const companyHolidays = holidays.filter(h => h.type === 'company_holiday');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <Calendar className="h-8 w-8 mr-3 text-blue-600" />
                祝日・休日管理
              </h1>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                会社休日を追加
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* 祝日セクション */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                祝日（自動取得）
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {nationalHolidays.map((holiday) => (
                  <div key={holiday.id} className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-red-900">{holiday.name}</p>
                        <p className="text-sm text-red-600">
                          {holiday.date.toLocaleDateString('ja-JP', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            weekday: 'long'
                          })}
                        </p>
                      </div>
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                        祝日
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 会社休日セクション */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                会社休日（手動設定）
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {companyHolidays.map((holiday) => (
                  <div key={holiday.id} className={`border rounded-lg p-4 ${
                    holiday.isActive 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className={`font-medium ${
                          holiday.isActive ? 'text-green-900' : 'text-gray-500'
                        }`}>
                          {holiday.name}
                        </p>
                        <p className={`text-sm ${
                          holiday.isActive ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          {holiday.date.toLocaleDateString('ja-JP', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            weekday: 'long'
                          })}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleToggleActive(holiday)}
                          className="text-gray-400 hover:text-gray-600"
                          title={holiday.isActive ? '無効にする' : '有効にする'}
                        >
                          {holiday.isActive ? (
                            <ToggleRight className="h-5 w-5 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-5 w-5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleEdit(holiday)}
                          className="text-green-600 hover:text-green-800"
                          title="編集"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(holiday)}
                          className="text-red-600 hover:text-red-800"
                          title="削除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {companyHolidays.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>会社休日が設定されていません</p>
                  <p className="text-sm">「会社休日を追加」ボタンから追加してください</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 追加・編集モーダル */}
        {showAddModal && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingHoliday ? '会社休日を編集' : '会社休日を追加'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    日付
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    休日名
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="例: 創立記念日"
                    required
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    {editingHoliday ? '更新' : '追加'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 確認モーダル */}
        <ConfirmationModal
          isOpen={confirmationState.isOpen}
          onClose={handleCancel}
          onConfirm={handleConfirm}
          title={confirmationState.title}
          message={confirmationState.message}
          confirmText={confirmationState.confirmText}
          cancelText={confirmationState.cancelText}
          type={confirmationState.type}
        />
      </div>
    </div>
  );
};

export default HolidayManagement;
