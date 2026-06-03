
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Transaction, Budget, ViewType, Debt, GiftRecord, GiftEventType, Category } from './types';
import StatsCard from './components/StatsCard';
import TransactionForm from './components/TransactionForm';
import Dashboard from './components/Dashboard';
import BudgetModal from './components/BudgetModal';
import LoginScreen from './components/LoginScreen';
import TransactionDetail from './components/TransactionDetail';
import CategoryModal from './components/CategoryModal';
import DebtCard from './components/DebtCard';
import DebtForm from './components/DebtForm';
import DebtDetail from './components/DebtDetail';
import GiftCard from './components/GiftCard';
import GiftForm from './components/GiftForm';
import GiftDetail from './components/GiftDetail';
import { useAuth } from './hooks/useAuth';
import { useFinancialData } from './hooks/useFinancialData';
import { GIFT_EVENT_TYPES, COLORS } from './constants';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

// Clean up description metadata and technical codes for mobile
const formatDescription = (desc: string) => {
  if (!desc || desc.trim() === '' || desc.toLowerCase() === 'null') {
    return 'Không có ghi chú';
  }
  
  let clean = desc.trim();
  
  // Remove common banking/momo prefixes like "MBVCB.xxxxxx.", "FTxxxxxx", "MOMO-CASHIN."
  clean = clean.replace(/^(MBVCB|MOMO-CASHIN|MOMO|VCB|MB|BIDV|Agribank|Techcombank|ACB|Vietinbank|TPB|VPB)\.?\s*[0-9A-Z]*\.?\s*/i, '');
  
  if (!clean) {
    clean = desc.trim();
  }
  
  return clean.split(/\s+/).map(word => {
    if (word.length > 12 && /^[a-z0-9_\-\.\:\/]+$/i.test(word)) {
      return word.slice(0, 6) + '...';
    }
    return word;
  }).join(' ');
};

const App: React.FC = () => {
  const { user, authLoading, handleLogout } = useAuth();
  const {
    transactions,
    budgets,
    categories,
    debts,
    gifts,
    isLoading,
    pendingSyncCount,
    aiAdvice,
    isAiLoading,
    isOnline,
    isSyncing,
    syncResult,
    dismissSyncResult,
    stats,
    pieData,
    barData,
    debtStats,
    giftStats,
    activeAlerts,
    loadDebts,
    loadGifts,
    handleAddTransaction,
    handleDeleteTransaction,
    handleUpdateTransaction,
    handleSaveBudgets,
    handleAddDebt,
    handleDeleteDebt,
    handleAddGift,
    handleDeleteGift,
    handleCategoriesChange,
    handleGetAiAdvice,
    clearAllData,
  } = useFinancialData(user);

  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isCategoryMgmtOpen, setIsCategoryMgmtOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showTips, setShowTips] = useState(false);
  const [filterMonth, setFilterMonth] = useState<string | null>(null); // 'YYYY-MM' or null
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');

  // Debt management state
  const [isDebtFormOpen, setIsDebtFormOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [debtFilter, setDebtFilter] = useState<'all' | 'receivable' | 'payable' | 'completed'>('all');

  // Gift money tracking state
  const [isGiftFormOpen, setIsGiftFormOpen] = useState(false);
  const [selectedGift, setSelectedGift] = useState<GiftRecord | null>(null);
  const [giftFilter, setGiftFilter] = useState<'all' | GiftEventType>('all');

  // Notification bell panel state
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const notificationPanelRef = React.useRef<HTMLDivElement>(null);

  // Lazy loading pagination state for transaction list
  const [visibleCount, setVisibleCount] = useState(20);

  // Reset pagination when search or filters change
  useEffect(() => {
    setVisibleCount(20);
  }, [searchTerm, typeFilter, filterMonth]);

  const performLogout = useCallback(async () => {
    await handleLogout(clearAllData);
  }, [handleLogout, clearAllData]);

  // Filter debts based on state
  const filteredDebts = useMemo(() => {
    if (debtFilter === 'completed') {
      return debts.filter(d => d.status === 'completed');
    }
    const activeDebts = debts.filter(d => d.status !== 'completed');
    if (debtFilter === 'all') return activeDebts;
    return activeDebts.filter(d => d.type === debtFilter);
  }, [debts, debtFilter]);

  // Filter gifts based on state
  const filteredGifts = useMemo(() => {
    if (giftFilter === 'all') return gifts;
    return gifts.filter(g => g.event_type === giftFilter);
  }, [gifts, giftFilter]);

  // Close notification panel on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationPanelRef.current && !notificationPanelRef.current.contains(e.target as Node)) {
        setIsNotificationPanelOpen(false);
      }
    };
    if (isNotificationPanelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotificationPanelOpen]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white font-bold text-2xl">💰</span>
          </div>
          <p className="text-gray-500">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return <LoginScreen onLoginSuccess={() => {}} isOnline={isOnline} />;
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 sticky top-0 z-50">
          <span>📡</span> Đang offline — dữ liệu sẽ đồng bộ khi có mạng
          {pendingSyncCount > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
              {pendingSyncCount} chờ đồng bộ
            </span>
          )}
        </div>
      )}

      {/* Syncing Banner */}
      {isSyncing && (
        <div className="bg-blue-500 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 sticky top-0 z-50">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Đang đồng bộ dữ liệu...
        </div>
      )}

      {/* Sync Result Toast */}
      {syncResult && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transition-all ${syncResult.failed > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
          }`}>
          <span>{syncResult.failed > 0 ? '⚠️' : '✅'}</span>
          <span>
            Đã đồng bộ {syncResult.processed} mục
            {syncResult.failed > 0 && ` (${syncResult.failed} lỗi)`}
          </span>
          <button onClick={dismissSyncResult} className="ml-2 hover:opacity-70">
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4">
          {/* Top row */}
          <div className="h-14 sm:h-16 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">💰</span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Quản Lý Tài Chính
              </h1>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4">
              <button
                onClick={handleGetAiAdvice}
                disabled={isAiLoading || transactions.length === 0}
                className="flex items-center space-x-1 sm:space-x-2 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 p-2 touch-target"
              >
                <svg className={`w-5 h-5 ${isAiLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
                <span className="hidden sm:inline">{isAiLoading ? 'Đang phân tích...' : 'Phân tích AI'}</span>
              </button>

              {/* Notification Bell */}
              <div className="relative" ref={notificationPanelRef}>
                <button
                  onClick={() => setIsNotificationPanelOpen(prev => !prev)}
                  className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors touch-target"
                  aria-label="Thông báo"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {activeAlerts.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                      {activeAlerts.length > 9 ? '9+' : activeAlerts.length}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown Panel */}
                {isNotificationPanelOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                    <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                      <h3 className="font-semibold text-sm">🔔 Thông báo</h3>
                      <p className="text-xs text-blue-100">{activeAlerts.length > 0 ? `${activeAlerts.length} cảnh báo` : 'Không có cảnh báo'}</p>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                      {activeAlerts.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <span className="text-3xl block mb-2">✅</span>
                          <p className="text-sm text-gray-500">Tất cả đều ổn!</p>
                          <p className="text-xs text-gray-400 mt-1">Không có nợ đến hạn hay ngân sách vượt mức</p>
                        </div>
                      ) : (
                        activeAlerts.map((alert) => (
                          <div
                            key={alert.id}
                            className={`px-4 py-3 border-b border-gray-50 last:border-b-0 flex items-start gap-3 ${alert.severity === 'danger' ? 'bg-rose-50/50' : 'bg-amber-50/30'
                              }`}
                          >
                            <span className="text-lg mt-0.5 flex-shrink-0">{alert.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold ${alert.severity === 'danger' ? 'text-rose-700' : 'text-amber-700'
                                }`}>
                                {alert.title}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5 truncate">{alert.body}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${alert.severity === 'danger'
                                ? 'bg-rose-100 text-rose-600'
                                : 'bg-amber-100 text-amber-600'
                              }`}>
                              {alert.type.includes('debt') ? 'Nợ' : 'NS'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    {activeAlerts.length > 0 && (
                      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                        <p className="text-[10px] text-gray-400 text-center">Thông báo sẽ được gửi lúc 6:00 AM và 6:00 PM</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User Menu */}
              <div className="relative group">
                <button className="flex items-center space-x-2 p-2 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {user.email?.[0].toUpperCase() || 'U'}
                  </div>
                  <svg className="w-4 h-4 text-gray-400 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown */}
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <div className="p-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.user_metadata?.full_name || 'Người dùng'}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Đăng xuất
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation - Desktop */}
          <div className="hidden sm:flex border-t border-gray-100 -mb-px">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${currentView === 'dashboard'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
                Dashboard
              </span>
            </button>
            <button
              onClick={() => setCurrentView('transactions')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${currentView === 'transactions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Giao dịch
              </span>
            </button>
            <button
              onClick={() => setCurrentView('debts')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${currentView === 'debts'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Dư nợ
                {debts.filter(d => d.status !== 'completed').length > 0 && (
                  <span className="bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-full">
                    {debts.filter(d => d.status !== 'completed').length}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setCurrentView('gifts')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${currentView === 'gifts'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              <span className="flex items-center gap-2">
                🎁 Ghi nhớ
                {gifts.length > 0 && (
                  <span className="bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-full">
                    {gifts.length}
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-6xl mx-auto px-4 py-4 sm:py-6 lg:py-8 pb-24 sm:pb-6 lg:pb-8">
        {/* Dashboard View */}
        {currentView === 'dashboard' && (
          <Dashboard
            transactions={transactions}
            budgets={budgets}
            onEditBudget={() => setIsBudgetModalOpen(true)}
            onMonthClick={(yearMonth) => {
              setFilterMonth(yearMonth);
              setCurrentView('transactions');
            }}
            categories={categories}
            onTransactionClick={setSelectedTransaction}
          />
        )}

        {/* Transactions View */}
        {currentView === 'transactions' && (
          <div className="space-y-6 lg:space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Lịch sử giao dịch</h2>
                <p className="text-xs text-gray-500 mt-0.5">Quản lý thu chi và xem phân tích dòng tiền</p>
              </div>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              <div className="col-span-2 sm:col-span-1">
                <StatsCard title="Số dư hiện tại" amount={stats.balance} type="balance" />
              </div>
              <div className="col-span-1">
                <StatsCard title="Tổng thu nhập" amount={stats.totalIncome} type="income" />
              </div>
              <div className="col-span-1">
                <StatsCard title="Tổng chi tiêu" amount={stats.totalExpense} type="expense" />
              </div>
            </div>

            <div className="main-layout">
              {/* Main Content: History & AI */}
              <div className="space-y-6 lg:space-y-8">
                {/* AI Insights Section */}
                {aiAdvice && (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-blue-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <svg className="w-16 sm:w-24 h-16 sm:h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-blue-900 mb-2 flex items-center">
                      <span className="mr-2">✨</span> Lời khuyên từ AI
                    </h2>
                    <p className="text-sm sm:text-base text-blue-800 mb-4">{aiAdvice.summary}</p>
                    <div className="space-y-2">
                      {aiAdvice.tips.map((tip, idx) => (
                        <div key={idx} className="flex items-start bg-white/60 p-3 rounded-xl border border-white/40">
                          <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-0.5">
                            {idx + 1}
                          </span>
                          <p className="text-xs sm:text-sm text-gray-700">{tip}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Charts Section */}
                <div className="charts-grid hidden sm:grid">
                  <div className="card p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4">Chi tiêu theo mục</h3>
                    <div className="chart-container">
                      {pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              innerRadius="50%"
                              outerRadius="70%"
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => value.toLocaleString('vi-VN') + ' VND'} />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
                          Chưa có dữ liệu chi tiêu
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="card p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4">Dòng tiền gần đây</h3>
                    <div className="chart-container">
                      {barData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={barData}>
                            <XAxis dataKey="date" fontSize={10} tickMargin={8} />
                            <YAxis hide />
                            <Tooltip formatter={(value: number) => value.toLocaleString('vi-VN')} />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                            <Bar dataKey="income" name="Thu" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="expense" name="Chi" fill="#ef4444" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
                          Chưa có dữ liệu giao dịch
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Transaction List */}
                <div className="card overflow-hidden">
                  <div className="bg-white border-b border-gray-100 shadow-sm">
                    <div className="p-4 sm:p-6 flex flex-col gap-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-base sm:text-lg font-bold text-gray-800">Lịch sử giao dịch</h3>
                        <span className="text-xs sm:text-sm text-gray-500">
                          {(() => {
                            const displayTx = transactions.filter(t => {
                              if (filterMonth && !t.date.startsWith(filterMonth)) return false;
                              if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;
                              if (searchTerm) {
                                const q = searchTerm.toLowerCase();
                                return t.category.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.amount.toString().includes(q);
                              }
                              return true;
                            });
                            return `${displayTx.length} giao dịch`;
                          })()}
                        </span>
                      </div>

                      {/* Search and Quick Filters */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        {/* Search input */}
                        <div className="relative flex-1">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </span>
                          <input
                            type="text"
                            placeholder="Tìm kiếm giao dịch..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          />
                          {searchTerm && (
                            <button
                              onClick={() => setSearchTerm('')}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {/* Type filter tags */}
                        <div className="w-full sm:w-auto flex bg-gray-100/80 p-1 sm:p-0.5 rounded-xl overflow-x-auto scrollbar-none">
                          <button
                            onClick={() => setTypeFilter('ALL')}
                            className={`flex-1 sm:flex-initial text-center px-4 py-3 sm:py-1.5 text-sm sm:text-xs font-semibold rounded-lg transition-all ${
                              typeFilter === 'ALL'
                                ? 'bg-white text-gray-800 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            Tất cả
                          </button>
                          <button
                            onClick={() => setTypeFilter('INCOME')}
                            className={`flex-1 sm:flex-initial text-center px-4 py-3 sm:py-1.5 text-sm sm:text-xs font-semibold rounded-lg transition-all ${
                              typeFilter === 'INCOME'
                                ? 'bg-white text-emerald-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            Thu nhập
                          </button>
                          <button
                            onClick={() => setTypeFilter('EXPENSE')}
                            className={`flex-1 sm:flex-initial text-center px-4 py-3 sm:py-1.5 text-sm sm:text-xs font-semibold rounded-lg transition-all ${
                              typeFilter === 'EXPENSE'
                                ? 'bg-white text-rose-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            Chi tiêu
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Month filter banner */}
                    {filterMonth && (
                      <div className="px-4 sm:px-6 py-2 bg-blue-50 border-t border-blue-100 flex items-center justify-between">
                        <span className="text-sm text-blue-700 font-medium">
                          📅 Tháng {parseInt(filterMonth.split('-')[1])}/{filterMonth.split('-')[0]}
                        </span>
                        <button
                          onClick={() => setFilterMonth(null)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          Xem tất cả ✕
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    {(() => {
                      const displayTx = transactions.filter(t => {
                        if (filterMonth && !t.date.startsWith(filterMonth)) return false;
                        if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;
                        if (searchTerm) {
                          const q = searchTerm.toLowerCase();
                          return t.category.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.amount.toString().includes(q);
                        }
                        return true;
                      });
                                            const visibleTx = displayTx.slice(0, visibleCount);
                      const hasMore = displayTx.length > visibleCount;
                      const remainingCount = displayTx.length - visibleCount;

                      return displayTx.length > 0 ? (
                        <>
                          {(() => {
                            const grouped: Record<string, typeof transactions> = {};
                            visibleTx.forEach(tx => {
                              if (!grouped[tx.date]) grouped[tx.date] = [];
                              grouped[tx.date].push(tx);
                            });
                            return Object.entries(grouped).map(([date, txs]) => {
                              const d = new Date(date);
                              const formatted = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
                              return (
                                <div key={date}>
                                  <div className="px-4 py-2.5 bg-slate-50 border-y border-slate-100 flex justify-between items-center mt-4 first:mt-0">
                                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                      <span className="text-sm">📅</span> {formatted}
                                    </span>
                                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-full">
                                      {txs.length} giao dịch
                                    </span>
                                  </div>
                                  <div className="divide-y divide-gray-50">
                                    {txs.map(tx => {
                                      const cat = categories.find(c => c.name === tx.category);
                                      const emoji = cat?.icon || (tx.type === 'INCOME' ? '💵' : '💸');
                                      return (
                                        <div
                                          key={tx.id}
                                          className="transaction-item group cursor-pointer hover:bg-gray-50"
                                          onClick={() => setSelectedTransaction(tx)}
                                        >
                                          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                                            <div className={`w-10 h-10 sm:w-10 sm:h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-base sm:text-lg ${
                                              tx.type === 'INCOME' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                            }`}>
                                              {emoji}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                              <p className="font-semibold text-gray-800 text-sm sm:text-base truncate">{tx.category}</p>
                                              <p className="text-xs text-gray-400 line-clamp-2 break-words leading-relaxed mt-0.5">{formatDescription(tx.description)}</p>
                                            </div>
                                          </div>
                                          <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0 ml-3">
                                            <div className="flex flex-col items-end">
                                              <p className={`font-bold text-right text-sm sm:text-base whitespace-nowrap ${
                                                tx.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'
                                              }`}>
                                                {tx.type === 'INCOME' ? '+' : '-'}{tx.amount.toLocaleString('vi-VN')}đ
                                              </p>
                                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md mt-0.5 ${
                                                tx.type === 'INCOME' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                              }`}>
                                                {tx.type === 'INCOME' ? 'THU' : 'CHI'}
                                              </span>
                                            </div>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(tx.id); }}
                                              className="transaction-delete-btn text-gray-300 hover:text-rose-500 transition-all touch-target flex items-center justify-center"
                                              aria-label="Xóa giao dịch"
                                            >
                                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                              </svg>
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            });
                          })()}

                          {hasMore && (
                            <div className="p-4 flex justify-center border-t border-gray-50">
                              <button
                                onClick={() => setVisibleCount(prev => prev + 20)}
                                className="px-5 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold text-sm rounded-xl transition-all flex items-center gap-2 active:scale-95 touch-target"
                              >
                                <span>📂</span> Xem thêm (còn {remainingCount} giao dịch)
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="p-8 sm:p-12 text-center text-gray-400">
                          <div className="text-4xl mb-3">📊</div>
                          <p className="text-sm sm:text-base">
                            {filterMonth ? 'Không có giao dịch trong tháng này' : 'Bạn chưa có giao dịch nào.'}
                          </p>
                          {!filterMonth && <p className="text-xs sm:text-sm mt-1">Hãy nhấn nút bên dưới để thêm mới!</p>}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Mobile Tips Toggle */}
                <div className="tips-toggle-mobile">
                  <button
                    onClick={() => setShowTips(!showTips)}
                    className="w-full card p-4 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">💡</span>
                      <span className="font-medium text-gray-800">Mẹo tài chính</span>
                    </div>
                    <svg className={`w-5 h-5 text-gray-400 transition-transform ${showTips ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showTips && (
                    <div className="card mt-2 p-4 space-y-4">
                      <TipItem emoji="💡" color="amber" text="Luôn trích ra 20% thu nhập để tiết kiệm trước khi chi tiêu." />
                      <TipItem emoji="📊" color="blue" text="Phân loại chi tiêu giúp bạn biết tiền đang 'chảy' đi đâu." />
                      <TipItem emoji="🎯" color="emerald" text="Đặt ra mục tiêu tiết kiệm cụ thể cho cuối năm nay." />
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar Area - Desktop only */}
              <div className="sidebar-tips space-y-8">
                <div className="card p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Mẹo nhanh</h3>
                  <ul className="space-y-4">
                    <TipItem emoji="💡" color="amber" text="Luôn trích ra 20% thu nhập để tiết kiệm trước khi chi tiêu." />
                    <TipItem emoji="📊" color="blue" text="Phân loại chi tiêu giúp bạn biết tiền đang 'chảy' đi đâu." />
                    <TipItem emoji="🎯" color="emerald" text="Đặt ra mục tiêu tiết kiệm cụ thể cho cuối năm nay." />
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Debts View */}
        {currentView === 'debts' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Quản lý dư nợ</h2>
                <p className="text-xs text-gray-500 mt-0.5">Theo dõi các khoản người khác nợ mình và mình nợ người khác</p>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="card p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">📥</span>
                  <p className="text-xs text-emerald-600 font-medium">Dư nợ có</p>
                </div>
                <p className="text-lg sm:text-xl font-bold text-emerald-700">
                  +{debtStats.receivable.toLocaleString('vi-VN')}đ
                </p>
                <p className="text-xs text-emerald-500 mt-1">
                  {debts.filter(d => d.type === 'receivable' && d.status !== 'completed').length} khoản
                </p>
              </div>
              <div className="card p-4 bg-gradient-to-br from-rose-50 to-rose-100 border-rose-200">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">📤</span>
                  <p className="text-xs text-rose-600 font-medium">Dư nợ còn</p>
                </div>
                <p className="text-lg sm:text-xl font-bold text-rose-700">
                  -{debtStats.payable.toLocaleString('vi-VN')}đ
                </p>
                <p className="text-xs text-rose-500 mt-1">
                  {debts.filter(d => d.type === 'payable' && d.status !== 'completed').length} khoản
                </p>
              </div>
              <div className="card p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 col-span-2 sm:col-span-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">💰</span>
                  <p className="text-xs text-blue-600 font-medium">Công nợ ròng</p>
                </div>
                <p className={`text-lg sm:text-xl font-bold ${debtStats.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {debtStats.net >= 0 ? '+' : ''}{debtStats.net.toLocaleString('vi-VN')}đ
                </p>
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="w-full max-w-full flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => setDebtFilter('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${debtFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                Tất cả ({debts.filter(d => d.status !== 'completed').length})
              </button>
              <button
                onClick={() => setDebtFilter('receivable')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${debtFilter === 'receivable'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
              >
                📥 Người khác nợ mình ({debts.filter(d => d.type === 'receivable' && d.status !== 'completed').length})
              </button>
              <button
                onClick={() => setDebtFilter('payable')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${debtFilter === 'payable'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
              >
                📤 Mình nợ người khác ({debts.filter(d => d.type === 'payable' && d.status !== 'completed').length})
              </button>
              <button
                onClick={() => setDebtFilter('completed')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${debtFilter === 'completed'
                  ? 'bg-slate-600 text-white'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
              >
                ✅ Đã hoàn thành ({debts.filter(d => d.status === 'completed').length})
              </button>
            </div>

            {/* Debt List */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-bold text-gray-800">
                  Danh sách khoản nợ
                </h3>
                <button
                  onClick={() => setIsDebtFormOpen(true)}
                  className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Thêm mới
                </button>
              </div>

              {filteredDebts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDebts.map(debt => (
                    <DebtCard
                      key={debt.id}
                      debt={debt}
                      onClick={() => setSelectedDebt(debt)}
                    />
                  ))}
                </div>
              ) : (
                <div className="card p-8 text-center">
                  <div className="text-4xl mb-3">💳</div>
                  <p className="text-gray-600 mb-2">
                    {debtFilter === 'all'
                      ? 'Chưa có khoản nợ nào'
                      : debtFilter === 'receivable'
                        ? 'Chưa có ai nợ bạn'
                        : debtFilter === 'payable'
                          ? 'Bạn chưa nợ ai'
                          : 'Chưa có khoản nợ nào đã hoàn thành'
                    }
                  </p>
                  {debtFilter !== 'completed' && (
                    <button
                      onClick={() => setIsDebtFormOpen(true)}
                      className="text-blue-600 font-medium hover:text-blue-700"
                    >
                      Thêm khoản nợ ngay
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Gifts View */}
        {currentView === 'gifts' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Sổ tay ghi nhớ quà tặng</h2>
                <p className="text-xs text-gray-500 mt-0.5">Ghi nhớ tiền hiếu hỉ, quà tặng đã trao đi hoặc nhận lại</p>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="card p-4 bg-gradient-to-br from-rose-50 to-rose-100 border-rose-200">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">📤</span>
                  <p className="text-xs text-rose-600 font-medium">Tiền đưa</p>
                </div>
                <p className="text-lg sm:text-xl font-bold text-rose-700">
                  -{giftStats.given.toLocaleString('vi-VN')}đ
                </p>
                <p className="text-xs text-rose-500 mt-1">
                  {gifts.filter(g => g.direction === 'given').length} lần
                </p>
              </div>
              <div className="card p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">📥</span>
                  <p className="text-xs text-emerald-600 font-medium">Tiền nhận</p>
                </div>
                <p className="text-lg sm:text-xl font-bold text-emerald-700">
                  +{giftStats.received.toLocaleString('vi-VN')}đ
                </p>
                <p className="text-xs text-emerald-500 mt-1">
                  {gifts.filter(g => g.direction === 'received').length} lần
                </p>
              </div>
              <div className={`card p-4 bg-gradient-to-br ${giftStats.net >= 0 ? 'from-emerald-50 to-emerald-100 border-emerald-200' : 'from-rose-50 to-rose-100 border-rose-200'} col-span-2 sm:col-span-1`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">📊</span>
                  <p className="text-xs text-gray-600 font-medium">Chênh lệch</p>
                </div>
                <p className={`text-lg sm:text-xl font-bold ${giftStats.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {giftStats.net >= 0 ? '+' : ''}{giftStats.net.toLocaleString('vi-VN')}đ
                </p>
              </div>
            </div>

            {/* Filter by Event Type */}
            <div className="w-full max-w-full flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => setGiftFilter('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${giftFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                Tất cả ({gifts.length})
              </button>
              {Object.entries(GIFT_EVENT_TYPES).map(([key, { label, icon }]) => {
                const count = gifts.filter(g => g.event_type === key).length;
                if (count === 0 && giftFilter !== key) return null;
                return (
                  <button
                    key={key}
                    onClick={() => setGiftFilter(key as GiftEventType)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${giftFilter === key
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    {icon} {label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Gift List */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-bold text-gray-800">
                  Lịch sử ghi nhớ
                </h3>
                <button
                  onClick={() => setIsGiftFormOpen(true)}
                  className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Thêm mới
                </button>
              </div>

              {filteredGifts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredGifts.map(gift => (
                    <GiftCard
                      key={gift.id}
                      gift={gift}
                      onClick={() => setSelectedGift(gift)}
                    />
                  ))}
                </div>
              ) : (
                <div className="card p-8 text-center">
                  <div className="text-4xl mb-3">🎁</div>
                  <p className="text-gray-600 mb-2">
                    {giftFilter === 'all'
                      ? 'Chưa có ghi nhớ nào'
                      : `Chưa có sự kiện ${GIFT_EVENT_TYPES[giftFilter]?.label || ''} nào`
                    }
                  </p>
                  <button
                    onClick={() => setIsGiftFormOpen(true)}
                    className="text-blue-600 font-medium hover:text-blue-700"
                  >
                    Thêm ghi nhớ ngay
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Desktop FAB */}
      <div className="hidden sm:block fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full shadow-2xl transition-all transform hover:scale-105 active:scale-95 group"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6 transform group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
          </svg>
          <span className="font-bold text-sm sm:text-base">Thêm Giao Dịch</span>
        </button>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 sm:hidden z-40">
        <div className="flex items-center justify-around py-2" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
          <button
            onClick={() => setCurrentView('dashboard')}
            className="flex flex-col items-center justify-center flex-1 py-1"
          >
            <div className={`flex items-center justify-center w-12 h-7 rounded-full transition-all ${
              currentView === 'dashboard' ? 'bg-blue-50 text-blue-600 scale-105' : 'text-gray-400'
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <span className={`text-[10px] mt-1 transition-all ${
              currentView === 'dashboard' ? 'text-blue-600 font-bold' : 'text-gray-400 font-medium'
            }`}>
              Tổng quan
            </span>
          </button>

          <button
            onClick={() => setCurrentView('transactions')}
            className="flex flex-col items-center justify-center flex-1 py-1"
          >
            <div className={`flex items-center justify-center w-12 h-7 rounded-full transition-all ${
              currentView === 'transactions' ? 'bg-blue-50 text-blue-600 scale-105' : 'text-gray-400'
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className={`text-[10px] mt-1 transition-all ${
              currentView === 'transactions' ? 'text-blue-600 font-bold' : 'text-gray-400 font-medium'
            }`}>
              Giao dịch
            </span>
          </button>

          <button
            onClick={() => {
              if (currentView === 'debts') setIsDebtFormOpen(true);
              else if (currentView === 'gifts') setIsGiftFormOpen(true);
              else setIsFormOpen(true);
            }}
            className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full shadow-lg shadow-blue-500/30 -mt-5 text-white active:scale-95 transition-transform"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
            </svg>
          </button>

          <button
            onClick={() => setCurrentView('debts')}
            className="flex flex-col items-center justify-center flex-1 py-1"
          >
            <div className={`flex items-center justify-center w-12 h-7 rounded-full transition-all ${
              currentView === 'debts' ? 'bg-blue-50 text-blue-600 scale-105' : 'text-gray-400'
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <span className={`text-[10px] mt-1 transition-all ${
              currentView === 'debts' ? 'text-blue-600 font-bold' : 'text-gray-400 font-medium'
            }`}>
              Dư nợ
            </span>
          </button>

          <button
            onClick={() => setCurrentView('gifts')}
            className="flex flex-col items-center justify-center flex-1 py-1"
          >
            <div className={`flex items-center justify-center w-12 h-7 rounded-full transition-all ${
              currentView === 'gifts' ? 'bg-blue-50 text-blue-600 scale-105' : 'text-gray-400'
            }`}>
              <span className="text-base">🎁</span>
            </div>
            <span className={`text-[10px] mt-1 transition-all ${
              currentView === 'gifts' ? 'text-blue-600 font-bold' : 'text-gray-400 font-medium'
            }`}>
              Ghi nhớ
            </span>
          </button>
        </div>
      </div>

      {/* Modal Form */}
      {isFormOpen && (
        <TransactionForm
          onAdd={handleAddTransaction}
          onClose={() => setIsFormOpen(false)}
          categories={categories}
          onOpenCategoryMgmt={() => setIsCategoryMgmtOpen(true)}
        />
      )}

      {/* Budget Modal */}
      {isBudgetModalOpen && (
        <BudgetModal
          budgets={budgets}
          onSave={handleSaveBudgets}
          onClose={() => setIsBudgetModalOpen(false)}
          categories={categories}
          onOpenCategoryMgmt={() => setIsCategoryMgmtOpen(true)}
        />
      )}

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <TransactionDetail
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          onDelete={handleDeleteTransaction}
          onUpdateTransaction={handleUpdateTransaction}
          categories={categories}
        />
      )}

      {/* Category Management Modal */}
      {isCategoryMgmtOpen && (
        <CategoryModal
          categories={categories}
          transactions={transactions}
          budgets={budgets}
          onCategoriesChange={handleCategoriesChange}
          onClose={() => setIsCategoryMgmtOpen(false)}
        />
      )}

      {/* Debt Form Modal */}
      {isDebtFormOpen && (
        <DebtForm
          onSubmit={handleAddDebt}
          onClose={() => setIsDebtFormOpen(false)}
        />
      )}

      {/* Debt Detail Modal */}
      {selectedDebt && (
        <DebtDetail
          debt={selectedDebt}
          onClose={() => setSelectedDebt(null)}
          onUpdate={() => {
            loadDebts();
            setSelectedDebt(null);
          }}
          onDelete={handleDeleteDebt}
        />
      )}

      {/* Gift Form Modal */}
      {isGiftFormOpen && (
        <GiftForm
          onSubmit={handleAddGift}
          onClose={() => setIsGiftFormOpen(false)}
          allGifts={gifts}
        />
      )}

      {/* Gift Detail Modal */}
      {selectedGift && (
        <GiftDetail
          gift={selectedGift}
          allGifts={gifts}
          onClose={() => setSelectedGift(null)}
          onDelete={handleDeleteGift}
        />
      )}
    </div>
  );
};

// Tip Item Component – uses static class map to avoid Tailwind purge issues
const TIP_COLOR_MAP: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-600',
  blue: 'bg-blue-100 text-blue-600',
  emerald: 'bg-emerald-100 text-emerald-600',
};

const TipItem: React.FC<{ emoji: string; color: string; text: string }> = ({ emoji, color, text }) => (
  <li className="flex items-start">
    <span className={`${TIP_COLOR_MAP[color] || 'bg-gray-100 text-gray-600'} p-2 rounded-lg mr-3 flex-shrink-0`}>{emoji}</span>
    <p className="text-sm text-gray-600">{text}</p>
  </li>
);

export default App;
