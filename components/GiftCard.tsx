import React from 'react';
import { GiftRecord } from '../types';
import { GIFT_EVENT_TYPES } from '../constants';

interface GiftCardProps {
    gift: GiftRecord;
    onClick: () => void;
}

/**
 * GiftCard Component
 * Hiển thị thông tin tóm tắt một khoản tiền ghi nhớ
 * - Given (📤): Tiền mình đưa người khác
 * - Received (📥): Tiền người khác đưa mình
 */
const GiftCard: React.FC<GiftCardProps> = ({ gift, onClick }) => {
    const isGiven = gift.direction === 'given';
    const eventConfig = GIFT_EVENT_TYPES[gift.event_type] || GIFT_EVENT_TYPES.other;

    return (
        <div
            onClick={onClick}
            className={`card p-4 cursor-pointer hover:shadow-md transition-all border-l-4 ${isGiven ? 'border-l-rose-400' : 'border-l-emerald-400'
                }`}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-xl flex-shrink-0">{eventConfig.icon}</span>
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-800 text-sm truncate">
                            {eventConfig.label} - {gift.person_name}
                        </p>
                        <p className="text-xs text-gray-500">
                            {new Date(gift.event_date).toLocaleDateString('vi-VN')}
                        </p>
                    </div>
                </div>
                <span className={`flex-shrink-0 ${isGiven ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {isGiven ? '📤' : '📥'}
                </span>
            </div>

            {/* Amount */}
            <p className={`text-lg font-bold ${isGiven ? 'text-rose-600' : 'text-emerald-600'}`}>
                {isGiven ? '-' : '+'}{gift.amount.toLocaleString('vi-VN')}đ
            </p>

            {/* Note */}
            {gift.note && (
                <p className="text-xs text-gray-400 mt-2 truncate">
                    {gift.note}
                </p>
            )}
        </div>
    );
};

export default GiftCard;
