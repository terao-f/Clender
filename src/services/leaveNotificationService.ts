import { supabase } from '../lib/supabase';
import { LeaveRequest, User } from '../types';

export interface LeaveNotificationParams {
  leaveRequest: LeaveRequest;
  applicant: User;
  type: 'group_approval_request' | 'president_approval_request' | 'approval_notification';
  recipients: User[];
}

/**
 * 休暇申請通知メール送信サービス
 */
export class LeaveNotificationService {
  
  /**
   * 休暇申請通知メールを送信
   */
  async sendLeaveNotificationEmail(params: LeaveNotificationParams): Promise<boolean> {
    const { leaveRequest, applicant, type, recipients } = params;

    try {
      console.log('=== 休暇申請通知メール送信開始 ===');
      console.log('申請ID:', leaveRequest.id);
      console.log('通知タイプ:', type);
      console.log('申請者:', applicant.name);
      console.log('受信者数:', recipients.length);
      console.log('実際の受信者:', recipients.map(r => `${r.name} (${r.email})`));
      console.log('本番環境: 実際のメールアドレスに送信します');

      if (recipients.length === 0) {
        console.warn('メール受信者が見つかりません');
        return false;
      }

      // 申請者の所属部署を取得
      const applicantDepartment = this.getDepartmentDisplay(applicant.department);

      // メール送信データを準備
      const recipientEmails = recipients.map(r => r.email).filter(email => email && email.trim() !== '');
      
      if (recipientEmails.length === 0) {
        console.warn('有効なメールアドレスを持つ受信者がいません');
        return false;
      }
      
      console.log('メール送信先:', recipientEmails);
      
      const emailData = {
        to: recipientEmails, // 実際の受信者のメールアドレス
        type,
        leaveRequest: {
          id: leaveRequest.id,
          applicantName: applicant.name,
          applicantDepartment,
          leaveType: leaveRequest.leaveType,
          startDate: leaveRequest.startDate,
          endDate: leaveRequest.endDate,
          startTime: leaveRequest.startTime,
          endTime: leaveRequest.endTime,
          reason: leaveRequest.reason
        }
      };

      console.log('メール送信データ:', JSON.stringify(emailData, null, 2));

      // Supabase Edge Functionを呼び出してメール送信
      console.log('Calling Edge Function: send-leave-notification-email');
      const { data, error } = await supabase.functions.invoke('send-leave-notification-email', {
        body: emailData
      });
      console.log('Edge Function response:', { data, error });

      if (error) {
        console.error('メール送信Edge Functionエラー:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        return false;
      }

      if (!data) {
        console.error('Edge Functionからレスポンスがありません');
        return false;
      }

      if (!data.success) {
        console.error('メール送信失敗:', data.error);
        console.error('Full response data:', JSON.stringify(data, null, 2));
        return false;
      }

      console.log('メール送信成功:', data.data);
      console.log('=== 休暇申請通知メール送信完了 ===');
      
      return true;

    } catch (error) {
      console.error('休暇申請通知メール送信エラー:', error);
      return false;
    }
  }

  /**
   * A. 休暇申請グループメンバーへの承認依頼メール送信
   */
  async sendGroupApprovalRequest(
    leaveRequest: LeaveRequest,
    applicant: User,
    groupMembers: User[]
  ): Promise<boolean> {
    return this.sendLeaveNotificationEmail({
      leaveRequest,
      applicant,
      type: 'group_approval_request',
      recipients: groupMembers
    });
  }

  /**
   * B. 社長への最終承認依頼メール送信
   */
  async sendPresidentApprovalRequest(
    leaveRequest: LeaveRequest,
    applicant: User,
    president: User
  ): Promise<boolean> {
    return this.sendLeaveNotificationEmail({
      leaveRequest,
      applicant,
      type: 'president_approval_request',
      recipients: [president]
    });
  }

  /**
   * C. 関係者全員への承認完了通知メール送信
   */
  async sendApprovalNotification(
    leaveRequest: LeaveRequest,
    applicant: User,
    allRelatedUsers: User[]
  ): Promise<boolean> {
    return this.sendLeaveNotificationEmail({
      leaveRequest,
      applicant,
      type: 'approval_notification',
      recipients: allRelatedUsers
    });
  }

  /**
   * 部署名の表示用変換
   */
  private getDepartmentDisplay(department?: string): string {
    const departmentMap: { [key: string]: string } = {
      'head_office_1f': '本社１F',
      'head_office_2f': '本社２F', 
      'web': 'WEB',
      'sales': '営業部',
      'development': '開発部',
      'hr': '人事部'
    };
    
    return department ? departmentMap[department] || department : '未設定';
  }

  /**
   * 休暇申請に関連するすべてのユーザーを取得
   * （申請者・グループメンバー・社長・人事）
   */
  async getAllRelatedUsers(
    leaveRequest: LeaveRequest,
    applicant: User,
    groupMembers: User[],
    president: User | null,
    hrMembers: User[]
  ): Promise<User[]> {
    const allUsers = new Map<string, User>();

    // 申請者を追加
    allUsers.set(applicant.id, applicant);

    // グループメンバーを追加
    groupMembers.forEach(user => {
      allUsers.set(user.id, user);
    });

    // 社長を追加
    if (president) {
      allUsers.set(president.id, president);
    }

    // 人事メンバーを追加
    hrMembers.forEach(user => {
      allUsers.set(user.id, user);
    });

    return Array.from(allUsers.values());
  }
}

// シングルトンインスタンス
export const leaveNotificationService = new LeaveNotificationService();