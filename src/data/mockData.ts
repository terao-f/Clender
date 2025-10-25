import { User, Department, UserRole, Group, Schedule, Room, Vehicle, SampleEquipment, LeaveRequest } from '../types';

// Mock Users
export const mockUsers: User[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    employeeId: '012E3D24690F653F',
    name: '山田 太郎',
    nameKana: 'やまだ たろう',
    email: 'yamada@terao-f.co.jp',
    phone: '03-1234-5678',
    department: '本社（１階）',
    role: 'president',
    defaultWorkDays: [
      { day: 1, startTime: '09:00', endTime: '18:00' },
      { day: 2, startTime: '09:00', endTime: '18:00' },
      { day: 3, startTime: '09:00', endTime: '18:00' },
      { day: 4, startTime: '09:00', endTime: '18:00' },
      { day: 5, startTime: '09:00', endTime: '18:00' },
    ]
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    employeeId: '112E3D24690F653G',
    name: '鈴木 花子',
    nameKana: 'すずき はなこ',
    email: 'suzuki@terao-f.co.jp',
    phone: '03-1234-5679',
    department: '本社（２階）',
    role: 'admin',
    defaultWorkDays: [
      { day: 1, startTime: '09:00', endTime: '18:00' },
      { day: 2, startTime: '09:00', endTime: '18:00' },
      { day: 3, startTime: '09:00', endTime: '18:00' },
      { day: 4, startTime: '09:00', endTime: '18:00' },
      { day: 5, startTime: '09:00', endTime: '18:00' },
    ]
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    employeeId: '212E3D24690F653H',
    name: '佐藤 次郎',
    nameKana: 'さとう じろう',
    email: 'sato@terao-f.co.jp',
    phone: '03-1234-5680',
    department: 'CAD-CAM',
    role: 'employee',
    defaultWorkDays: [
      { day: 1, startTime: '09:00', endTime: '18:00' },
      { day: 2, startTime: '09:00', endTime: '18:00' },
      { day: 3, startTime: '09:00', endTime: '18:00' },
      { day: 4, startTime: '09:00', endTime: '18:00' },
      { day: 5, startTime: '09:00', endTime: '18:00' },
    ]
  },
  {
    id: '4',
    employeeId: '312E3D24690F653I',
    name: '田中 三郎',
    nameKana: 'たなか さぶろう',
    email: 'tanaka@terao-f.co.jp',
    phone: '03-1234-5681',
    department: 'WEB',
    role: 'employee',
    defaultWorkDays: [
      { day: 1, startTime: '09:00', endTime: '18:00' },
      { day: 2, startTime: '09:00', endTime: '18:00' },
      { day: 3, startTime: '09:00', endTime: '18:00' },
      { day: 4, startTime: '09:00', endTime: '18:00' },
      { day: 5, startTime: '09:00', endTime: '18:00' },
    ]
  },
];

// Mock Groups
export const mockGroups: Group[] = [
  {
    id: '1',
    name: '本社（１階）',
    type: 'department',
    members: ['1'],
    createdBy: '1',
    createdAt: new Date('2025-01-01'),
  },
  {
    id: '2',
    name: '本社（２階）',
    type: 'department',
    members: ['2'],
    createdBy: '1',
    createdAt: new Date('2025-01-01'),
  },
  {
    id: '3',
    name: 'CAD-CAM',
    type: 'department',
    members: ['3'],
    createdBy: '1',
    createdAt: new Date('2025-01-01'),
  },
  {
    id: '4',
    name: 'WEB',
    type: 'department',
    members: ['4'],
    createdBy: '1',
    createdAt: new Date('2025-01-01'),
  },
  {
    id: '5',
    name: 'プロジェクトA',
    type: 'business',
    members: ['1', '2', '3'],
    createdBy: '1',
    createdAt: new Date('2025-01-15'),
  },
  {
    id: '6',
    name: '休暇承認グループ',
    type: 'leave',
    members: ['1', '2'],
    createdBy: '1',
    createdAt: new Date('2025-01-01'),
  },
];

// Mock Rooms
export const mockRooms: Room[] = [
  {
    id: '1',
    name: '２階会議室',
    createdBy: '1',
  },
  {
    id: '2',
    name: '４階会議室',
    createdBy: '1',
  },
  {
    id: '3',
    name: '５階',
    createdBy: '1',
  },
  {
    id: '4',
    name: 'Web',
    createdBy: '1',
  },
  {
    id: '5',
    name: 'LAB',
    createdBy: '1',
  },
];

// Mock Vehicles
export const mockVehicles: Vehicle[] = [
  {
    id: '1',
    name: 'フリード',
    licensePlate: '品川 300 あ 12-34',
    type: 'フリード',
    createdBy: '1',
  },
  {
    id: '2',
    name: '軽トラ',
    licensePlate: '品川 400 い 56-78',
    type: '軽トラ',
    createdBy: '1',
  },
  {
    id: '3',
    name: 'タウンボックス',
    licensePlate: '品川 500 う 90-12',
    type: 'タウンボックス',
    createdBy: '1',
  },
];

// Mock Sample Equipment
export const mockSampleEquipment: SampleEquipment[] = [
  {
    id: '1',
    name: 'CAD・マーキング 1',
    type: 'CAD・マーキング',
  },
  {
    id: '2',
    name: 'サンプル裁断 1',
    type: 'サンプル裁断',
  },
  {
    id: '3',
    name: 'サンプル縫製 1',
    type: 'サンプル縫製',
  },
  {
    id: '4',
    name: 'サンプル内職 1',
    type: 'サンプル内職',
  },
  {
    id: '5',
    name: 'プレス 1',
    type: 'プレス',
  },
  {
    id: '6',
    name: '仕上げ・梱包 1',
    type: '仕上げ・梱包',
  },
];

// Create dates for this week
const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
const dayAfterTomorrow = new Date(today);
dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

// Mock Schedules
export const mockSchedules: Schedule[] = [
  {
    id: '1',
    type: '会議',
    title: '週次ミーティング',
    details: '今週の進捗確認と来週の計画について',
    startTime: new Date(today.setHours(10, 0, 0, 0)),
    endTime: new Date(today.setHours(11, 0, 0, 0)),
    isAllDay: false,
    recurrence: {
      type: 'weekly',
      interval: 1,
      endDate: null,
      count: null,
      weekdays: [1], // Monday
    },
    participants: ['1', '2', '3', '4'],
    equipment: [{ id: '1', type: 'room' }],
    reminders: [{ time: 15, methods: ['email', 'notification'] }],
    createdBy: '1',
    createdAt: new Date('2025-01-15'),
    updatedBy: null,
    updatedAt: null,
  },
  {
    id: '2',
    type: 'オンライン商談',
    title: 'A社との商談',
    details: '新規プロジェクトについての打ち合わせ',
    startTime: new Date(tomorrow.setHours(14, 0, 0, 0)),
    endTime: new Date(tomorrow.setHours(15, 30, 0, 0)),
    isAllDay: false,
    recurrence: null,
    participants: ['1', '2'],
    equipment: [{ id: '4', type: 'room' }],
    reminders: [{ time: 30, methods: ['email'] }],
    createdBy: '2',
    createdAt: new Date('2025-01-20'),
    updatedBy: null,
    updatedAt: null,
  },
  {
    id: '3',
    type: '来訪',
    title: 'B社来訪',
    details: 'サンプル確認のため',
    startTime: new Date(dayAfterTomorrow.setHours(13, 0, 0, 0)),
    endTime: new Date(dayAfterTomorrow.setHours(16, 0, 0, 0)),
    isAllDay: false,
    recurrence: null,
    participants: ['1', '3'],
    equipment: [{ id: '2', type: 'room' }, { id: '1', type: 'vehicle' }],
    reminders: [{ time: 60, methods: ['email', 'notification', 'calendar'] }],
    createdBy: '1',
    createdAt: new Date('2025-01-22'),
    updatedBy: null,
    updatedAt: null,
  },
];

// Mock Leave Requests
export const mockLeaveRequests: LeaveRequest[] = [
  {
    id: '1',
    type: 'vacation',
    userId: '3',
    date: new Date('2025-02-15'),
    reason: '私用のため',
    status: 'pending',
    approvers: [
      {
        userId: '2',
        status: 'approved',
        timestamp: new Date('2025-02-10T10:30:00'),
      },
      {
        userId: '1',
        status: 'pending',
        timestamp: null,
      },
    ],
    createdAt: new Date('2025-02-10'),
  },
  {
    id: '2',
    type: 'late',
    userId: '4',
    date: new Date('2025-02-12'),
    reason: '電車遅延のため',
    status: 'approved',
    approvers: [
      {
        userId: '2',
        status: 'approved',
        timestamp: new Date('2025-02-11T09:15:00'),
      },
      {
        userId: '1',
        status: 'approved',
        timestamp: new Date('2025-02-11T14:20:00'),
      },
    ],
    createdAt: new Date('2025-02-11'),
  },
];