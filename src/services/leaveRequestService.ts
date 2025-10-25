import { supabase } from '../lib/supabase';

export interface LeaveRequest {
  id: string;
  type: string;
  userId: string;
  date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvers: Array<{
    step: number;
    status: 'pending' | 'approved' | 'rejected';
    userId: string;
    userName: string;
    timestamp: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

export class LeaveRequestService {
  /**
   * 承認された休暇申請を取得
   */
  static async getApprovedLeaveRequests(startDate: Date, endDate: Date): Promise<LeaveRequest[]> {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('status', 'approved')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) throw error;

      return data?.map(request => ({
        id: request.id,
        type: request.type,
        userId: request.user_id,
        date: request.date,
        reason: request.reason,
        status: request.status,
        approvers: request.approvers,
        createdAt: request.created_at,
        updatedAt: request.updated_at
      })) || [];
    } catch (error) {
      console.error('Error fetching approved leave requests:', error);
      return [];
    }
  }

  /**
   * 特定のユーザーの承認された休暇申請を取得
   */
  static async getApprovedLeaveRequestsByUser(userId: string, startDate: Date, endDate: Date): Promise<LeaveRequest[]> {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) throw error;

      return data?.map(request => ({
        id: request.id,
        type: request.type,
        userId: request.user_id,
        date: request.date,
        reason: request.reason,
        status: request.status,
        approvers: request.approvers,
        createdAt: request.created_at,
        updatedAt: request.updated_at
      })) || [];
    } catch (error) {
      console.error('Error fetching approved leave requests by user:', error);
      return [];
    }
  }
}
