import React, { useState } from 'react';

interface ScheduleTooltipProps {
  children: React.ReactNode;
  title: string;
  participants?: string;
  details?: string;
  assignedTo?: string;
  notes?: string;
}

export default function ScheduleTooltip({ 
  children, 
  title, 
  participants,
  details,
  assignedTo,
  notes 
}: ScheduleTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (e: React.MouseEvent) => {
    setShowTooltip(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  return (
    <div 
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {showTooltip && (
        <div 
          className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg max-w-xs pointer-events-none"
          style={{
            left: `${position.x}px`,
            top: `${position.y - 10}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="font-semibold mb-1">{title}</div>
          {participants && (
            <div className="text-gray-300 mb-1">参加者: {participants}</div>
          )}
          {assignedTo && (
            <div className="text-gray-300 mb-1">担当者: {assignedTo}</div>
          )}
          {details && (
            <div className="text-gray-300 mb-1">詳細: {details}</div>
          )}
          {notes && (
            <div className="text-gray-300">備考: {notes}</div>
          )}
          <div 
            className="absolute w-2 h-2 bg-gray-900 transform rotate-45"
            style={{
              bottom: '-4px',
              left: '50%',
              marginLeft: '-4px'
            }}
          />
        </div>
      )}
    </div>
  );
}