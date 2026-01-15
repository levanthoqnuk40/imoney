import React, { useState, useMemo } from 'react';
import { GiftRecord } from '../types';
import { GIFT_EVENT_TYPES } from '../constants';

interface GiftDetailProps {
    gift: GiftRecord;
    allGifts: GiftRecord[]; // To show history with same person
    onClose: () => void;
    onDelete: (id: string) => void;
}

/**
 * GiftDetail Component
 * Modal chi tiết khoản tiền ghi nhớ với lịch sử cùng người
 */
const GiftDetail: React.FC<GiftDetailProps> = ({ gift, allGifts, onClose, onDelete }) => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const isGiven = gift.direction === 'given';
    const eventConfig = GIFT_EVENT_TYPES[gift.event_type] || GIFT_EVENT_TYPES.other;

    // Find all records with same person
    const personHistory = useMemo(() => {
        return allGifts
            .filter(g => g.person_name.toLowerCase() === gift.person_name.toLowerCase() && g.id !== gift.id)
            .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
    }, [allGifts, gift]);

    // Calculate balance with this person
    const personBalance = useMemo(() => {
        const allWithPerson = allGifts.filter(g =>
            g.person_name.toLowerCase() === gift.person_name.toLowerCase()
        );
        const given = allWithPerson.filter(g => g.direction === 'given').reduce((s, g) => s + g.amount, 0);
        const received = allWithPerson.filter(g => g.direction === 'received').reduce((s, g) => s + g.amount, 0);
        return { given, received, net: received - given };
    }, [allGifts, gift]);

    const handleDelete = () => {
        onDelete(gift.id);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[95vh] overflow-y-auto">
                {/* Header */}
                <div className={`sticky top-0 p-4 flex items-center justify-between ${isGiven ? 'bg-rose-50' : 'bg-emerald-50'
                    }`}>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">{eventConfig.icon}</span>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">{eventConfig.label}</h2>
                            <p className="text-xs text-gray-500">{gift.person_name}</p>
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
                    {/* Amount */}
                    <div className={`p-4 rounded-xl ${isGiven ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">Số tiền</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isGiven ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                {isGiven ? '📤 Mình đưa' : '📥 Mình nhận'}
                            </span>
                        </div>
                        <p className={`text-2xl font-bold ${isGiven ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {isGiven ? '-' : '+'}{gift.amount.toLocaleString('vi-VN')}đ
                        </p>
                    </div>

                    {/* Details */}
                    <div className="card p-4 space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Ngày sự kiện</span>
                            <span className="font-medium">{new Date(gift.event_date).toLocaleDateString('vi-VN')}</span>
                        </div>
                        {gift.note && (
                            <div className="pt-2 border-t border-gray-100">
                                <p className="text-xs text-gray-500 mb-1">Ghi chú</p>
                                <p className="text-sm text-gray-700">{gift.note}</p>
                            </div>
                        )}
                    </div>

                    {/* Balance with this person */}
                    <div className="card p-4">
                        <h4 className="font-semibold text-gray-800 mb-3">Cân đối với {gift.person_name}</h4>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 bg-rose-50 rounded-lg">
                                <p className="text-xs text-rose-600 mb-1">Mình đưa</p>
                                <p className="font-bold text-rose-700 text-sm">{personBalance.given.toLocaleString('vi-VN')}đ</p>
                            </div>
                            <div className="p-2 bg-emerald-50 rounded-lg">
                                <p className="text-xs text-emerald-600 mb-1">Mình nhận</p>
                                <p className="font-bold text-emerald-700 text-sm">{personBalance.received.toLocaleString('vi-VN')}đ</p>
                            </div>
                            <div className={`p-2 rounded-lg ${personBalance.net >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                                <p className="text-xs text-gray-600 mb-1">Chênh lệch</p>
                                <p className={`font-bold text-sm ${personBalance.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {personBalance.net >= 0 ? '+' : ''}{personBalance.net.toLocaleString('vi-VN')}đ
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* History with same person */}
                    {personHistory.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-gray-800 mb-3">Lịch sử với {gift.person_name}</h4>
                            <div className="space-y-2">
                                {personHistory.slice(0, 5).map(h => {
                                    const hEvent = GIFT_EVENT_TYPES[h.event_type] || GIFT_EVENT_TYPES.other;
                                    return (
                                        <div key={h.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <span>{hEvent.icon}</span>
                                                <div>
                                                    <p className="text-sm font-medium">{hEvent.label}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {new Date(h.event_date).toLocaleDateString('vi-VN')}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className={`font-bold text-sm ${h.direction === 'given' ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                {h.direction === 'given' ? '-' : '+'}{h.amount.toLocaleString('vi-VN')}đ
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Delete Button */}
                    <div className="pt-4 border-t border-gray-100">
                        {!showDeleteConfirm ? (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="w-full py-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-sm"
                            >
                                🗑️ Xoá ghi nhớ này
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

export default GiftDetail;
