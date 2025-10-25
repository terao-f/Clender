import { supabase } from '../lib/supabase';

export interface OperationLog {
  id: string;
  operation_type: 'CREATE' | 'UPDATE' | 'DELETE';
  target_type: 'SCHEDULE' | 'USER' | 'ROOM' | 'VEHICLE';
  target_id: string;
  target_title?: string;
  operator_id: string;
  operator_name: string;
  operation_details?: any;
  created_at: string;
}

export interface CreateOperationLogParams {
  operation_type: 'CREATE' | 'UPDATE' | 'DELETE';
  target_type: 'SCHEDULE' | 'USER' | 'ROOM' | 'VEHICLE';
  target_id: string;
  target_title?: string;
  operator_id: string;
  operator_name: string;
  operation_details?: any;
}

class OperationLogService {
  /**
   * 操作履歴を記録する
   */
  async logOperation(params: CreateOperationLogParams): Promise<void> {
    try {
      const { error } = await supabase
        .from('operation_logs')
        .insert([params]);

      if (error) {
        console.error('操作履歴の記録に失敗しました:', error);
        // エラーが発生してもアプリケーションの動作は継続
      }
    } catch (error) {
      console.error('操作履歴の記録中にエラーが発生しました:', error);
    }
  }

  /**
   * 操作履歴を取得する（管理者用）
   */
  async getOperationLogs(limit: number = 100, offset: number = 0): Promise<OperationLog[]> {
    try {
      const { data, error } = await supabase
        .from('operation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('操作履歴の取得に失敗しました:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('操作履歴の取得中にエラーが発生しました:', error);
      return [];
    }
  }

  /**
   * 操作履歴の総数を取得する
   */
  async getOperationLogsCount(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('operation_logs')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error('操作履歴数の取得に失敗しました:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('操作履歴数の取得中にエラーが発生しました:', error);
      return 0;
    }
  }

  /**
   * 操作履歴を日本語でフォーマットする
   */
  formatOperationLog(log: OperationLog): string {
    const date = new Date(log.created_at).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const operationText = this.getOperationText(log.operation_type);
    const targetText = this.getTargetText(log.target_type, log.target_title);

    return `「${date}」に「${log.operator_name}」が「${targetText}」を「${operationText}」しました。`;
  }

  /**
   * 操作タイプを日本語に変換
   */
  private getOperationText(operationType: string): string {
    switch (operationType) {
      case 'CREATE':
        return '作成';
      case 'UPDATE':
        return '編集';
      case 'DELETE':
        return '削除';
      default:
        return operationType;
    }
  }

  /**
   * 操作対象を日本語で表示
   */
  private getTargetText(targetType: string, targetTitle?: string): string {
    const typeText = this.getTargetTypeText(targetType);
    
    if (targetTitle) {
      return `${typeText}「${targetTitle}」`;
    }
    
    return typeText;
  }

  /**
   * 操作対象タイプを日本語に変換
   */
  private getTargetTypeText(targetType: string): string {
    switch (targetType) {
      case 'SCHEDULE':
        return 'スケジュール';
      case 'USER':
        return 'ユーザー';
      case 'ROOM':
        return '会議室';
      case 'VEHICLE':
        return '車両';
      default:
        return targetType;
    }
  }
}

export const operationLogService = new OperationLogService();

