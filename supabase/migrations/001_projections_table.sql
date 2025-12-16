-- =====================================================
-- PROJECTIONS WIDGET - DATABASE SETUP
-- Run this in Supabase SQL Editor
-- =====================================================

-- 0. Drop existing functions if they exist (to allow recreation)
DROP FUNCTION IF EXISTS fn_generate_projection(UUID);
DROP FUNCTION IF EXISTS fn_generate_all_projections();

-- 1. Create projections_12m table
CREATE TABLE IF NOT EXISTS projections_12m (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) NOT NULL,
    month DATE NOT NULL,
    projected_revenue NUMERIC,
    projected_expenses NUMERIC,
    projected_cash_flow NUMERIC,
    projected_net_profit NUMERIC,
    seasonality_factor NUMERIC DEFAULT 1.0,
    recurring_expenses_flagged JSONB DEFAULT '[]'::jsonb,
    confidence_score NUMERIC DEFAULT 0.5,
    generated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(company_id, month)
);

-- 2. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_projections_company_month 
ON projections_12m(company_id, month);

-- 3. Enable RLS
ALTER TABLE projections_12m ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy - users can read their company's projections
CREATE POLICY "Users can view their company projections" 
ON projections_12m FOR SELECT 
USING (true);

-- =====================================================
-- PROJECTION GENERATION FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION fn_generate_projection(p_company_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_month_data RECORD;
    v_seasonality RECORD;
    v_last_revenue NUMERIC;
    v_last_expenses NUMERIC;
    v_last_cash_flow NUMERIC;
    v_last_net_profit NUMERIC;
    v_yoy_growth NUMERIC := 0.05; -- Default 5% YoY growth
    v_projection_month DATE;
    v_seasonality_factor NUMERIC;
    v_recurring_expenses JSONB;
BEGIN
    -- Get the last known values
    SELECT 
        COALESCE(revenue, 0),
        COALESCE(expenses, 0),
        COALESCE(revenue - expenses - cogs, 0)
    INTO v_last_revenue, v_last_expenses, v_last_net_profit
    FROM monthly_pl
    WHERE company_id = p_company_id
    ORDER BY month DESC
    LIMIT 1;

    -- Get last cash flow
    SELECT COALESCE(inflows - outflows, 0)
    INTO v_last_cash_flow
    FROM monthly_cash_flow
    WHERE company_id = p_company_id
    ORDER BY month DESC
    LIMIT 1;

    -- Calculate YoY growth from historical data
    WITH yearly_totals AS (
        SELECT 
            EXTRACT(YEAR FROM month) as year,
            SUM(revenue) as total_revenue
        FROM monthly_pl
        WHERE company_id = p_company_id
        GROUP BY EXTRACT(YEAR FROM month)
        ORDER BY year DESC
        LIMIT 2
    )
    SELECT 
        CASE 
            WHEN COUNT(*) = 2 THEN 
                (MAX(CASE WHEN year = (SELECT MAX(year) FROM yearly_totals) THEN total_revenue END) -
                 MAX(CASE WHEN year = (SELECT MIN(year) FROM yearly_totals) THEN total_revenue END)) /
                NULLIF(MAX(CASE WHEN year = (SELECT MIN(year) FROM yearly_totals) THEN total_revenue END), 0)
            ELSE 0.05
        END
    INTO v_yoy_growth
    FROM yearly_totals;

    -- Cap growth rate between -20% and +50%
    v_yoy_growth := GREATEST(-0.20, LEAST(0.50, COALESCE(v_yoy_growth, 0.05)));

    -- Delete existing projections for this company
    DELETE FROM projections_12m WHERE company_id = p_company_id;

    -- Generate 12 months of projections
    FOR i IN 1..12 LOOP
        v_projection_month := DATE_TRUNC('month', CURRENT_DATE) + (i || ' months')::INTERVAL;
        
        -- Calculate seasonality factor based on historical month patterns
        SELECT COALESCE(
            (SELECT AVG(revenue) / NULLIF(
                (SELECT AVG(revenue) FROM monthly_pl WHERE company_id = p_company_id), 0
            )
            FROM monthly_pl 
            WHERE company_id = p_company_id 
            AND EXTRACT(MONTH FROM month) = EXTRACT(MONTH FROM v_projection_month)),
            1.0
        ) INTO v_seasonality_factor;

        -- Check for recurring expenses in this month
        SELECT COALESCE(
            jsonb_agg(jsonb_build_object(
                'description', description,
                'amount', ABS(amount),
                'expected_date', v_projection_month
            )),
            '[]'::jsonb
        )
        INTO v_recurring_expenses
        FROM raw_transactions
        WHERE company_id = p_company_id
        AND ABS(amount) > 2000
        AND EXTRACT(MONTH FROM transaction_date) = EXTRACT(MONTH FROM v_projection_month)
        AND transaction_date >= CURRENT_DATE - INTERVAL '24 months';

        -- Insert projection
        INSERT INTO projections_12m (
            company_id,
            month,
            projected_revenue,
            projected_expenses,
            projected_cash_flow,
            projected_net_profit,
            seasonality_factor,
            recurring_expenses_flagged,
            confidence_score
        ) VALUES (
            p_company_id,
            v_projection_month,
            v_last_revenue * POWER(1 + v_yoy_growth/12, i) * v_seasonality_factor,
            v_last_expenses * POWER(1 + v_yoy_growth/12, i) * v_seasonality_factor,
            v_last_cash_flow * POWER(1 + v_yoy_growth/12, i) * v_seasonality_factor,
            v_last_net_profit * POWER(1 + v_yoy_growth/12, i) * v_seasonality_factor,
            v_seasonality_factor,
            v_recurring_expenses,
            CASE 
                WHEN (SELECT COUNT(*) FROM monthly_pl WHERE company_id = p_company_id) >= 24 THEN 0.9
                WHEN (SELECT COUNT(*) FROM monthly_pl WHERE company_id = p_company_id) >= 12 THEN 0.7
                ELSE 0.5
            END
        )
        ON CONFLICT (company_id, month) 
        DO UPDATE SET
            projected_revenue = EXCLUDED.projected_revenue,
            projected_expenses = EXCLUDED.projected_expenses,
            projected_cash_flow = EXCLUDED.projected_cash_flow,
            projected_net_profit = EXCLUDED.projected_net_profit,
            seasonality_factor = EXCLUDED.seasonality_factor,
            recurring_expenses_flagged = EXCLUDED.recurring_expenses_flagged,
            confidence_score = EXCLUDED.confidence_score,
            generated_at = NOW();
    END LOOP;
END;
$$;

-- =====================================================
-- HELPER: Generate projections for all companies
-- =====================================================

CREATE OR REPLACE FUNCTION fn_generate_all_projections()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_company RECORD;
BEGIN
    FOR v_company IN SELECT id FROM companies WHERE is_active = true LOOP
        PERFORM fn_generate_projection(v_company.id);
    END LOOP;
END;
$$;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT SELECT ON projections_12m TO authenticated;
GRANT SELECT ON projections_12m TO anon;

