import { useState } from 'react';
import { format, addDays, startOfWeek, isToday } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Box, ArrowDownUp } from 'lucide-react';
import { useCalendar } from '../../contexts/CalendarContext';
import { mockSampleEquipment } from '../../data/mockData';
import ReservationModal from '../../components/ReservationModal';

export default function SampleReservation() {
  const { 
    currentDate, 
    view, 
    setView, 
    goToNextPeriod, 
    goToPreviousPeriod, 
    goToToday,
    getSchedulesForEquipment,
    addSchedule
  } = useCalendar();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<{ id: string; type: 'sample' } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Get start of week (Monday) for the current week
  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
  
  // Create array of dates for the week
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));

  const getSampleSchedulesForDay = (equipmentId: string, date: Date) => {
    const schedules = getSchedulesForEquipment(equipmentId, 'sample');
    return schedules.filter(schedule => 
      new Date(schedule.startTime).toDateString() === date.toDateString()
    );
  };

  const handleCellClick = (equipment: { id: string }, date: Date) => {
    setSelectedEquipment({ id: equipment.id, type: 'sample' });
    setSelectedDate(date);
    setIsModalOpen(true);
  };

  const handleReservationSubmit = (scheduleData: any) => {
    addSchedule(scheduleData);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">サンプル予約</h1>
        <div className="flex space-x-2">
          <button
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            <ArrowDownUp className="h-5 w-5 mr-1" />
            順番変更
          </button>
          <button
            onClick={() => {
              setSelectedEquipment(null);
              setSelectedDate(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            <Plus className="h-5 w-5 mr-1" />
            予約作成
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <div className="flex items-center justify-between flex-wrap sm:flex-nowrap">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {format(currentDate, 'yyyy年M月', { locale: ja })}
              </h3>
            </div>
            <div className="flex items-center space-x-3">
              <div className="inline-flex rounded-md shadow-sm">
                <button
                  type="button"
                  onClick={goToPreviousPeriod}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <span className="sr-only">前へ</span>
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={goToToday}
                  className="relative inline-flex items-center px-4 py-2 border-t border-b border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  今日
                </button>
                <button
                  type="button"
                  onClick={goToNextPeriod}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <span className="sr-only">次へ</span>
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                  サンプル設備
                </th>
                {weekDays.map((date, i) => (
                  <th key={i} scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex flex-col items-center">
                      <span>{format(date, 'EEEE', { locale: ja })}</span>
                      <span className={`mt-1 text-sm ${isToday(date) ? 'bg-blue-100 text-blue-800 rounded-full w-7 h-7 flex items-center justify-center' : ''}`}>
                        {format(date, 'd')}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mockSampleEquipment.map((equipment) => (
                <tr key={equipment.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                        <Box className="h-6 w-6 text-purple-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{equipment.name}</div>
                        <div className="text-xs text-gray-500">{equipment.type}</div>
                      </div>
                    </div>
                  </td>
                  {weekDays.map((date, i) => {
                    const schedules = getSampleSchedulesForDay(equipment.id, date);
                    return (
                      <td key={i} className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 relative group border border-gray-100">
                        <button
                          onClick={() => handleCellClick(equipment, date)}
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-purple-100 rounded-full p-1"
                        >
                          <Plus className="h-4 w-4 text-purple-600" />
                        </button>
                        <div className="min-h-[80px]">
                          {schedules.map((schedule, index) => (
                            <div 
                              key={schedule.id} 
                              className="mb-1 px-2 py-1 rounded text-xs truncate bg-purple-100 text-purple-800 border-l-4 border-purple-500"
                            >
                              <div className="font-medium">#{index + 1} {schedule.title}</div>
                              <div>{schedule.details}</div>
                              {schedule.quantity && schedule.quantity > 1 && (
                                <div className="text-xs text-purple-600">({schedule.quantity}枚)</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ReservationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleReservationSubmit}
        selectedDate={selectedDate || undefined}
        selectedEquipment={selectedEquipment || undefined}
        type="sample"
      />
    </div>
  );
}