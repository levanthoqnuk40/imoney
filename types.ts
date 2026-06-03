
export type TransactionType = 'INCOME' | 'EXPENSE';

export interface Category {
  id: string;
  name: string;
  icon: string;
  type: TransactionType;
  keywords: string[];
}

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

// ============================================
// SUPABASE PAYLOAD SCHEMAS FOR SYNC
// ============================================

export type SupabaseTransactionInsert = {
  _tempId?: string;
  user_id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  transaction_date: string;
  currency?: string;
  receipt_url?: string | null;
};

export type SupabaseTransactionUpdate = {
  id: string;
  user_id: string;
  description?: string;
  category?: string;
  receipt_url?: string | null;
};

export type SupabaseTransactionDelete = {
  id: string;
  user_id: string;
};

export type SupabaseDebtInsert = {
  _tempId?: string;
  user_id: string;
  type: 'receivable' | 'payable';
  person_name: string;
  original_amount: number;
  created_date: string;
  due_date?: string | null;
  description?: string | null;
  status: 'pending' | 'partial' | 'completed';
};

export type SupabaseDebtUpdate = {
  id: string;
  user_id: string;
  paid_amount?: number;
  status?: 'pending' | 'partial' | 'completed';
};

export type SupabaseDebtDelete = {
  id: string;
  user_id: string;
};

export type SupabaseGiftInsert = {
  _tempId?: string;
  user_id: string;
  direction: GiftDirection;
  person_name: string;
  event_type: GiftEventType;
  amount: number;
  event_date: string;
  note?: string | null;
};

export type SupabaseGiftDelete = {
  id: string;
  user_id: string;
};

export type SupabaseBudgetInsert = {
  _tempId?: string;
  user_id: string;
  category: string;
  budget_limit: number;
  period: 'monthly' | 'weekly';
};

export type SupabaseBudgetDelete = {
  user_id: string;
};

export type SupabaseCategoryInsert = {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  type: 'INCOME' | 'EXPENSE';
  keywords: string[];
};

export type SupabaseCategoryUpdate = {
  id: string;
  user_id: string;
  name?: string;
  icon?: string;
  type?: 'INCOME' | 'EXPENSE';
  keywords?: string[];
};

export type SupabaseCategoryDelete = {
  id: string;
  user_id: string;
};

export type SupabaseDebtPaymentInsert = {
  id: string;
  debt_id: string;
  amount: number;
  payment_date: string;
  note?: string | null;
};

export type SupabaseDebtPaymentDelete = {
  id: string;
};

export type SyncPayload =
  | { table: 'transactions'; action: 'INSERT'; data: SupabaseTransactionInsert }
  | { table: 'transactions'; action: 'UPDATE'; data: SupabaseTransactionUpdate }
  | { table: 'transactions'; action: 'DELETE'; data: SupabaseTransactionDelete }
  | { table: 'debts'; action: 'INSERT'; data: SupabaseDebtInsert }
  | { table: 'debts'; action: 'UPDATE'; data: SupabaseDebtUpdate }
  | { table: 'debts'; action: 'DELETE'; data: SupabaseDebtDelete }
  | { table: 'gift_records'; action: 'INSERT'; data: SupabaseGiftInsert }
  | { table: 'gift_records'; action: 'DELETE'; data: SupabaseGiftDelete }
  | { table: 'budgets'; action: 'INSERT'; data: SupabaseBudgetInsert }
  | { table: 'budgets'; action: 'DELETE'; data: SupabaseBudgetDelete }
  | { table: 'categories'; action: 'INSERT' | 'UPDATE'; data: SupabaseCategoryInsert }
  | { table: 'categories'; action: 'DELETE'; data: SupabaseCategoryDelete }
  | { table: 'debt_payments'; action: 'INSERT'; data: SupabaseDebtPaymentInsert }
  | { table: 'debt_payments'; action: 'DELETE'; data: SupabaseDebtPaymentDelete };

