
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Transaction, AIAdvice, Budget, ViewType } from './types';
import StatsCard from './components/StatsCard';
import TransactionForm from './components/TransactionForm';
import Dashboard from './components/Dashboard';
import BudgetModal from './components/BudgetModal';
import LoginScreen from './components/LoginScreen';
import { getFinancialAdvice } from './services/geminiService';
import { supabase } from './services/supabase.service';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { COLORS } from './constants';
import { User } from '@supabase/supabase-js';

const App: React.FC = () => {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [budgets, setBudgets] = useState<Budget[]>(() => {
    const saved = localStorage.getItem('finvise_budgets');
    return saved ? JSON.parse(saved) : [];
  });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<AIAdvice | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showTips, setShowTips] = useState(false);

  // Check auth state on mount
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setTransactions([]);
  };

  // Load transactions from Supabase - filtered by user_id for security
  const loadTransactions = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id) // Security: Only load current user's transactions
        .order('transaction_date', { ascending: false });

      if (error) throw error;

      // Map Supabase data to app Transaction format
      const mappedTransactions: Transaction[] = (data || []).map(t => ({
        id: t.id,
        amount: parseFloat(t.amount),
        category: t.category || 'Khác',
        description: t.description || '',
        date: t.transaction_date,
        type: t.type === 'income' ? 'INCOME' : 'EXPENSE',
        receipt_url: t.receipt_url || undefined
      }));

      setTransactions(mappedTransactions);
    } catch (error) {
      console.error('Error loading transactions:', error);
      // Show empty state on error - don't fallback to localStorage (security)
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load transactions when user is authenticated
  useEffect(() => {
    if (user) {
      loadTransactions();
    }
  }, [user, loadTransactions]);

  // Keep localStorage as backup
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('finvise_transactions', JSON.stringify(transactions));
    }
  }, [transactions, isLoading]);

  useEffect(() => {
    localStorage.setItem('finvise_budgets', JSON.stringify(budgets));
  }, [budgets]);

  const stats = useMemo(() => {
    const income = transactions.filter(t => t.type === 'INCOME').reduce((acc, curr) => acc + curr.amount, 0);
    const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((acc, curr) => acc + curr.amount, 0);
    return {
      totalIncome: income,
      totalExpense: expense,
      balance: income - expense
    };
  }, [transactions]);

  const pieData = useMemo(() => {
    const categories: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'EXPENSE')
      .forEach(t => {
        categories[t.category] = (categories[t.category] || 0) + t.amount;
      });
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const barData = useMemo(() => {
    const dates: Record<string, { income: number; expense: number }> = {};
    transactions.slice(-10).forEach(t => {
      const date = t.date;
      if (!dates[date]) dates[date] = { income: 0, expense: 0 };
      if (t.type === 'INCOME') dates[date].income += t.amount;
      else dates[date].expense += t.amount;
    });
    return Object.entries(dates).map(([date, values]) => ({ date, ...values }));
  }, [transactions]);

  const handleAddTransaction = async (newTx: Omit<Transaction, 'id'>) => {
    if (!user) return;

    try {
      // Insert to Supabase with user_id
      const { data, error } = await supabase
        .from('transactions')
        .insert([{
          user_id: user.id, // Required for RLS
          type: newTx.type === 'INCOME' ? 'income' : 'expense',
          amount: newTx.amount,
          category: newTx.category,
          description: newTx.description,
          transaction_date: newTx.date,
          currency: 'VND',
          receipt_url: newTx.receipt_url || null
        }])
        .select()
        .single();

      if (error) throw error;

      // Add to local state
      const tx: Transaction = {
        id: data.id,
        amount: parseFloat(data.amount),
        category: data.category || 'Khác',
        description: data.description || '',
        date: data.transaction_date,
        type: newTx.type,
        receipt_url: data.receipt_url || undefined
      };
      setTransactions([tx, ...transactions]);
    } catch (error) {
      console.error('Error adding transaction:', error);
      // Fallback: add locally with secure random ID
      const tx: Transaction = {
        ...newTx,
        id: crypto.randomUUID()
      };
      setTransactions([tx, ...transactions]);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!user) return;

    try {
      // Delete from Supabase - verify user owns the transaction
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id); // Security: Only delete if user owns it

      if (error) throw error;
      // Only update local state on success
      setTransactions(transactions.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const handleGetAiAdvice = async () => {
    if (transactions.length === 0) return;
    setIsAiLoading(true);
    const advice = await getFinancialAdvice(transactions);
    setAiAdvice(advice);
    setIsAiLoading(false);
  };

  const handleSaveBudgets = (newBudgets: Budget[]) => {
    setBudgets(newBudgets);
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white font-bold text-2xl">F</span>
          </div>
          <p className="text-gray-500">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return <LoginScreen onLoginSuccess={() => loadTransactions()} />;
  }

  return (
    <div className="min-h-screen safe-bottom">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4">
          {/* Top row */}
          <div className="h-14 sm:h-16 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">F</span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                FinVise
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
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4 sm:py-6 lg:py-8">
        {/* Dashboard View */}
        {currentView === 'dashboard' && (
          <Dashboard
            transactions={transactions}
            budgets={budgets}
            onEditBudget={() => setIsBudgetModalOpen(true)}
          />
        )}

        {/* Transactions View */}
        {currentView === 'transactions' && (
          <div className="space-y-6 lg:space-y-8">
            {/* Overview Stats */}
            <div className="stats-grid">
              <StatsCard title="Số dư hiện tại" amount={stats.balance} type="balance" />
              <StatsCard title="Tổng thu nhập" amount={stats.totalIncome} type="income" />
              <StatsCard title="Tổng chi tiêu" amount={stats.totalExpense} type="expense" />
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
                <div className="charts-grid">
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
                  <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-base sm:text-lg font-bold text-gray-800">Lịch sử giao dịch</h3>
                    <span className="text-xs sm:text-sm text-gray-500">{transactions.length} giao dịch</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {transactions.length > 0 ? (
                      transactions.map(tx => (
                        <div key={tx.id} className="transaction-item group">
                          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                            <div className={`w-10 h-10 sm:w-10 sm:h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-base sm:text-lg ${tx.type === 'INCOME' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                              }`}>
                              {tx.type === 'INCOME' ? '↓' : '↑'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-gray-800 text-sm sm:text-base truncate">{tx.category}</p>
                              <p className="text-xs text-gray-500 truncate">{tx.description || 'Không có ghi chú'} • {tx.date}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
                            <p className={`font-bold text-right text-sm sm:text-base ${tx.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'
                              }`}>
                              {tx.type === 'INCOME' ? '+' : '-'}{tx.amount.toLocaleString('vi-VN')}
                            </p>
                            <button
                              onClick={() => handleDeleteTransaction(tx.id)}
                              className="transaction-delete-btn text-gray-300 hover:text-rose-500 transition-all touch-target flex items-center justify-center"
                              aria-label="Xóa giao dịch"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 sm:p-12 text-center text-gray-400">
                        <div className="text-4xl mb-3">📊</div>
                        <p className="text-sm sm:text-base">Bạn chưa có giao dịch nào.</p>
                        <p className="text-xs sm:text-sm mt-1">Hãy nhấn nút bên dưới để thêm mới!</p>
                      </div>
                    )}
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
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 sm:hidden z-40">
        <div className="flex items-center justify-around py-2" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`flex flex-col items-center justify-center py-2 px-4 min-w-[64px] ${currentView === 'dashboard' ? 'text-blue-600' : 'text-gray-400'
              }`}
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            <span className="text-xs font-medium">Dashboard</span>
          </button>

          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center justify-center w-14 h-14 bg-blue-600 rounded-full shadow-lg -mt-6 text-white active:scale-95 transition-transform"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
            </svg>
          </button>

          <button
            onClick={() => setCurrentView('transactions')}
            className={`flex flex-col items-center justify-center py-2 px-4 min-w-[64px] ${currentView === 'transactions' ? 'text-blue-600' : 'text-gray-400'
              }`}
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-xs font-medium">Giao dịch</span>
          </button>
        </div>
      </div>

      {/* Modal Form */}
      {isFormOpen && (
        <TransactionForm
          onAdd={handleAddTransaction}
          onClose={() => setIsFormOpen(false)}
        />
      )}

      {/* Budget Modal */}
      {isBudgetModalOpen && (
        <BudgetModal
          budgets={budgets}
          onSave={handleSaveBudgets}
          onClose={() => setIsBudgetModalOpen(false)}
        />
      )}
    </div>
  );
};

// Tip Item Component
const TipItem: React.FC<{ emoji: string; color: string; text: string }> = ({ emoji, color, text }) => (
  <li className="flex items-start">
    <span className={`bg-${color}-100 p-2 rounded-lg mr-3 text-${color}-600 flex-shrink-0`}>{emoji}</span>
    <p className="text-sm text-gray-600">{text}</p>
  </li>
);

export default App;
