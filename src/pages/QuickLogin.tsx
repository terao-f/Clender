import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function QuickLogin() {
  const navigate = useNavigate();
  const { switchUser } = useAuth();

  useEffect(() => {
    // Create a default test user
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

    // Directly switch to the user without authentication
    switchUser(defaultUser);
    
    // Navigate to home
    navigate('/');
  }, [navigate, switchUser]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">ログイン中...</p>
      </div>
    </div>
  );
}