
import React from 'react';
import { Transaction } from '../types';
import { CATEGORY_ICONS } from '../constants';

interface TransactionDetailProps {
    transaction: Transaction;
    onClose: () => void;
    onDelete: (id: string) => void;
}

const TransactionDetail: React.FC<TransactionDetailProps> = ({ transaction, onClose, onDelete }) => {
    const handleDelete = () => {
        if (confirm('Bạn có chắc muốn xóa giao dịch này?')) {
            onDelete(transaction.id);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
            <div
                className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800">Chi tiết giao dịch</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-2 -mr-2"
                        aria-label="Đóng"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                    {/* Amount */}
                    <div className={`text-center p-6 rounded-2xl ${transaction.type === 'INCOME' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                        <p className={`text-3xl font-bold ${transaction.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {transaction.type === 'INCOME' ? '+' : '-'}{transaction.amount.toLocaleString('vi-VN')}
                            <span className="text-lg font-normal ml-1">VND</span>
                        </p>
                        <p className={`text-sm mt-1 ${transaction.type === 'INCOME' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {transaction.type === 'INCOME' ? 'Thu nhập' : 'Chi tiêu'}
                        </p>
                    </div>

                    {/* Details */}
                    <div className="space-y-3">
                        {/* Category */}
                        <div className="flex items-center justify-between py-3 border-b border-gray-100">
                            <span className="text-gray-500">Danh mục</span>
                            <span className="font-medium text-gray-800 flex items-center gap-2">
                                <span>{CATEGORY_ICONS[transaction.category] || '📦'}</span>
                                {transaction.category}
                            </span>
                        </div>

                        {/* Date */}
                        <div className="flex items-center justify-between py-3 border-b border-gray-100">
                            <span className="text-gray-500">Ngày</span>
                            <span className="font-medium text-gray-800">
                                {new Date(transaction.date).toLocaleDateString('vi-VN', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </span>
                        </div>

                        {/* Description */}
                        {transaction.description && (
                            <div className="py-3 border-b border-gray-100">
                                <span className="text-gray-500 block mb-1">Ghi chú</span>
                                <p className="font-medium text-gray-800">{transaction.description}</p>
                            </div>
                        )}

                        {/* Receipt */}
                        {transaction.receipt_url && (
                            <div className="py-3">
                                <span className="text-gray-500 block mb-2">Hóa đơn</span>
                                <img
                                    src={transaction.receipt_url}
                                    alt="Hóa đơn"
                                    className="w-full rounded-xl border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => window.open(transaction.receipt_url, '_blank')}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-6 border-t border-gray-100 flex-shrink-0">
                    <button
                        onClick={handleDelete}
                        className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Xóa giao dịch
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TransactionDetail;
