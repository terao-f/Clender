import { supabase } from '../lib/supabase';
import { ScheduleHistory, Schedule, User } from '../types';

export class ScheduleHistoryService {
  /**
   * スケジュール操作履歴を記録する
   */
  static async recordOperation(
    scheduleId: string,
    operationType: 'create' | 'update' | 'delete',
    operator: User,
    description: string,
    scheduleData?: Schedule
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('schedule_history')
        .insert({
          schedule_id: scheduleId,
          operation_type: operationType,
          operator_id: operator.id,
          operator_name: operator.name,
          operation_time: new Date().toISOString(),
          description,
          schedule_data: scheduleData ? {
            title: scheduleData.title,
            type: scheduleData.type,
            startTime: scheduleData.startTime.toISOString(),
            endTime: scheduleData.endTime.toISOString(),
            isAllDay: scheduleData.isAllDay,
            isMultiDay: scheduleData.isMultiDay,
            participants: scheduleData.participants,
            equipment: scheduleData.equipment,
            details: scheduleData.details
          } : null
        });

      if (error) {
        console.error('Failed to record schedule history:', error);
      }
    } catch (err) {
      console.error('Error recording schedule history:', err);
    }
  }

  /**
   * スケジュール履歴を取得する
   */
  static async getScheduleHistory(scheduleId: string): Promise<ScheduleHistory[]> {
    try {
      const { data, error } = await supabase
        .from('schedule_history')
        .select('*')
        .eq('schedule_id', scheduleId)
        .order('operation_time', { ascending: false });

      if (error) {
        console.error('Failed to fetch schedule history:', error);
        return [];
      }

      return data?.map(item => ({
        id: item.id,
        scheduleId: item.schedule_id,
        operationType: item.operation_type,
        operatorId: item.operator_id,
        operatorName: item.operator_name,
        operationTime: new Date(item.operation_time),
        description: item.description,
        scheduleData: item.schedule_data,
        createdAt: new Date(item.created_at)
      })) || [];
    } catch (err) {
      console.error('Error fetching schedule history:', err);
      return [];
    }
  }

  /**
   * 全てのスケジュール履歴を取得する（管理者向け）
   */
  static async getAllScheduleHistory(limit: number = 100): Promise<ScheduleHistory[]> {
    try {
      const { data, error } = await supabase
        .from('schedule_history')
        .select('*')
        .order('operation_time', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Failed to fetch all schedule history:', error);
        return [];
      }

      return data?.map(item => ({
        id: item.id,
        scheduleId: item.schedule_id,
        operationType: item.operation_type,
        operatorId: item.operator_id,
        operatorName: item.operator_name,
        operationTime: new Date(item.operation_time),
        description: item.description,
        scheduleData: item.schedule_data,
        createdAt: new Date(item.created_at)
      })) || [];
    } catch (err) {
      console.error('Error fetching all schedule history:', err);
      return [];
    }
  }

  /**
   * 操作者別の履歴を取得する
   */
  static async getHistoryByOperator(operatorId: string, limit: number = 50): Promise<ScheduleHistory[]> {
    try {
      const { data, error } = await supabase
        .from('schedule_history')
        .select('*')
        .eq('operator_id', operatorId)
        .order('operation_time', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Failed to fetch history by operator:', error);
        return [];
      }

      return data?.map(item => ({
        id: item.id,
        scheduleId: item.schedule_id,
        operationType: item.operation_type,
        operatorId: item.operator_id,
        operatorName: item.operator_name,
        operationTime: new Date(item.operation_time),
        description: item.description,
        scheduleData: item.schedule_data,
        createdAt: new Date(item.created_at)
      })) || [];
    } catch (err) {
      console.error('Error fetching history by operator:', err);
      return [];
    }
  }

  /**
   * 操作種別別の履歴を取得する
   */
  static async getHistoryByOperationType(
    operationType: 'create' | 'update' | 'delete',
    limit: number = 50
  ): Promise<ScheduleHistory[]> {
    try {
      const { data, error } = await supabase
        .from('schedule_history')
        .select('*')
        .eq('operation_type', operationType)
        .order('operation_time', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Failed to fetch history by operation type:', error);
        return [];
      }

      return data?.map(item => ({
        id: item.id,
        scheduleId: item.schedule_id,
        operationType: item.operation_type,
        operatorId: item.operator_id,
        operatorName: item.operator_name,
        operationTime: new Date(item.operation_time),
        description: item.description,
        scheduleData: item.schedule_data,
        createdAt: new Date(item.created_at)
      })) || [];
    } catch (err) {
      console.error('Error fetching history by operation type:', err);
      return [];
    }
  }

  /**
   * 履歴の説明文を生成する
   */
  static generateDescription(
    operationType: 'create' | 'update' | 'delete',
    scheduleTitle: string,
    operator: User
  ): string {
    switch (operationType) {
      case 'create':
        return `${operator.name} が「${scheduleTitle}」スケジュールを作成しました。`;
      case 'update':
        return `${operator.name} が「${scheduleTitle}」スケジュールを編集しました。`;
      case 'delete':
        return `${operator.name} が「${scheduleTitle}」スケジュールを削除しました。`;
      default:
        return `${operator.name} がスケジュールを操作しました。`;
    }
  }
}

export default ScheduleHistoryService;