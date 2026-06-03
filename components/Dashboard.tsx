
import React, { useMemo } from 'react';
import { Transaction, Budget, Category } from '../types';
import { COLORS } from '../constants';
import BudgetCard from './BudgetCard';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, AreaChart, Area, BarChart, Bar, LabelList } from 'recharts';

interface DashboardProps {
    transactions: Transaction[];
    budgets: Budget[];
    onEditBudget: () => void;
    onMonthClick?: (yearMonth: string) => void;
    categories: Category[];
}

const Dashboard: React.FC<DashboardProps> = ({ transactions, budgets, onEditBudget, onMonthClick, categories }) => {
    // Get current month transactions
    const { currentMonth, currentYear } = useMemo(() => ({
        currentMonth: new Date().getMonth(),
        currentYear: new Date().getFullYear(),
    }), []);

    const monthlyTransactions = useMemo(() => {
        return transactions.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });
    }, [transactions, currentMonth, currentYear]);

    // Calculate spending by category for current month
    const categorySpending = useMemo(() => {
        const spending: Record<string, number> = {};
        monthlyTransactions
            .filter(t => t.type === 'EXPENSE')
            .forEach(t => {
                spending[t.category] = (spending[t.category] || 0) + t.amount;
            });
        return spending;
    }, [monthlyTransactions]);

    // Monthly trend data (last 6 months)
    const monthlyTrend = useMemo(() => {
        const months: Record<string, { income: number; expense: number; month: string }> = {};
        const monthNames = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

        // Build a reverse lookup: label -> 'YYYY-MM'
        const labelToYearMonth: Record<string, string> = {};
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            months[key] = { income: 0, expense: 0, month: monthNames[d.getMonth()] };
            labelToYearMonth[monthNames[d.getMonth()]] = ym;
        }

        transactions.forEach(t => {
            const d = new Date(t.date);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (months[key]) {
                if (t.type === 'INCOME') months[key].income += t.amount;
                else months[key].expense += t.amount;
            }
        });

        return { data: Object.values(months), labelToYearMonth };
    }, [transactions]);

    // Category breakdown for pie chart
    const pieData = useMemo(() => {
        return Object.entries(categorySpending)
            .map(([name, value]: [string, number]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [categorySpending]);

    // Calculate totals
    const totals = useMemo(() => {
        const income = monthlyTransactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
        const expense = monthlyTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
        const savingRate = income > 0 ? ((income - expense) / income) * 100 : 0;
        return { income, expense, savingRate };
    }, [monthlyTransactions]);

    // Weekly comparison
    const weeklyComparison = useMemo(() => {
        const now = new Date();
        const thisWeekStart = new Date(now);
        thisWeekStart.setDate(now.getDate() - now.getDay());
        const lastWeekStart = new Date(thisWeekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        const lastWeekEnd = new Date(thisWeekStart);
        lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

        let thisWeek = 0, lastWeek = 0;
        transactions.forEach(t => {
            if (t.type !== 'EXPENSE') return;
            const d = new Date(t.date);
            if (d >= thisWeekStart) thisWeek += t.amount;
            else if (d >= lastWeekStart && d <= lastWeekEnd) lastWeek += t.amount;
        });

        const change = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0;
        return { thisWeek, lastWeek, change };
    }, [transactions]);

    // Previous month comparison
    const monthComparison = useMemo(() => {
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        const prevTransactions = transactions.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
        });

        const prevIncome = prevTransactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
        const prevExpense = prevTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);

        const incomeChange = prevIncome > 0 ? ((totals.income - prevIncome) / prevIncome) * 100 : 0;
        const expenseChange = prevExpense > 0 ? ((totals.expense - prevExpense) / prevExpense) * 100 : 0;

        const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
            'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

        return {
            prevIncome, prevExpense,
            incomeChange, expenseChange,
            prevMonthName: monthNames[prevMonth],
            currentMonthName: monthNames[currentMonth],
            hasPrevData: prevIncome > 0 || prevExpense > 0,
        };
    }, [transactions, currentMonth, currentYear, totals]);

    // Phân tích quy tắc tài chính 50/30/20
    const rule503020 = useMemo(() => {
        let needsActual = 0;
        let wantsActual = 0;
        
        // Track category names that are classified as "Needs" based on default system IDs
        const needCategoryIds = ['cat_nhao', 'cat_anuong', 'cat_dichuyen', 'cat_suckhoe', 'cat_giaoduc'];
        const needCategoryNames = categories
            .filter(c => needCategoryIds.includes(c.id))
            .map(c => c.name);
        
        monthlyTransactions.forEach(t => {
            if (t.type === 'EXPENSE') {
                if (needCategoryNames.includes(t.category)) {
                    needsActual += t.amount;
                } else {
                    wantsActual += t.amount;
                }
            }
        });

        const totalIncome = totals.income;
        const totalExpenses = needsActual + wantsActual;
        const savingsActual = Math.max(0, totalIncome - totalExpenses);

        const needsTarget = totalIncome * 0.5;
        const wantsTarget = totalIncome * 0.3;
        const savingsTarget = totalIncome * 0.2;

        const needsPercent = totalIncome > 0 ? (needsActual / totalIncome) * 100 : 0;
        const wantsPercent = totalIncome > 0 ? (wantsActual / totalIncome) * 100 : 0;
        const savingsPercent = totalIncome > 0 ? (savingsActual / totalIncome) * 100 : 0;

        return {
            totalIncome,
            needsActual,
            needsTarget,
            needsPercent,
            wantsActual,
            wantsTarget,
            wantsPercent,
            savingsActual,
            savingsTarget,
            savingsPercent,
            hasData: totalIncome > 0 || totalExpenses > 0
        };
    }, [monthlyTransactions, totals.income]);

    return (
        <div className="space-y-6">
            {/* Summary Cards Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="card p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                    <p className="text-xs text-blue-600 font-medium mb-1">Thu tháng này</p>
                    <p className="text-lg sm:text-xl font-bold text-blue-700">{totals.income.toLocaleString('vi-VN')}</p>
                </div>
                <div className="card p-4 bg-gradient-to-br from-rose-50 to-rose-100 border-rose-200">
                    <p className="text-xs text-rose-600 font-medium mb-1">Chi tháng này</p>
                    <p className="text-lg sm:text-xl font-bold text-rose-700">{totals.expense.toLocaleString('vi-VN')}</p>
                </div>
                <div className="card p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
                    <p className="text-xs text-emerald-600 font-medium mb-1">Tỷ lệ tiết kiệm</p>
                    <p className="text-lg sm:text-xl font-bold text-emerald-700">{totals.savingRate.toFixed(1)}%</p>
                </div>
                <div className="card p-4 bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                    <p className="text-xs text-amber-600 font-medium mb-1">So với tuần trước</p>
                    <p className={`text-lg sm:text-xl font-bold ${weeklyComparison.change > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {weeklyComparison.change > 0 ? '+' : ''}{weeklyComparison.change.toFixed(0)}%
                    </p>
                </div>
            </div>

            {/* Monthly History — 6 Month Grouped Bar Chart */}
            {monthlyTrend.data.some(m => m.income > 0 || m.expense > 0) && (
                <div className="card p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <span>📊</span> Thu chi 6 tháng gần nhất
                    </h3>
                    <div style={{ width: '100%', height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={monthlyTrend.data}
                                barGap={4}
                                barCategoryGap="15%"
                                margin={{ top: 20 }}
                                onClick={(state) => {
                                    if (state?.activeLabel && onMonthClick) {
                                        const ym = monthlyTrend.labelToYearMonth[state.activeLabel];
                                        if (ym) onMonthClick(ym);
                                    }
                                }}
                                style={{ cursor: onMonthClick ? 'pointer' : 'default' }}
                            >
                                <XAxis dataKey="month" fontSize={12} tickMargin={8} />
                                <YAxis hide />
                                <Tooltip formatter={(value: number) => value.toLocaleString('vi-VN') + ' đ'} />
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                                <Bar dataKey="income" name="Thu" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36}>
                                    <LabelList dataKey="income" position="top" fontSize={9} fill="#059669" formatter={(v: number) => v > 0 ? (v >= 1000000 ? (v / 1000000).toFixed(1) + 'tr' : v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toString()) : ''} />
                                </Bar>
                                <Bar dataKey="expense" name="Chi" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={36}>
                                    <LabelList dataKey="expense" position="top" fontSize={9} fill="#e11d48" formatter={(v: number) => v > 0 ? (v >= 1000000 ? (v / 1000000).toFixed(1) + 'tr' : v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toString()) : ''} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    {/* vs previous month badges */}
                    {monthComparison.hasPrevData && (
                        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-100">
                            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50">
                                <span className="text-xs text-gray-600">Thu so với {monthComparison.prevMonthName}</span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${monthComparison.incomeChange >= 0
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-rose-100 text-rose-700'
                                    }`}>
                                    {monthComparison.incomeChange >= 0 ? '↑' : '↓'}{Math.abs(monthComparison.incomeChange).toFixed(0)}%
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-rose-50">
                                <span className="text-xs text-gray-600">Chi so với {monthComparison.prevMonthName}</span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${monthComparison.expenseChange <= 0
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-rose-100 text-rose-700'
                                    }`}>
                                    {monthComparison.expenseChange >= 0 ? '↑' : '↓'}{Math.abs(monthComparison.expenseChange).toFixed(0)}%
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Phân tích quy tắc 50/30/20 */}
            <div className="card p-4 sm:p-6 bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                    <div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
                            <span>🎯</span> Quy tắc phân bổ tài chính 50/30/20
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Phương pháp quản lý dòng tiền cá nhân tiêu chuẩn quốc tế giúp bạn cân bằng cuộc sống và tích lũy bền vững.
                        </p>
                    </div>
                    {rule503020.hasData && (
                        <span className="self-start sm:self-center bg-slate-200 text-slate-700 text-xs px-2.5 py-1 rounded-full font-semibold">
                            Thu nhập áp dụng: {rule503020.totalIncome.toLocaleString('vi-VN')}đ
                        </span>
                    )}
                </div>

                {!rule503020.hasData ? (
                    <div className="text-center py-6 text-slate-400 text-sm italic">
                        Hãy thêm giao dịch thu nhập và chi tiêu của tháng này để phân tích theo quy tắc 50/30/20.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* 50% Needs */}
                        <div className="bg-white rounded-2xl p-4 border border-slate-100 flex flex-col justify-between shadow-sm">
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm">Thiết yếu (Needs)</h4>
                                        <p className="text-[10px] text-slate-400">Ăn uống, Nhà ở, Đi lại, Sức khỏe, Học tập</p>
                                    </div>
                                    <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        Mục tiêu: 50%
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs font-semibold">
                                        <span className="text-slate-600">Thực tế: {rule503020.needsPercent.toFixed(1)}%</span>
                                        <span className={rule503020.needsPercent <= 50 ? 'text-emerald-600' : 'text-rose-600'}>
                                            {rule503020.needsActual.toLocaleString('vi-VN')}đ
                                        </span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${
                                                rule503020.needsPercent <= 50 ? 'bg-blue-500' : 'bg-rose-500'
                                            }`}
                                            style={{ width: `${Math.min(rule503020.needsPercent * 2, 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400">
                                        Hạn mức tối đa đề xuất: {rule503020.needsTarget.toLocaleString('vi-VN')}đ
                                    </p>
                                </div>
                            </div>
                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                                <span className="text-[10px] text-slate-500 font-medium">Trạng thái:</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    rule503020.needsPercent <= 50 
                                        ? 'bg-emerald-50 text-emerald-600' 
                                        : 'bg-rose-50 text-rose-600'
                                }`}>
                                    {rule503020.needsPercent <= 50 ? '✓ Tốt' : '⚠ Cần tối ưu'}
                                </span>
                            </div>
                        </div>

                        {/* 30% Wants */}
                        <div className="bg-white rounded-2xl p-4 border border-slate-100 flex flex-col justify-between shadow-sm">
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm">Sở thích (Wants)</h4>
                                        <p className="text-[10px] text-slate-400">Mua sắm, Giải trí, Chuyển tiền đi, Khác</p>
                                    </div>
                                    <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        Mục tiêu: 30%
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs font-semibold">
                                        <span className="text-slate-600">Thực tế: {rule503020.wantsPercent.toFixed(1)}%</span>
                                        <span className={rule503020.wantsPercent <= 30 ? 'text-emerald-600' : 'text-rose-600'}>
                                            {rule503020.wantsActual.toLocaleString('vi-VN')}đ
                                        </span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${
                                                rule503020.wantsPercent <= 30 ? 'bg-amber-500' : 'bg-rose-500'
                                            }`}
                                            style={{ width: `${Math.min(rule503020.wantsPercent * 3.33, 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400">
                                        Hạn mức tối đa đề xuất: {rule503020.wantsTarget.toLocaleString('vi-VN')}đ
                                    </p>
                                </div>
                            </div>
                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                                <span className="text-[10px] text-slate-500 font-medium">Trạng thái:</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    rule503020.wantsPercent <= 30 
                                        ? 'bg-emerald-50 text-emerald-600' 
                                        : 'bg-rose-50 text-rose-600'
                                }`}>
                                    {rule503020.wantsPercent <= 30 ? '✓ Tốt' : '⚠ Vượt chi tiêu'}
                                </span>
                            </div>
                        </div>

                        {/* 20% Savings */}
                        <div className="bg-white rounded-2xl p-4 border border-slate-100 flex flex-col justify-between shadow-sm">
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm">Tích lũy (Savings)</h4>
                                        <p className="text-[10px] text-slate-400">Dư thu nhập trừ chi tiêu để tích luỹ/đầu tư</p>
                                    </div>
                                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        Mục tiêu: ≥ 20%
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs font-semibold">
                                        <span className="text-slate-600">Thực tế: {rule503020.savingsPercent.toFixed(1)}%</span>
                                        <span className={rule503020.savingsPercent >= 20 ? 'text-emerald-600' : 'text-amber-600'}>
                                            {rule503020.savingsActual.toLocaleString('vi-VN')}đ
                                        </span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${
                                                rule503020.savingsPercent >= 20 ? 'bg-emerald-500' : 'bg-amber-400'
                                            }`}
                                            style={{ width: `${Math.min(rule503020.savingsPercent * 5, 100)}%` }}
                                        />
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                        Mục tiêu đề xuất: {rule503020.savingsTarget.toLocaleString('vi-VN')}đ
                                    </div>
                                </div>
                            </div>
                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                                <span className="text-[10px] text-slate-500 font-medium">Trạng thái:</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    rule503020.savingsPercent >= 20 
                                        ? 'bg-emerald-50 text-emerald-600' 
                                        : 'bg-amber-50 text-amber-600'
                                }`}>
                                    {rule503020.savingsPercent >= 20 ? '✓ Đạt chỉ tiêu' : '⚠ Cần tăng tích lũy'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Budget Progress */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base sm:text-lg font-bold text-gray-800">Ngân sách tháng này</h3>
                    <button
                        onClick={onEditBudget}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 touch-target"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="hidden sm:inline">Thiết lập</span>
                    </button>
                </div>

                {budgets.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {budgets.map(budget => (
                            <BudgetCard
                                key={budget.id}
                                category={budget.category}
                                spent={categorySpending[budget.category] || 0}
                                limit={budget.limit}
                                icon={categories.find(c => c.name === budget.category)?.icon || '📦'}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="card p-8 text-center">
                        <div className="text-4xl mb-3">📊</div>
                        <p className="text-gray-600 mb-2">Chưa có ngân sách nào được thiết lập</p>
                        <button
                            onClick={onEditBudget}
                            className="text-blue-600 font-medium hover:text-blue-700"
                        >
                            Thiết lập ngân sách ngay
                        </button>
                    </div>
                )}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Monthly Trend */}
                <div className="card p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4">Xu hướng 6 tháng</h3>
                    <div className="chart-container">
                        {monthlyTrend.data.some(m => m.income > 0 || m.expense > 0) ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={monthlyTrend.data}>
                                    <defs>
                                        <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="month" fontSize={12} tickMargin={8} />
                                    <YAxis hide />
                                    <Tooltip formatter={(value: number) => value.toLocaleString('vi-VN') + ' đ'} />
                                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                                    <Area type="monotone" dataKey="income" name="Thu" stroke="#10b981" fill="url(#incomeGrad)" strokeWidth={2} />
                                    <Area type="monotone" dataKey="expense" name="Chi" stroke="#ef4444" fill="url(#expenseGrad)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
                                Chưa có dữ liệu
                            </div>
                        )}
                    </div>
                </div>

                {/* Category Breakdown */}
                <div className="card p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4">Chi tiêu theo danh mục</h3>
                    <div className="chart-container">
                        {pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        innerRadius="50%"
                                        outerRadius="75%"
                                        paddingAngle={3}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        labelLine={false}
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => value.toLocaleString('vi-VN') + ' đ'} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
                                Chưa có dữ liệu chi tiêu tháng này
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Top Spending Categories */}
            {pieData.length > 0 && (
                <div className="card p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4">Top chi tiêu tháng này</h3>
                    <div className="space-y-3">
                        {pieData.slice(0, 5).map((cat, idx) => (
                            <div key={cat.name} className="flex items-center gap-3">
                                <span className="text-xl">{categories.find(c => c.name === cat.name)?.icon || '📦'}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-medium text-gray-800 text-sm truncate">{cat.name}</span>
                                        <span className="text-sm text-gray-600 ml-2">{cat.value.toLocaleString('vi-VN')}đ</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${(cat.value / pieData[0].value) * 100}%`,
                                                backgroundColor: COLORS[idx % COLORS.length]
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
