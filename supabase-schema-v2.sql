-- Oracle Dashboard Supabase Schema v2
-- Enhanced with Projects, Invoices, Clients, Payments, Time Entries
-- Run this in your Supabase SQL Editor
-- ============================================================

-- PROJECTS TABLE
-- Track all projects with income
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    client_id UUID,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active', -- active, completed, paused, cancelled
    hourly_rate DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    budget DECIMAL(12,2),
    start_date DATE,
    end_date DATE,
    source VARCHAR(50) DEFAULT 'direct', -- upwork, direct, referral
    upwork_contract_id VARCHAR(100),
    color VARCHAR(7) DEFAULT '#18181B', -- hex color for UI
    total_hours DECIMAL(10,2) DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CLIENTS TABLE
-- Store client information
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    vat_number VARCHAR(100),
    country VARCHAR(100),
    currency VARCHAR(3) DEFAULT 'USD',
    payment_terms INTEGER DEFAULT 7, -- days
    notes TEXT,
    total_invoiced DECIMAL(12,2) DEFAULT 0,
    total_paid DECIMAL(12,2) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INVOICES TABLE
-- Store all invoices
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    invoice_number VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    due_date DATE,
    status VARCHAR(20) DEFAULT 'draft', -- draft, pending, sent, paid, overdue, cancelled
    currency VARCHAR(3) DEFAULT 'USD',
    exchange_rate DECIMAL(10,4) DEFAULT 1,
    subtotal DECIMAL(12,2) DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) DEFAULT 0,
    zar_total DECIMAL(12,2) DEFAULT 0,
    line_items JSONB DEFAULT '[]', -- [{description, qty, unitPrice, isHours}]
    remarks TEXT,
    payment_method VARCHAR(50), -- yoco, wise, bank, paypal
    payment_link TEXT,
    paid_at TIMESTAMPTZ,
    paid_amount DECIMAL(12,2),
    yoco_checkout_id VARCHAR(100),
    wise_transfer_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PAYMENTS TABLE
-- Track all payments received
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'ZAR',
    original_amount DECIMAL(12,2),
    original_currency VARCHAR(3),
    exchange_rate DECIMAL(10,4),
    payment_method VARCHAR(50), -- yoco, wise, bank, paypal, upwork
    reference VARCHAR(255),
    description TEXT,
    status VARCHAR(20) DEFAULT 'completed', -- pending, completed, failed, refunded
    paid_at TIMESTAMPTZ DEFAULT NOW(),
    fees DECIMAL(10,2) DEFAULT 0, -- payment processor fees
    net_amount DECIMAL(12,2), -- amount after fees
    bank_reference VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TIME ENTRIES TABLE
-- Track time worked on projects
-- ============================================================
CREATE TABLE IF NOT EXISTS time_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    description TEXT,
    duration INTEGER NOT NULL, -- seconds
    hourly_rate DECIMAL(10,2),
    billable BOOLEAN DEFAULT true,
    billed BOOLEAN DEFAULT false,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    date DATE DEFAULT CURRENT_DATE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BANK TRANSACTIONS TABLE (enhanced)
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    description TEXT,
    amount DECIMAL(12,2) NOT NULL,
    source VARCHAR(50) DEFAULT 'unknown', -- upwork, exergy, personal, bank
    type VARCHAR(20) DEFAULT 'unknown', -- income, expense, transfer
    category VARCHAR(50),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    currency VARCHAR(3) DEFAULT 'ZAR',
    original_amount DECIMAL(12,2),
    original_currency VARCHAR(3),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- USER SETTINGS TABLE (enhanced)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    clickup_api_key TEXT,
    fireflies_api_key TEXT,
    claude_api_key TEXT,
    yoco_api_key TEXT,
    yoco_secret_key TEXT,
    wise_api_key TEXT,
    invoice_prefix VARCHAR(20) DEFAULT 'INV',
    default_currency VARCHAR(3) DEFAULT 'USD',
    default_exchange_rate DECIMAL(10,4) DEFAULT 18.5,
    default_payment_terms INTEGER DEFAULT 7,
    default_hourly_rate DECIMAL(10,2) DEFAULT 64,
    business_name VARCHAR(255) DEFAULT 'Exergy Designs',
    business_address TEXT,
    business_email VARCHAR(255),
    business_phone VARCHAR(50),
    business_vat VARCHAR(50),
    business_bank_details TEXT,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON projects FOR DELETE USING (auth.uid() = user_id);

-- Clients policies
CREATE POLICY "Users can view own clients" ON clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own clients" ON clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clients" ON clients FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own clients" ON clients FOR DELETE USING (auth.uid() = user_id);

-- Invoices policies
CREATE POLICY "Users can view own invoices" ON invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own invoices" ON invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own invoices" ON invoices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own invoices" ON invoices FOR DELETE USING (auth.uid() = user_id);

-- Payments policies
CREATE POLICY "Users can view own payments" ON payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payments" ON payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own payments" ON payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own payments" ON payments FOR DELETE USING (auth.uid() = user_id);

-- Time entries policies
CREATE POLICY "Users can view own time_entries" ON time_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own time_entries" ON time_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own time_entries" ON time_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own time_entries" ON time_entries FOR DELETE USING (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON transactions FOR DELETE USING (auth.uid() = user_id);

-- Settings policies
CREATE POLICY "Users can view own settings" ON user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON user_settings FOR UPDATE USING (auth.uid() = user_id);

-- MEETINGS TABLE (Fireflies sync)
-- ============================================================
CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(500),
    date TIMESTAMPTZ,
    duration INTEGER DEFAULT 0, -- seconds
    participants JSONB DEFAULT '[]',
    summary_overview TEXT,
    summary_action_items TEXT,
    summary_keywords JSONB DEFAULT '[]',
    meeting_type VARCHAR(20) DEFAULT 'client', -- client, team
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ALLOCATIONS TABLE (Team project assignments)
-- ============================================================
CREATE TABLE IF NOT EXISTS allocations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    team_member_id VARCHAR(100) NOT NULL,
    team_member_name VARCHAR(255),
    project_name VARCHAR(255),
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    hours_per_week INTEGER DEFAULT 10,
    hourly_rate DECIMAL(10,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'active', -- active, paused, inactive
    weekly_estimate DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for meetings
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own meetings" ON meetings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meetings" ON meetings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meetings" ON meetings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meetings" ON meetings FOR DELETE USING (auth.uid() = user_id);

-- RLS for allocations
ALTER TABLE allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own allocations" ON allocations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own allocations" ON allocations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own allocations" ON allocations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own allocations" ON allocations FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_clients_user ON clients(user_id);
CREATE INDEX idx_invoices_user_date ON invoices(user_id, date DESC);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_date ON payments(paid_at DESC);
CREATE INDEX idx_time_entries_user ON time_entries(user_id);
CREATE INDEX idx_time_entries_project ON time_entries(project_id);
CREATE INDEX idx_time_entries_date ON time_entries(date DESC);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_meetings_user ON meetings(user_id);
CREATE INDEX idx_meetings_date ON meetings(date DESC);
CREATE INDEX idx_allocations_user ON allocations(user_id);
CREATE INDEX idx_allocations_member ON allocations(team_member_id);

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON meetings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_allocations_updated_at BEFORE UPDATE ON allocations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Update project totals when time entry is added
CREATE OR REPLACE FUNCTION update_project_totals()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE projects SET
            total_hours = (SELECT COALESCE(SUM(duration) / 3600.0, 0) FROM time_entries WHERE project_id = NEW.project_id),
            updated_at = NOW()
        WHERE id = NEW.project_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE projects SET
            total_hours = (SELECT COALESCE(SUM(duration) / 3600.0, 0) FROM time_entries WHERE project_id = OLD.project_id),
            updated_at = NOW()
        WHERE id = OLD.project_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_totals
AFTER INSERT OR UPDATE OR DELETE ON time_entries
FOR EACH ROW EXECUTE FUNCTION update_project_totals();

-- Update client totals when invoice is added/updated
CREATE OR REPLACE FUNCTION update_client_totals()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE clients SET
            total_invoiced = (SELECT COALESCE(SUM(zar_total), 0) FROM invoices WHERE client_id = NEW.client_id),
            total_paid = (SELECT COALESCE(SUM(zar_total), 0) FROM invoices WHERE client_id = NEW.client_id AND status = 'paid'),
            updated_at = NOW()
        WHERE id = NEW.client_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE clients SET
            total_invoiced = (SELECT COALESCE(SUM(zar_total), 0) FROM invoices WHERE client_id = OLD.client_id),
            total_paid = (SELECT COALESCE(SUM(zar_total), 0) FROM invoices WHERE client_id = OLD.client_id AND status = 'paid'),
            updated_at = NOW()
        WHERE id = OLD.client_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_client_totals
AFTER INSERT OR UPDATE OR DELETE ON invoices
FOR EACH ROW EXECUTE FUNCTION update_client_totals();
