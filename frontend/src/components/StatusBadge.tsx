import React from 'react';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const getStyle = (s: string) => {
    switch (s?.toUpperCase()) {
      case 'NEW':
        return 'bg-purple-100 text-purple-700 border border-purple-200';
      case 'CONTACTED':
        return 'bg-indigo-100 text-indigo-700 border border-indigo-200';
      case 'REMINDER_SENT':
        return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'STORY_SUBMITTED':
      case 'SUBMITTED':
        return 'bg-blue-100 text-blue-700 border border-blue-200';
      case 'UNDER_REVIEW':
        return 'bg-pink-100 text-pink-700 border border-pink-200';
      case 'ELIGIBLE':
      case 'PASS':
        return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
      case 'NOT_ELIGIBLE':
      case 'FLAGGED':
      case 'FAILED':
        return 'bg-rose-100 text-rose-700 border border-rose-200';
      case 'PAYMENT_PENDING':
      case 'LINK_SENT':
      case 'PENDING':
        return 'bg-orange-100 text-orange-800 border border-orange-200';
      case 'PAID':
      case 'APPROVED':
      case 'COMPLETED':
        return 'bg-teal-100 text-teal-800 border border-teal-200';
      case 'READY':
        return 'bg-violet-100 text-violet-700 border border-violet-200';
      case 'PUBLISHED':
        return 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm';
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-200';
    }
  };

  const getLabel = (s: string) => {
    return s?.replace(/_/g, ' ') || 'UNKNOWN';
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${getStyle(
        status
      )} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70"></span>
      {getLabel(status)}
    </span>
  );
};
