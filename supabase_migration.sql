-- ============================================
-- SUPABASE MIGRATION: Debt Management Tables
-- ============================================
-- Run this script in Supabase SQL Editor
-- Dashboard > SQL Editor > New Query

-- Bảng chính lưu thông tin khoản nợ
CREATE TABLE IF NOT EXISTS debts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('receivable', 'payable')),
  person_name VARCHAR(255) NOT NULL,
  original_amount DECIMAL(15,2) NOT NULL,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  created_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index cho truy vấn nhanh
CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_type ON debts(type);
CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);

-- RLS Policy cho debts
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running)
DROP POLICY IF EXISTS "Users can view own debts" ON debts;
DROP POLICY IF EXISTS "Users can insert own debts" ON debts;
DROP POLICY IF EXISTS "Users can update own debts" ON debts;
DROP POLICY IF EXISTS "Users can delete own debts" ON debts;

CREATE POLICY "Users can view own debts" ON debts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own debts" ON debts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own debts" ON debts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own debts" ON debts
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Bảng lưu lịch sử thanh toán từng phần
-- ============================================

CREATE TABLE IF NOT EXISTS debt_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  debt_id UUID REFERENCES debts(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id ON debt_payments(debt_id);

-- RLS Policy cho debt_payments (chỉ cho phép qua debt của user)
ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage payments for own debts" ON debt_payments;

CREATE POLICY "Users can manage payments for own debts" ON debt_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()
    )
  );

-- ============================================
-- Function to auto-update paid_amount and status
-- ============================================

CREATE OR REPLACE FUNCTION update_debt_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Update paid_amount
  UPDATE debts 
  SET 
    paid_amount = (SELECT COALESCE(SUM(amount), 0) FROM debt_payments WHERE debt_id = NEW.debt_id),
    status = CASE 
      WHEN (SELECT COALESCE(SUM(amount), 0) FROM debt_payments WHERE debt_id = NEW.debt_id) >= original_amount THEN 'completed'
      WHEN (SELECT COALESCE(SUM(amount), 0) FROM debt_payments WHERE debt_id = NEW.debt_id) > 0 THEN 'partial'
      ELSE 'pending'
    END,
    updated_at = NOW()
  WHERE id = NEW.debt_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for insert/update/delete on debt_payments
DROP TRIGGER IF EXISTS trigger_update_debt_on_payment ON debt_payments;

CREATE TRIGGER trigger_update_debt_on_payment
AFTER INSERT OR UPDATE OR DELETE ON debt_payments
FOR EACH ROW
EXECUTE FUNCTION update_debt_on_payment();

-- ============================================
-- Done! Verify tables created
-- ============================================
-- SELECT * FROM debts LIMIT 1;
-- SELECT * FROM debt_payments LIMIT 1;

-- ============================================
-- GIFT MONEY TRACKING TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS gift_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('given', 'received')),
  person_name VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  event_date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gift_records_user_id ON gift_records(user_id);
CREATE INDEX IF NOT EXISTS idx_gift_records_direction ON gift_records(direction);
CREATE INDEX IF NOT EXISTS idx_gift_records_event_type ON gift_records(event_type);
CREATE INDEX IF NOT EXISTS idx_gift_records_person_name ON gift_records(person_name);

-- RLS Policies
ALTER TABLE gift_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own gifts" ON gift_records;
DROP POLICY IF EXISTS "Users can insert own gifts" ON gift_records;
DROP POLICY IF EXISTS "Users can update own gifts" ON gift_records;
DROP POLICY IF EXISTS "Users can delete own gifts" ON gift_records;

CREATE POLICY "Users can view own gifts" ON gift_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gifts" ON gift_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gifts" ON gift_records
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own gifts" ON gift_records
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- ALL TABLES CREATED!
-- ============================================
-- Verify: SELECT * FROM gift_records LIMIT 1;
