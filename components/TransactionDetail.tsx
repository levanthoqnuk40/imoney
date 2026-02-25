
import React, { useState } from 'react';
import { Transaction } from '../types';
import { CATEGORY_ICONS } from '../constants';

interface TransactionDetailProps {
    transaction: Transaction;
    onClose: () => void;
    onDelete: (id: string) => void;
    onUpdateDescription: (id: string, description: string) => Promise<void>;
}

const TransactionDetail: React.FC<TransactionDetailProps> = ({ transaction, onClose, onDelete, onUpdateDescription }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedDescription, setEditedDescription] = useState(transaction.description || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleDelete = () => {
        if (confirm('Bạn có chắc muốn xóa giao dịch này?')) {
            onDelete(transaction.id);
            onClose();
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onUpdateDescription(transaction.id, editedDescription);
            setIsEditing(false);
        } catch (error) {
            console.error('Error updating description:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setEditedDescription(transaction.description || '');
        setIsEditing(false);
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

                        {/* Description - Editable */}
                        <div className="py-3 border-b border-gray-100">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-gray-500">Ghi chú</span>
                                {!isEditing ? (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="text-blue-500 hover:text-blue-700 text-sm font-medium flex items-center gap-1 transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Sửa
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleCancel}
                                            className="text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors"
                                            disabled={isSaving}
                                        >
                                            Hủy
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={isSaving}
                                            className="text-white bg-blue-500 hover:bg-blue-600 text-sm font-medium px-3 py-1 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                                        >
                                            {isSaving ? (
                                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                            Lưu
                                        </button>
                                    </div>
                                )}
                            </div>
                            {isEditing ? (
                                <textarea
                                    value={editedDescription}
                                    onChange={(e) => setEditedDescription(e.target.value)}
                                    className="w-full p-3 border border-blue-200 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none transition-all"
                                    rows={3}
                                    placeholder="Nhập ghi chú..."
                                    autoFocus
                                />
                            ) : (
                                <p className="font-medium text-gray-800">
                                    {transaction.description || <span className="text-gray-400 italic">Chưa có ghi chú</span>}
                                </p>
                            )}
                        </div>

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
