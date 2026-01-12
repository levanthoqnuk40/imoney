
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

export type ViewType = 'dashboard' | 'transactions';
