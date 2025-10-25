import { useState } from 'react';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User } from '../types';

interface UserDeleteHelperProps {
  user: User;
  onClose: () => void;
}

export default function UserDeleteHelper({ user, onClose }: UserDeleteHelperProps) {
  const [checking, setChecking] = useState(false);
  const [dependencies, setDependencies] = useState<{
    groups: number;
    schedulesCreated: number;
    schedulesParticipant: number;
    leaveRequests: number;
    vehicles: number;
    rooms: number;
  } | null>(null);

  const checkDependencies = async () => {
    setChecking(true);
    try {
      // Check groups
      const { data: groupsData } = await supabase
        .from('groups')
        .select('id, members')
        .filter('members', 'cs', `{${user.id}}`);
      
      // Check schedules created/updated
      const { count: schedulesCreatedCount } = await supabase
        .from('schedules')
        .select('*', { count: 'exact', head: true })
        .or(`created_by.eq.${user.id},updated_by.eq.${user.id}`);
      
      // Check schedules as participant
      const { data: schedulesParticipantData } = await supabase
        .from('schedules')
        .select('id, participants')
        .filter('participants', 'cs', `{${user.id}}`);
      
      // Check leave requests
      const { count: leaveRequestsCount } = await supabase
        .from('leave_requests')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      // Check vehicles
      const { count: vehiclesCount } = await supabase
        .from('vehicles')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', user.id);
      
      // Check rooms
      const { count: roomsCount } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', user.id);
      
      setDependencies({
        groups: groupsData?.length || 0,
        schedulesCreated: schedulesCreatedCount || 0,
        schedulesParticipant: schedulesParticipantData?.length || 0,
        leaveRequests: leaveRequestsCount || 0,
        vehicles: vehiclesCount || 0,
        rooms: roomsCount || 0,
      });
    } catch (error) {
      console.error('Error checking dependencies:', error);
    } finally {
      setChecking(false);
    }
  };

  const hasDependencies = dependencies && (
    dependencies.groups > 0 ||
    dependencies.schedulesCreated > 0 ||
    dependencies.schedulesParticipant > 0 ||
    dependencies.leaveRequests > 0 ||
    dependencies.vehicles > 0 ||
    dependencies.rooms > 0
  );

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          ユーザー削除の確認: {user.name}
        </h3>
        
        {!dependencies && (
          <div className="mb-4">
            <button
              onClick={checkDependencies}
              disabled={checking}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {checking ? '確認中...' : '関連データを確認'}
            </button>
          </div>
        )}
        
        {dependencies && (
          <div className="space-y-3 mb-4">
            <div className={`flex items-center ${dependencies.groups > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {dependencies.groups > 0 ? <XCircle className="h-5 w-5 mr-2" /> : <CheckCircle className="h-5 w-5 mr-2" />}
              <span>グループメンバー: {dependencies.groups}件</span>
            </div>
            
            <div className={`flex items-center ${dependencies.schedulesCreated > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {dependencies.schedulesCreated > 0 ? <XCircle className="h-5 w-5 mr-2" /> : <CheckCircle className="h-5 w-5 mr-2" />}
              <span>作成したスケジュール: {dependencies.schedulesCreated}件</span>
            </div>
            
            <div className={`flex items-center ${dependencies.schedulesParticipant > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {dependencies.schedulesParticipant > 0 ? <XCircle className="h-5 w-5 mr-2" /> : <CheckCircle className="h-5 w-5 mr-2" />}
              <span>参加スケジュール: {dependencies.schedulesParticipant}件</span>
            </div>
            
            <div className={`flex items-center ${dependencies.leaveRequests > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
              {dependencies.leaveRequests > 0 ? <AlertCircle className="h-5 w-5 mr-2" /> : <CheckCircle className="h-5 w-5 mr-2" />}
              <span>休暇申請: {dependencies.leaveRequests}件（自動削除）</span>
            </div>
            
            <div className={`flex items-center ${dependencies.vehicles > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {dependencies.vehicles > 0 ? <XCircle className="h-5 w-5 mr-2" /> : <CheckCircle className="h-5 w-5 mr-2" />}
              <span>登録車両: {dependencies.vehicles}件</span>
            </div>
            
            <div className={`flex items-center ${dependencies.rooms > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {dependencies.rooms > 0 ? <XCircle className="h-5 w-5 mr-2" /> : <CheckCircle className="h-5 w-5 mr-2" />}
              <span>登録会議室: {dependencies.rooms}件</span>
            </div>
            
            {hasDependencies && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  このユーザーは関連データがあるため、削除前にデータの移行や削除が必要です。
                </p>
              </div>
            )}
            
            {!hasDependencies && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-800">
                  このユーザーは安全に削除できます。
                </p>
              </div>
            )}
          </div>
        )}
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}