import { notificationService } from '../services/notificationService';
import { User, LeaveRequest } from '../types';

export const leaveNotifications = {
  // 申請提出時の通知
  async notifyLeaveRequestSubmitted(
    request: LeaveRequest, 
    submitter: User, 
    approvers: User[],
    groupMembers: User[] = [],
    president?: User,
    hrMembers: User[] = []
  ) {
    const leaveTypeMap = {
      vacation: '休暇',
      late: '遅刻',
      early: '早退'
    };

    // 全通知対象者を収集（重複排除）
    const allRecipients = new Set<User>();
    
    // 本人を追加
    allRecipients.add(submitter);
    
    // グループメンバーを追加
    groupMembers.forEach(member => allRecipients.add(member));
    
    // 社長を追加
    if (president) {
      allRecipients.add(president);
    }
    
    // 人事を追加
    hrMembers.forEach(hr => allRecipients.add(hr));
    
    // 承認者も追加（既存の動作を維持）
    approvers.forEach(approver => allRecipients.add(approver));

    // 各対象者に適切なメッセージを送信
    for (const recipient of allRecipients) {
      let message: string;
      let title: string;
      
      if (recipient.id === submitter.id) {
        // 本人への通知
        message = `あなたの${leaveTypeMap[request.type]}申請を提出しました。`;
        title = '休暇申請提出完了';
      } else {
        // その他の人への通知
        message = `${submitter.name}さんから${leaveTypeMap[request.type]}申請が提出されました。`;
        title = '休暇申請通知';
      }
      
      try {
        await notificationService.sendPush({
          title,
          body: message,
          userId: recipient.id,
          type: 'leave_request',
          data: {
            requestId: request.id,
            submitterId: submitter.id,
            leaveType: request.type,
            date: request.date.toISOString()
          }
        });
      } catch (error) {
        console.warn('Push notification skipped (Edge Function not configured):', error);
      }

      // アプリ内通知ログ
      await notificationService.logNotification({
        userId: recipient.id,
        type: 'in_app',
        category: 'leave_request_submitted',
        subject: title,
        content: message,
        metadata: {
          requestId: request.id,
          submitterId: submitter.id,
          leaveType: request.type,
          date: request.date.toISOString()
        },
        status: 'sent'
      });
    }

  },

  // グループ承認完了時の通知（社長への通知 + 全関係者への進捗通知）
  async notifyGroupApprovalComplete(
    request: LeaveRequest,
    submitter: User,
    president?: User,
    groupMembers: User[] = [],
    hrMembers: User[] = []
  ) {
    const leaveTypeMap = {
      vacation: '休暇',
      late: '遅刻', 
      early: '早退'
    };

    // 全関係者に進捗通知
    const allRecipients = new Set<User>();
    
    // 本人を追加
    allRecipients.add(submitter);
    
    // グループメンバーを追加
    groupMembers.forEach(member => allRecipients.add(member));
    
    // 社長を追加
    if (president) {
      allRecipients.add(president);
    }
    
    // 人事を追加
    hrMembers.forEach(hr => allRecipients.add(hr));

    for (const recipient of allRecipients) {
      let message: string;
      let title: string;
      
      if (recipient.id === president?.id) {
        // 社長への通知
        message = `${submitter.name}さんの${leaveTypeMap[request.type]}申請がグループ承認を完了しました。最終承認をお願いします。`;
        title = '休暇申請承認待ち';
      } else if (recipient.id === submitter.id) {
        // 本人への通知
        message = `あなたの${leaveTypeMap[request.type]}申請がグループ承認を完了しました。最終承認待ちです。`;
        title = '休暇申請進捗通知';
      } else {
        // その他の人への通知
        message = `${submitter.name}さんの${leaveTypeMap[request.type]}申請がグループ承認を完了しました。`;
        title = '休暇申請進捗通知';
      }

      try {
        await notificationService.sendPush({
          title,
          body: message,
          userId: recipient.id,
          type: recipient.id === president?.id ? 'leave_approval_required' : 'leave_progress',
          data: {
            requestId: request.id,
            submitterId: submitter.id,
            leaveType: request.type,
            date: request.date.toISOString()
          }
        });
      } catch (error) {
        console.warn('Push notification skipped (Edge Function not configured):', error);
      }

      // アプリ内通知ログ
      await notificationService.logNotification({
        userId: recipient.id,
        type: 'in_app',
        category: 'leave_request_submitted',
        subject: title,
        content: message,
        metadata: {
          requestId: request.id,
          submitterId: submitter.id,
          leaveType: request.type,
          date: request.date.toISOString()
        },
        status: 'sent'
      });
    }

  },

  // 最終承認完了時の通知（申請者・人事・グループメンバーへ）
  async notifyFinalApprovalComplete(
    request: LeaveRequest,
    submitter: User,
    approved: boolean,
    groupMembers: User[] = [],
    hrMembers: User[] = []
  ) {
    const leaveTypeMap = {
      vacation: '休暇',
      late: '遅刻',
      early: '早退'
    };

    const status = approved ? '承認' : '却下';
    const title = `休暇申請${status}通知`;

    const submitterMessage = `あなたの${leaveTypeMap[request.type]}申請が${status}されました。`;

    // 申請者への通知
    try {
      await notificationService.sendPush({
        title,
        body: submitterMessage,
        userId: submitter.id,
        type: approved ? 'leave_approved' : 'leave_rejected',
        data: {
          requestId: request.id,
          leaveType: request.type,
          date: request.date.toISOString(),
          approved
        }
      });
    } catch (error) {
      console.warn('Push notification skipped (Edge Function not configured):', error);
    }

    // アプリ内通知ログ
    await notificationService.logNotification({
      userId: submitter.id,
      type: 'in_app',
      category: approved ? 'leave_request_approved' : 'leave_request_rejected',
      subject: title,
      content: submitterMessage,
      metadata: {
        requestId: request.id,
        leaveType: request.type,
        date: request.date.toISOString(),
        approved
      },
      status: 'sent'
    });

    if (approved) {
      // グループメンバーへの通知
      for (const member of groupMembers) {
        if (member.id !== submitter.id) {
          try {
            await notificationService.sendPush({
              title: '休暇申請承認通知',
              body: `${submitter.name}さんの${leaveTypeMap[request.type]}申請が承認されました。`,
              userId: member.id,
              type: 'leave_approved_info',
              data: {
                requestId: request.id,
                submitterId: submitter.id,
                leaveType: request.type,
                date: request.date.toISOString()
              }
            });
          } catch (error) {
            console.warn('Push notification skipped:', error);
          }
        }
      }

      // 人事への通知
      for (const hrMember of hrMembers) {
        try {
          await notificationService.sendPush({
            title: '休暇申請承認完了',
            body: `${submitter.name}さんの${leaveTypeMap[request.type]}申請が最終承認されました。`,
            userId: hrMember.id,
            type: 'leave_hr_notification',
            data: {
              requestId: request.id,
              submitterId: submitter.id,
              leaveType: request.type,
              date: request.date.toISOString()
            }
          });
        } catch (error) {
          console.warn('Push notification skipped:', error);
        }
      }
    }

  },

  // 個別承認時の通知（申請者への進捗報告）
  async notifyApprovalProgress(
    request: LeaveRequest,
    submitter: User,
    approver: User,
    approved: boolean
  ) {
    const action = approved ? '承認' : '却下';
    
    try {
      await notificationService.sendPush({
        title: '休暇申請進捗通知',
        body: `${approver.name}さんがあなたの休暇申請を${action}しました。`,
        userId: submitter.id,
        type: 'leave_progress',
        data: {
          requestId: request.id,
          approverId: approver.id,
          approved,
          date: request.date.toISOString()
        }
      });
    } catch (error) {
      console.warn('Push notification skipped (Edge Function not configured):', error);
    }
  },

  // 申請受信時の通知（承認者が申請を受け取った時）
  async notifyLeaveRequestReceived(
    request: LeaveRequest,
    submitter: User,
    receiver: User,
    groupMembers: User[] = [],
    president?: User,
    hrMembers: User[] = []
  ) {
    const leaveTypeMap = {
      vacation: '休暇',
      late: '遅刻',
      early: '早退'
    };

    // 全関係者に通知
    const allRecipients = new Set<User>();
    
    // 本人を追加
    allRecipients.add(submitter);
    
    // グループメンバーを追加
    groupMembers.forEach(member => allRecipients.add(member));
    
    // 社長を追加
    if (president) {
      allRecipients.add(president);
    }
    
    // 人事を追加
    hrMembers.forEach(hr => allRecipients.add(hr));

    for (const recipient of allRecipients) {
      let message: string;
      let title: string;
      
      if (recipient.id === submitter.id) {
        // 本人への通知
        message = `${receiver.name}さんがあなたの${leaveTypeMap[request.type]}申請を受信しました。`;
        title = '休暇申請受信通知';
      } else {
        // その他の人への通知
        message = `${receiver.name}さんが${submitter.name}さんの${leaveTypeMap[request.type]}申請を受信しました。`;
        title = '休暇申請受信通知';
      }
      
      try {
        await notificationService.sendPush({
          title,
          body: message,
          userId: recipient.id,
          type: 'leave_received',
          data: {
            requestId: request.id,
            submitterId: submitter.id,
            receiverId: receiver.id,
            leaveType: request.type,
            date: request.date.toISOString()
          }
        });
      } catch (error) {
        console.warn('Push notification skipped (Edge Function not configured):', error);
      }

      // アプリ内通知ログ
      await notificationService.logNotification({
        userId: recipient.id,
        type: 'in_app',
        category: 'leave_request_received',
        subject: title,
        content: message,
        metadata: {
          requestId: request.id,
          submitterId: submitter.id,
          receiverId: receiver.id,
          leaveType: request.type,
          date: request.date.toISOString()
        },
        status: 'sent'
      });
    }
  },

  // 申請キャンセル時の通知
  async notifyLeaveRequestCancelled(
    request: LeaveRequest,
    submitter: User,
    groupMembers: User[] = [],
    president?: User,
    hrMembers: User[] = []
  ) {
    const leaveTypeMap = {
      vacation: '休暇',
      late: '遅刻',
      early: '早退'
    };

    // 全関係者に通知
    const allRecipients = new Set<User>();
    
    // 本人を追加
    allRecipients.add(submitter);
    
    // グループメンバーを追加
    groupMembers.forEach(member => allRecipients.add(member));
    
    // 社長を追加
    if (president) {
      allRecipients.add(president);
    }
    
    // 人事を追加
    hrMembers.forEach(hr => allRecipients.add(hr));

    for (const recipient of allRecipients) {
      let message: string;
      let title: string;
      
      if (recipient.id === submitter.id) {
        // 本人への通知
        message = `あなたの${leaveTypeMap[request.type]}申請をキャンセルしました。`;
        title = '休暇申請キャンセル完了';
      } else {
        // その他の人への通知
        message = `${submitter.name}さんの${leaveTypeMap[request.type]}申請がキャンセルされました。`;
        title = '休暇申請キャンセル通知';
      }
      
      try {
        await notificationService.sendPush({
          title,
          body: message,
          userId: recipient.id,
          type: 'leave_cancelled',
          data: {
            requestId: request.id,
            submitterId: submitter.id,
            leaveType: request.type,
            date: request.date.toISOString()
          }
        });
      } catch (error) {
        console.warn('Push notification skipped (Edge Function not configured):', error);
      }

      // アプリ内通知ログ
      await notificationService.logNotification({
        userId: recipient.id,
        type: 'in_app',
        category: 'leave_request_cancelled',
        subject: title,
        content: message,
        metadata: {
          requestId: request.id,
          submitterId: submitter.id,
          leaveType: request.type,
          date: request.date.toISOString()
        },
        status: 'sent'
      });
    }
  },

  // 申請完了時の通知（承認プロセス完了）
  async notifyLeaveRequestCompleted(
    request: LeaveRequest,
    submitter: User,
    approved: boolean,
    groupMembers: User[] = [],
    president?: User,
    hrMembers: User[] = []
  ) {
    const leaveTypeMap = {
      vacation: '休暇',
      late: '遅刻',
      early: '早退'
    };

    const status = approved ? '承認' : '却下';
    
    // 全関係者に通知
    const allRecipients = new Set<User>();
    
    // 本人を追加
    allRecipients.add(submitter);
    
    // グループメンバーを追加
    groupMembers.forEach(member => allRecipients.add(member));
    
    // 社長を追加
    if (president) {
      allRecipients.add(president);
    }
    
    // 人事を追加
    hrMembers.forEach(hr => allRecipients.add(hr));

    for (const recipient of allRecipients) {
      let message: string;
      let title: string;
      
      if (recipient.id === submitter.id) {
        // 本人への通知
        message = `あなたの${leaveTypeMap[request.type]}申請が${status}されました。`;
        title = `休暇申請${status}通知`;
      } else {
        // その他の人への通知
        message = `${submitter.name}さんの${leaveTypeMap[request.type]}申請が${status}されました。`;
        title = `休暇申請${status}通知`;
      }
      
      try {
        await notificationService.sendPush({
          title,
          body: message,
          userId: recipient.id,
          type: approved ? 'leave_approved' : 'leave_rejected',
          data: {
            requestId: request.id,
            submitterId: submitter.id,
            leaveType: request.type,
            date: request.date.toISOString(),
            approved
          }
        });
      } catch (error) {
        console.warn('Push notification skipped (Edge Function not configured):', error);
      }

      // アプリ内通知ログ
      await notificationService.logNotification({
        userId: recipient.id,
        type: 'in_app',
        category: approved ? 'leave_request_approved' : 'leave_request_rejected',
        subject: title,
        content: message,
        metadata: {
          requestId: request.id,
          submitterId: submitter.id,
          leaveType: request.type,
          date: request.date.toISOString(),
          approved
        },
        status: 'sent'
      });
    }
  }
};