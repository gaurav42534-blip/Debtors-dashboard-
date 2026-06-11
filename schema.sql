-- Run this inside the Supabase SQL Editor

-- 1. Create Debtors table
CREATE TABLE public.debtors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  limit_amount NUMERIC DEFAULT 0,
  default_terms INTEGER DEFAULT 15,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Transactions table
CREATE TABLE public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  debtor_id UUID REFERENCES public.debtors(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sale', 'payment')),
  amount NUMERIC NOT NULL,
  ref_note TEXT,
  transaction_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.debtors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 4. Create Security Policies
-- Users can only see and manage their own debtors
CREATE POLICY "Users can manage their own debtors" 
ON public.debtors
FOR ALL USING (auth.uid() = user_id);

-- Users can only see and manage transactions for their own debtors
CREATE POLICY "Users can manage their own debtor transactions" 
ON public.transactions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.debtors 
    WHERE debtors.id = transactions.debtor_id 
    AND debtors.user_id = auth.uid()
  )
);
