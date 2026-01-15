import React, { useState } from 'react';
import { DebtType } from '../types';

interface DebtFormProps {
    onSubmit: (debt: {
        type: DebtType;
        person_name: string;
        original_amount: number;
        created_date: string;
        due_date?: string;
        description?: string;
    }) => void;
    onClose: () => void;
    initialData?: {
        type: DebtType;
        person_name: string;
        original_amount: number;
        created_date: string;
        due_date?: string;
        description?: string;
    };
    isEdit?: boolean;
}

/**
 * DebtForm Component
 * Form modal để thêm hoặc sửa khoản nợ
 */
const DebtForm: React.FC<DebtFormProps> = ({ onSubmit, onClose, initialData, isEdit = false }) => {
    const [type, setType] = useState<DebtType>(initialData?.type || 'receivable');
    const [personName, setPersonName] = useState(initialData?.person_name || '');
    const [amount, setAmount] = useState(initialData?.original_amount?.toString() || '');
    const [createdDate, setCreatedDate] = useState(
        initialData?.created_date || new Date().toISOString().split('T')[0]
    );
    const [dueDate, setDueDate] = useState(initialData?.due_date || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!personName.trim() || !amount || parseFloat(amount) <= 0) {
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit({
                type,
                person_name: personName.trim(),
                original_amount: parseFloat(amount),
                created_date: createdDate,
                due_date: dueDate || undefined,
                description: description.trim() || undefined,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-800">
                        {isEdit ? 'Sửa khoản nợ' : 'Thêm khoản nợ'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {/* Debt Type Toggle */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Loại nợ</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setType('receivable')}
                                className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${type === 'receivable'
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                    }`}
                            >
                                <span className="text-xl">📥</span>
                                <div className="text-left">
                                    <p className="font-medium text-sm">Dư nợ có</p>
                                    <p className="text-xs opacity-70">Người khác nợ mình</p>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setType('payable')}
                                className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${type === 'payable'
                                        ? 'border-rose-500 bg-rose-50 text-rose-700'
                                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                    }`}
                            >
                                <span className="text-xl">📤</span>
                                <div className="text-left">
                                    <p className="font-medium text-sm">Dư nợ còn</p>
                                    <p className="text-xs opacity-70">Mình nợ người khác</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Person Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {type === 'receivable' ? 'Người nợ mình' : 'Mình nợ ai'}
                        </label>
                        <input
                            type="text"
                            value={personName}
                            onChange={(e) => setPersonName(e.target.value)}
                            placeholder="Nhập tên người/tổ chức..."
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            required
                        />
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Số tiền (VND)
                        </label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0"
                            min="0"
                            step="1000"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-lg font-semibold"
                            required
                        />
                        {amount && parseFloat(amount) > 0 && (
                            <p className="text-sm text-gray-500 mt-1">
                                = {parseFloat(amount).toLocaleString('vi-VN')} VND
                            </p>
                        )}
                    </div>

                    {/* Dates Row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Ngày phát sinh
                            </label>
                            <input
                                type="date"
                                value={createdDate}
                                onChange={(e) => setCreatedDate(e.target.value)}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Ngày đến hạn
                                <span className="text-gray-400 font-normal ml-1">(tuỳ chọn)</span>
                            </label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                min={createdDate}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Ghi chú
                            <span className="text-gray-400 font-normal ml-1">(tuỳ chọn)</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Mô tả thêm về khoản nợ..."
                            rows={3}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isSubmitting || !personName.trim() || !amount || parseFloat(amount) <= 0}
                        className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all ${type === 'receivable'
                                ? 'bg-emerald-600 hover:bg-emerald-700'
                                : 'bg-rose-600 hover:bg-rose-700'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {isSubmitting ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm khoản nợ'}
                    </button>
                </form>

                {/* Safe area padding for mobile */}
                <div className="h-6 sm:hidden" />
            </div>
        </div>
    );
};

export default DebtForm;
