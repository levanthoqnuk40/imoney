import React, { useState } from 'react';
import { ExpenseEvent, ExpenseParticipant, ExpenseSplit, Repayment } from '../types';
import { getParticipantSettlementStates, getEventRepaymentProgress, generateReminderText } from '../services/sharedExpense.service';

interface SharedExpenseDetailProps {
  event: ExpenseEvent;
  participants: ExpenseParticipant[];
  splits: ExpenseSplit[];
  repayments: Repayment[];
  onClose: () => void;
  onAddRepayment: (repayment: Omit<Repayment, 'id'>) => void;
  onDeleteRepayment: (id: string) => void;
}

export const SharedExpenseDetail: React.FC<SharedExpenseDetailProps> = ({
  event,
  participants,
  splits,
  repayments,
  onClose,
  onAddRepayment,
  onDeleteRepayment
}) => {
  const [activeParticipantForPayment, setActiveParticipantForPayment] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNote, setPaymentNote] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const stats = getEventRepaymentProgress(event, participants, splits, repayments);
  const settlements = getParticipantSettlementStates(event.id, participants, splits, repayments);
  
  const eventRepayments = repayments.filter(r => r.event_id === event.id);

  const handleOpenPaymentForm = (participantId: string, remainingAmount: number) => {
    setActiveParticipantForPayment(participantId);
    setPaymentAmount(remainingAmount.toString());
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNote('');
  };

  const handleClosePaymentForm = () => {
    setActiveParticipantForPayment(null);
  };

  const handleSavePayment = (e: React.FormEvent, participantId: string) => {
    e.preventDefault();
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      alert('Vui lòng nhập số tiền thanh toán hợp lệ');
      return;
    }

    onAddRepayment({
      event_id: event.id,
      participant_id: participantId,
      repayment_date: paymentDate,
      amount,
      note: paymentNote.trim() || undefined
    });

    handleClosePaymentForm();
  };

  const handleCopyReminder = (displayName: string, remainingAmount: number) => {
    const text = generateReminderText(event, displayName, remainingAmount);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedText(displayName);
      setTimeout(() => setCopiedText(null), 2000);
    });
  };

  // Helper formatting classes for event statuses
  const getEventStatusConfig = () => {
    switch (event.status) {
      case 'settled':
        return { label: 'Đã thu đủ', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
      case 'partial':
        return { label: 'Đang thu dở', color: 'bg-amber-100 text-amber-700 border-amber-200' };
      default:
        return { label: 'Chờ thu hồi', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const statusConfig = getEventStatusConfig();
  const collectedPercentage = stats.receivableTotal > 0
    ? (stats.receivablePaid / stats.receivableTotal) * 100
    : 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center modal-overlay">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-xl max-h-[95vh] flex flex-col modal-content modal-fullscreen-mobile text-sm">
        
        {/* Header - Sticky */}
        <div className="sticky top-0 bg-slate-50 border-b border-gray-100 p-4 sm:p-5 flex items-center justify-between rounded-t-3xl flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">👥</span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-800">{event.title}</h2>
              <p className="text-xs text-gray-500">
                Ngày chi: {new Date(event.event_date).toLocaleDateString('vi-VN')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-200/50 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">

          {/* Overall Stats Cards */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Tổng còn phải thu</span>
                <p className="text-2xl font-black text-blue-800">{stats.receivableRemaining.toLocaleString('vi-VN')}đ</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-xs text-blue-700 font-medium mb-1">
                <span>Bạn bè đã hoàn trả: {stats.receivablePaid.toLocaleString('vi-VN')}đ / {stats.receivableTotal.toLocaleString('vi-VN')}đ</span>
                <span>{collectedPercentage.toFixed(0)}%</span>
              </div>
              <div className="h-2.5 bg-blue-200/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{ width: `${Math.min(collectedPercentage, 100)}%` }}
                />
              </div>
            </div>

            {/* Cost Details breakdown */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-blue-100/60 text-xs text-blue-700/80 font-medium">
              <div>
                <span className="block text-blue-900/60 text-[10px] uppercase">Tổng hóa đơn</span>
                <span className="font-bold text-sm text-blue-950">{stats.totalAmount.toLocaleString('vi-VN')}đ</span>
              </div>
              <div>
                <span className="block text-blue-900/60 text-[10px] uppercase">Phần của bạn</span>
                <span className="font-bold text-sm text-blue-950">{stats.personalShare.toLocaleString('vi-VN')}đ</span>
              </div>
              <div>
                <span className="block text-blue-900/60 text-[10px] uppercase">Tổng ứng hộ</span>
                <span className="font-bold text-sm text-blue-950">{stats.receivableTotal.toLocaleString('vi-VN')}đ</span>
              </div>
            </div>

            {/* Hạn thanh toán & Ghi chú */}
            {(event.due_date || event.description) && (
              <div className="pt-2 border-t border-blue-100/60 text-xs text-gray-600 space-y-1">
                {event.due_date && (
                  <p>📅 <strong>Hạn thanh toán:</strong> {new Date(event.due_date).toLocaleDateString('vi-VN')}</p>
                )}
                {event.description && (
                  <p>📝 <strong>Ghi chú:</strong> {event.description}</p>
                )}
              </div>
            )}
          </div>

          {/* Friends Settlement list */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tình hình hoàn trả bạn bè ({settlements.filter(s => !s.participant.is_owner).length})</h3>
            <div className="space-y-3">
              {settlements
                .filter(s => !s.participant.is_owner)
                .map(({ participant, amountDue, amountPaid, amountRemaining, status }) => {
                  const isPaid = status === 'paid';
                  const isPartial = status === 'partial';
                  
                  return (
                    <div key={participant.id} className="border border-gray-100 p-3.5 rounded-2xl bg-white shadow-sm flex flex-col space-y-3">
                      {/* Name row */}
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-gray-800 text-sm">{participant.display_name}</p>
                          <p className="text-[10px] text-gray-400">
                            {isPaid ? 'Đã thanh toán đủ' : `Đã trả: ${amountPaid.toLocaleString('vi-VN')}đ / ${amountDue.toLocaleString('vi-VN')}đ`}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isPaid ? 'bg-emerald-50 text-emerald-700' : isPartial ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {isPaid ? '✓ Đã trả đủ' : isPartial ? '⏳ Trả một phần' : '✕ Chưa trả'}
                        </span>
                      </div>

                      {/* Bar and remaining amount */}
                      {!isPaid && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-500 font-medium">Còn nợ: <strong className="text-rose-600 font-bold">{amountRemaining.toLocaleString('vi-VN')}đ</strong></span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopyReminder(participant.display_name, amountRemaining)}
                              className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-xs flex items-center gap-1 transition-all active:scale-95"
                            >
                              💬 {copiedText === participant.display_name ? 'Đã sao chép!' : 'Nhắc nợ'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenPaymentForm(participant.id, amountRemaining)}
                              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                            >
                              💵 Trả tiền
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Inline repayment form */}
                      {activeParticipantForPayment === participant.id && (
                        <form onSubmit={(e) => handleSavePayment(e, participant.id)} className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-3 animate-fade-in">
                          <p className="font-bold text-gray-700 text-xs flex items-center gap-1">💰 Ghi nhận bạn {participant.display_name} trả tiền</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-gray-500 mb-1">Số tiền trả (đ)</label>
                              <input
                                type="number"
                                required
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-200 rounded-lg outline-none font-semibold text-gray-800"
                                max={amountRemaining}
                                min="1000"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-500 mb-1">Ngày hoàn trả</label>
                              <input
                                type="date"
                                required
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-200 rounded-lg outline-none text-gray-800"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Ghi chú (tùy chọn)</label>
                            <input
                              type="text"
                              value={paymentNote}
                              onChange={(e) => setPaymentNote(e.target.value)}
                              placeholder="VD: Ck Techcombank..."
                              className="w-full px-2 py-1 text-sm border border-gray-200 rounded-lg outline-none"
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={handleClosePaymentForm}
                              className="px-3 py-1 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs"
                            >
                              Hủy
                            </button>
                            <button
                              type="submit"
                              className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold"
                            >
                              Ghi nhận
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Repayment History Timeline */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">Lịch sử hoàn trả ({eventRepayments.length})</h3>
            {eventRepayments.length === 0 ? (
              <p className="text-center py-6 text-gray-400 text-xs italic bg-gray-50 border border-dashed border-gray-200 rounded-2xl">
                Chưa ghi nhận đợt hoàn trả nào từ bạn bè.
              </p>
            ) : (
              <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-3.5 space-y-2.5 max-h-48 overflow-y-auto">
                {eventRepayments.map(rep => {
                  const friend = participants.find(p => p.id === rep.participant_id);
                  return (
                    <div key={rep.id} className="flex justify-between items-center gap-2 py-2 border-b border-gray-100/60 last:border-b-0">
                      <div>
                        <p className="font-bold text-gray-800 text-xs">
                          {friend ? friend.display_name : 'Người lạ'} đã trả
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {new Date(rep.repayment_date).toLocaleDateString('vi-VN')} {rep.note && `• ${rep.note}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="font-bold text-emerald-600 text-sm">
                          +{rep.amount.toLocaleString('vi-VN')}đ
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Xóa đợt hoàn trả này và cộng lại tiền nợ?')) {
                              onDeleteRepayment(rep.id);
                            }
                          }}
                          className="text-gray-300 hover:text-red-500 transition-all p-1 text-xs"
                          aria-label="Xóa hoàn trả"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Bottom padding for mobile safe areas */}
        <div className="h-6 sm:hidden bg-white" />
      </div>
    </div>
  );
};
export default SharedExpenseDetail;
