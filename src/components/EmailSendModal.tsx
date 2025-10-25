import { useState, useEffect } from 'react';
import { X, Send, Mail, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Schedule, User } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string;
  type: string;
  is_active: boolean;
}

interface EmailSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: Schedule;
  users?: User[];
  onEmailSent?: () => void;
}

const defaultTemplates: EmailTemplate[] = [
  {
    id: '1',
    name: '会議招待',
    subject: '【会議招待】{{title}} - {{date}}',
    body_html: `<p>{{recipient_name}} 様</p>

<p>以下の会議にご参加をお願いいたします。</p>

<p>■ 会議名: {{title}}<br>
■ 日時: {{date}} {{start_time}} - {{end_time}}<br>
■ 場所: {{location}}<br>
■ 会議リンク: {{meet_link}}</p>

<p>■ 参加者:<br>
{{participants}}</p>

{{#if details}}
<p>■ 詳細:<br>
{{details}}</p>
{{/if}}

<p>ご不明な点がございましたら、お気軽にお問い合わせください。</p>

<p>よろしくお願いいたします。</p>`,
    body_text: `{{recipient_name}} 様

以下の会議にご参加をお願いいたします。

■ 会議名: {{title}}
■ 日時: {{date}} {{start_time}} - {{end_time}}
■ 場所: {{location}}
■ 会議リンク: {{meet_link}}

■ 参加者:
{{participants}}

{{#if details}}
■ 詳細:
{{details}}
{{/if}}

ご不明な点がございましたら、お気軽にお問い合わせください。

よろしくお願いいたします。`
  },
  {
    id: '2',
    name: 'リマインダー',
    subject: '【リマインダー】{{title}} - {{date}}',
    body_html: `<p>{{recipient_name}} 様</p>

<p>本日の予定についてリマインドさせていただきます。</p>

<p>■ 予定: {{title}}<br>
■ 時間: {{start_time}} - {{end_time}}</p>
{{#if meet_link}}
<p>■ Google Meet: {{meet_link}}</p>
{{/if}}

<p>お忘れのないよう、よろしくお願いいたします。</p>`,
    body_text: `{{recipient_name}} 様

本日の予定についてリマインドさせていただきます。

■ 予定: {{title}}
■ 時間: {{start_time}} - {{end_time}}
{{#if meet_link}}
■ Google Meet: {{meet_link}}
{{/if}}

お忘れのないよう、よろしくお願いいたします。`
  },
  {
    id: '3',
    name: '予定変更通知',
    subject: '【予定変更】{{title}} - {{date}}',
    body_html: `<p>{{recipient_name}} 様</p>

<p>下記の予定が変更されましたのでお知らせいたします。</p>

<p>■ 予定名: {{title}}<br>
■ 新しい日時: {{date}} {{start_time}} - {{end_time}}</p>
{{#if meet_link}}
<p>■ Google Meet: {{meet_link}}</p>
{{/if}}

<p>ご確認のほど、よろしくお願いいたします。</p>`,
    body_text: `{{recipient_name}} 様

下記の予定が変更されましたのでお知らせいたします。

■ 予定名: {{title}}
■ 新しい日時: {{date}} {{start_time}} - {{end_time}}
{{#if meet_link}}
■ Google Meet: {{meet_link}}
{{/if}}

ご確認のほど、よろしくお願いいたします。`
  },
  {
    id: '4',
    name: 'Google Meet URL案内',
    subject: 'Google Meet URLをお送りします',
    body_html: `<p>{{recipient_name}} 様</p>

<p>以下の会議のGoogle Meet URLをお送りします。<br>
会議の時間になりましたら、下記のリンクからご参加ください。</p>

<p>{{custom_body}}</p>

<p>■ 会議名: {{title}}<br>
■ 日時: {{date}} {{start_time}} - {{end_time}}<br>
■ 場所: {{location}}<br>
■ 会議リンク: {{meet_link}}</p>

<p>ご不明な点がございましたら、お気軽にお問い合わせください。</p>

<p>よろしくお願いいたします。</p>`,
    body_text: `{{recipient_name}} 様

以下の会議のGoogle Meet URLをお送りします。
会議の時間になりましたら、下記のリンクからご参加ください。

{{custom_body}}

■ 会議名: {{title}}
■ 日時: {{date}} {{start_time}} - {{end_time}}
■ 場所: {{location}}
■ 会議リンク: {{meet_link}}

ご不明な点がございましたら、お気軽にお問い合わせください。

よろしくお願いいたします。`
  }
];

export default function EmailSendModal({
  isOpen,
  onClose,
  schedule,
  users,
  onEmailSent
}: EmailSendModalProps) {
  const { currentUser } = useAuth();
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate>(defaultTemplates[0]);
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [customRecipients, setCustomRecipients] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendHistory, setSendHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);

  // テンプレートを読み込む
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const { data, error } = await supabase
          .from('email_templates')
          .select('*')
          .eq('type', 'meet_url')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        if (data && data.length > 0) {
          console.log('🔍 データベースからテンプレートを取得:', data);
          setTemplates(data);
          setSelectedTemplate(data[0]);
        } else {
          console.log('🔍 データベースにテンプレートがないため、デフォルトテンプレートを使用');
          // データベースにテンプレートがない場合はデフォルトテンプレートを使用
          setTemplates(defaultTemplates);
          setSelectedTemplate(defaultTemplates[0]);
        }
      } catch (error) {
        console.error('テンプレート取得エラー:', error);
        // エラーの場合はデフォルトテンプレートを使用
        setTemplates(defaultTemplates);
        setSelectedTemplate(defaultTemplates[0]);
      }
    };

    fetchTemplates();
  }, []);

  useEffect(() => {
    if (isOpen && schedule && users && users.length > 0) {
      // 初回のみ状態をリセット（GoogleMeetメール送信の場合は内容を保持）
      if (!schedule.meetLink) {
        // Google MeetのURLがない場合のみ、すべての状態をリセット
        setCustomBody('');
        setCustomSubject('');
        setCustomRecipients('');
      } else {
        // Google MeetのURLがある場合は、件名と本文が空の場合のみリセット
        if (!customSubject) setCustomSubject('');
        if (!customBody) setCustomBody('');
        setCustomRecipients('');
      }
      
      // タイトルを初期設定
      setCustomTitle(schedule.title);
      
      // Google MeetのURLがある場合は宛先を未選択にする（お客様向け）
      if (!schedule.meetLink) {
        // Google MeetのURLがない場合のみ、デフォルトで参加者全員を選択
        setRecipients(schedule.participants || []);
      } else {
        // Google MeetのURLがある場合は宛先を空にする
        setRecipients([]);
        // Google Meet用テンプレートの自動選択は別のuseEffectで処理
      }
    }
  }, [isOpen, schedule, users]); // isOpenを依存配列に追加

  useEffect(() => {
    if (isOpen) {
      fetchSendHistory();
    }
  }, [isOpen]);

  // Google Meet用テンプレートの自動選択（テンプレートが取得された後に実行）
  useEffect(() => {
    if (schedule?.meetLink && templates.length > 0 && !selectedTemplate) {
      // データベースから取得したテンプレートを優先
      const dbTemplate = templates.find(t => t.type === 'meet_url' && t.is_active);
      if (dbTemplate) {
        console.log('🔍 データベースのテンプレートを選択:', dbTemplate);
        setSelectedTemplate(dbTemplate);
      } else {
        // データベースにテンプレートがない場合はデフォルトテンプレートを使用
        const googleMeetTemplate = defaultTemplates.find(t => t.id === '4');
        if (googleMeetTemplate) {
          console.log('🔍 デフォルトテンプレートを選択:', googleMeetTemplate);
          setSelectedTemplate(googleMeetTemplate);
        }
      }
    }
  }, [schedule?.meetLink, templates, selectedTemplate]);

  useEffect(() => {
    // テンプレートが変更されたら適用（GoogleMeetメール送信の場合は既存内容を保持）
    if (selectedTemplate && schedule) {
      const preserveContent = schedule.meetLink && (customSubject || customBody);
      console.log('🔍 テンプレート変更検出:', {
        templateName: selectedTemplate.name,
        templateSubject: selectedTemplate.subject,
        preserveContent,
        currentSubject: customSubject,
        currentBody: customBody
      });
      applyTemplate(selectedTemplate, preserveContent, preserveContent);
    }
  }, [selectedTemplate, schedule]);

  useEffect(() => {
    // カスタムタイトルが変更されたらテンプレートを再適用（GoogleMeetメール送信の場合は既存内容を保持）
    if (customTitle && selectedTemplate && schedule) {
      const preserveContent = schedule.meetLink && (customSubject || customBody);
      applyTemplate(selectedTemplate, preserveContent, preserveContent);
    }
  }, [customTitle]);

  useEffect(() => {
    // カスタムタイトルが変更されたらテンプレートを再適用（GoogleMeetメール送信の場合は既存内容を保持、モーダルが開いている場合のみ）
    if (customTitle && selectedTemplate && isOpen && schedule) {
      const preserveContent = schedule.meetLink && (customSubject || customBody);
      applyTemplate(selectedTemplate, preserveContent, preserveContent);
    }
  }, [customTitle, isOpen]);

  const fetchSendHistory = async () => {
    try {
      console.log('📧 メール送信履歴を取得中...', { schedule_id: schedule.id });
      
      const { data, error } = await supabase
        .from('email_send_history')
        .select('*')
        .eq('schedule_id', schedule.id)
        .order('sent_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('❌ メール送信履歴の取得エラー:', error);
        console.error('エラー詳細:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      } else {
        console.log('✅ メール送信履歴を取得しました:', data);
        setSendHistory(data || []);
      }
    } catch (dbError) {
      console.error('❌ メール送信履歴取得中のエラー:', dbError);
      // データベースが利用できない場合はローカルストレージから取得
      const localLogs = JSON.parse(localStorage.getItem('email_logs') || '[]');
      const scheduleLogs = localLogs
        .filter((log: any) => log.schedule_id === schedule.id)
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);
      setSendHistory(scheduleLogs);
    }
  };

  const applyTemplate = (template: EmailTemplate, preserveBody: boolean = false, preserveSubject: boolean = false) => {
    console.log('🔍 テンプレート適用開始:', {
      templateName: template.name,
      templateSubject: template.subject,
      templateBodyHtml: template.body_html,
      templateBodyText: template.body_text,
      preserveBody,
      preserveSubject
    });

    const participantNames = (schedule.participants || [])
      .map(pid => (users || []).find(u => u.id === pid)?.name || 'Unknown')
      .join(', ');

    const variables = {
      title: customTitle || schedule.title,
      date: new Date(schedule.startTime).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }),
      start_time: new Date(schedule.startTime).toLocaleTimeString('ja-JP', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'Asia/Tokyo'
      }),
      end_time: new Date(schedule.endTime).toLocaleTimeString('ja-JP', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'Asia/Tokyo'
      }),
      location: schedule.equipment?.find(e => e.type === 'room')?.name || '未設定',
      meet_link: schedule.meetLink || 'なし',
      participants: participantNames,
      details: schedule.details || '',
      custom_body: '' // 常に空文字列から開始（重複を防ぐ）
    };

    console.log('🔍 変数:', variables);

    // データベースのテンプレートとデフォルトテンプレートの両方に対応
    let subject = template.subject || '';
    // body_textを優先的に使用（メール送信画面ではテキスト形式を優先）
    let body = template.body_text || template.body_html || '';

    console.log('🔍 テンプレート適用前:', { subject, body });

    Object.entries(variables).forEach(([key, value]) => {
      subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
      body = body.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    // 条件付きセクションの処理
    body = body.replace(/{{#if details}}([\s\S]*?){{\/if}}/g, (match, content) => {
      return schedule.details ? content : '';
    });

    // 条件付きセクションの処理（meet_link用）
    body = body.replace(/{{#if meet_link}}([\s\S]*?){{\/if}}/g, (match, content) => {
      return schedule.meetLink ? content : '';
    });

    console.log('🔍 テンプレート適用後:', { subject, body });

    // preserveSubjectがtrueの場合はタイトルを上書きしない
    if (!preserveSubject) {
      console.log('🔍 件名を設定:', subject);
      setCustomSubject(subject);
    } else {
      console.log('🔍 件名を保持（上書きしない）');
    }
    
    // preserveBodyがtrueの場合は本文を上書きしない
    if (!preserveBody) {
      console.log('🔍 本文を設定:', body);
      setCustomBody(body);
    } else {
      console.log('🔍 本文を保持（上書きしない）');
    }
  };

  const handleSend = async () => {
    setIsSending(true);

    try {
      let allRecipients: string[] = [];

      if (schedule.meetLink) {
        // Google Meet URLがある場合は、カスタム送信先のみを使用
        allRecipients = customRecipients
          .split(/[,\s]+/)
          .filter(email => email.includes('@'));
      } else {
        // 通常の場合は、参加者とカスタム送信先の両方を使用
        const customEmails = customRecipients
          .split(/[,\s]+/)
          .filter(email => email.includes('@'));

        const participantEmails = await Promise.all(
          recipients.map(async (userId) => {
            const user = (users || []).find(u => u.id === userId);
            return user?.email || null;
          })
        );

        allRecipients = [
          ...participantEmails.filter(Boolean),
          ...customEmails
        ];
      }

      if (allRecipients.length === 0) {
        toast.error('送信先を選択してください');
        setIsSending(false);
        return;
      }

      // メール送信API呼び出し
      try {
        console.log('=== Sending Email via Supabase Edge Function ===');
        console.log('Recipients:', allRecipients);
        console.log('Subject:', customSubject);
        console.log('Schedule data:', {
          id: schedule.id,
          title: customTitle || schedule.title,
          description: customBody,
          meetLink: schedule.meetLink
        });
        
        // Supabase Edge Functionでメール送信
        const { data, error } = await supabase.functions.invoke('send-schedule-notification-email', {
          body: {
            to: allRecipients,
            type: 'meet_url', // Google Meet URL送信専用タイプ
            schedule: {
              id: schedule.id,
              title: customTitle || schedule.title,
              description: customBody,
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              type: schedule.type,
              location: schedule.location || '',
              meetLink: schedule.meetLink,
              participants: (schedule.participants || []).map(pid => {
                // pidが文字列の場合はユーザーを検索、オブジェクトの場合はそのまま使用
                if (typeof pid === 'string') {
                  const user = (users || []).find(u => u.id === pid);
                  return {
                    id: pid,
                    name: user?.name || 'Unknown',
                    email: user?.email || 'unknown@example.com'
                  };
                } else {
                  // 既にオブジェクトの場合はそのまま使用
                  return {
                    id: pid.id || 'unknown',
                    name: pid.name || 'Unknown',
                    email: pid.email || 'unknown@example.com'
                  };
                }
              })
            },
            appUrl: 'https://clender-app.vercel.app', // 本番環境のURLを固定で設定
            operatorName: currentUser?.name || '管理者'
          }
        });

        console.log('Edge Function response:', { data, error });

        if (error) {
          console.error('🚨 Supabase function error:', error);
          console.error('🚨 Error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            stack: error.stack,
            name: error.name
          });
          
          // Check for specific error patterns
          const errorStr = String(error.message || error);
          if (errorStr.includes('利用できません') || errorStr.includes('式')) {
            console.error('🎯 Detected "利用できません" error in EmailSendModal!');
            console.error('Full error details:', {
              error: error,
              requestBody: {
                to: allRecipients,
                type: 'meet_url',
                schedule: {
                  id: schedule.id,
                  title: customTitle || schedule.title,
                  description: customBody,
                  startTime: schedule.startTime,
                  endTime: schedule.endTime,
                  type: schedule.type,
                  location: schedule.location || '',
                  meetLink: schedule.meetLink,
                  participants: (schedule.participants || []).map(pid => {
                    if (typeof pid === 'string') {
                      const user = (users || []).find(u => u.id === pid);
                      return {
                        id: pid,
                        name: user?.name || 'Unknown',
                        email: user?.email || 'unknown@example.com'
                      };
                    } else {
                      return {
                        id: pid.id || 'unknown',
                        name: pid.name || 'Unknown',
                        email: pid.email || 'unknown@example.com'
                      };
                    }
                  })
                },
                appUrl: 'https://clender-app.vercel.app',
                operatorName: currentUser?.name || '管理者'
              },
              timestamp: new Date().toISOString()
            });
          }
          
          throw error;
        }

        if (!data?.success) {
          console.error('Edge Function returned error:', data);
          throw new Error(data?.error || 'メール送信に失敗しました');
        }

        console.log('Email sent successfully:', data);
        
        // 送信成功
        toast.success('メールを送信しました');
        
        // メール送信履歴をデータベースに保存
        if (schedule.meetLink) {
          const emailType = 'meet_url';
          console.log('📧 メール送信履歴を保存中...', {
            schedule_id: schedule.id,
            sender_id: currentUser?.id,
            sender_name: currentUser?.name,
            recipient_emails: allRecipients,
            email_type: emailType,
            subject: customSubject
          });
          
          const { data: historyData, error: historyError } = await supabase
            .from('email_send_history')
            .insert({
              schedule_id: schedule.id,
              sender_id: currentUser?.id || '',
              sender_name: currentUser?.name || '不明',
              recipient_emails: allRecipients,
              email_type: emailType,
              subject: customSubject,
              body: customBody
            })
            .select();
          
          if (historyError) {
            console.error('❌ メール送信履歴の保存エラー:', historyError);
            console.error('エラー詳細:', {
              message: historyError.message,
              details: historyError.details,
              hint: historyError.hint,
              code: historyError.code
            });
            toast.error(`メール送信履歴の保存に失敗しました: ${historyError.message}`);
          } else {
            console.log('✅ メール送信履歴を保存しました:', historyData);
            toast.success('メール送信履歴を保存しました');
            
            // メール送信履歴を再取得
            await fetchSendHistory();
            
            // 親コンポーネントにメール送信完了を通知
            if (onEmailSent) {
              onEmailSent();
            }
          }
        } else {
          // Google Meet URLがない場合でも、メール送信履歴を保存
          console.log('📧 通常のメール送信履歴を保存中...', {
            schedule_id: schedule.id,
            sender_id: currentUser?.id,
            sender_name: currentUser?.name,
            recipient_emails: allRecipients,
            email_type: 'custom',
            subject: customSubject
          });
          
          const { data: historyData, error: historyError } = await supabase
            .from('email_send_history')
            .insert({
              schedule_id: schedule.id,
              sender_id: currentUser?.id || '',
              sender_name: currentUser?.name || '不明',
              recipient_emails: allRecipients,
              email_type: 'custom',
              subject: customSubject,
              body: customBody
            })
            .select();
          
          if (historyError) {
            console.error('❌ メール送信履歴の保存エラー:', historyError);
            console.error('エラー詳細:', {
              message: historyError.message,
              details: historyError.details,
              hint: historyError.hint,
              code: historyError.code
            });
            toast.error(`メール送信履歴の保存に失敗しました: ${historyError.message}`);
          } else {
            console.log('✅ メール送信履歴を保存しました:', historyData);
            toast.success('メール送信履歴を保存しました');
            
            // メール送信履歴を再取得
            await fetchSendHistory();
            
            // 親コンポーネントにメール送信完了を通知
            if (onEmailSent) {
              onEmailSent();
            }
          }
        }
        
        // ローカルストレージにも保存（バックアップ）
        const logEntry = {
          scheduleId: schedule.id,
          sentAt: new Date().toISOString(),
          recipients: allRecipients,
          subject: customSubject,
          status: 'sent'
        };
        
        const existingLogs = JSON.parse(localStorage.getItem('emailSendHistory') || '[]');
        existingLogs.push(logEntry);
        localStorage.setItem('emailSendHistory', JSON.stringify(existingLogs));
        
      } catch (functionError) {
        console.error('Edge Function error:', functionError);
        console.error('Error details:', {
          message: functionError.message,
          stack: functionError.stack,
          name: functionError.name
        });
        toast.error('メール送信に失敗しました: ' + (functionError.message || 'Unknown error'));
        
        // 送信失敗履歴も保存
        const failureLogEntry = {
          scheduleId: schedule.id,
          sentAt: new Date().toISOString(),
          recipients: allRecipients,
          subject: customSubject,
          status: 'failed',
          error: functionError.message || 'Unknown error'
        };
        
        const existingLogs = JSON.parse(localStorage.getItem('emailSendHistory') || '[]');
        existingLogs.push(failureLogEntry);
        localStorage.setItem('emailSendHistory', JSON.stringify(existingLogs));
      }

      // 成功時は既にtry文内でtoast.successを表示済み
      onClose();
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('メール送信に失敗しました');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen || !schedule) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all my-4 align-middle max-w-4xl w-full max-h-[95vh] flex flex-col">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {schedule.meetLink ? 'GoogleMeetURLのメール送信' : 'メール送信'}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 左側：テンプレート選択と編集 */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    テンプレート選択
                  </label>
                  <select
                    value={selectedTemplate.id}
                    onChange={(e) => {
                      const template = templates.find(t => t.id === e.target.value);
                      if (template) {
                        console.log('🔍 テンプレート選択変更:', {
                          from: selectedTemplate.name,
                          to: template.name,
                          templateSubject: template.subject,
                          templateBodyText: template.body_text,
                          templateBodyHtml: template.body_html
                        });
                        setSelectedTemplate(template);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {templates.map(template => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    件名
                  </label>
                  <input
                    type="text"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {schedule.meetLink && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      タイトル
                    </label>
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    本文
                  </label>
                  <textarea
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* 右側：送信先選択と履歴 */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {schedule.meetLink ? '送信先（顧客）' : '送信先（参加者）'}
                    {schedule.meetLink && (
                      <span className="text-xs text-gray-500 font-normal ml-2">
                        （カンマ区切りで複数入力可）
                      </span>
                    )}
                  </label>
                  {schedule.meetLink ? (
                    <textarea
                      value={customRecipients}
                      onChange={(e) => setCustomRecipients(e.target.value)}
                      placeholder="customer@example.com, another@example.com"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <div className="border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto">
                      {(schedule.participants || []).map(pid => {
                        const user = (users || []).find(u => u.id === pid);
                        if (!user) return null;
                        return (
                          <label key={pid} className="flex items-center space-x-2 py-1">
                            <input
                              type="checkbox"
                              checked={recipients.includes(pid)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setRecipients([...recipients, pid]);
                                } else {
                                  setRecipients(recipients.filter(id => id !== pid));
                                }
                              }}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                            <span className="text-sm">
                              {user.name} ({user.email})
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {!schedule.meetLink && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      追加の送信先メールアドレス（カンマ区切りで入力）
                    </label>
                    <textarea
                      value={customRecipients}
                      onChange={(e) => setCustomRecipients(e.target.value)}
                      placeholder="example@company.com, another@company.com"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div>
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Clock className="inline h-4 w-4 mr-1" />
                    送信履歴を{showHistory ? '隠す' : '表示'}
                  </button>
                  
                  {showHistory && (
                    <div className="mt-2 border border-gray-200 rounded-md p-3 max-h-80 overflow-y-auto">
                      {(() => {
                        const meetUrlHistory = sendHistory.filter(log => 
                          log.email_type === 'meet_url' || 
                          (log.body && log.body.includes(schedule?.meetLink || ''))
                        );
                        
                        if (meetUrlHistory.length === 0) {
                          return (
                            <div className="text-xs text-gray-500 text-center py-4">
                              まだメールが送信されていません
                            </div>
                          );
                        }
                        
                        return (
                          <div className="space-y-2">
                            {meetUrlHistory.map((log, index) => (
                              <div key={index} className="bg-blue-50 p-3 rounded-lg text-xs">
                                <div className="font-medium text-blue-900">
                                  操作者名: {log.sender_name || '不明'}
                                </div>
                                <div className="text-blue-700 mt-1">
                                  操作日時: {new Date(log.sent_at || log.created_at).toLocaleString('ja-JP', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </div>
                                <div className="text-blue-600 mt-1">
                                  送信先メールアドレス: {Array.isArray(log.recipient_emails) ? log.recipient_emails.join(', ') : '不明'}
                                </div>
                                <div className="text-blue-500 mt-1">
                                  件名: {log.subject || '件名なし'}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse flex-shrink-0">
            <button
              onClick={handleSend}
              disabled={isSending}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  送信中...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  送信
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}