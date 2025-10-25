import { supabase } from '../lib/supabase';
import { Holiday, HolidayType } from '../types';

export class HolidayService {
  /**
   * 指定された期間の祝日・休日を取得
   */
  static async getHolidays(startDate: Date, endDate: Date): Promise<Holiday[]> {
    try {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .eq('is_active', true)
        .order('date', { ascending: true });

      if (error) throw error;

      return data?.map(holiday => ({
        id: holiday.id,
        date: new Date(holiday.date + 'T00:00:00'), // ローカル時間として処理
        name: holiday.name,
        type: holiday.type as HolidayType,
        isActive: holiday.is_active,
        createdAt: new Date(holiday.created_at),
        updatedAt: new Date(holiday.updated_at),
        createdBy: holiday.created_by,
        updatedBy: holiday.updated_by
      })) || [];
    } catch (error) {
      console.error('Error fetching holidays:', error);
      return [];
    }
  }

  /**
   * 管理者用：全ての祝日・休日を取得（is_activeに関係なく）
   */
  static async getAllHolidays(startDate: Date, endDate: Date): Promise<Holiday[]> {
    try {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) throw error;

      return data?.map(holiday => ({
        id: holiday.id,
        date: new Date(holiday.date + 'T00:00:00'), // ローカル時間として処理
        name: holiday.name,
        type: holiday.type as HolidayType,
        isActive: holiday.is_active,
        createdAt: new Date(holiday.created_at),
        updatedAt: new Date(holiday.updated_at),
        createdBy: holiday.created_by,
        updatedBy: holiday.updated_by
      })) || [];
    } catch (error) {
      console.error('Error fetching all holidays:', error);
      return [];
    }
  }

  /**
   * 指定された日付の祝日・休日を取得
   */
  static async getHolidayByDate(date: Date): Promise<Holiday | null> {
    try {
      const dateStr = date.toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .eq('date', dateStr)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
      if (!data) return null;

      return {
        id: data.id,
        date: new Date(data.date + 'T00:00:00'), // ローカル時間として処理
        name: data.name,
        type: data.type as HolidayType,
        isActive: data.is_active,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        createdBy: data.created_by,
        updatedBy: data.updated_by
      };
    } catch (error) {
      console.error('Error fetching holiday by date:', error);
      return null;
    }
  }

  /**
   * 会社休日を追加
   */
  static async addCompanyHoliday(date: Date, name: string): Promise<Holiday | null> {
    try {
      const { data, error } = await supabase
        .from('holidays')
        .insert({
          date: date.toISOString().split('T')[0],
          name,
          type: 'company_holiday',
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        date: new Date(data.date + 'T00:00:00'), // ローカル時間として処理
        name: data.name,
        type: data.type as HolidayType,
        isActive: data.is_active,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        createdBy: data.created_by,
        updatedBy: data.updated_by
      };
    } catch (error) {
      console.error('Error adding company holiday:', error);
      return null;
    }
  }

  /**
   * 会社休日を更新
   */
  static async updateCompanyHoliday(id: string, updates: Partial<Pick<Holiday, 'name' | 'isActive'>>): Promise<Holiday | null> {
    try {
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

      const { data, error } = await supabase
        .from('holidays')
        .update(updateData)
        .eq('id', id)
        .eq('type', 'company_holiday') // 会社休日のみ更新可能
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        date: new Date(data.date + 'T00:00:00'), // ローカル時間として処理
        name: data.name,
        type: data.type as HolidayType,
        isActive: data.is_active,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        createdBy: data.created_by,
        updatedBy: data.updated_by
      };
    } catch (error) {
      console.error('Error updating company holiday:', error);
      return null;
    }
  }

  /**
   * 会社休日を削除
   */
  static async deleteCompanyHoliday(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('holidays')
        .delete()
        .eq('id', id)
        .eq('type', 'company_holiday'); // 会社休日のみ削除可能

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting company holiday:', error);
      return false;
    }
  }

  /**
   * 祝日APIから祝日データを取得（将来の実装用）
   */
  static async fetchNationalHolidays(year: number): Promise<Holiday[]> {
    // 将来的に祝日APIを実装する場合のプレースホルダー
    // 現在は手動でデータベースに挿入済み
    console.log(`Fetching national holidays for year ${year} - Not implemented yet`);
    return [];
  }

  /**
   * 指定された日付が祝日・休日かどうかを判定
   */
  static async isHoliday(date: Date): Promise<{ isHoliday: boolean; holiday: Holiday | null }> {
    const holiday = await this.getHolidayByDate(date);
    return {
      isHoliday: holiday !== null,
      holiday
    };
  }

  /**
   * 指定された日付が土日かどうかを判定
   */
  static isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
  }

  /**
   * 指定された日付が営業日かどうかを判定
   */
  static async isBusinessDay(date: Date): Promise<boolean> {
    // 土日は営業日ではない
    if (this.isWeekend(date)) return false;
    
    // 祝日・休日は営業日ではない
    const { isHoliday } = await this.isHoliday(date);
    return !isHoliday;
  }
}

export const holidayService = new HolidayService();
