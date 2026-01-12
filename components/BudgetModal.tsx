
import React, { useState } from 'react';
import { Budget } from '../types';
import { EXPENSE_CATEGORIES } from '../constants';

interface BudgetModalProps {
    budgets: Budget[];
    onSave: (budgets: Budget[]) => void;
    onClose: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
    'Ăn uống': '🍜',
    'Di chuyển': '🚗',
    'Nhà ở': '🏠',
    'Giải trí': '🎮',
    'Mua sắm': '🛒',
    'Sức khỏe': '💊',
    'Giáo dục': '📚',
    'Khác': '📦',
};

const BudgetModal: React.FC<BudgetModalProps> = ({ budgets, onSave, onClose }) => {
    const [localBudgets, setLocalBudgets] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        budgets.forEach(b => {
            initial[b.category] = b.limit.toString();
        });
        return initial;
    });

    const handleChange = (category: string, value: string) => {
        setLocalBudgets(prev => ({
            ...prev,
            [category]: value
        }));
    };

    const handleSubmit = () => {
        const newBudgets: Budget[] = [];
        Object.entries(localBudgets).forEach(([category, limitStr]) => {
            const limit = parseFloat(limitStr);
            if (limit > 0) {
                const existing = budgets.find(b => b.category === category);
                newBudgets.push({
                    id: existing?.id || Math.random().toString(36).substr(2, 9),
                    category,
                    limit,
                    period: 'monthly'
                });
            }
        });
        onSave(newBudgets);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center modal-overlay">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg overflow-hidden modal-content modal-fullscreen-mobile sm:max-h-[90vh]">
                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800">Thiết lập ngân sách tháng</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-2 -mr-2 touch-target"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[60vh] sm:max-h-[50vh]">
                    <p className="text-sm text-gray-600 mb-4">
                        Nhập số tiền ngân sách cho mỗi danh mục. Để trống nếu không muốn theo dõi.
                    </p>

                    {EXPENSE_CATEGORIES.map(category => (
                        <div key={category} className="flex items-center gap-3">
                            <span className="text-2xl w-10 text-center">{CATEGORY_ICONS[category]}</span>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">{category}</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        value={localBudgets[category] || ''}
                                        onChange={(e) => handleChange(category, e.target.value)}
                                        placeholder="0"
                                        className="w-full px-4 py-3 sm:py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-base pr-16"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">VND</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-6 border-t border-gray-100 sticky bottom-0 bg-white">
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 sm:py-2 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors touch-target"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="flex-1 py-3 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg transition-all touch-target"
                        >
                            Lưu ngân sách
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BudgetModal;
