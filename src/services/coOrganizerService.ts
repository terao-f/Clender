import { supabase } from '../lib/supabase';

export interface CoOrganizerRequest {
  calendarEventId: string;
  coOrganizerEmail: string;
  userId: string;
}

export interface CoOrganizerResponse {
  success: boolean;
  eventId?: string;
  coOrganizers?: Array<{ email: string }>;
  message?: string;
  error?: string;
}

class CoOrganizerService {
  /**
   * 既存のGoogle Meet会議に共同主催者を追加
   */
  async addCoOrganizer(request: CoOrganizerRequest): Promise<CoOrganizerResponse> {
    try {
      console.log('Adding co-organizer:', request);

      const { data, error } = await supabase.functions.invoke('add-co-organizer', {
        body: request
      });

      if (error) {
        console.error('Co-organizer addition error:', error);
        return {
          success: false,
          error: error.message || '共同主催者の追加に失敗しました'
        };
      }

      console.log('Co-organizer added successfully:', data);
      return data;
    } catch (error) {
      console.error('Co-organizer service error:', error);
      return {
        success: false,
        error: (error as Error).message || '共同主催者の追加中にエラーが発生しました'
      };
    }
  }

  /**
   * スケジュールIDからGoogle CalendarイベントIDを取得して共同主催者を追加
   */
  async addCoOrganizerToSchedule(
    scheduleId: string, 
    coOrganizerEmail: string = 'terao.form@gmail.com'
  ): Promise<CoOrganizerResponse> {
    try {
      // スケジュール情報を取得
      const { data: schedule, error: scheduleError } = await supabase
        .from('schedules')
        .select('google_calendar_event_id, created_by')
        .eq('id', scheduleId)
        .single();

      if (scheduleError || !schedule) {
        return {
          success: false,
          error: 'スケジュールが見つかりません'
        };
      }

      if (!schedule.google_calendar_event_id) {
        return {
          success: false,
          error: 'このスケジュールにはGoogle Calendarイベントが関連付けられていません'
        };
      }

      // 共同主催者を追加
      return await this.addCoOrganizer({
        calendarEventId: schedule.google_calendar_event_id,
        coOrganizerEmail,
        userId: schedule.created_by
      });
    } catch (error) {
      console.error('Add co-organizer to schedule error:', error);
      return {
        success: false,
        error: (error as Error).message || '共同主催者の追加中にエラーが発生しました'
      };
    }
  }

  /**
   * オンライン会議のスケジュールにterao.formを自動的に共同主催者として追加
   */
  async addTeraoFormAsCoOrganizer(scheduleId: string): Promise<CoOrganizerResponse> {
    return await this.addCoOrganizerToSchedule(scheduleId, 'terao.form@gmail.com');
  }
}

export const coOrganizerService = new CoOrganizerService();













