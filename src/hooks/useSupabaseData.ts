import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User, Group, Schedule, Room, Vehicle, SampleEquipment, LeaveRequest } from '../types';
import { 
  mockUsers, 
  mockGroups, 
  mockSchedules, 
  mockRooms, 
  mockVehicles, 
  mockSampleEquipment, 
  mockLeaveRequests 
} from '../data/mockData';

// Hook for users data
export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name');

      if (error) {
        console.warn('Failed to fetch users from Supabase, using mock data:', error);
        setUsers(mockUsers);
      } else {
        const convertedUsers: User[] = data.map(user => ({
          id: user.id,
          employeeId: user.employee_id,
          name: user.name,
          nameKana: user.name_kana,
          email: user.email,
          phone: user.phone,
          department: user.department,
          role: user.role,
          defaultWorkDays: user.default_work_days || []
        }));
        setUsers(convertedUsers);
      }
    } catch (err) {
      console.warn('Error fetching users, using mock data:', err);
      setUsers(mockUsers);
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  return { users, loading, error, refetch: fetchUsers };
}

// Hook for groups data
export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .order('name');

      if (error) {
        console.warn('Failed to fetch groups from Supabase, using mock data:', error);
        setGroups(mockGroups);
      } else {
        const convertedGroups: Group[] = data.map(group => ({
          id: group.id,
          name: group.name,
          type: group.type,
          members: group.members || [],
          createdBy: group.created_by,
          createdAt: new Date(group.created_at)
        }));
        setGroups(convertedGroups);
      }
    } catch (err) {
      console.warn('Error fetching groups, using mock data:', err);
      setGroups(mockGroups);
      setError('Failed to fetch groups');
    } finally {
      setLoading(false);
    }
  };

  return { groups, loading, error, refetch: fetchGroups };
}

// Hook for schedules data
export function useSchedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .order('start_time');

      if (error) {
        console.warn('Failed to fetch schedules from Supabase, using mock data:', error);
        setSchedules(mockSchedules);
      } else {
        const convertedSchedules: Schedule[] = data.map(schedule => ({
          id: schedule.id,
          type: schedule.type,
          title: schedule.title,
          details: schedule.details || '',
          startTime: new Date(schedule.start_time),
          endTime: new Date(schedule.end_time),
          isAllDay: schedule.is_all_day,
          recurrence: schedule.recurrence,
          participants: schedule.participants || [],
          equipment: schedule.equipment || [],
          reminders: schedule.reminders || [],
          createdBy: schedule.created_by,
          createdAt: new Date(schedule.created_at),
          updatedBy: schedule.updated_by,
          updatedAt: schedule.updated_at ? new Date(schedule.updated_at) : null,
          isFromGoogleCalendar: schedule.is_from_google_calendar || false
        }));
        setSchedules(convertedSchedules);
      }
    } catch (err) {
      console.warn('Error fetching schedules, using mock data:', err);
      setSchedules(mockSchedules);
      setError('Failed to fetch schedules');
    } finally {
      setLoading(false);
    }
  };

  return { schedules, loading, error, refetch: fetchSchedules };
}

// Hook for rooms data
export function useRooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('name');

      if (error) {
        console.warn('Failed to fetch rooms from Supabase, using mock data:', error);
        setRooms(mockRooms);
      } else {
        setRooms(data);
      }
    } catch (err) {
      console.warn('Error fetching rooms, using mock data:', err);
      setRooms(mockRooms);
      setError('Failed to fetch rooms');
    } finally {
      setLoading(false);
    }
  };

  return { rooms, loading, error, refetch: fetchRooms };
}

// Hook for vehicles data
export function useVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('name');

      if (error) {
        console.warn('Failed to fetch vehicles from Supabase, using mock data:', error);
        setVehicles(mockVehicles);
      } else {
        const convertedVehicles: Vehicle[] = data.map(vehicle => ({
          id: vehicle.id,
          name: vehicle.name,
          licensePlate: vehicle.license_plate,
          type: vehicle.type,
          createdBy: vehicle.created_by
        }));
        setVehicles(convertedVehicles);
      }
    } catch (err) {
      console.warn('Error fetching vehicles, using mock data:', err);
      setVehicles(mockVehicles);
      setError('Failed to fetch vehicles');
    } finally {
      setLoading(false);
    }
  };

  return { vehicles, loading, error, refetch: fetchVehicles };
}

// Hook for sample equipment data
export function useSampleEquipment() {
  const [sampleEquipment, setSampleEquipment] = useState<SampleEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSampleEquipment();
  }, []);

  const fetchSampleEquipment = async () => {
    try {
      const { data, error } = await supabase
        .from('sample_equipment')
        .select('*')
        .order('name');

      if (error) {
        console.warn('Failed to fetch sample equipment from Supabase, using mock data:', error);
        setSampleEquipment(mockSampleEquipment);
      } else {
        setSampleEquipment(data);
      }
    } catch (err) {
      console.warn('Error fetching sample equipment, using mock data:', err);
      setSampleEquipment(mockSampleEquipment);
      setError('Failed to fetch sample equipment');
    } finally {
      setLoading(false);
    }
  };

  return { sampleEquipment, loading, error, refetch: fetchSampleEquipment };
}

// Hook for leave requests data
export function useLeaveRequests() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  const fetchLeaveRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Failed to fetch leave requests from Supabase, using mock data:', error);
        setLeaveRequests(mockLeaveRequests);
      } else {
        const convertedLeaveRequests: LeaveRequest[] = data.map(request => ({
          id: request.id,
          type: request.type,
          userId: request.user_id,
          date: new Date(request.date),
          reason: request.reason,
          status: request.status,
          approvers: request.approvers || [],
          createdAt: new Date(request.created_at)
        }));
        setLeaveRequests(convertedLeaveRequests);
      }
    } catch (err) {
      console.warn('Error fetching leave requests, using mock data:', err);
      setLeaveRequests(mockLeaveRequests);
      setError('Failed to fetch leave requests');
    } finally {
      setLoading(false);
    }
  };

  return { leaveRequests, loading, error, refetch: fetchLeaveRequests };
}