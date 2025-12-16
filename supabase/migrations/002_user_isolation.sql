-- =====================================================
-- USER ISOLATION MIGRATION
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. ADD user_id TO companies
-- =====================================================
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id);

-- =====================================================
-- 2. ADD user_id TO qbo_connections
-- =====================================================
ALTER TABLE qbo_connections 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_qbo_connections_user_id ON qbo_connections(user_id);

-- =====================================================
-- 3. ENABLE RLS ON ALL TABLES
-- =====================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE qbo_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_pl ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Check if raw_transactions exists before enabling RLS
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'raw_transactions') THEN
        ALTER TABLE raw_transactions ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- =====================================================
-- 4. DROP EXISTING POLICIES (clean slate)
-- =====================================================
DROP POLICY IF EXISTS "Users can view own companies" ON companies;
DROP POLICY IF EXISTS "Users can insert own companies" ON companies;
DROP POLICY IF EXISTS "Users can update own companies" ON companies;
DROP POLICY IF EXISTS "Service role full access companies" ON companies;

DROP POLICY IF EXISTS "Users can view own connections" ON qbo_connections;
DROP POLICY IF EXISTS "Users can insert own connections" ON qbo_connections;
DROP POLICY IF EXISTS "Users can update own connections" ON qbo_connections;
DROP POLICY IF EXISTS "Users can delete own connections" ON qbo_connections;
DROP POLICY IF EXISTS "Service role full access connections" ON qbo_connections;

DROP POLICY IF EXISTS "Users can view own monthly_pl" ON monthly_pl;
DROP POLICY IF EXISTS "Service role full access monthly_pl" ON monthly_pl;

DROP POLICY IF EXISTS "Users can view own accounts" ON accounts;
DROP POLICY IF EXISTS "Service role full access accounts" ON accounts;

-- =====================================================
-- 5. CREATE RLS POLICIES FOR companies
-- =====================================================
-- Users can read their own companies
CREATE POLICY "Users can view own companies" ON companies
FOR SELECT USING (user_id = auth.uid());

-- Users can create companies (user_id must match their own)
CREATE POLICY "Users can insert own companies" ON companies
FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own companies
CREATE POLICY "Users can update own companies" ON companies
FOR UPDATE USING (user_id = auth.uid());

-- Service role (Pipedream) can do everything
CREATE POLICY "Service role full access companies" ON companies
FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- 6. CREATE RLS POLICIES FOR qbo_connections
-- =====================================================
CREATE POLICY "Users can view own connections" ON qbo_connections
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own connections" ON qbo_connections
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own connections" ON qbo_connections
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own connections" ON qbo_connections
FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Service role full access connections" ON qbo_connections
FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- 7. CREATE RLS POLICIES FOR monthly_pl
-- (Users can read data for companies they own)
-- =====================================================
CREATE POLICY "Users can view own monthly_pl" ON monthly_pl
FOR SELECT USING (
    company_id IN (
        SELECT id FROM companies WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Service role full access monthly_pl" ON monthly_pl
FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- 8. CREATE RLS POLICIES FOR accounts
-- =====================================================
CREATE POLICY "Users can view own accounts" ON accounts
FOR SELECT USING (
    company_id IN (
        SELECT id FROM companies WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Service role full access accounts" ON accounts
FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- 9. CREATE RLS POLICIES FOR raw_transactions (if exists)
-- =====================================================
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'raw_transactions') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users can view own transactions" ON raw_transactions';
        EXECUTE 'DROP POLICY IF EXISTS "Service role full access transactions" ON raw_transactions';
        
        EXECUTE 'CREATE POLICY "Users can view own transactions" ON raw_transactions
            FOR SELECT USING (
                company_id IN (
                    SELECT id FROM companies WHERE user_id = auth.uid()
                )
            )';
        
        EXECUTE 'CREATE POLICY "Service role full access transactions" ON raw_transactions
            FOR ALL USING (auth.role() = ''service_role'')';
    END IF;
END $$;

-- =====================================================
-- 10. CREATE sync_status TABLE (for tracking syncs)
-- =====================================================
CREATE TABLE IF NOT EXISTS sync_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES qbo_connections(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL, -- 'initial', 'incremental', 'full'
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    records_synced INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_status_connection ON sync_status(connection_id);
CREATE INDEX IF NOT EXISTS idx_sync_status_status ON sync_status(status);

ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync_status" ON sync_status
FOR SELECT USING (
    connection_id IN (
        SELECT id FROM qbo_connections WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Service role full access sync_status" ON sync_status
FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- 11. GRANT PERMISSIONS
-- =====================================================
GRANT SELECT, INSERT, UPDATE ON companies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON qbo_connections TO authenticated;
GRANT SELECT ON monthly_pl TO authenticated;
GRANT SELECT ON accounts TO authenticated;
GRANT SELECT ON sync_status TO authenticated;

-- Service role gets everything
GRANT ALL ON companies TO service_role;
GRANT ALL ON qbo_connections TO service_role;
GRANT ALL ON monthly_pl TO service_role;
GRANT ALL ON accounts TO service_role;
GRANT ALL ON sync_status TO service_role;

-- Grant on raw_transactions if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'raw_transactions') THEN
        EXECUTE 'GRANT SELECT ON raw_transactions TO authenticated';
        EXECUTE 'GRANT ALL ON raw_transactions TO service_role';
    END IF;
END $$;

-- =====================================================
-- DONE! Next: Update OAuth callbacks to store user_id
-- =====================================================

