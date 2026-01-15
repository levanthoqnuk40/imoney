import React, { useState, useEffect } from 'react';
import { Debt, DebtPayment } from '../types';
import { supabase } from '../services/supabase.service';

interface DebtDetailProps {
    debt: Debt;
    onClose: () => void;
    onUpdate: () => void;
    onDelete: (id: string) => void;
}

/**
 * DebtDetail Component
 * Modal chi tiết khoản nợ với:
 * - Thông tin đầy đủ
 * - Form thanh toán từng phần
 * - Lịch sử thanh toán
 */
const DebtDetail: React.FC<DebtDetailProps> = ({ debt, onClose, onUpdate, onDelete }) => {
    const [payments, setPayments] = useState<DebtPayment[]>([]);
    const [isLoadingPayments, setIsLoadingPayments] = useState(true);
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentNote, setPaymentNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const isReceivable = debt.type === 'receivable';
    const progress = debt.original_amount > 0
        ? (debt.paid_amount / debt.original_amount) * 100
        : 0;

    // Load payment history
    useEffect(() => {
        const loadPayments = async () => {
            try {
                const { data, error } = await supabase
                    .from('debt_payments')
                    .select('*')
                    .eq('debt_id', debt.id)
                    .order('payment_date', { ascending: false });

                if (error) throw error;

                setPayments(data.map(p => ({
                    id: p.id,
                    debt_id: p.debt_id,
                    amount: parseFloat(p.amount),
                    payment_date: p.payment_date,
                    note: p.note
                })));
            } catch (error) {
                console.error('Error loading payments:', error);
            } finally {
                setIsLoadingPayments(false);
            }
        };

        loadPayments();
    }, [debt.id]);

    // Handle payment submission
    const handleAddPayment = async (e: React.FormEvent) => {
        e.preventDefault();

        const amount = parseFloat(paymentAmount);
        if (!amount || amount <= 0 || amount > debt.remaining_amount) {
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('debt_payments')
                .insert([{
                    debt_id: debt.id,
                    amount: amount,
                    payment_date: paymentDate,
                    note: paymentNote.trim() || null
                }]);

            if (error) throw error;

            // Refresh data
            onUpdate();
            setShowPaymentForm(false);
            setPaymentAmount('');
            setPaymentNote('');
        } catch (error) {
            console.error('Error adding payment:', error);
            alert('Có lỗi khi ghi nhận thanh toán');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle delete
    const handleDelete = async () => {
        try {
            await onDelete(debt.id);
            onClose();
        } catch (error) {
            console.error('Error deleting debt:', error);
        }
    };

    // Status config
    const getStatusConfig = () => {
        switch (debt.status) {
            case 'completed':
                return { label: 'Đã trả hết', color: 'bg-emerald-100 text-emerald-700', icon: '✅' };
            case 'partial':
                return { label: 'Đang trả', color: 'bg-amber-100 text-amber-700', icon: '⏳' };
            default:
                return { label: 'Chưa trả', color: 'bg-gray-100 text-gray-700', icon: '📋' };
        }
    };

    const statusConfig = getStatusConfig();

    return (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[95vh] overflow-y-auto">
                {/* Header */}
                <div className={`sticky top-0 p-4 flex items-center justify-between ${isReceivable ? 'bg-emerald-50' : 'bg-rose-50'
                    }`}>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">{isReceivable ? '📥' : '📤'}</span>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">{debt.person_name}</h2>
                            <p className="text-xs text-gray-500">
                                {isReceivable ? 'Người này nợ mình' : 'Mình đang nợ'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/50 rounded-full transition-colors"
                    >
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Amount Summary */}
                    <div className={`p-4 rounded-xl ${isReceivable ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">Số tiền còn lại</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                                {statusConfig.icon} {statusConfig.label}
                            </span>
                        </div>
                        <p className={`text-2xl font-bold ${isReceivable ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {debt.remaining_amount.toLocaleString('vi-VN')}đ
                        </p>

                        {/* Progress */}
                        <div className="mt-3">
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                                <span>Đã thanh toán</span>
                                <span>{debt.paid_amount.toLocaleString('vi-VN')}đ / {debt.original_amount.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="h-2 bg-white rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${isReceivable ? 'bg-emerald-500' : 'bg-rose-500'
                                        }`}
                                    style={{ width: `${Math.min(progress, 100)}%` }}
                                />
                            </div>
                            <p className="text-xs text-gray-400 mt-1 text-right">{progress.toFixed(0)}%</p>
                        </div>
                    </div>

                    {/* Details */}
                    <div className="card p-4 space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Ngày phát sinh</span>
                            <span className="font-medium">{new Date(debt.created_date).toLocaleDateString('vi-VN')}</span>
                        </div>
                        {debt.due_date && (
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Ngày đến hạn</span>
                                <span className="font-medium">{new Date(debt.due_date).toLocaleDateString('vi-VN')}</span>
                            </div>
                        )}
                        {debt.description && (
                            <div className="pt-2 border-t border-gray-100">
                                <p className="text-xs text-gray-500 mb-1">Ghi chú</p>
                                <p className="text-sm text-gray-700">{debt.description}</p>
                            </div>
                        )}
                    </div>

                    {/* Add Payment Button */}
                    {debt.status !== 'completed' && !showPaymentForm && (
                        <button
                            onClick={() => setShowPaymentForm(true)}
                            className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${isReceivable
                                    ? 'bg-emerald-600 hover:bg-emerald-700'
                                    : 'bg-rose-600 hover:bg-rose-700'
                                }`}
                        >
                            💰 Ghi nhận thanh toán
                        </button>
                    )}

                    {/* Payment Form */}
                    {showPaymentForm && (
                        <form onSubmit={handleAddPayment} className="card p-4 space-y-3">
                            <h4 className="font-semibold text-gray-800">Ghi nhận thanh toán</h4>

                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Số tiền</label>
                                <input
                                    type="number"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    placeholder="0"
                                    max={debt.remaining_amount}
                                    min="1"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                                <p className="text-xs text-gray-400 mt-1">
                                    Tối đa: {debt.remaining_amount.toLocaleString('vi-VN')}đ
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Ngày thanh toán</label>
                                <input
                                    type="date"
                                    value={paymentDate}
                                    onChange={(e) => setPaymentDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Ghi chú (tuỳ chọn)</label>
                                <input
                                    type="text"
                                    value={paymentNote}
                                    onChange={(e) => setPaymentNote(e.target.value)}
                                    placeholder="VD: Trả qua chuyển khoản..."
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowPaymentForm(false)}
                                    className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                                >
                                    Huỷ
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !paymentAmount || parseFloat(paymentAmount) <= 0}
                                    className={`flex-1 py-2 rounded-lg text-white font-medium ${isReceivable ? 'bg-emerald-600' : 'bg-rose-600'
                                        } disabled:opacity-50`}
                                >
                                    {isSubmitting ? 'Đang lưu...' : 'Xác nhận'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Payment History */}
                    <div>
                        <h4 className="font-semibold text-gray-800 mb-3">Lịch sử thanh toán</h4>
                        {isLoadingPayments ? (
                            <div className="text-center py-4 text-gray-400">Đang tải...</div>
                        ) : payments.length > 0 ? (
                            <div className="space-y-2">
                                {payments.map(payment => (
                                    <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div>
                                            <p className="font-medium text-gray-800">
                                                +{payment.amount.toLocaleString('vi-VN')}đ
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(payment.payment_date).toLocaleDateString('vi-VN')}
                                                {payment.note && ` • ${payment.note}`}
                                            </p>
                                        </div>
                                        <span className="text-emerald-500">✓</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-4 text-gray-400 text-sm">
                                Chưa có thanh toán nào
                            </div>
                        )}
                    </div>

                    {/* Delete Button */}
                    <div className="pt-4 border-t border-gray-100">
                        {!showDeleteConfirm ? (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="w-full py-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-sm"
                            >
                                🗑️ Xoá khoản nợ này
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-600"
                                >
                                    Huỷ
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="flex-1 py-2 bg-rose-600 text-white rounded-lg"
                                >
                                    Xác nhận xoá
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Safe area padding */}
                <div className="h-6 sm:hidden" />
            </div>
        </div>
    );
};

export default DebtDetail;
