import { supabase } from '../lib/supabase';
import { LeaveRequest, User } from '../types';
import { 
  generateLeaveRequestEmailSubject, 
  generateLeaveRequestEmailBody,
  getLeaveRequestEmailRecipients 
} from '../utils/leaveRequestEmails';

export interface SendLeaveRequestEmailParams {
  request: LeaveRequest;
  applicant: User;
  allUsers: User[];
  leaveGroupMembers: string[];
  type: 'received' | 'approved' | 'rejected' | 'cancelled' | 'pending_president' | 'final_approved';
}

export async function sendLeaveRequestEmail(params: SendLeaveRequestEmailParams): Promise<void> {
  const { request, applicant, type } = params;

  // Email system disabled - logging instead of sending actual emails
  console.log('=== Leave Request Email Disabled ===');
  console.log('Request ID:', request.id);
  console.log('Type:', type);
  console.log('Applicant:', applicant.name, '(' + applicant.email + ')');
  console.log('Email sending has been disabled');
  console.log('=====================================');
  return;
}

// 承認者のメールアドレスを取得する関数
export async function getApproversEmails(approverIds: string[]): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('email')
      .in('id', approverIds);

    if (error) throw error;

    return data?.map(u => u.email) || [];
  } catch (error) {
    console.error('Error fetching approver emails:', error);
    return [];
  }
}