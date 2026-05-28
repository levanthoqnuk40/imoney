import React, { useState } from 'react';
import { GiftDirection, GiftEventType, GiftRecord } from '../types';
import { GIFT_EVENT_TYPES } from '../constants';

interface GiftFormProps {
    onSubmit: (gift: {
        direction: GiftDirection;
        person_name: string;
        event_type: GiftEventType;
        amount: number;
        event_date: string;
        note?: string;
    }) => void;
    onClose: () => void;
    allGifts?: GiftRecord[];
}

/**
 * GiftForm Component
 * Form modal để thêm khoản tiền ghi nhớ
 */
const GiftForm: React.FC<GiftFormProps> = ({ onSubmit, onClose, allGifts }) => {
    const [direction, setDirection] = useState<GiftDirection>('given');
    const [personName, setPersonName] = useState('');
    const [eventType, setEventType] = useState<GiftEventType>('wedding');
    const [amount, setAmount] = useState('');
    const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Tra cứu lịch sử đối ngoại cho tính năng "Gợi ý trả lễ"
    const reciprocityInfo = React.useMemo(() => {
        if (!allGifts || personName.trim().length < 2) return null;
        const searchName = personName.trim().toLowerCase();
        
        // Lọc các bản ghi khớp với tên (tìm kiếm chứa ký tự không phân biệt hoa thường)
        const matches = allGifts.filter(g => 
            g.person_name.toLowerCase().includes(searchName)
        );
        
        if (matches.length === 0) return null;
        
        // Tính toán gợi ý số tiền đối ngoại dựa trên lịch sử
        // Ưu tiên lịch sử mà họ đi tiền mình (received) để trả lễ (given) hoặc ngược lại
        const relevantReceived = matches.filter(g => g.direction === 'received');
        const relevantGiven = matches.filter(g => g.direction === 'given');
        
        let suggestionAmount = 0;
        let suggestionReason = '';
        
        if (direction === 'given') {
            // Nếu mình đang đi tiền họ, tìm xem họ đã từng mừng mình chưa
            if (relevantReceived.length > 0) {
                // Lấy giao dịch gần nhất
                const lastReceived = relevantReceived[0];
                suggestionAmount = lastReceived.amount;
                suggestionReason = `Họ đã từng mừng bạn ${lastReceived.amount.toLocaleString('vi-VN')}đ vào ngày ${new Date(lastReceived.event_date).toLocaleDateString('vi-VN')} (${GIFT_EVENT_TYPES[lastReceived.event_type]?.label || lastReceived.event_type})`;
            } else if (relevantGiven.length > 0) {
                // Nếu họ chưa mừng mình, nhưng mình đã từng mừng họ trong quá khứ
                const lastGiven = relevantGiven[0];
                suggestionAmount = lastGiven.amount;
                suggestionReason = `Bạn đã từng mừng họ ${lastGiven.amount.toLocaleString('vi-VN')}đ vào ngày ${new Date(lastGiven.event_date).toLocaleDateString('vi-VN')} (${GIFT_EVENT_TYPES[lastGiven.event_type]?.label || lastGiven.event_type})`;
            }
        } else {
            // Nếu mình đang nhận tiền của họ, xem mình đã mừng họ bao nhiêu để đối chiếu
            if (relevantGiven.length > 0) {
                const lastGiven = relevantGiven[0];
                suggestionAmount = lastGiven.amount;
                suggestionReason = `Bạn đã từng mừng họ ${lastGiven.amount.toLocaleString('vi-VN')}đ vào ngày ${new Date(lastGiven.event_date).toLocaleDateString('vi-VN')} (${GIFT_EVENT_TYPES[lastGiven.event_type]?.label || lastGiven.event_type})`;
            } else if (relevantReceived.length > 0) {
                const lastReceived = relevantReceived[0];
                suggestionAmount = lastReceived.amount;
                suggestionReason = `Họ đã từng mừng bạn ${lastReceived.amount.toLocaleString('vi-VN')}đ vào ngày ${new Date(lastReceived.event_date).toLocaleDateString('vi-VN')} (${GIFT_EVENT_TYPES[lastReceived.event_type]?.label || lastReceived.event_type})`;
            }
        }
        
        return {
            matches,
            suggestionAmount,
            suggestionReason
        };
    }, [allGifts, personName, direction]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!personName.trim() || !amount || parseFloat(amount) <= 0) {
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit({
                direction,
                person_name: personName.trim(),
                event_type: eventType,
                amount: parseFloat(amount),
                event_date: eventDate,
                note: note.trim() || undefined,
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
                    <h2 className="text-lg font-bold text-gray-800">Thêm ghi nhớ</h2>
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
                    {/* Direction Toggle */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Loại</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setDirection('given')}
                                className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${direction === 'given'
                                        ? 'border-rose-500 bg-rose-50 text-rose-700'
                                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                    }`}
                            >
                                <span className="text-xl">📤</span>
                                <div className="text-left">
                                    <p className="font-medium text-sm">Tiền đưa</p>
                                    <p className="text-xs opacity-70">Mình mừng/viếng</p>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setDirection('received')}
                                className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${direction === 'received'
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                    }`}
                            >
                                <span className="text-xl">📥</span>
                                <div className="text-left">
                                    <p className="font-medium text-sm">Tiền nhận</p>
                                    <p className="text-xs opacity-70">Người khác mừng/viếng</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Event Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Loại sự kiện</label>
                        <div className="grid grid-cols-4 gap-2">
                            {Object.entries(GIFT_EVENT_TYPES).map(([key, { label, icon }]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setEventType(key as GiftEventType)}
                                    className={`p-2 rounded-xl border-2 transition-all flex flex-col items-center ${eventType === key
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <span className="text-xl mb-1">{icon}</span>
                                    <span className="text-xs text-center">{label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Person Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Tên người / gia đình
                        </label>
                        <input
                            type="text"
                            value={personName}
                            onChange={(e) => setPersonName(e.target.value)}
                            placeholder="VD: Anh Nguyễn Văn A, Gia đình chú B..."
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            required
                        />
                    </div>

                    {/* Gợi ý trả lễ đối ngoại dựa trên lịch sử */}
                    {reciprocityInfo && (
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-900 space-y-2 animate-fade-in">
                            <div className="flex items-center gap-1 font-semibold text-indigo-950">
                                <span>💡 Lịch sử & Gợi ý đối ngoại:</span>
                            </div>
                            
                            {reciprocityInfo.suggestionReason && (
                                <div className="text-indigo-800">
                                    <p>{reciprocityInfo.suggestionReason}.</p>
                                    {reciprocityInfo.suggestionAmount > 0 && (
                                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                                            <span>👉 Gợi ý đi lễ: <strong className="text-indigo-950 text-sm font-bold">{reciprocityInfo.suggestionAmount.toLocaleString('vi-VN')}đ</strong></span>
                                            <button 
                                                type="button"
                                                onClick={() => setAmount(reciprocityInfo.suggestionAmount.toString())}
                                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors text-[10px]"
                                            >
                                                Áp dụng gợi ý
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="pt-2 border-t border-indigo-100/50">
                                <p className="font-semibold mb-1 text-indigo-950">Lịch sử đối ngoại ({reciprocityInfo.matches.length}):</p>
                                <div className="max-h-24 overflow-y-auto space-y-1 divide-y divide-indigo-100/30">
                                    {reciprocityInfo.matches.slice(0, 3).map(g => (
                                        <div key={g.id} className="flex justify-between items-center py-1">
                                            <span>
                                                {g.direction === 'given' ? '📤 Bạn mừng: ' : '📥 Họ mừng: '}
                                                {GIFT_EVENT_TYPES[g.event_type]?.icon || '🎉'} {GIFT_EVENT_TYPES[g.event_type]?.label || g.event_type}
                                            </span>
                                            <span className="font-medium text-indigo-950">
                                                {g.amount.toLocaleString('vi-VN')}đ ({new Date(g.event_date).getFullYear()})
                                            </span>
                                        </div>
                                    ))}
                                    {reciprocityInfo.matches.length > 3 && (
                                        <p className="text-[10px] text-indigo-500 text-center pt-1">và {reciprocityInfo.matches.length - 3} lần khác...</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

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
                            step="50000"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-lg font-semibold"
                            required
                        />
                        {amount && parseFloat(amount) > 0 && (
                            <p className="text-sm text-gray-500 mt-1">
                                = {parseFloat(amount).toLocaleString('vi-VN')} VND
                            </p>
                        )}
                    </div>

                    {/* Event Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Ngày sự kiện
                        </label>
                        <input
                            type="date"
                            value={eventDate}
                            onChange={(e) => setEventDate(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            required
                        />
                    </div>

                    {/* Note */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Ghi chú
                            <span className="text-gray-400 font-normal ml-1">(tuỳ chọn)</span>
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="VD: Cưới con trai..."
                            rows={2}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isSubmitting || !personName.trim() || !amount || parseFloat(amount) <= 0}
                        className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all ${direction === 'given'
                                ? 'bg-rose-600 hover:bg-rose-700'
                                : 'bg-emerald-600 hover:bg-emerald-700'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {isSubmitting ? 'Đang lưu...' : 'Thêm ghi nhớ'}
                    </button>
                </form>

                {/* Safe area padding */}
                <div className="h-6 sm:hidden" />
            </div>
        </div>
    );
};

export default GiftForm;
