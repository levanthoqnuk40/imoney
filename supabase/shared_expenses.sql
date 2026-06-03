-- =====================================================================
-- SQL Schema for Shared Expenses Repayments Tracking ("Theo dõi chi hộ")
-- =====================================================================

-- 1. Create public.expense_events
CREATE TABLE IF NOT EXISTS public.expense_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount DECIMAL(18, 2) NOT NULL,
    split_method VARCHAR(50) NOT NULL DEFAULT 'equal', -- 'equal', 'custom'
    due_date DATE NULL,
    description TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'open', -- 'open', 'partial', 'settled'
    transaction_id UUID NULL, -- links to owner's personal share transaction
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Create public.expense_participants
CREATE TABLE IF NOT EXISTS public.expense_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.expense_events(id) ON DELETE CASCADE,
    display_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(50) NULL,
    is_owner BOOLEAN NOT NULL DEFAULT FALSE,
    note VARCHAR(500) NULL
);

-- 3. Create public.expense_splits
CREATE TABLE IF NOT EXISTS public.expense_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.expense_events(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES public.expense_participants(id) ON DELETE CASCADE,
    amount_due DECIMAL(18, 2) NOT NULL,
    note VARCHAR(500) NULL
);

-- 4. Create public.repayments
CREATE TABLE IF NOT EXISTS public.repayments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.expense_events(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES public.expense_participants(id) ON DELETE CASCADE,
    repayment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(18, 2) NOT NULL,
    payment_method VARCHAR(50) NULL, -- 'cash', 'transfer', etc.
    reference_no VARCHAR(100) NULL,
    note VARCHAR(500) NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.expense_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repayments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to prevent errors
DO $$
BEGIN
    -- expense_events
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow individual read access' AND tablename = 'expense_events') THEN
        DROP POLICY "Allow individual read access" ON public.expense_events;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow individual insert access' AND tablename = 'expense_events') THEN
        DROP POLICY "Allow individual insert access" ON public.expense_events;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow individual update access' AND tablename = 'expense_events') THEN
        DROP POLICY "Allow individual update access" ON public.expense_events;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow individual delete access' AND tablename = 'expense_events') THEN
        DROP POLICY "Allow individual delete access" ON public.expense_events;
    END IF;

    -- expense_participants
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow select on participants' AND tablename = 'expense_participants') THEN
        DROP POLICY "Allow select on participants" ON public.expense_participants;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow insert on participants' AND tablename = 'expense_participants') THEN
        DROP POLICY "Allow insert on participants" ON public.expense_participants;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow update on participants' AND tablename = 'expense_participants') THEN
        DROP POLICY "Allow update on participants" ON public.expense_participants;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow delete on participants' AND tablename = 'expense_participants') THEN
        DROP POLICY "Allow delete on participants" ON public.expense_participants;
    END IF;

    -- expense_splits
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow select on splits' AND tablename = 'expense_splits') THEN
        DROP POLICY "Allow select on splits" ON public.expense_splits;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow insert on splits' AND tablename = 'expense_splits') THEN
        DROP POLICY "Allow insert on splits" ON public.expense_splits;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow update on splits' AND tablename = 'expense_splits') THEN
        DROP POLICY "Allow update on splits" ON public.expense_splits;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow delete on splits' AND tablename = 'expense_splits') THEN
        DROP POLICY "Allow delete on splits" ON public.expense_splits;
    END IF;

    -- repayments
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow select on repayments' AND tablename = 'repayments') THEN
        DROP POLICY "Allow select on repayments" ON public.repayments;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow insert on repayments' AND tablename = 'repayments') THEN
        DROP POLICY "Allow insert on repayments" ON public.repayments;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow update on repayments' AND tablename = 'repayments') THEN
        DROP POLICY "Allow update on repayments" ON public.repayments;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow delete on repayments' AND tablename = 'repayments') THEN
        DROP POLICY "Allow delete on repayments" ON public.repayments;
    END IF;
END $$;

-- Recreate policies
CREATE POLICY "Allow individual read access" ON public.expense_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow individual insert access" ON public.expense_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow individual update access" ON public.expense_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Allow individual delete access" ON public.expense_events FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Allow select on participants" ON public.expense_participants FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.expense_events e WHERE e.id = event_id AND e.user_id = auth.uid())
);
CREATE POLICY "Allow insert on participants" ON public.expense_participants FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.expense_events e WHERE e.id = event_id AND e.user_id = auth.uid())
);
CREATE POLICY "Allow update on participants" ON public.expense_participants FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.expense_events e WHERE e.id = event_id AND e.user_id = auth.uid())
);
CREATE POLICY "Allow delete on participants" ON public.expense_participants FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.expense_events e WHERE e.id = event_id AND e.user_id = auth.uid())
);

CREATE POLICY "Allow select on splits" ON public.expense_splits FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.expense_events e WHERE e.id = event_id AND e.user_id = auth.uid())
);
CREATE POLICY "Allow insert on splits" ON public.expense_splits FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.expense_events e WHERE e.id = event_id AND e.user_id = auth.uid())
);
CREATE POLICY "Allow update on splits" ON public.expense_splits FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.expense_events e WHERE e.id = event_id AND e.user_id = auth.uid())
);
CREATE POLICY "Allow delete on splits" ON public.expense_splits FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.expense_events e WHERE e.id = event_id AND e.user_id = auth.uid())
);

CREATE POLICY "Allow select on repayments" ON public.repayments FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.expense_events e WHERE e.id = event_id AND e.user_id = auth.uid())
);
CREATE POLICY "Allow insert on repayments" ON public.repayments FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.expense_events e WHERE e.id = event_id AND e.user_id = auth.uid())
);
CREATE POLICY "Allow update on repayments" ON public.repayments FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.expense_events e WHERE e.id = event_id AND e.user_id = auth.uid())
);
CREATE POLICY "Allow delete on repayments" ON public.repayments FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.expense_events e WHERE e.id = event_id AND e.user_id = auth.uid())
);
