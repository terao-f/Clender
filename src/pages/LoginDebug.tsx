import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function LoginDebug() {
  const [status, setStatus] = useState<string[]>([]);
  const navigate = useNavigate();
  const { switchUser } = useAuth();

  // Simple test user
  const testUser = {
    id: 'test-user-1',
    employeeId: 'E001',
    name: '山田太郎',
    nameKana: 'ヤマダタロウ',
    email: 'yamada@terao-f.co.jp',
    phone: '090-1234-5678',
    department: '本社（１階）' as const,
    role: 'president' as const,
    defaultWorkDays: []
  };

  const addStatus = (message: string) => {
    setStatus(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  const testSupabaseConnection = async () => {
    addStatus('Testing Supabase connection...');
    try {
      const { data, error } = await supabase.from('users').select('count').single();
      if (error) {
        addStatus(`Supabase error: ${error.message}`);
      } else {
        addStatus(`Supabase connected successfully. Response: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      addStatus(`Connection error: ${err}`);
    }
  };

  const simpleLogin = () => {
    addStatus('Attempting simple login...');
    try {
      // Directly switch to test user without authentication
      switchUser(testUser);
      addStatus('User switched successfully');
      
      // Navigate after a short delay
      setTimeout(() => {
        addStatus('Navigating to home...');
        navigate('/');
      }, 1000);
    } catch (err) {
      addStatus(`Login error: ${err}`);
    }
  };

  const checkEnvironment = () => {
    addStatus('Checking environment variables...');
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    addStatus(`Supabase URL: ${url ? 'Set (' + url.substring(0, 30) + '...)' : 'NOT SET'}`);
    addStatus(`Supabase Key: ${key ? 'Set (hidden)' : 'NOT SET'}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Login Debug Page</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Actions</h2>
          <div className="space-x-4">
            <button
              onClick={checkEnvironment}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Check Environment
            </button>
            <button
              onClick={testSupabaseConnection}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Test Supabase
            </button>
            <button
              onClick={simpleLogin}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              Simple Login (No Auth)
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Status Log</h2>
          <div className="space-y-2 font-mono text-sm">
            {status.length === 0 ? (
              <p className="text-gray-500">No actions performed yet</p>
            ) : (
              status.map((msg, idx) => (
                <div key={idx} className="p-2 bg-gray-100 rounded">
                  {msg}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}