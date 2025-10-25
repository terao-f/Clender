import { utils, write } from 'xlsx';
import { Schedule } from '../types';

export function exportToExcel(schedules: Schedule[], filename: string = 'schedules.xlsx') {
  // Convert schedules to worksheet format
  const wsData = schedules.map(schedule => ({
    'ID': schedule.id,
    '種別': schedule.type,
    'タイトル': schedule.title,
    '詳細': schedule.details,
    '開始時間': schedule.startTime.toLocaleString(),
    '終了時間': schedule.endTime.toLocaleString(),
    '参加者数': schedule.participants.length,
    '作成日時': schedule.createdAt.toLocaleString(),
  }));

  // Create worksheet
  const ws = utils.json_to_sheet(wsData);

  // Create workbook
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Schedules');

  // Generate Excel file
  write(wb, { bookType: 'xlsx', type: 'array' });

  // Trigger download
  const blob = new Blob([write(wb, { bookType: 'xlsx', type: 'array' })], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}