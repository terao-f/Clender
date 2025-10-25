import { LeaveRequest, User } from '../types';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

export interface EmailRecipient {
  email: string;
  name: string;
}

export interface LeaveRequestEmailData {
  request: LeaveRequest;
  applicant: User;
  recipients: EmailRecipient[];
  type: 'received' | 'approved' | 'rejected' | 'cancelled' | 'pending_president' | 'final_approved';
}

export function getLeaveTypeLabel(type: string): string {
  switch (type) {
    case 'vacation': return '休暇';
    case 'late': return '遅刻';
    case 'early': return '早退';
    default: return type;
  }
}

export function generateLeaveRequestEmailSubject(data: LeaveRequestEmailData): string {
  const { request, applicant, type } = data;
  const leaveType = getLeaveTypeLabel(request.type);
  const date = format(new Date(request.date), 'M月d日(E)', { locale: ja });

  switch (type) {
    case 'received':
      return `【休暇申請】${applicant.name}さんから${leaveType}申請がありました（${date}）`;
    case 'pending_president':
      return `【最終承認要請】${applicant.name}さんの${leaveType}申請の最終承認をお願いします（${date}）`;
    case 'final_approved':
      return `【承認完了】${applicant.name}さんの${leaveType}申請が承認されました（${date}）`;
    case 'approved':
      return `【承認完了】${applicant.name}さんの${leaveType}申請が承認されました（${date}）`;
    case 'rejected':
      return `【却下】${applicant.name}さんの${leaveType}申請が却下されました（${date}）`;
    case 'cancelled':
      return `【キャンセル】${applicant.name}さんが${leaveType}申請をキャンセルしました（${date}）`;
    default:
      return `【休暇申請】${applicant.name}さんの${leaveType}申請（${date}）`;
  }
}

export function generateLeaveRequestEmailBody(data: LeaveRequestEmailData): string {
  const { request, applicant, type, recipients } = data;
  const leaveType = getLeaveTypeLabel(request.type);
  const date = format(new Date(request.date), 'yyyy年M月d日(E)', { locale: ja });

  let statusMessage = '';
  let actionMessage = '';
  
  switch (type) {
    case 'received':
      statusMessage = '休暇申請のリクエストを受け付けました、承認してください。';
      actionMessage = '\n※ 承認者の皆様へ：システムにログインして承認処理を行ってください。';
      break;
    case 'pending_president':
      statusMessage = '休暇申請のリクエストを受け付けました、承認してください。';
      actionMessage = '\n※ 社長承認待ちの状態です。システムにログインして承認処理を行ってください。';
      break;
    case 'final_approved':
      statusMessage = '休暇申請が承認されました。';
      actionMessage = '\n※ 承認プロセスが完了しました。';
      break;
    case 'approved':
      statusMessage = '以下の休暇申請が承認されました。';
      break;
    case 'rejected':
      statusMessage = '以下の休暇申請が却下されました。';
      break;
    case 'cancelled':
      statusMessage = '以下の休暇申請がキャンセルされました。';
      break;
  }
  
  // 人事担当者への特別な通知メッセージ
  const isHrRecipient = recipients.some(r => r.email && data.recipients.find(recipient => 
    recipient.email === r.email && applicant.id !== recipient.email
  ));
  if (type === 'final_approved' && isHrRecipient) {
    statusMessage += '\n※ 人事担当者への通知：社長承認が完了しました。';
  }

  return `
${statusMessage}

【申請者情報】
申請者名：${applicant.name}
申請者所属：${applicant.department}

【申請内容】
申請種別：${leaveType}
申請日時：${date}
理由：${request.reason}

【承認状況】
${formatApproversStatus(request.approvers)}
${actionMessage}

--------------------
このメールは自動送信されています。
株式会社テラオエフ
`.trim();
}

function formatApproversStatus(approvers: any[]): string {
  if (!approvers || approvers.length === 0) {
    return '承認者なし';
  }

  return approvers
    .map((approver, index) => {
      const statusLabel = approver.status === 'approved' ? '✓ 承認済み' : 
                         approver.status === 'rejected' ? '✗ 却下' : 
                         '- 承認待ち';
      const timestamp = approver.timestamp ? 
        format(new Date(approver.timestamp), 'yyyy/MM/dd HH:mm') : '';
      
      return `${index + 1}. ${approver.userName || '不明'}: ${statusLabel} ${timestamp}`;
    })
    .join('\n');
}

// メール送信対象者を取得する関数
export async function getLeaveRequestEmailRecipients(
  request: LeaveRequest,
  applicant: User,
  allUsers: User[],
  leaveGroupMembers: string[],
  type: 'received' | 'approved' | 'rejected' | 'cancelled' | 'pending_president' | 'final_approved'
): Promise<EmailRecipient[]> {
  const recipients: EmailRecipient[] = [];
  const addedEmails = new Set<string>();

  // Resendのテスト制限のため、一時的にk.sho626626@gmail.comのみに送信
  const allowedTestEmail = 'k.sho626626@gmail.com';
  
  // テスト用の制限された受信者リスト
  const testRecipient: EmailRecipient = {
    email: allowedTestEmail,
    name: 'テストユーザー'
  };

  // A. 社員が休暇申請を送った先の、休暇申請グループのメンバーに
  if (type === 'received') {
    // テスト環境では許可されたメールアドレスのみ
    recipients.push(testRecipient);
    return recipients;
  }

  // B. 社長に休暇申請の最後の承認のリクエストが送られたとき
  if (type === 'pending_president') {
    // テスト環境では許可されたメールアドレスのみ
    recipients.push(testRecipient);
    return recipients;
  }

  // C. 社長が承認したときに、関係者全員（本人・休暇申請グループ・社長・人事）に
  if (type === 'final_approved') {
    // テスト環境では許可されたメールアドレスのみ
    recipients.push(testRecipient);
    return recipients;
  }

  // 従来の処理（rejected, cancelled等）
  // テスト環境では全て許可されたメールアドレスのみ
  recipients.push(testRecipient);
  return recipients;
}