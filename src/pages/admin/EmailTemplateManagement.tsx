import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string;
  type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const EmailTemplateManagement: React.FC = () => {
  const { currentUser } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body_html: '',
    body_text: '',
    type: 'meet_url'
  });

  // 管理者権限チェック
  const isAdmin = currentUser?.role === 'president' || currentUser?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      fetchTemplates();
    }
  }, [isAdmin]);

  const fetchTemplates = async () => {
    try {
      console.log('📧 テンプレート取得開始...');
      console.log('📧 現在のユーザー:', currentUser);
      console.log('📧 管理者権限:', isAdmin);
      
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('📧 取得結果:', { data, error });

      if (error) throw error;
      setTemplates(data || []);
      console.log('📧 テンプレート設定完了:', data?.length || 0, '件');
    } catch (error) {
      console.error('テンプレート取得エラー:', error);
      toast.error('テンプレートの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('📧 テンプレート保存開始...');
    console.log('📧 現在のユーザーID:', currentUser?.id);
    console.log('📧 フォームデータ:', formData);
    
    try {
      if (editingTemplate) {
        // 更新
        const { error } = await supabase
          .from('email_templates')
          .update({
            name: formData.name,
            subject: formData.subject,
            body_html: formData.body_html,
            body_text: formData.body_text,
            updated_by: currentUser?.id
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;
        toast.success('テンプレートを更新しました');
      } else {
        // 新規作成
        const { error } = await supabase
          .from('email_templates')
          .insert({
            name: formData.name,
            subject: formData.subject,
            body_html: formData.body_html,
            body_text: formData.body_text,
            type: formData.type,
            created_by: currentUser?.id
          });

        if (error) throw error;
        toast.success('テンプレートを作成しました');
      }

      setShowModal(false);
      setEditingTemplate(null);
      setFormData({ name: '', subject: '', body_html: '', body_text: '', type: 'meet_url' });
      fetchTemplates();
    } catch (error) {
      console.error('テンプレート保存エラー:', error);
      toast.error('テンプレートの保存に失敗しました');
    }
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name || '',
      subject: template.subject || '',
      body_html: template.body_html || '',
      body_text: template.body_text || '',
      type: template.type || 'meet_url'
    });
    setShowModal(true);
  };

  const handleDelete = async (template: EmailTemplate) => {
    if (!confirm(`「${template.name}」を削除しますか？`)) return;

    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', template.id);

      if (error) throw error;
      toast.success('テンプレートを削除しました');
      fetchTemplates();
    } catch (error) {
      console.error('テンプレート削除エラー:', error);
      toast.error('テンプレートの削除に失敗しました');
    }
  };

  const handleToggleActive = async (template: EmailTemplate) => {
    try {
      const { error } = await supabase
        .from('email_templates')
        .update({ 
          is_active: !template.is_active,
          updated_by: currentUser?.id
        })
        .eq('id', template.id);

      if (error) throw error;
      toast.success(`テンプレートを${!template.is_active ? '有効' : '無効'}にしました`);
      fetchTemplates();
    } catch (error) {
      console.error('テンプレート状態変更エラー:', error);
      toast.error('テンプレートの状態変更に失敗しました');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', subject: '', body_html: '', body_text: '', type: 'meet_url' });
    setEditingTemplate(null);
    setShowModal(false);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">メールテンプレート管理</h1>
              <button
                onClick={() => setShowModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                新規作成
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      テンプレート名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      件名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      タイプ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状態
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      更新日時
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {templates.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center">
                          <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                          <p className="text-lg font-medium text-gray-900 mb-2">テンプレートがありません</p>
                          <p className="text-gray-500 mb-4">新しいテンプレートを作成してください</p>
                          <button
                            onClick={() => setShowModal(true)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                          >
                            新規作成
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    templates.map((template) => (
                      <tr key={template.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {template.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                          {template.subject || '件名なし'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {template.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button
                            onClick={() => handleToggleActive(template)}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              template.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {template.is_active ? '有効' : '無効'}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(template.updated_at).toLocaleString('ja-JP')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => handleEdit(template)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(template)}
                            className="text-red-600 hover:text-red-900"
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingTemplate ? 'テンプレート編集' : '新規テンプレート作成'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    テンプレート名
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    件名
                  </label>
                  <input
                    type="text"
                    value={formData.subject || ''}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`例: 【会議招待】{title} - {date}`}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    本文（HTML）
                  </label>
                  <textarea
                    value={formData.body_html || ''}
                    onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`例: <p>{{recipient_name}} 様</p><p>以下の会議のGoogle Meet URLをお送りします...</p>`}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    本文（テキスト）
                  </label>
                  <textarea
                    value={formData.body_text || ''}
                    onChange={(e) => setFormData({ ...formData, body_text: e.target.value })}
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`例: {{recipient_name}} 様

以下の会議のGoogle Meet URLをお送りします...`}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    使用可能な変数: {`{{recipient_name}}, {{title}}, {{date}}, {{start_time}}, {{end_time}}, {{location}}, {{meet_link}}`}
                  </p>
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
                    {editingTemplate ? '更新' : '作成'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailTemplateManagement;
