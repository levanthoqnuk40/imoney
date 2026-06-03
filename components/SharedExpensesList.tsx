import React, { useState, useMemo } from 'react';
import { ExpenseEvent, ExpenseParticipant, ExpenseSplit, Repayment } from '../types';
import { getEventRepaymentProgress } from '../services/sharedExpense.service';

interface SharedExpensesListProps {
  events: ExpenseEvent[];
  participants: ExpenseParticipant[];
  splits: ExpenseSplit[];
  repayments: Repayment[];
  onSelectEvent: (event: ExpenseEvent) => void;
  onOpenCreateForm: () => void;
}

type FilterTab = 'pending' | 'settled' | 'overdue' | 'all';

export const SharedExpensesList: React.FC<SharedExpensesListProps> = ({
  events,
  participants,
  splits,
  repayments,
  onSelectEvent,
  onOpenCreateForm
}) => {
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Calculate event progress structures
  const eventProgresses = useMemo(() => {
    return events.map(event => {
      const progress = getEventRepaymentProgress(event, participants, splits, repayments);
      
      const isOverdue = event.due_date 
        ? event.due_date < todayStr && !progress.isFullySettled
        : false;

      return {
        event,
        progress,
        isOverdue
      };
    });
  }, [events, participants, splits, repayments, todayStr]);

  // Overall Statistics for Dashboard
  const stats = useMemo(() => {
    let totalReceivableRemaining = 0;
    let openCount = 0;
    let overdueCount = 0;

    eventProgresses.forEach(({ event, progress, isOverdue }) => {
      totalReceivableRemaining += progress.receivableRemaining;
      if (!progress.isFullySettled) {
        openCount++;
      }
      if (isOverdue) {
        overdueCount++;
      }
    });

    return {
      totalReceivableRemaining,
      openCount,
      overdueCount
    };
  }, [eventProgresses]);

  // Filter events according to active tab
  const filteredItems = useMemo(() => {
    return eventProgresses.filter(({ event, progress, isOverdue }) => {
      if (activeTab === 'pending') {
        return !progress.isFullySettled;
      }
      if (activeTab === 'settled') {
        return progress.isFullySettled;
      }
      if (activeTab === 'overdue') {
        return isOverdue;
      }
      return true; // 'all'
    });
  }, [eventProgresses, activeTab]);

  // Count items for tab buttons
  const counts = useMemo(() => {
    let pending = 0;
    let settled = 0;
    let overdue = 0;

    eventProgresses.forEach(({ progress, isOverdue }) => {
      if (!progress.isFullySettled) pending++;
      else settled++;
      if (isOverdue) overdue++;
    });

    return {
      pending,
      settled,
      overdue,
      all: events.length
    };
  }, [eventProgresses, events.length]);

  return (
    <div className="space-y-6">
      {/* 1. Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        
        {/* Total Remaining Card */}
        <div className="card p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">💸</span>
            <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Còn Phải Thu</p>
          </div>
          <p className="text-lg sm:text-2xl font-black text-blue-800">
            {stats.totalReceivableRemaining.toLocaleString('vi-VN')}đ
          </p>
          <p className="text-[10px] text-blue-500 font-semibold mt-1">
            Từ {stats.openCount} sự kiện đang mở
          </p>
        </div>

        {/* Active events count Card */}
        <div className="card p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">📊</span>
            <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wider">Đang chờ thu</p>
          </div>
          <p className="text-lg sm:text-2xl font-black text-indigo-800">
            {stats.openCount} khoản
          </p>
          <p className="text-[10px] text-indigo-500 font-semibold mt-1">
            {counts.settled} sự kiện đã tất toán
          </p>
        </div>

        {/* Overdue collection Card */}
        <div className="card p-4 bg-gradient-to-br from-rose-50 to-rose-100 border-rose-200 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">⚠️</span>
            <p className="text-xs text-rose-600 font-semibold uppercase tracking-wider">Khoản Quá Hạn</p>
          </div>
          <p className={`text-lg sm:text-2xl font-black ${stats.overdueCount > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
            {stats.overdueCount} khoản
          </p>
          <p className="text-[10px] text-rose-500 font-semibold mt-1">
            Cần nhắn nhắc nợ bạn bè
          </p>
        </div>
      </div>

      {/* 2. Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-gray-100">
        <button
          type="button"
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'pending'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          Chờ thu ({counts.pending})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('overdue')}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'overdue'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
          }`}
        >
          🚨 Quá hạn ({counts.overdue})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('settled')}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'settled'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          Đã thu đủ ({counts.settled})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'all'
              ? 'bg-slate-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          Tất cả ({counts.all})
        </button>
      </div>

      {/* 3. Grid header row */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base sm:text-lg font-bold text-gray-800">
            Danh sách các buổi chi chung
          </h3>
          <button
            type="button"
            onClick={onOpenCreateForm}
            className="flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-700 transition-all active:scale-95 touch-target"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Tạo khoản chi hộ
          </button>
        </div>

        {/* 4. Event Cards */}
        {filteredItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map(({ event, progress, isOverdue }) => {
              const progressPercentage = progress.receivableTotal > 0
                ? (progress.receivablePaid / progress.receivableTotal) * 100
                : 0;

              return (
                <div
                  key={event.id}
                  onClick={() => onSelectEvent(event)}
                  className={`card p-4 cursor-pointer hover:shadow-md transition-all border-l-4 ${
                    progress.isFullySettled
                      ? 'border-l-emerald-500 bg-emerald-50/10'
                      : isOverdue
                        ? 'border-l-rose-500 bg-rose-50/10'
                        : 'border-l-blue-500'
                  }`}
                >
                  {/* Title & Status */}
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-gray-800 text-base truncate">{event.title}</h4>
                      <p className="text-[11px] text-gray-400">
                        {new Date(event.event_date).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                    {isOverdue && (
                      <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-0.5 shrink-0">
                        🚨 Quá hạn
                      </span>
                    )}
                  </div>

                  {/* Split Summary info */}
                  <div className="mb-4 space-y-1">
                    {progress.isFullySettled ? (
                      <p className="text-emerald-600 font-bold text-base">
                        Đã thu hồi xong!
                      </p>
                    ) : (
                      <>
                        <p className="text-xs text-gray-500">Còn phải thu:</p>
                        <p className="text-lg font-black text-rose-600">
                          {progress.receivableRemaining.toLocaleString('vi-VN')}đ
                        </p>
                      </>
                    )}
                    <p className="text-[10px] text-gray-400 truncate">
                      Tổng bill: {event.total_amount.toLocaleString('vi-VN')}đ • Bạn chịu {progress.personalShare.toLocaleString('vi-VN')}đ
                    </p>
                  </div>

                  {/* Friends Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-gray-500 font-medium">
                      <span>Hoàn trả: {progress.paidParticipantsCount}/{progress.totalParticipantsCount} bạn bè</span>
                      <span>{progressPercentage.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          progress.isFullySettled
                            ? 'bg-emerald-500'
                            : isOverdue
                              ? 'bg-rose-500'
                              : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card p-10 text-center border border-dashed border-gray-200 bg-gray-50/50">
            <div className="text-4xl mb-3">💸</div>
            <p className="text-gray-600 font-medium mb-1">
              {activeTab === 'pending'
                ? 'Không có khoản chi hộ nào chờ thu'
                : activeTab === 'settled'
                  ? 'Chưa có khoản chi hộ nào được thu hồi xong'
                  : activeTab === 'overdue'
                    ? 'Tuyệt vời! Không có khoản chi hộ nào bị quá hạn'
                    : 'Chưa có dữ liệu chi hộ nào'
              }
            </p>
            {activeTab !== 'settled' && (
              <button
                type="button"
                onClick={onOpenCreateForm}
                className="text-blue-600 font-bold hover:text-blue-700 mt-2 inline-flex items-center gap-1"
              >
                Tạo sự kiện chi hộ ngay
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default SharedExpensesList;
