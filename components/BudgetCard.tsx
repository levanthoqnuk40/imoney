
import React from 'react';

interface BudgetCardProps {
    category: string;
    spent: number;
    limit: number;
    icon: string;
}

const BudgetCard: React.FC<BudgetCardProps> = ({ category, spent, limit, icon }) => {
    const percentage = Math.min((spent / limit) * 100, 100);
    const remaining = limit - spent;

    const getProgressColor = () => {
        if (percentage >= 90) return 'bg-rose-500';
        if (percentage >= 70) return 'bg-amber-500';
        return 'bg-emerald-500';
    };

    const getTextColor = () => {
        if (percentage >= 90) return 'text-rose-600';
        if (percentage >= 70) return 'text-amber-600';
        return 'text-emerald-600';
    };

    return (
        <div className="card p-4 sm:p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{icon}</span>
                    <div>
                        <h4 className="font-semibold text-gray-800 text-sm sm:text-base">{category}</h4>
                        <p className="text-xs text-gray-500">Tháng này</p>
                    </div>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${percentage >= 90 ? 'bg-rose-100 text-rose-600' :
                        percentage >= 70 ? 'bg-amber-100 text-amber-600' :
                            'bg-emerald-100 text-emerald-600'
                    }`}>
                    {percentage.toFixed(0)}%
                </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div
                    className={`h-full ${getProgressColor()} transition-all duration-500 rounded-full`}
                    style={{ width: `${percentage}%` }}
                />
            </div>

            {/* Amount info */}
            <div className="flex justify-between items-center text-xs sm:text-sm">
                <span className="text-gray-600">
                    {spent.toLocaleString('vi-VN')} / {limit.toLocaleString('vi-VN')}
                </span>
                <span className={remaining >= 0 ? getTextColor() : 'text-rose-600'}>
                    {remaining >= 0 ? `Còn ${remaining.toLocaleString('vi-VN')}` : `Vượt ${Math.abs(remaining).toLocaleString('vi-VN')}`}
                </span>
            </div>
        </div>
    );
};

export default BudgetCard;
