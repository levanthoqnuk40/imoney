import React from 'react';
import { Debt } from '../types';

interface DebtCardProps {
    debt: Debt;
    onClick: () => void;
}

/**
 * DebtCard Component
 * Hiển thị thông tin tóm tắt một khoản nợ
 * - Dư nợ có (receivable): màu xanh lá - tiền người khác nợ mình
 * - Dư nợ còn (payable): màu đỏ - tiền mình nợ người khác
 */
const DebtCard: React.FC<DebtCardProps> = ({ debt, onClick }) => {
    const isReceivable = debt.type === 'receivable';
    const progress = debt.original_amount > 0
        ? (debt.paid_amount / debt.original_amount) * 100
        : 0;

    // Tính số ngày còn lại đến hạn
    const getDaysRemaining = () => {
        if (!debt.due_date) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(debt.due_date);
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const daysRemaining = getDaysRemaining();
    const isOverdue = daysRemaining !== null && daysRemaining < 0;
    const isDueSoon = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7;

    // Status badge config
    const getStatusConfig = () => {
        switch (debt.status) {
            case 'completed':
                return { label: 'Đã trả hết', color: 'bg-emerald-100 text-emerald-700' };
            case 'partial':
                return { label: 'Đang trả', color: 'bg-amber-100 text-amber-700' };
            default:
                return { label: 'Chưa trả', color: 'bg-gray-100 text-gray-700' };
        }
    };

    const statusConfig = getStatusConfig();

    return (
        <div
            onClick={onClick}
            className={`card p-4 cursor-pointer hover:shadow-md transition-all border-l-4 ${isReceivable ? 'border-l-emerald-500' : 'border-l-rose-500'
                }`}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`text-xl flex-shrink-0 ${isReceivable ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                        {isReceivable ? '📥' : '📤'}
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-800 text-sm truncate">
                            {debt.person_name}
                        </p>
                        <p className="text-xs text-gray-500">
                            {isReceivable ? 'Nợ mình' : 'Mình nợ'}
                        </p>
                    </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                    {statusConfig.label}
                </span>
            </div>

            {/* Amount */}
            <div className="mb-3">
                <p className={`text-lg font-bold ${isReceivable ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                    {isReceivable ? '+' : '-'}{debt.remaining_amount.toLocaleString('vi-VN')}đ
                </p>
                {debt.paid_amount > 0 && (
                    <p className="text-xs text-gray-500">
                        Đã trả: {debt.paid_amount.toLocaleString('vi-VN')}đ / {debt.original_amount.toLocaleString('vi-VN')}đ
                    </p>
                )}
            </div>

            {/* Progress bar */}
            <div className="mb-3">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all ${debt.status === 'completed'
                                ? 'bg-emerald-500'
                                : isReceivable
                                    ? 'bg-emerald-400'
                                    : 'bg-rose-400'
                            }`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>
                <p className="text-xs text-gray-400 mt-1 text-right">{progress.toFixed(0)}%</p>
            </div>

            {/* Due date warning */}
            {debt.due_date && debt.status !== 'completed' && (
                <div className={`flex items-center gap-1 text-xs ${isOverdue
                        ? 'text-rose-600'
                        : isDueSoon
                            ? 'text-amber-600'
                            : 'text-gray-500'
                    }`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {isOverdue ? (
                        <span>Quá hạn {Math.abs(daysRemaining!)} ngày</span>
                    ) : daysRemaining === 0 ? (
                        <span>Đến hạn hôm nay</span>
                    ) : (
                        <span>Còn {daysRemaining} ngày</span>
                    )}
                </div>
            )}

            {/* Description preview */}
            {debt.description && (
                <p className="text-xs text-gray-400 mt-2 truncate">
                    {debt.description}
                </p>
            )}
        </div>
    );
};

export default DebtCard;
