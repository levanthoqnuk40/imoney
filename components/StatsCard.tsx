
import React from 'react';

interface StatsCardProps {
  title: string;
  amount: number;
  type: 'income' | 'expense' | 'balance';
}

const StatsCard: React.FC<StatsCardProps> = ({ title, amount, type }) => {
  const isNegativeBalance = type === 'balance' && amount < 0;

  const getColors = () => {
    if (isNegativeBalance) return 'text-rose-700 bg-rose-50 border-rose-200';
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
      default: return isNegativeBalance ? '⚠' : '⚖️';
    }
  };

  const getIconBg = () => {
    if (isNegativeBalance) return 'bg-rose-100 text-rose-700';
    switch (type) {
      case 'income': return 'bg-emerald-100 text-emerald-600';
      case 'expense': return 'bg-rose-100 text-rose-600';
      default: return 'bg-blue-100 text-blue-600';
    }
  };

  return (
    <div className={`p-4 sm:p-5 rounded-2xl border ${getColors()} shadow-sm transition-all hover:shadow-md`}>
      <div className="flex items-center justify-between sm:block">
        <div className="flex items-center gap-2 sm:block">
          {/* Icon visible on mobile */}
          <div className={`w-8 h-8 sm:hidden rounded-lg flex items-center justify-center text-sm font-bold ${getIconBg()}`}>
            {getIcon()}
          </div>
          <h3 className="text-[11px] sm:text-xs font-semibold opacity-75 uppercase tracking-wider">{title}</h3>
        </div>
        <p className="text-base sm:text-xl lg:text-2xl font-bold mt-0 sm:mt-1 whitespace-nowrap">
          {amount.toLocaleString('vi-VN')}<span className="text-[11px] sm:text-sm font-normal ml-1 opacity-80">đ</span>
        </p>
      </div>
    </div>
  );
};

export default StatsCard;
