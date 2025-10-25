import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Plus, Clock, CheckCircle, XCircle, X, Users } from 'lucide-react';
import { mockLeaveRequests, mockUsers, mockGroups } from '../../data/mockData';
import { useAuth } from '../../contexts/AuthContext';
import { LeaveRequest, LeaveType, LeaveStatus, User } from '../../types';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import ParticipantSelector from '../../components/ParticipantSelector';
import LeaveApprovalModal from '../../components/LeaveApprovalModal';
import { leaveNotifications } from '../../utils/leaveNotifications';
import { leaveNotificationService } from '../../services/leaveNotificationService';

export default function LeaveRequests() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'my' | 'pending' | 'approved'>('my');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<LeaveRequest>>({});
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);

  // State for leave requests
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [leaveApprovalGroups, setLeaveApprovalGroups] = useState<any[]>([]);
  const [additionalApprovers, setAdditionalApprovers] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [hrMembers, setHrMembers] = useState<User[]>([]);
  const [selectedLeaveGroups, setSelectedLeaveGroups] = useState<string[]>([]);
  const [userLeaveGroups, setUserLeaveGroups] = useState<any[]>([]);

  // Fetch leave requests and related data from Supabase
  useEffect(() => {
    fetchLeaveRequests();
    fetchLeaveApprovalGroups();
    fetchUsers();
    fetchHrMembers();
  }, []);

  // Fetch user's leave groups when current user changes
  useEffect(() => {
    if (currentUser && leaveApprovalGroups.length > 0) {
      fetchUserLeaveGroups();
    }
  }, [currentUser, leaveApprovalGroups]);

  // Fetch user's leave groups
  const fetchUserLeaveGroups = async () => {
    if (!currentUser) return;
    
    console.log('Current user:', currentUser.id, currentUser.name);
    console.log('All leave approval groups:', leaveApprovalGroups);
    console.log('Leave approval groups with members:', leaveApprovalGroups.map(g => ({
      id: g.id,
      name: g.name,
      members: g.members
    })));
    
    const userGroups = leaveApprovalGroups.filter(group => 
      group.members && group.members.includes(currentUser.id)
    );
    
    console.log('User belongs to groups:', userGroups);
    setUserLeaveGroups(userGroups);
    
    // Set default selection to all groups if user belongs to multiple groups
    if (userGroups.length > 1) {
      setSelectedLeaveGroups(userGroups.map(g => g.id));
    } else if (userGroups.length === 1) {
      setSelectedLeaveGroups([userGroups[0].id]);
    } else {
      setSelectedLeaveGroups([]);
    }
  };
  
  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Error fetching users:', error);
        setUsers(mockUsers);
      } else {
        const convertedUsers: User[] = data?.map(u => ({
          id: u.id,
          employeeId: u.employee_id,
          name: u.name,
          nameKana: u.name_kana,
          email: u.email,
          phone: u.phone,
          department: u.department,
          role: u.role,
          isHr: u.is_hr,
          defaultWorkDays: u.default_work_days || []
        })) || [];
        setUsers(convertedUsers);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers(mockUsers);
    }
  };

  const fetchHrMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_hr', true)
        .order('name');
      
      if (error) {
        console.error('Error fetching HR members:', error);
        setHrMembers([]);
      } else {
        const convertedHrMembers: User[] = data?.map(u => ({
          id: u.id,
          employeeId: u.employee_id,
          name: u.name,
          nameKana: u.name_kana,
          email: u.email,
          phone: u.phone,
          department: u.department,
          role: u.role,
          isHr: u.is_hr,
          defaultWorkDays: u.default_work_days || []
        })) || [];
        setHrMembers(convertedHrMembers);
      }
    } catch (error) {
      console.error('Error fetching HR members:', error);
      setHrMembers([]);
    }
  };
  
  const fetchLeaveApprovalGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('type', 'leave')
        .order('name');
      
      if (error) {
        console.error('Error fetching leave groups:', error);
        setLeaveApprovalGroups(mockGroups.filter(g => g.type === 'leave'));
      } else {
        setLeaveApprovalGroups(data || []);
      }
    } catch (error) {
      console.error('Error fetching leave groups:', error);
      setLeaveApprovalGroups(mockGroups.filter(g => g.type === 'leave'));
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch leave requests:', error);
        // Fallback to mock data only
        console.warn('Using mock data for leave requests');
        setLeaveRequests(mockLeaveRequests);
      } else if (data) {
        const convertedRequests: LeaveRequest[] = data.map(request => ({
          id: request.id,
          type: request.type,
          userId: request.user_id,
          date: new Date(request.date),
          reason: request.reason,
          status: request.status,
          approvers: request.approvers || [],
          createdAt: new Date(request.created_at)
        }));
        setLeaveRequests(convertedRequests);
      }
    } catch (err) {
      console.error('Error fetching leave requests:', err);
      console.warn('Using mock data for leave requests');
      setLeaveRequests(mockLeaveRequests);
    } finally {
      setIsLoading(false);
    }
  };

  // Get all required approvers (selected leave approval groups + additional approvers)
  const getRequiredApprovers = () => {
    const requiredApprovers = new Set<string>();
    
    // Add members from selected leave approval groups only
    selectedLeaveGroups.forEach(groupId => {
      const group = leaveApprovalGroups.find(g => g.id === groupId);
      if (group && group.members) {
        group.members.forEach((memberId: string) => {
          requiredApprovers.add(memberId);
        });
      }
    });
    
    // Add additional approvers
    additionalApprovers.forEach(approverId => {
      requiredApprovers.add(approverId);
    });
    
    return Array.from(requiredApprovers)
      .map(id => users.find(user => user.id === id))
      .filter((user): user is User => user !== undefined);
  };
  
  const approvers = getRequiredApprovers();
  
  // Get president for final approval
  const president = users.find(user => user.role === 'president');

  // Note: No longer saving to localStorage - only Supabase

  // Count pending approvals for current user
  const pendingApprovalsCount = leaveRequests.filter(request => 
    request.approvers.some(
      approver => approver.userId === currentUser?.id && approver.status === 'pending'
    )
  ).length;

  // Filter leave requests based on the active tab
  const filteredRequests = leaveRequests.filter(request => {
    if (activeTab === 'my') {
      return request.userId === currentUser?.id;
    } else if (activeTab === 'pending') {
      return request.approvers.some(
        approver => approver.userId === currentUser?.id && approver.status === 'pending'
      );
    } else if (activeTab === 'approved') {
      return request.approvers.some(
        approver => approver.userId === currentUser?.id && approver.status !== 'pending'
      );
    }
    return false;
  }).sort((a, b) => {
    // 自分の申請タブの場合は申請日（createdAt）で降順ソート
    if (activeTab === 'my') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    // その他のタブも降順ソート
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.date) {
      toast.error('日付を選択してください');
      return;
    }
    
    if (!formData.reason?.trim()) {
      toast.error('理由を入力してください');
      return;
    }

    if (selectedLeaveGroups.length === 0) {
      toast.error('申請先グループを選択してください');
      return;
    }

    // Check for duplicate date applications (prevent consecutive day registrations)
    const selectedDate = new Date(formData.date);
    const existingRequest = leaveRequests.find(request => 
      request.userId === currentUser?.id &&
      format(request.date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd') &&
      request.status !== 'rejected'
    );

    if (existingRequest) {
      toast.error('この日付には既に申請があります。連日での申請はできません。');
      return;
    }

    try {
      // Create workflow: Group Approvers -> President -> Final Status
      const allApprovers = [
        // Step 1: Group approvers (required + additional)
        ...approvers.map(approver => ({
          userId: approver.id,
          userName: approver.name,
          status: 'pending' as const,
          timestamp: null,
          step: 1
        })),
        // Step 2: President approval (if president exists and is not already in approvers)
        ...(president && !approvers.find(a => a.id === president.id) ? [{
          userId: president.id,
          userName: president.name,
          status: 'pending' as const,
          timestamp: null,
          step: 2
        }] : [])
      ];
      
      // Save to Supabase
      const { data, error } = await supabase
        .from('leave_requests')
        .insert([{
          type: formData.type as LeaveType || 'vacation',
          user_id: currentUser?.id || '',
          date: new Date(formData.date || new Date()).toISOString().split('T')[0],
          reason: formData.reason || '',
          status: 'pending',
          approvers: allApprovers
        }])
        .select()
        .single();

      if (error) {
        console.error('Error saving leave request:', error);
        toast.error('休暇申請の保存に失敗しました');
        return;
      } else if (data) {
        const newRequest: LeaveRequest = {
          id: data.id,
          type: data.type,
          userId: data.user_id,
          date: new Date(data.date),
          reason: data.reason,
          status: data.status,
          approvers: data.approvers || [],
          createdAt: new Date(data.created_at)
        };
        setLeaveRequests([...leaveRequests, newRequest]);
        toast.success('休暇申請を作成しました');

        // Send notification to all relevant parties
        if (currentUser) {
          try {
            // Get leave group members
            const leaveGroup = leaveApprovalGroups.find(g => 
              g.members.includes(currentUser.id)
            );
            const leaveGroupMembers = leaveGroup ? leaveGroup.members : [];
            const leaveGroupUsers = users.filter(u => leaveGroupMembers.includes(u.id));
            
            // Get president
            const president = users.find(u => u.role === 'president');
            
            // Send submission notification
            await leaveNotifications.notifyLeaveRequestSubmitted(
              newRequest,
              currentUser,
              approvers,
              leaveGroupUsers,
              president,
              hrMembers
            );
            
            // Send "received" notification to all stakeholders
            await leaveNotifications.notifyLeaveRequestReceived(
              newRequest,
              currentUser,
              currentUser, // receiver is the submitter initially
              leaveGroupUsers,
              president,
              hrMembers
            );
          } catch (notificationError) {
            console.error('Failed to send notification:', notificationError);
            // Don't fail the whole request if notification fails
          }

          // Send email notification - A. 休暇申請グループのメンバーに
          try {
            // Get leave group members who are not the applicant
            const leaveGroup = leaveApprovalGroups.find(g => 
              g.members.includes(currentUser.id)
            );
            const leaveGroupMembers = leaveGroup ? leaveGroup.members : [];
            const groupMembersToNotify = users.filter(u => 
              leaveGroupMembers.includes(u.id) && u.id !== currentUser.id
            );

            if (groupMembersToNotify.length > 0) {
              // メール送信用にLeaveRequestオブジェクトを拡張
              const requestForEmail = {
                ...newRequest,
                leaveType: newRequest.type,
                startDate: newRequest.date.toISOString().split('T')[0],
                endDate: newRequest.date.toISOString().split('T')[0],
                startTime: formData.startTime,
                endTime: formData.endTime
              };

              const emailSent = await leaveNotificationService.sendGroupApprovalRequest(
                requestForEmail,
                currentUser,
                groupMembersToNotify
              );
              
              if (emailSent) {
                console.log('休暇申請グループへの通知メール送信成功');
              } else {
                console.warn('休暇申請グループへの通知メール送信失敗');
              }
            }
          } catch (emailError) {
            console.error('Failed to send email notification:', emailError);
          }
        }
      }

      setIsModalOpen(false);
      setFormData({});
      setAdditionalApprovers([]);
      // Reset selected groups to default (all user's groups)
      if (userLeaveGroups.length > 1) {
        setSelectedLeaveGroups(userLeaveGroups.map(g => g.id));
      } else if (userLeaveGroups.length === 1) {
        setSelectedLeaveGroups([userLeaveGroups[0].id]);
      }
    } catch (err) {
      console.error('Error:', err);
      toast.error('休暇申請の作成中にエラーが発生しました');
    }
  };

  // Open approval modal
  const handleOpenApprovalModal = (request: LeaveRequest) => {
    setSelectedRequest(request);
    setIsApprovalModalOpen(true);
  };

  // Handle approval modal completion
  const handleApprovalComplete = () => {
    fetchLeaveRequests(); // Refresh the list
  };

  // Handle approval/rejection with step-based workflow
  const handleApproval = async (requestId: string, approved: boolean) => {
    const request = leaveRequests.find(r => r.id === requestId);
    if (!request) return;

    // Check if current user is the leave manager
    const { data: leaveManagerData } = await supabase
      .from('leave_manager_settings')
      .select('*')
      .eq('user_id', currentUser?.id)
      .eq('is_active', true)
      .single();
    const isLeaveManager = !!leaveManagerData;
    const isPresident = currentUser?.role === 'president';

    const updatedApprovers = request.approvers.map((approver: any) => {
      if (approver.userId === currentUser?.id) {
        return {
          ...approver,
          status: approved ? 'approved' : 'rejected' as const,
          timestamp: new Date(),
        };
      }
      return approver;
    });

    // Check workflow progress
    const step1Approvers = updatedApprovers.filter((a: any) => a.step === 1);
    const step2Approvers = updatedApprovers.filter((a: any) => a.step === 2); // Leave manager
    const step3Approvers = updatedApprovers.filter((a: any) => a.step === 3); // President
    
    const step1AllApproved = step1Approvers.length > 0 && step1Approvers.every((a: any) => a.status === 'approved');
    const step1AnyRejected = step1Approvers.some((a: any) => a.status === 'rejected');
    const step2AllApproved = step2Approvers.length === 0 || step2Approvers.every((a: any) => a.status === 'approved');
    const step2AnyRejected = step2Approvers.some((a: any) => a.status === 'rejected');
    const step3AllApproved = step3Approvers.length === 0 || step3Approvers.every((a: any) => a.status === 'approved');
    const step3AnyRejected = step3Approvers.some((a: any) => a.status === 'rejected');
    
    let newStatus: LeaveStatus = 'pending';
    
    if (step1AnyRejected || step2AnyRejected || step3AnyRejected) {
      newStatus = 'rejected';
    } else if (step1AllApproved && step2AllApproved && step3AllApproved) {
      newStatus = 'approved';
    } else {
      newStatus = 'pending';
    }

    try {
      // Update in Supabase
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: newStatus,
          approvers: updatedApprovers
        })
        .eq('id', requestId);

      if (error) {
        console.error('Error updating leave request:', error);
        toast.error('承認状態の更新に失敗しました');
      } else {
        // Update local state
        const updatedRequests = leaveRequests.map(r => {
          if (r.id === requestId) {
            return {
              ...r,
              status: newStatus,
              approvers: updatedApprovers,
            };
          }
          return r;
        });
        setLeaveRequests(updatedRequests);
        
        // Send notifications based on approval status
        const submitter = users.find(u => u.id === request.userId);
        if (submitter && currentUser) {
          try {
            // Always notify submitter of progress
            await leaveNotifications.notifyApprovalProgress(
              request,
              submitter,
              currentUser,
              approved
            );

            // Get leave group members for email
            const leaveGroup = leaveApprovalGroups.find(g => 
              g.members.includes(submitter.id)
            );
            const leaveGroupMembers = leaveGroup ? leaveGroup.members : [];

            // Check workflow progress for additional notifications
            if (approved) {
              if (step1AllApproved && step2Approvers.length > 0 && !step2AllApproved) {
                // Group approval complete, notify president
                await leaveNotifications.notifyGroupApprovalComplete(
                  request,
                  submitter,
                  president
                );
                
                // B. 社長に最終承認のリクエストメールを送信
                try {
                  if (president) {
                    const requestForEmail = {
                      ...request,
                      status: newStatus,
                      approvers: updatedApprovers,
                      leaveType: request.type,
                      startDate: request.date.toISOString().split('T')[0],
                      endDate: request.date.toISOString().split('T')[0]
                    };

                    const emailSent = await leaveNotificationService.sendPresidentApprovalRequest(
                      requestForEmail,
                      submitter,
                      president
                    );
                    
                    if (emailSent) {
                      console.log('社長への最終承認依頼メール送信成功');
                    } else {
                      console.warn('社長への最終承認依頼メール送信失敗');
                    }
                  }
                } catch (emailError) {
                  console.error('Failed to send president notification email:', emailError);
                }
                
                toast.success('申請を承認しました（社長承認待ち）');
              } else if (newStatus === 'approved') {
                // Final approval complete, notify everyone
                const groupMembers = approvers.filter(a => step1Approvers.some(s1 => s1.userId === a.id));
                
                // Send final approval notification
                await leaveNotifications.notifyFinalApprovalComplete(
                  request,
                  submitter,
                  true,
                  groupMembers,
                  hrMembers
                );
                
                // Send "completed" notification to all stakeholders
                const leaveGroup = leaveApprovalGroups.find(g => 
                  g.members.includes(submitter.id)
                );
                const leaveGroupUsers = leaveGroup ? users.filter(u => leaveGroup.members.includes(u.id)) : [];
                
                await leaveNotifications.notifyLeaveRequestCompleted(
                  { ...request, status: newStatus, approvers: updatedApprovers },
                  submitter,
                  true,
                  leaveGroupUsers,
                  president,
                  hrMembers
                );
                
                // C. 社長が承認したときに、関係者全員（本人・休暇申請グループ・社長・人事）にメール送信
                try {
                  const requestForEmail = {
                    ...request,
                    status: newStatus,
                    approvers: updatedApprovers,
                    leaveType: request.type,
                    startDate: request.date.toISOString().split('T')[0],
                    endDate: request.date.toISOString().split('T')[0]
                  };

                  const allRelatedUsers = await leaveNotificationService.getAllRelatedUsers(
                    requestForEmail,
                    submitter,
                    leaveGroupUsers,
                    president,
                    hrMembers
                  );
                  
                  const emailSent = await leaveNotificationService.sendApprovalNotification(
                    requestForEmail,
                    submitter,
                    allRelatedUsers
                  );
                  
                  if (emailSent) {
                    console.log('関係者全員への承認完了通知メール送信成功');
                  } else {
                    console.warn('関係者全員への承認完了通知メール送信失敗');
                  }
                } catch (emailError) {
                  console.error('Failed to send final approval notification email:', emailError);
                }
                
                toast.success('申請が最終承認されました');
              } else {
                toast.success('申請を承認しました（次の承認者待ち）');
              }
            } else {
              // Rejection - notify final rejection
              if (newStatus === 'rejected') {
                await leaveNotifications.notifyFinalApprovalComplete(
                  request,
                  submitter,
                  false,
                  [],
                  []
                );
                
                // Send "completed" notification for rejection to all stakeholders
                const leaveGroup = leaveApprovalGroups.find(g => 
                  g.members.includes(submitter.id)
                );
                const leaveGroupUsers = leaveGroup ? users.filter(u => leaveGroup.members.includes(u.id)) : [];
                
                await leaveNotifications.notifyLeaveRequestCompleted(
                  { ...request, status: newStatus, approvers: updatedApprovers },
                  submitter,
                  false,
                  leaveGroupUsers,
                  president,
                  hrMembers
                );
                
                // Send email for rejection
                /* await sendLeaveRequestEmail({
                  request: { ...request, status: newStatus, approvers: updatedApprovers },
                  applicant: submitter,
                  allUsers: users,
                  leaveGroupMembers,
                  type: 'rejected'
                }); */
              }
              toast.success('申請を却下しました');
            }
          } catch (notificationError) {
            console.error('Failed to send notification:', notificationError);
            // Don't fail the approval if notification fails
            if (approved) {
              if (newStatus === 'approved') {
                toast.success('申請が最終承認されました');
              } else {
                toast.success('申請を承認しました');
              }
            } else {
              toast.success('申請を却下しました');
            }
          }
        }
      }
    } catch (err) {
      console.error('Error:', err);
      toast.error('承認処理中にエラーが発生しました');
    }
  };


  // Handle cancellation
  const handleCancel = async (requestId: string) => {
    if (confirm('この申請をキャンセルしてもよろしいですか？')) {
      try {
        const request = leaveRequests.find(r => r.id === requestId);
        if (!request || !currentUser) return;

        const { error } = await supabase
          .from('leave_requests')
          .delete()
          .eq('id', requestId);

        if (error) {
          console.error('Error deleting leave request:', error);
          toast.error('申請のキャンセルに失敗しました');
        } else {
          const updatedRequests = leaveRequests.filter(request => request.id !== requestId);
          setLeaveRequests(updatedRequests);
          toast.success('申請をキャンセルしました');

          // Send cancellation notification to all stakeholders
          try {
            const leaveGroup = leaveApprovalGroups.find(g => 
              g.members.includes(currentUser.id)
            );
            const leaveGroupMembers = leaveGroup ? leaveGroup.members : [];
            const leaveGroupUsers = users.filter(u => leaveGroupMembers.includes(u.id));
            const president = users.find(u => u.role === 'president');
            
            // Send push notification and in-app notification
            await leaveNotifications.notifyLeaveRequestCancelled(
              request,
              currentUser,
              leaveGroupUsers,
              president,
              hrMembers
            );

          } catch (emailError) {
            console.error('Failed to send cancellation email:', emailError);
          }
        }
      } catch (err) {
        console.error('Error:', err);
        toast.error('キャンセル処理中にエラーが発生しました');
      }
    }
  };

  const getStatusBadge = (status: LeaveStatus) => {
    if (status === 'approved') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="h-4 w-4 mr-1" />
          承認済み
        </span>
      );
    } else if (status === 'rejected') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="h-4 w-4 mr-1" />
          却下
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <Clock className="h-4 w-4 mr-1" />
          承認待ち
        </span>
      );
    }
  };

  const getDetailedApprovalStatus = (request: LeaveRequest) => {
    if (!request.approvers || request.approvers.length === 0) {
      return getStatusBadge(request.status);
    }

    const approvedCount = request.approvers.filter(a => a.status === 'approved').length;
    const totalCount = request.approvers.length;

    return (
      <div className="space-y-1">
        {getStatusBadge(request.status)}
        <div className="text-xs text-gray-600">
          <div className="font-medium">承認状況:</div>
          {request.approvers.map((approver, index) => {
            const user = users.find(u => u.id === approver.userId);
            return (
              <div key={index} className="flex items-center space-x-1 mt-1">
                {approver.status === 'approved' ? (
                  <CheckCircle className="h-3 w-3 text-green-600" />
                ) : approver.status === 'rejected' ? (
                  <XCircle className="h-3 w-3 text-red-600" />
                ) : (
                  <Clock className="h-3 w-3 text-yellow-600" />
                )}
                <span className="text-xs">
                  {user ? user.name : 'Unknown'} 
                  {approver.timestamp ? ` (${format(new Date(approver.timestamp), 'MM/dd')})` : ''}
                </span>
              </div>
            );
          })}
          <div className="text-xs text-gray-500 mt-1">
            {approvedCount}/{totalCount} 名承認済み
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">休暇・遅刻・早退申請</h1>
        <button
          onClick={() => {
            setIsModalOpen(true);
            // Reset selected groups to default when opening modal
            if (userLeaveGroups.length > 1) {
              setSelectedLeaveGroups(userLeaveGroups.map(g => g.id));
            } else if (userLeaveGroups.length === 1) {
              setSelectedLeaveGroups([userLeaveGroups[0].id]);
            }
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
        >
          <Plus className="h-5 w-5 mr-1" />
          新規申請
        </button>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('my')}
              className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                activeTab === 'my'
                  ? 'border-rose-500 text-rose-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              自分の申請
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                activeTab === 'pending'
                  ? 'border-rose-500 text-rose-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="relative">
                承認待ち
                {pendingApprovalsCount > 0 && (
                  <span className="absolute -top-2 -right-6 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                    {pendingApprovalsCount}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('approved')}
              className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                activeTab === 'approved'
                  ? 'border-rose-500 text-rose-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              承認済み
            </button>
          </nav>
        </div>

        <div className="overflow-auto">
          {isLoading ? (
            <div className="px-6 py-10 text-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600 mx-auto mb-4"></div>
              データを読み込み中...
            </div>
          ) : filteredRequests.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col\" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    申請者
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    種別
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    日付
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    理由
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ステータス
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    申請日
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">アクション</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRequests.map((request) => {
                  const requestUser = users.find(user => user.id === request.userId);
                  return (
                    <tr key={request.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {requestUser?.name || '不明なユーザー'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {requestUser?.department}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          request.type === 'vacation' ? 'bg-blue-100 text-blue-800' : 
                          request.type === 'late' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {request.type === 'vacation' ? '休暇' : 
                           request.type === 'late' ? '遅刻' : '早退'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {format(new Date(request.date), 'yyyy/MM/dd')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{request.reason}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getDetailedApprovalStatus(request)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(request.createdAt), 'yyyy/MM/dd')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {activeTab === 'pending' && (
                          <button
                            onClick={() => handleOpenApprovalModal(request)}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            承認・却下
                          </button>
                        )}
                        {activeTab === 'my' && request.status === 'pending' && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleCancel(request.id)}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              キャンセル
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-10 text-center text-gray-500">
              表示するデータがありません
            </div>
          )}
        </div>
      </div>

      {/* New Request Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                新規申請
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">種別</label>
                <select
                  value={formData.type || 'vacation'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as LeaveType })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="vacation">休暇</option>
                  <option value="late">遅刻</option>
                  <option value="early">早退</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">日付</label>
                <input
                  type="date"
                  value={formData.date ? format(new Date(formData.date), 'yyyy-MM-dd') : ''}
                  onChange={(e) => setFormData({ ...formData, date: new Date(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">理由</label>
                <textarea
                  value={formData.reason || ''}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              {/* 休暇申請グループ選択 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">申請先グループ選択</label>
                {userLeaveGroups.length > 0 ? (
                  <div className="space-y-2 bg-blue-50 p-3 rounded-md border border-blue-200">
                    {userLeaveGroups.length > 1 ? (
                      <p className="text-xs text-blue-700 mb-2">
                        複数のグループに所属しています。申請先を選択してください（複数選択可）
                      </p>
                    ) : (
                      <p className="text-xs text-blue-700 mb-2">
                        申請先グループを確認してください
                      </p>
                    )}
                    {userLeaveGroups.map(group => (
                      <label key={group.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedLeaveGroups.includes(group.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLeaveGroups([...selectedLeaveGroups, group.id]);
                            } else {
                              setSelectedLeaveGroups(selectedLeaveGroups.filter(id => id !== group.id));
                            }
                          }}
                          className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-900">{group.name}</span>
                        <span className="ml-2 text-xs text-gray-500">({group.members?.length || 0}名)</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 bg-yellow-50 p-3 rounded-md border border-yellow-200">
                    <p className="text-xs text-yellow-700">
                      休暇申請グループに所属していません。管理者にお問い合わせください。
                    </p>
                    <p className="text-xs text-gray-600">
                      利用可能なグループ数: {leaveApprovalGroups.length}
                    </p>
                    {leaveApprovalGroups.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-blue-600">グループ一覧を表示</summary>
                        <ul className="mt-2 ml-4 space-y-1">
                          {leaveApprovalGroups.map(group => (
                            <li key={group.id}>
                              {group.name} ({group.members?.length || 0}名)
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
              </div>

              {/* 必須承認者（選択された休暇申請グループ） */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  必須承認者（選択された休暇申請グループ）
                </label>
                <div className="space-y-2 bg-gray-50 p-3 rounded-md max-h-32 overflow-y-auto">
                  {selectedLeaveGroups.length === 0 ? (
                    <p className="text-sm text-red-500">申請先グループを選択してください</p>
                  ) : (
                    (() => {
                      const allSelectedApprovers = new Set<string>();
                      selectedLeaveGroups.forEach(groupId => {
                        const group = leaveApprovalGroups.find(g => g.id === groupId);
                        if (group && group.members) {
                          group.members.forEach((memberId: string) => {
                            allSelectedApprovers.add(memberId);
                          });
                        }
                      });
                      
                      return Array.from(allSelectedApprovers).map(memberId => {
                        const user = users.find(u => u.id === memberId);
                        return user ? (
                          <div key={user.id} className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-rose-100 flex items-center justify-center">
                              <span className="text-sm font-medium text-rose-600">
                                {user.name.charAt(0)}
                              </span>
                            </div>
                            <div className="ml-3 flex-1">
                              <p className="text-sm font-medium text-gray-900">{user.name}</p>
                              <p className="text-xs text-gray-500">{user.department}</p>
                            </div>
                            <div className="text-right">
                              <div className="flex flex-wrap gap-1">
                                {selectedLeaveGroups.map(groupId => {
                                  const group = leaveApprovalGroups.find(g => g.id === groupId);
                                  if (group && group.members && group.members.includes(user.id)) {
                                    return (
                                      <span key={groupId} className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded">
                                        {group.name}
                                      </span>
                                    );
                                  }
                                  return null;
                                })}
                              </div>
                            </div>
                          </div>
                        ) : null;
                      }).filter(Boolean);
                    })()
                  )}
                  {president && selectedLeaveGroups.length > 0 && (
                    <div className="border-t pt-2 mt-2">
                      <p className="text-xs text-gray-500 mb-2">最終承認者（社長）</p>
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-purple-600">
                            {president.name.charAt(0)}
                          </span>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">{president.name}</p>
                          <p className="text-xs text-gray-500">{president.department}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* 任意承認者追加 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">任意承認者追加</label>
                <div className="max-h-64 overflow-y-auto">
                  <ParticipantSelector
                    selectedParticipants={additionalApprovers}
                    onChange={setAdditionalApprovers}
                    showBusinessGroups={true}
                    showLeaveGroups={false}
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
                >
                  申請する
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* 承認モーダル */}
      <LeaveApprovalModal
        isOpen={isApprovalModalOpen}
        onClose={() => {
          setIsApprovalModalOpen(false);
          setSelectedRequest(null);
        }}
        request={selectedRequest}
        onApprovalComplete={handleApprovalComplete}
      />
    </div>
  );
}