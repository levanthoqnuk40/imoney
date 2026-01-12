
import React from 'react';

interface StatsCardProps {
  title: string;
  amount: number;
  type: 'income' | 'expense' | 'balance';
}

const StatsCard: React.FC<StatsCardProps> = ({ title, amount, type }) => {
  const getColors = () => {
    switch (type) {
      case 'income': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      case 'expense': return 'text-rose-600 bg-rose-50 border-rose-100';
      default: return 'text-blue-600 bg-blue-50 border-blue-100';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'income': return '↓';
      case 'expense': return '↑';
      default: return '₫';
    }
  };

  return (
    <div className={`p-4 sm:p-6 rounded-2xl border ${getColors()} shadow-sm transition-all hover:shadow-md`}>
      <div className="flex items-center justify-between sm:block">
        <div className="flex items-center gap-2 sm:block">
          {/* Icon visible on mobile */}
          <div className={`w-8 h-8 sm:hidden rounded-lg flex items-center justify-center text-lg ${
            type === 'income' ? 'bg-emerald-100' : type === 'expense' ? 'bg-rose-100' : 'bg-blue-100'
          }`}>
            {getIcon()}
          </div>
          <h3 className="text-xs sm:text-sm font-medium opacity-80 uppercase tracking-wider">{title}</h3>
        </div>
        <p className="text-lg sm:text-xl lg:text-2xl font-bold mt-0 sm:mt-1">
          {amount.toLocaleString('vi-VN')} <span className="text-xs sm:text-sm font-normal">VND</span>
        </p>
      </div>
    </div>
  );
};

export default StatsCard;
