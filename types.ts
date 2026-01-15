
export type TransactionType = 'INCOME' | 'EXPENSE';

export interface Transaction {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  type: TransactionType;
  receipt_url?: string;  // URL ảnh hoá đơn từ Supabase Storage
}

export interface SpendingSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export interface AIAdvice {
  summary: string;
  tips: string[];
}

export interface Budget {
  id: string;
  category: string;
  limit: number;
  period: 'monthly' | 'weekly';
}

// ============================================
// DEBT MANAGEMENT TYPES
// ============================================

// Loại nợ: receivable = người khác nợ mình, payable = mình nợ người khác
export type DebtType = 'receivable' | 'payable';

// Trạng thái khoản nợ
export type DebtStatus = 'pending' | 'partial' | 'completed';

// Interface cho khoản nợ
export interface Debt {
  id: string;
  user_id: string;
  type: DebtType;
  person_name: string;
  original_amount: number;
  paid_amount: number;
  remaining_amount: number; // Computed: original - paid
  created_date: string;
  due_date?: string;
  description?: string;
  status: DebtStatus;
}

// Interface cho lịch sử thanh toán
export interface DebtPayment {
  id: string;
  debt_id: string;
  amount: number;
  payment_date: string;
  note?: string;
}

// ============================================
// GIFT MONEY TRACKING TYPES
// ============================================

// Hướng tiền: given = mình đưa, received = mình nhận
export type GiftDirection = 'given' | 'received';

// Loại sự kiện
export type GiftEventType =
  | 'wedding' | 'birthday' | 'housewarming'
  | 'funeral' | 'baby' | 'graduation' | 'other';

// Interface cho tiền ghi nhớ
export interface GiftRecord {
  id: string;
  user_id: string;
  direction: GiftDirection;
  person_name: string;
  event_type: GiftEventType;
  amount: number;
  event_date: string;
  note?: string;
}

// View types cho navigation
export type ViewType = 'dashboard' | 'transactions' | 'debts' | 'gifts';
