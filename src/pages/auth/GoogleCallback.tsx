import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { googleAuthService } from '../../services/googleAuthService';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function GoogleCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    console.log('GoogleCallback useEffect - currentUser:', currentUser);
    console.log('GoogleCallback useEffect - isProcessing:', isProcessing);
    
    // ユーザー情報が読み込まれたら処理を開始
    if (currentUser && !isProcessing) {
      console.log('Starting callback processing...');
      setIsProcessing(true);
      handleCallback();
    } else if (!currentUser) {
      // currentUserがない場合、localStorageから直接取得を試みる
      const savedUser = localStorage.getItem('currentUser');
      console.log('No currentUser, checking localStorage:', savedUser);
      if (savedUser && !isProcessing) {
        console.log('Found user in localStorage, starting processing...');
        setIsProcessing(true);
        handleCallback();
      }
    }
  }, [currentUser, isProcessing]);

  const handleCallback = async () => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    console.log('=== Google Callback Debug ===');
    console.log('Code:', code);
    console.log('Error:', error);
    console.log('Error Description:', errorDescription);
    console.log('Current User:', currentUser);
    console.log('All URL Params:', Object.fromEntries(searchParams));

    if (error) {
      console.error('Google OAuth Error:', error, errorDescription);
      toast.error(`Google認証エラー: ${error} - ${errorDescription || 'Unknown error'}`);
      navigate('/settings/google-calendar');
      return;
    }

    if (!code) {
      console.error('認証コードが見つかりません');
      toast.error('認証コードが見つかりません');
      navigate('/settings/google-calendar');
      return;
    }

    // currentUserがnullでもlocalStorageから取得できればOK
    const savedUser = localStorage.getItem('currentUser');
    if (!currentUser && !savedUser) {
      console.error('ユーザー情報が見つかりません');
      toast.error('ユーザー情報が見つかりません');
      navigate('/settings/google-calendar');
      return;
    }

    try {
      console.log('トークン交換を開始します...');
      console.log('googleAuthService exists:', !!googleAuthService);
      console.log('exchangeCodeForTokens exists:', !!googleAuthService?.exchangeCodeForTokens);
      console.log('code value:', code);
      
      // 認証コードをトークンに交換
      let tokens = null;
      try {
        console.log('Before calling exchangeCodeForTokens');
        tokens = await googleAuthService.exchangeCodeForTokens(code);
        console.log('After calling exchangeCodeForTokens');
      } catch (innerError) {
        console.error('exchangeCodeForTokens内部エラー:', innerError);
        console.error('エラー詳細:', innerError?.message, innerError?.stack);
        throw innerError;
      }
      
      console.log('トークン交換結果:', tokens);
      
      if (tokens) {
        console.log('トークン取得成功:', tokens);
        toast.success('Googleカレンダーと連携しました');
        navigate('/settings/google-calendar');
      } else {
        console.error('トークンの取得に失敗しました');
        toast.error('トークンの取得に失敗しました');
        navigate('/settings/google-calendar');
      }
    } catch (error) {
      console.error('認証エラー詳細:', error);
      console.error('エラーメッセージ:', error.message);
      console.error('エラースタック:', error.stack);
      toast.error(`認証処理中にエラーが発生しました: ${error.message}`);
      navigate('/settings/google-calendar');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Google認証を処理中...</p>
      </div>
    </div>
  );
}