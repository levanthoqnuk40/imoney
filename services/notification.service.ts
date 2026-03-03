/**
 * Notification Service — Local notifications for debt reminders & budget alerts.
 * Uses @capacitor/local-notifications to schedule Android notifications
 * at 6:00 AM and 6:00 PM daily.
 *
 * ID Ranges:
 *  - 1000–1999: Debt notifications
 *  - 2000–2999: Budget notifications
 */

import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { Debt } from '../types';
import { Transaction, Budget } from '../types';

// ============================================
// CONSTANTS
// ============================================

const DEBT_ID_BASE = 1000;
const BUDGET_ID_BASE = 2000;
const NOTIFICATION_HOURS = [6, 18]; // 6 AM and 6 PM

// ============================================
// INITIALIZATION
// ============================================

export async function initNotifications(): Promise<boolean> {
    try {
        const permResult = await LocalNotifications.requestPermissions();
        if (permResult.display !== 'granted') {
            console.warn('Notification permission not granted');
            return false;
        }
        return true;
    } catch (error) {
        console.error('Failed to initialize notifications:', error);
        return false;
    }
}

// ============================================
// DEBT NOTIFICATIONS
// ============================================

export async function scheduleDebtNotifications(debts: Debt[]): Promise<void> {
    // Cancel all existing debt notifications first
    await cancelNotificationRange(DEBT_ID_BASE, DEBT_ID_BASE + 999);

    const pendingDebts = debts.filter(d => d.status !== 'completed' && d.due_date);
    if (pendingDebts.length === 0) return;

    const notifications: ScheduleOptions['notifications'] = [];
    let idCounter = DEBT_ID_BASE;
    const now = new Date();

    for (const debt of pendingDebts) {
        if (!debt.due_date || idCounter >= DEBT_ID_BASE + 999) break;

        const dueDate = new Date(debt.due_date + 'T00:00:00');
        const diffDays = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const amountStr = debt.remaining_amount.toLocaleString('vi-VN');
        const typeLabel = debt.type === 'payable' ? 'trả nợ' : 'thu nợ';

        // 3 days before due date
        if (diffDays >= 3) {
            const scheduleDate = new Date(dueDate);
            scheduleDate.setDate(scheduleDate.getDate() - 3);
            scheduleDate.setHours(6, 0, 0, 0);

            if (scheduleDate > now) {
                notifications.push({
                    id: idCounter++,
                    title: '⏳ Nợ sắp đến hạn (còn 3 ngày)',
                    body: `${debt.person_name}: ${amountStr}₫ — ${typeLabel}. Hạn: ${formatDate(dueDate)}`,
                    schedule: { at: scheduleDate },
                    sound: 'default',
                    smallIcon: 'ic_stat_icon_config_sample',
                });
            }
        }

        // 1 day before due date
        if (diffDays >= 1) {
            const scheduleDate = new Date(dueDate);
            scheduleDate.setDate(scheduleDate.getDate() - 1);
            scheduleDate.setHours(6, 0, 0, 0);

            if (scheduleDate > now) {
                notifications.push({
                    id: idCounter++,
                    title: '⚠️ Nợ đến hạn ngày mai!',
                    body: `${debt.person_name}: ${amountStr}₫ — ${typeLabel}. Hạn: ${formatDate(dueDate)}`,
                    schedule: { at: scheduleDate },
                    sound: 'default',
                    smallIcon: 'ic_stat_icon_config_sample',
                });
            }
        }

        // On due date
        if (diffDays >= 0) {
            const scheduleDate = new Date(dueDate);
            scheduleDate.setHours(6, 0, 0, 0);

            if (scheduleDate > now) {
                notifications.push({
                    id: idCounter++,
                    title: '🔴 Nợ đến hạn hôm nay!',
                    body: `${debt.person_name}: ${amountStr}₫ — ${typeLabel}. Cần xử lý ngay!`,
                    schedule: { at: scheduleDate },
                    sound: 'default',
                    smallIcon: 'ic_stat_icon_config_sample',
                });
            }
        }

        // Overdue: schedule daily reminders for the next 7 days at 6 AM
        if (diffDays < 0) {
            const overdueDays = Math.abs(diffDays);
            for (let i = 0; i < 7 && idCounter < DEBT_ID_BASE + 999; i++) {
                const scheduleDate = getNextScheduleTime(6);
                scheduleDate.setDate(scheduleDate.getDate() + i);

                if (scheduleDate > now) {
                    notifications.push({
                        id: idCounter++,
                        title: '🚨 Nợ quá hạn!',
                        body: `${debt.person_name}: ${amountStr}₫ — ${typeLabel}. Đã quá hạn ${overdueDays + i} ngày!`,
                        schedule: { at: scheduleDate },
                        sound: 'default',
                        smallIcon: 'ic_stat_icon_config_sample',
                    });
                }
            }
        }
    }

    if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });
        console.log(`Scheduled ${notifications.length} debt notifications`);
    }
}

// ============================================
// BUDGET NOTIFICATIONS
// ============================================

export async function scheduleBudgetNotifications(
    budgets: Budget[],
    transactions: Transaction[],
): Promise<void> {
    // Cancel all existing budget notifications first
    await cancelNotificationRange(BUDGET_ID_BASE, BUDGET_ID_BASE + 999);

    if (budgets.length === 0) return;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Calculate spending per category for current month
    const monthlySpending: Record<string, number> = {};
    transactions
        .filter(t => t.type === 'EXPENSE' && t.date.startsWith(currentMonth))
        .forEach(t => {
            monthlySpending[t.category] = (monthlySpending[t.category] || 0) + t.amount;
        });

    const notifications: ScheduleOptions['notifications'] = [];
    let idCounter = BUDGET_ID_BASE;

    for (const budget of budgets) {
        if (idCounter >= BUDGET_ID_BASE + 999) break;

        const spent = monthlySpending[budget.category] || 0;
        const percentage = (spent / budget.limit) * 100;
        const spentStr = spent.toLocaleString('vi-VN');
        const limitStr = budget.limit.toLocaleString('vi-VN');

        if (percentage >= 100) {
            // Exceeded — schedule at next available time
            const scheduleDate = getNextScheduleTime();
            notifications.push({
                id: idCounter++,
                title: '🔴 Vượt ngân sách chi tiêu!',
                body: `${budget.category}: đã chi ${spentStr}₫ / ${limitStr}₫ (${percentage.toFixed(0)}%). Cần kiểm soát chi tiêu!`,
                schedule: { at: scheduleDate },
                sound: 'default',
                smallIcon: 'ic_stat_icon_config_sample',
            });
        } else if (percentage >= 80) {
            // Warning — schedule at next available time
            const scheduleDate = getNextScheduleTime();
            notifications.push({
                id: idCounter++,
                title: '⚠️ Sắp vượt ngân sách!',
                body: `${budget.category}: đã chi ${spentStr}₫ / ${limitStr}₫ (${percentage.toFixed(0)}%). Chỉ còn ${(budget.limit - spent).toLocaleString('vi-VN')}₫.`,
                schedule: { at: scheduleDate },
                sound: 'default',
                smallIcon: 'ic_stat_icon_config_sample',
            });
        }
    }

    if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });
        console.log(`Scheduled ${notifications.length} budget notifications`);
    }
}

// ============================================
// IN-APP ALERTS (for bell icon panel)
// ============================================

export interface NotificationAlert {
    id: string;
    type: 'debt_due_soon' | 'debt_overdue' | 'budget_warning' | 'budget_exceeded';
    icon: string;
    title: string;
    body: string;
    severity: 'warning' | 'danger';
}

export function getActiveAlerts(
    debts: Debt[],
    budgets: Budget[],
    transactions: Transaction[],
): NotificationAlert[] {
    const alerts: NotificationAlert[] = [];
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Debt alerts
    const pendingDebts = debts.filter(d => d.status !== 'completed' && d.due_date);
    for (const debt of pendingDebts) {
        if (!debt.due_date) continue;
        const dueDate = new Date(debt.due_date + 'T00:00:00');
        const diffDays = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const amountStr = debt.remaining_amount.toLocaleString('vi-VN');
        const typeLabel = debt.type === 'payable' ? 'trả nợ' : 'thu nợ';

        if (diffDays < 0) {
            alerts.push({
                id: `debt_overdue_${debt.id}`,
                type: 'debt_overdue',
                icon: '🚨',
                title: `Nợ quá hạn ${Math.abs(diffDays)} ngày`,
                body: `${debt.person_name}: ${amountStr}₫ — ${typeLabel}`,
                severity: 'danger',
            });
        } else if (diffDays === 0) {
            alerts.push({
                id: `debt_today_${debt.id}`,
                type: 'debt_due_soon',
                icon: '🔴',
                title: 'Nợ đến hạn hôm nay!',
                body: `${debt.person_name}: ${amountStr}₫ — ${typeLabel}`,
                severity: 'danger',
            });
        } else if (diffDays <= 3) {
            alerts.push({
                id: `debt_soon_${debt.id}`,
                type: 'debt_due_soon',
                icon: '⏳',
                title: `Nợ đến hạn trong ${diffDays} ngày`,
                body: `${debt.person_name}: ${amountStr}₫ — ${typeLabel}`,
                severity: 'warning',
            });
        }
    }

    // Budget alerts
    const monthlySpending: Record<string, number> = {};
    transactions
        .filter(t => t.type === 'EXPENSE' && t.date.startsWith(currentMonth))
        .forEach(t => {
            monthlySpending[t.category] = (monthlySpending[t.category] || 0) + t.amount;
        });

    for (const budget of budgets) {
        const spent = monthlySpending[budget.category] || 0;
        const percentage = (spent / budget.limit) * 100;
        const spentStr = spent.toLocaleString('vi-VN');
        const limitStr = budget.limit.toLocaleString('vi-VN');

        if (percentage >= 100) {
            alerts.push({
                id: `budget_exceeded_${budget.id}`,
                type: 'budget_exceeded',
                icon: '🔴',
                title: `Vượt ngân sách ${budget.category}`,
                body: `${spentStr}₫ / ${limitStr}₫ (${percentage.toFixed(0)}%)`,
                severity: 'danger',
            });
        } else if (percentage >= 80) {
            alerts.push({
                id: `budget_warning_${budget.id}`,
                type: 'budget_warning',
                icon: '⚠️',
                title: `Sắp vượt NS ${budget.category}`,
                body: `${spentStr}₫ / ${limitStr}₫ (${percentage.toFixed(0)}%)`,
                severity: 'warning',
            });
        }
    }

    // Sort: danger first, then warning
    alerts.sort((a, b) => (a.severity === 'danger' ? -1 : 1) - (b.severity === 'danger' ? -1 : 1));
    return alerts;
}

// ============================================
// CONVENIENCE WRAPPER
// ============================================

export async function rescheduleAll(
    debts: Debt[],
    budgets: Budget[],
    transactions: Transaction[],
): Promise<void> {
    try {
        await scheduleDebtNotifications(debts);
        await scheduleBudgetNotifications(budgets, transactions);
    } catch (error) {
        console.error('Failed to reschedule notifications:', error);
    }
}

// ============================================
// HELPERS
// ============================================

/**
 * Cancel notifications within a given ID range.
 */
async function cancelNotificationRange(from: number, to: number): Promise<void> {
    try {
        const { notifications: pending } = await LocalNotifications.getPending();
        const idsToCancel = pending
            .filter(n => n.id >= from && n.id <= to)
            .map(n => ({ id: n.id }));

        if (idsToCancel.length > 0) {
            await LocalNotifications.cancel({ notifications: idsToCancel });
        }
    } catch {
        // Silently ignore — may not have any pending
    }
}

/**
 * Get the next 6:00 AM or 6:00 PM that is in the future.
 * If a specific hour is provided, find the next occurrence of that hour.
 */
function getNextScheduleTime(specificHour?: number): Date {
    const now = new Date();
    const result = new Date(now);

    if (specificHour !== undefined) {
        result.setHours(specificHour, 0, 0, 0);
        if (result <= now) {
            result.setDate(result.getDate() + 1);
        }
        return result;
    }

    // Find the next 6 AM or 6 PM
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    for (const hour of NOTIFICATION_HOURS) {
        if (hour > currentHour || (hour === currentHour && currentMinute < 0)) {
            result.setHours(hour, 0, 0, 0);
            return result;
        }
    }

    // All times today have passed — schedule for tomorrow 6 AM
    result.setDate(result.getDate() + 1);
    result.setHours(NOTIFICATION_HOURS[0], 0, 0, 0);
    return result;
}

/**
 * Format date for Vietnamese display.
 */
function formatDate(date: Date): string {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}
