// メール送信履歴をローカルストレージから取得
export function getEmailSentStatus(scheduleId: string): boolean {
  try {
    const emailLogs = JSON.parse(localStorage.getItem('email_logs') || '[]');
    return emailLogs.some((log: any) => 
      log.schedule_id === scheduleId && 
      log.status === 'sent'
    );
  } catch (error) {
    console.error('Error checking email status:', error);
    return false;
  }
}

// 複数のスケジュールのメール送信状態を一括取得
export function getEmailSentStatuses(scheduleIds: string[]): Record<string, boolean> {
  try {
    const emailLogs = JSON.parse(localStorage.getItem('email_logs') || '[]');
    const statusMap: Record<string, boolean> = {};
    
    scheduleIds.forEach(id => {
      statusMap[id] = emailLogs.some((log: any) => 
        log.schedule_id === id && 
        log.status === 'sent'
      );
    });
    
    return statusMap;
  } catch (error) {
    console.error('Error checking email statuses:', error);
    return {};
  }
}

// メール送信履歴を記録
export function recordEmailSent(scheduleId: string, recipients: string[], subject: string): void {
  try {
    const emailLogs = JSON.parse(localStorage.getItem('email_logs') || '[]');
    const newLog = {
      id: `log-${Date.now()}`,
      schedule_id: scheduleId,
      type: 'email',
      metadata: {
        recipients,
        subject,
      },
      status: 'sent',
      created_at: new Date().toISOString(),
    };
    
    emailLogs.push(newLog);
    localStorage.setItem('email_logs', JSON.stringify(emailLogs));
  } catch (error) {
    console.error('Error recording email sent:', error);
  }
}